"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/messages";
import { CATS, categorize, OTHER } from "@/lib/categories";
import "./inventory.css";

type Prod = { name: string; unit: string | null; barcode: string | null; category: string | null; image_url: string | null };
type Row = { product_id: string; price: number; buy_price: number | null; stock: number; is_available: boolean; expiry_date: string | null; products: Prod };
type Rate = { category: string; rate: number };
type Known = { source: "mine" | "catalog" | "off" | "new"; image: string | null; locked: boolean };

const CAT_OPTIONS = CATS.filter((c) => c.enabled).map((c) => c.name);
const empty = { name: "", unit: "", category: "", buy: "", price: "", stock: "", expiry: "" };
const LOW_STOCK = 5;
const rupee = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

// ---- icons ----
const sv = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: "false" } as const;
const CameraIcon = () => (<svg {...sv}><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13" r="3.5" /></svg>);
const ImagePlusIcon = () => (<svg {...sv} width={22} height={22}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="M21 16l-5-5-8 8" /></svg>);

// ---- margin ----
function profit(buy: number | null, sale: number, cat: string | null, rates: Rate[]) {
  if (buy == null || !(sale > 0)) return null;
  const m = sale - buy;
  const r = rates.find((x) => x.category.toLowerCase() === (cat || "").toLowerCase());
  const rate = r ? Number(r.rate) : null;
  return { m, pct: (m / sale) * 100, rate, net: rate == null ? null : m - (sale * rate) / 100 };
}
function Margin({ buy, sale, cat, qty, rates }: { buy: number | null; sale: number; cat: string | null; qty: number; rates: Rate[] }) {
  const p = profit(buy, sale, cat, rates);
  if (!p) return <div className="inv-m none">{buy == null ? "Add the buy price to see margin" : "Enter the sale price"}</div>;
  const real = p.net ?? p.m;
  return (<div className={"inv-m" + (real < 0 ? " neg" : "")}>
    <b>Margin {rupee(p.m)} ({p.pct.toFixed(0)}%)</b>
    {p.rate != null && p.rate > 0 && <small>You keep <strong>{rupee(p.net as number)}</strong> after {p.rate}% commission</small>}
    {p.rate === 0 && <small>Commission not set for this category</small>}
    {qty > 0 && <small>{rupee(real * qty)} profit on {qty} in stock</small>}
    {real < 0 && <small className="warn">You are selling below cost</small>}
  </div>);
}

// ---- expiry ----
function expiryInfo(d: string | null): { text: string; cls: string } | null {
  if (!d) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((new Date(d + "T00:00:00").getTime() - today.getTime()) / 86400000);
  if (days < 0) return { text: "Expired", cls: "gone" };
  if (days === 0) return { text: "Expires today", cls: "soon" };
  if (days <= 7) return { text: `Expires in ${days} day${days > 1 ? "s" : ""}`, cls: "soon" };
  return null;
}

// ---- photos: shrink to 800px and upload ----
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Could not read this image"))), "image/webp", 0.82));
}
async function uploadPhoto(file: File): Promise<string> {
  const blob = await shrink(file);
  const path = `${crypto.randomUUID()}.${blob.type === "image/png" ? "png" : "webp"}`;
  const { error } = await supabase.storage.from("products").upload(path, blob, { contentType: blob.type });
  if (error) throw new Error(error.message);
  return supabase.storage.from("products").getPublicUrl(path).data.publicUrl;
}

