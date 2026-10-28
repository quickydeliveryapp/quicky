"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Row = { product_id: string; price: number; stock: number; is_available: boolean; products: { name: string; unit: string | null; barcode: string | null } };
const empty = { name: "", unit: "", category: "", price: "", stock: "" };

export default function Inventory() {
  const [rows, setRows] = useState<Row[]>([]);
  const [barcode, setBarcode] = useState("");
  const [f, setF] = useState(empty);
  const [msg, setMsg] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);

  const load = async () => {
    const { data, error } = await supabase.from("shop_products").select("product_id,price,stock,is_available,products(name,unit,barcode)");
    if (error) setMsg(error.message); else setRows((data as unknown as Row[]) || []);
  };
  useEffect(() => { load(); return stopCam; }, []);

  async function lookup(code: string) {
    code = code.trim(); if (!code) return;
    setBarcode(code);
    const { data } = await supabase.from("products").select("name,unit,category").eq("barcode", code).maybeSingle();
    if (data) { setF({ ...empty, name: data.name, unit: data.unit || "", category: data.category || "" }); setMsg("Catalog mein mil gaya. Price aur stock daalo."); return; }
    try {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=product_name,quantity,categories`);
      const j = await r.json();
      if (j.status === 1 && j.product?.product_name) {
        setF({ ...empty, name: j.product.product_name, unit: j.product.quantity || "", category: (j.product.categories || "").split(",")[0] });
        setMsg("Open Food Facts se mila. Naam check karo, phir price/stock daalo."); return;
      }
    } catch {}
    setF(empty); setMsg("Naya product hai. Naam, unit, price, stock khud bharo.");
  }

  async function save() {
    const { error } = await supabase.rpc("add_shop_product", {
      p_barcode: barcode, p_name: f.name, p_unit: f.unit, p_category: f.category,
      p_price: Number(f.price), p_stock: Number(f.stock) });
    if (error) { setMsg(error.message); return; }
    setMsg("Save ho gaya ✅"); setBarcode(""); setF(empty); load();
  }

  async function update(r: Row, patch: Partial<Row>) {
    const next = { price: r.price, stock: r.stock, is_available: r.is_available, ...patch };
    const { error } = await supabase.from("shop_products").update(next).eq("product_id", r.product_id);
    if (error) setMsg(error.message); else load();
  }

  async function startCam() {
    if (!("BarcodeDetector" in window)) { setMsg("Is browser mein camera scan nahi chalta. Android Chrome ya USB scanner use karo."); return; }
    stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    videoRef.current!.srcObject = stream.current; await videoRef.current!.play(); setScanning(true);
    const det = new (window as any).BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] });
    timer.current = window.setInterval(async () => {
      const res = await det.detect(videoRef.current!);
      if (res[0]) { stopCam(); lookup(res[0].rawValue); }
    }, 500);
  }
  function stopCam() {
    if (timer.current) clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop()); setScanning(false);
  }

  return (<div>
    <h3>Product add karo</h3>
    <input autoFocus placeholder="Barcode scan karo ya type karke Enter dabao" value={barcode}
      onChange={(e) => setBarcode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && lookup(barcode)} />
    <button className="alt" onClick={scanning ? stopCam : startCam}>{scanning ? "Camera band" : "📷 Camera se scan"}</button>
    <video ref={videoRef} style={{ width: "100%", display: scanning ? "block" : "none", marginTop: 8 }} playsInline muted />
    {msg && <p>{msg}</p>}
    {barcode && <div className="card">
      <input placeholder="Naam" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <input placeholder="Unit (jaise 500 g)" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} />
      <input placeholder="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
      <input placeholder="Price ₹" inputMode="decimal" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} />
      <input placeholder="Stock" inputMode="numeric" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} />
      <button onClick={save}>Save</button></div>}
    <h3>Mera stock</h3>
    {rows.map((r) => (<div className="card" key={r.product_id} style={{ marginBottom: 8 }}>
      <b>{r.products.name}</b> <small>{r.products.unit}</small>
      <div>₹ <input style={{ width: 80 }} defaultValue={r.price} onBlur={(e) => Number(e.target.value) !== r.price && update(r, { price: Number(e.target.value) })} />
        {" "}Stock <input style={{ width: 70 }} defaultValue={r.stock} onBlur={(e) => Number(e.target.value) !== r.stock && update(r, { stock: Number(e.target.value) })} /></div>
      <label><input type="checkbox" style={{ width: "auto" }} checked={r.is_available} onChange={(e) => update(r, { is_available: e.target.checked })} /> Available</label>
    </div>))}
  </div>);
}