export default function Inventory() {
  const [rows, setRows] = useState<Row[]>([]);
  const [rates, setRates] = useState<Rate[]>([]);
  const [q, setQ] = useState("");
  const [barcode, setBarcode] = useState("");
  const [f, setF] = useState(empty);
  const [known, setKnown] = useState<Known | null>(null);
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);

  const say = (text: string, ok = true) => setToast({ text, ok });
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4500); return () => clearTimeout(t); }, [toast]);
  useEffect(() => {
    if (!imgFile) { setPreview(null); return; }
    const u = URL.createObjectURL(imgFile); setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [imgFile]);

  const load = async () => {
    const [s, c] = await Promise.all([
      supabase.from("shop_products").select("product_id,price,buy_price,stock,is_available,expiry_date,products(name,unit,barcode,category,image_url)"),
      supabase.from("category_commissions").select("category,rate"),
    ]);
    if (s.error) say(friendly(s.error.message), false); else setRows((s.data as unknown as Row[]) || []);
    if (!c.error) setRates((c.data as Rate[]) || []);
  };
  useEffect(() => {
    (async () => { await supabase.rpc("expire_stock"); load(); })();
    return stopCam;
  }, []);

  // ---- look a code up: my stock, then Quicky catalog, then Open Food Facts ----
  async function lookup(raw: string) {
    const code = raw.trim(); if (!code) return;
    setBarcode(code); setImgFile(null);
    const mine = rows.find((r) => r.products.barcode === code);
    if (mine) {
      setF({ name: mine.products.name, unit: mine.products.unit || "", category: mine.products.category || "", buy: mine.buy_price == null ? "" : String(mine.buy_price), price: String(mine.price), stock: String(mine.stock), expiry: mine.expiry_date ?? "" });
      setKnown({ source: "mine", image: mine.products.image_url, locked: true });
      say("Already in your stock. Change the numbers and press Save."); return;
    }
    const { data } = await supabase.from("products").select("name,unit,category,image_url").eq("barcode", code).maybeSingle();
    if (data) {
      setF({ ...empty, name: data.name, unit: data.unit || "", category: data.category || "" });
      setKnown({ source: "catalog", image: data.image_url, locked: true });
      say("Found in the Quicky catalog. Enter your prices and quantity."); return;
    }
    try {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,quantity,categories`);
      const j = await r.json();
      if (j.status === 1 && j.product?.product_name) {
        const cat = categorize((j.product.categories || "").split(",")[0]);
        setF({ ...empty, name: j.product.product_name, unit: j.product.quantity || "", category: cat === OTHER ? "" : cat });
        setKnown({ source: "off", image: null, locked: false });
        say("Found on Open Food Facts. Check the details and pick a category."); return;
      }
    } catch {}
    setF(empty); setKnown({ source: "new", image: null, locked: false });
    say("New product. Enter the name, unit, category and your numbers.");
  }

  function clear() { setBarcode(""); setF(empty); setKnown(null); setImgFile(null); }

  async function save() {
    const price = Number(f.price), stock = Number(f.stock);
    if (!barcode.trim()) return say("Scan or type a barcode / QR code first.", false);
    if (!f.name.trim()) return say("Enter the product name.", false);
    if (!f.category.trim() && !known?.locked) return say("Pick a category.", false);
    if (!(price > 0)) return say("Enter the sale price.", false);
    if (f.stock === "" || !(stock >= 0)) return say("Enter the quantity.", false);
    if (f.buy !== "" && !(Number(f.buy) >= 0)) return say("Check the buy price.", false);
    setBusy(true);
    try {
      const url = imgFile ? await uploadPhoto(imgFile) : null;
      const { error } = await supabase.rpc("add_shop_product", {
        p_barcode: barcode.trim(), p_name: f.name.trim(), p_unit: f.unit, p_category: f.category,
        p_price: price, p_stock: Math.floor(stock),
        p_buy_price: f.buy === "" ? null : Number(f.buy), p_expiry: f.expiry || null, p_image_url: url,
      });
      if (error) { say(friendly(error.message), false); setBusy(false); return; }
      if (url && known?.image) { // the product already had a photo: replace it with the new one
        const { data: pr } = await supabase.from("products").select("id").eq("barcode", barcode.trim()).maybeSingle();
        if (pr) {
          const { error: e2 } = await supabase.rpc("set_product_image", { p_product: pr.id, p_url: url });
          if (e2) { say("Saved, but the photo could not be replaced: " + friendly(e2.message), false); setBusy(false); clear(); load(); return; }
        }
      }
    } catch (e) { say(e instanceof Error ? e.message : "Could not upload the photo", false); setBusy(false); return; }
    setBusy(false); say("Saved."); clear(); load();
  }

  // ---- edit a row in my stock ----
  async function update(r: Row, patch: Record<string, unknown>) {
    const { error } = await supabase.from("shop_products").update(patch).eq("product_id", r.product_id);
    if (error) say(friendly(error.message), false); else load();
  }
  function setStock(r: Row, v: string) {
    const n = Math.max(0, Math.floor(Number(v) || 0));
    if (n === r.stock) return;
    const expired = expiryInfo(r.expiry_date)?.cls === "gone";
    update(r, { stock: n, ...(n === 0 ? { is_available: false } : r.stock === 0 && !expired ? { is_available: true } : {}) });
  }
  async function remove(r: Row) {
    if (!window.confirm(`Remove "${r.products.name}" from your shop? Customers will stop seeing it from you.`)) return;
    const { error } = await supabase.from("shop_products").delete().eq("product_id", r.product_id);
    if (error) say(friendly(error.message), false); else { say("Removed."); load(); }
  }
  async function addPhoto(r: Row, file: File) {
    setBusy(true);
    try {
      const url = await uploadPhoto(file);
      const { error } = await supabase.rpc("set_product_image", { p_product: r.product_id, p_url: url });
      if (error) say(friendly(error.message), false); else { say("Photo updated."); load(); }
    } catch (e) { say(e instanceof Error ? e.message : "Could not upload the photo", false); }
    setBusy(false);
  }

  // ---- camera: barcodes and QR codes ----
  async function startCam() {
    if (!("BarcodeDetector" in window)) { say("Camera scanning is not supported in this browser. Use Chrome on Android or a computer, or type the code.", false); return; }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      videoRef.current!.srcObject = stream.current; await videoRef.current!.play(); setScanning(true);
    } catch { say("Could not open the camera. Please allow camera access.", false); return; }
    const det = new (window as any).BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "qr_code"] });
    timer.current = window.setInterval(async () => {
      try { const res = await det.detect(videoRef.current!); if (res[0]) { stopCam(); lookup(res[0].rawValue); } } catch {}
    }, 500);
  }
  function stopCam() {
    if (timer.current) clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop()); setScanning(false);
  }

  // ---- views ----
  const sorted = [...rows].sort((a, b) => a.products.name.localeCompare(b.products.name));
  const shown = sorted.filter((r) => (r.products.name + " " + (r.products.barcode || "")).toLowerCase().includes(q.trim().toLowerCase()));
  const low = rows.filter((r) => r.stock > 0 && r.stock <= LOW_STOCK).length;
  const soon = rows.filter((r) => expiryInfo(r.expiry_date)?.cls === "soon").length;
  const gone = rows.filter((r) => expiryInfo(r.expiry_date)?.cls === "gone").length;
  const heads = <div className="inv-grid inv-head" aria-hidden="true"><span /><span>Barcode / QR · Product</span><span>Buy ₹</span><span>Sale ₹</span><span>Qty</span><span>Expiry</span><span>Margin</span><span /></div>;
  const addImg = preview || known?.image || null;

  return (<div className="inv">
    {toast && <p className={"inv-toast" + (toast.ok ? "" : " bad")} role="status">{toast.text}</p>}

    <section className="inv-card">
      <h3>Add product</h3>
      <p className="inv-hint">Scan or type a barcode / QR code and press Enter. Known products fill in by themselves.</p>
      {heads}
      <div className="inv-grid inv-addrow">
        <div className="c-thumb">
          <label className={"inv-thumb" + (addImg ? " has" : "") + (preview ? " new" : "")} title={addImg ? "Click to change the photo" : "Add a photo"}>
            {addImg ? <img src={addImg} alt="Product photo" /> : <ImagePlusIcon />}
            {addImg && <span className="ov"><CameraIcon /></span>}
            <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) setImgFile(file); e.target.value = ""; }} />
          </label>
        </div>
        <div className="c-main inv-bc">
          <input autoFocus placeholder="Barcode or QR code" aria-label="Barcode or QR code" value={barcode}
            onChange={(e) => setBarcode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookup(barcode)} />
          <button type="button" className={"inv-cam" + (scanning ? " on" : "")} aria-label={scanning ? "Close camera" : "Scan with camera"} title={scanning ? "Close camera" : "Scan with camera"} onClick={scanning ? stopCam : startCam}><CameraIcon /></button>
        </div>
        <label className="inv-f c-buy"><span>Buy price ₹</span><input placeholder="Buy ₹" inputMode="decimal" aria-label="Buy price" value={f.buy} onChange={(e) => setF({ ...f, buy: e.target.value })} /></label>
        <label className="inv-f c-sale"><span>Sale price ₹</span><input placeholder="Sale ₹" inputMode="decimal" aria-label="Sale price" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></label>
        <label className="inv-f c-qty"><span>Quantity</span><input placeholder="Qty" inputMode="numeric" aria-label="Quantity" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} /></label>
        <label className="inv-f c-exp"><span>Expiry date</span><input type="date" aria-label="Expiry date" value={f.expiry} onChange={(e) => setF({ ...f, expiry: e.target.value })} /></label>
        <div className="c-margin"><Margin buy={f.buy === "" ? null : Number(f.buy)} sale={Number(f.price)} cat={f.category} qty={Number(f.stock) || 0} rates={rates} /></div>
        <div className="c-act inv-act">
          <button onClick={save} disabled={busy}>{busy ? "Saving..." : known?.source === "mine" ? "Save" : "Add"}</button>
          <button className="alt" onClick={clear} disabled={busy}>Remove</button>
        </div>
      </div>

      {barcode && known && (known.locked
        ? <p className="inv-found" style={{ marginTop: 10 }}><b>{f.name}</b>{f.unit ? ` · ${f.unit}` : ""}{f.category ? ` · ${f.category}` : ""}</p>
        : <div className="inv-meta">
            <label className="inv-f"><span>Product name</span><input placeholder="Product name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
            <label className="inv-f"><span>Unit</span><input placeholder="Unit (e.g. 500 g)" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></label>
            <label className="inv-f"><span>Category</span>
              <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
                <option value="">Pick a category</option>
                {CAT_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select></label>
          </div>)}
      <video ref={videoRef} className={"inv-video" + (scanning ? " on" : "")} playsInline muted />
    </section>

    <section className="inv-card">
      <div className="inv-bar">
        <h3>My stock ({rows.length})</h3>
        <input type="search" placeholder="Search by name or barcode" aria-label="Search my stock" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <p className="inv-stats">{low} low stock · {soon} expiring within 7 days · {gone} expired</p>
      {heads}
      {shown.length === 0
        ? <p className="inv-empty">{rows.length === 0 ? "No products yet. Add your first product above." : "No product matches your search."}</p>
        : shown.map((r) => {
          const ex = expiryInfo(r.expiry_date);
          return (<div className="inv-grid inv-row" key={r.product_id}>
            <div className="c-thumb">
              <label className={"inv-thumb" + (r.products.image_url ? " has" : "")} title={r.products.image_url ? "Click to change the photo" : "Add a photo"}>
                {r.products.image_url ? <img src={r.products.image_url} alt={r.products.name} /> : <ImagePlusIcon />}
                {r.products.image_url && <span className="ov"><CameraIcon /></span>}
                <input type="file" accept="image/*" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) addPhoto(r, file); e.target.value = ""; }} />
              </label>
            </div>
            <div className="c-main">
              <span className="inv-name">{r.products.name}</span>
              <span className="inv-sub">{[r.products.unit, r.products.barcode, r.products.category].filter(Boolean).join(" · ")}</span>
              {!r.is_available && <span className="inv-badge off">Not on sale</span>}
              {r.stock > 0 && r.stock <= LOW_STOCK && <span className="inv-badge">Low stock</span>}
            </div>
            <label className="inv-f c-buy"><span>Buy price ₹</span>
              <input key={"b" + r.buy_price} defaultValue={r.buy_price ?? ""} inputMode="decimal" aria-label="Buy price" placeholder="Buy ₹"
                onBlur={(e) => { const v = e.target.value.trim(); const n = v === "" ? null : Number(v); if (n !== r.buy_price && (n === null || n >= 0)) update(r, { buy_price: n }); }} /></label>
            <label className="inv-f c-sale"><span>Sale price ₹</span>
              <input key={"p" + r.price} defaultValue={r.price} inputMode="decimal" aria-label="Sale price"
                onBlur={(e) => { const n = Number(e.target.value); if (n > 0 && n !== r.price) update(r, { price: n }); }} /></label>
            <label className="inv-f c-qty"><span>Quantity</span>
              <input key={"s" + r.stock} defaultValue={r.stock} inputMode="numeric" aria-label="Quantity" className={r.stock <= LOW_STOCK ? "inv-low" : ""}
                onBlur={(e) => setStock(r, e.target.value)} /></label>
            <label className="inv-f c-exp"><span>Expiry date</span>
              <input key={"e" + r.expiry_date} type="date" defaultValue={r.expiry_date ?? ""} aria-label="Expiry date"
                onBlur={(e) => { const v = e.target.value || null; if (v !== r.expiry_date) update(r, { expiry_date: v, ...(v && v < new Date().toISOString().slice(0, 10) ? { is_available: false } : {}) }); }} />
              {ex && <span className={"inv-exp " + ex.cls}>{ex.text}</span>}</label>
            <div className="c-margin"><Margin buy={r.buy_price} sale={r.price} cat={r.products.category} qty={r.stock} rates={rates} /></div>
            <div className="c-act inv-act">
              <label className="inv-onsale"><input type="checkbox" className="inv-sw" checked={r.is_available} onChange={(e) => update(r, { is_available: e.target.checked })} /> On sale</label>
              <button className="danger" onClick={() => remove(r)}>Remove</button>
            </div>
          </div>);
        })}
    </section>
  </div>);
}
