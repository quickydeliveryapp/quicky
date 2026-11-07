"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/messages";
import { QRCodeSVG } from "qrcode.react";
import "./shop.css";

type Item = { qty: number; product_id: string; products: { name: string; unit: string | null } | null };
type O = { id: string; status: string; total: number; address: string; pickup_token: string; created_at: string; rider_id: string | null; order_items: Item[] };
type ShopRow = { id: string; name: string; is_open: boolean; status: string };
type Stk = { stock: number; is_available: boolean; name: string };
type Col = "new" | "packing" | "ready";

const COLS = "id,status,total,address,pickup_token,created_at,rider_id,order_items(qty,product_id,products(name,unit))";
const LOW = 5;
const COL_TITLE: Record<Col, string> = { new: "New orders", packing: "To pack", ready: "Ready for pickup" };
const COL_EMPTY: Record<Col, string> = { new: "No new orders.", packing: "Nothing to pack.", ready: "Nothing waiting for a rider." };
const STATUS_LABEL: Record<string, string> = { placed: "New", accepted: "Packing", packed: "Ready", picked_up: "Picked up", delivered: "Delivered", cancelled: "Cancelled" };
const STATUS_TONE: Record<string, string> = { delivered: "ok", cancelled: "bad", picked_up: "info" };

const rupee = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const minsSince = (ts: string, now: number) => Math.max(0, Math.floor((now - new Date(ts).getTime()) / 60000));
function ago(ts: string, now: number) {
  const m = minsSince(ts, now);
  if (m < 1) return "just now";
  if (m < 60) return m + " min ago";
  const h = Math.floor(m / 60);
  return h < 24 ? h + " h ago" : new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function Shop() {
  const [live, setLive] = useState<O[]>([]);
  const [hist, setHist] = useState<O[]>([]);
  const [shop, setShop] = useState<ShopRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [stock, setStock] = useState<Record<string, Stk> | null>(null);
  const [today, setToday] = useState({ count: 0, sales: 0 });
  const [col, setCol] = useState<Col>("new");
  const [histAll, setHistAll] = useState(false);
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [sound, setSound] = useState(false);
  const [now, setNow] = useState(Date.now());
  const audio = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const [l, h, s, st, td] = await Promise.all([
      supabase.from("orders").select(COLS).in("status", ["placed", "accepted", "packed"]).order("created_at"),
      supabase.from("orders").select(COLS).in("status", ["picked_up", "delivered", "cancelled"]).order("created_at", { ascending: false }).limit(20),
      supabase.from("shops").select("id,name,is_open,status").limit(1).maybeSingle(),
      supabase.from("shop_products").select("product_id,stock,is_available,products(name)"),
      supabase.from("orders").select("items_total").eq("status", "delivered").gte("delivered_at", start.toISOString()),
    ]);
    if (l.error) setLoadErr(friendly(l.error.message)); else { setLoadErr(""); setLive((l.data as unknown as O[]) || []); }
    if (!h.error) setHist((h.data as unknown as O[]) || []);
    setShop((s.data as ShopRow) ?? null); setLoaded(true);
    if (!st.error) {
      const m: Record<string, Stk> = {};
      ((st.data as any[]) || []).forEach((r) => { m[r.product_id] = { stock: r.stock, is_available: r.is_available, name: r.products?.name ?? "Item" }; });
      setStock(m);
    }
    if (!td.error) { const d = (td.data as any[]) || []; setToday({ count: d.length, sales: d.reduce((a, r) => a + Number(r.items_total || 0), 0) }); }
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel("shop-orders").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load).subscribe();
    const poll = setInterval(load, 30000); // safety net if the live connection drops
    const tick = setInterval(() => setNow(Date.now()), 30000);
    const back = () => { if (document.visibilityState === "visible") load(); }; // coming back from the inventory page
    document.addEventListener("visibilitychange", back); window.addEventListener("focus", back);
    return () => { supabase.removeChannel(ch); clearInterval(poll); clearInterval(tick); document.removeEventListener("visibilitychange", back); window.removeEventListener("focus", back); };
  }, [load]);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4500); return () => clearTimeout(t); }, [toast]);

  const by = (st: string) => live.filter((o) => o.status === st);
  const lists: Record<Col, O[]> = { new: by("placed"), packing: by("accepted"), ready: by("packed") };
  const newCount = lists.new.length;
  const stockRows = stock ? Object.values(stock) : [];
  const out = stockRows.filter((r) => r.stock === 0);
  const low = stockRows.filter((r) => r.stock > 0 && r.stock <= LOW);

  // ---- order alert sound (browsers need one tap before they allow sound) ----
  const pendingRef = useRef(false);
  pendingRef.current = newCount > 0;
  useEffect(() => {
    const a = audio.current; if (!a) return;
    if (sound && newCount > 0) a.play().catch(() => {}); else a.pause();
  }, [sound, newCount]);
  function toggleSound() {
    const a = audio.current;
    if (sound) { setSound(false); a?.pause(); return; }
    setSound(true);
    a?.play().then(() => { if (!pendingRef.current) a.pause(); }).catch(() => {});
  }
  useEffect(() => {
    const prev = document.title;
    if (newCount > 0) document.title = `(${newCount}) New order | Quicky`;
    return () => { document.title = prev; };
  }, [newCount]);

  // ---- stock check: an order can only be accepted when every item is on sale and in stock ----
  function shortages(o: O) {
    if (!stock) return [];
    return o.order_items.flatMap((it) => {
      const s = stock[it.product_id];
      const have = s && s.is_available ? s.stock : 0;
      return have < it.qty ? [{ name: it.products?.name ?? "Item", need: it.qty, have, off: !!s && !s.is_available && s.stock > 0 }] : [];
    });
  }

  // ---- actions ----
  const say = (text: string, ok = true) => setToast({ text, ok });
  async function setStatus(id: string, status: string) {
    const { data, error } = await supabase.from("orders").update({ status }).eq("id", id).select("id");
    if (error) say(friendly(error.message), false);
    else if (!data?.length) say("Update failed: you don't have permission for this order", false);
    load();
  }
  async function reject(id: string) {
    if (!window.confirm("Reject this order? It will go to the next nearest shop.")) return;
    const { error } = await supabase.rpc("reject_order", { p_order_id: id });
    if (error) say(friendly(error.message), false); else say("Order rejected.");
    load();
  }
  async function outOfStock(productId: string, name: string) {
    if (!window.confirm(`Mark "${name}" as out of stock? Customers will stop seeing it from your shop.`)) return;
    const { error } = await supabase.from("shop_products").update({ stock: 0, is_available: false }).eq("product_id", productId);
    say(error ? friendly(error.message) : `${name} marked out of stock.`, !error);
    load();
  }
  async function toggleOpen() {
    if (!shop) return;
    const next = !shop.is_open;
    if (!next && !window.confirm("Close your shop? You will not get new orders until you open it again.")) return;
    const { error } = await supabase.from("shops").update({ is_open: next }).eq("id", shop.id);
    if (error) say(friendly(error.message), false); else say(next ? "Your shop is open." : "Your shop is closed.");
    load();
  }
  const tickKey = (id: string, i: number) => id + ":" + i;
  const allTicked = (o: O) => o.order_items.every((_, i) => ticked[tickKey(o.id, i)]);

  // ---- views ----
  function itemsList(o: O) {
    return (<ul className="shp-items">
      {o.order_items.map((it, i) => {
        const name = it.products?.name ?? "Item";
        const s = stock?.[it.product_id];
        const have = s && s.is_available ? s.stock : 0;
        const short = o.status === "placed" && !!stock && have < it.qty;
        return (<li key={i}>
          {o.status === "accepted" && (
            <input type="checkbox" checked={!!ticked[tickKey(o.id, i)]} aria-label={`Packed: ${name}`}
              onChange={(e) => setTicked({ ...ticked, [tickKey(o.id, i)]: e.target.checked })} />)}
          <span className="shp-qty">{it.qty} ×</span>
          <span>{name}{it.products?.unit ? <small> {it.products.unit}</small> : null}</span>
          {o.status === "placed" && stock && (
            <span className={"shp-stk" + (short ? " bad" : "")}>
              {short ? (have === 0 ? (s && !s.is_available && s.stock > 0 ? "Not on sale" : "Out of stock") : `Only ${have} left`) : `${have} in stock`}
            </span>)}
          {o.status === "placed" && !short && <button className="shp-link" onClick={() => outOfStock(it.product_id, name)}>Out of stock?</button>}
        </li>);
      })}
    </ul>);
  }

  function card(o: O) {
    const wait = minsSince(o.created_at, now);
    const late = o.status === "placed" && wait >= 5;
    const bad = o.status === "placed" ? shortages(o) : [];
    return (<article className={"shp-order" + (late ? " late" : "")} key={o.id}>
      <div className="shp-top">
        <span className={"shp-badge " + (STATUS_TONE[o.status] ?? "")}>{STATUS_LABEL[o.status] ?? o.status}</span>
        <span className="shp-id">#{String(o.id).slice(0, 6)}</span>
        <span className={"shp-time" + (late ? " late" : "")}>{o.status === "placed" ? `Waiting ${wait} min` : ago(o.created_at, now)}</span>
        <b className="shp-amt">{rupee(o.total)}</b>
      </div>
      {itemsList(o)}
      <div className="shp-addr">{o.address}</div>

      {o.status === "placed" && <>
        <div className="shp-actions">
          <button disabled={bad.length > 0} onClick={() => setStatus(o.id, "accepted")}>Accept order</button>
          <button className="alt" onClick={() => reject(o.id)}>Reject</button>
        </div>
        {bad.length > 0 && <p className="shp-need">
          You do not have enough stock for {bad.map((b) => `${b.name} (need ${b.need}, have ${b.have})`).join(", ")}, so this order cannot be accepted.{" "}
          <Link href="/shop/inventory">Update stock</Link> or reject the order.
        </p>}
      </>}
      {o.status === "accepted" && <>
        <div className="shp-actions">
          <button disabled={!allTicked(o)} onClick={() => setStatus(o.id, "packed")}>Mark as packed</button>
        </div>
        {!allTicked(o) && <p className="shp-hint" style={{ marginTop: 8 }}>Tick every item to mark this order as packed.</p>}
      </>}
      {o.status === "packed" && <div className="shp-qr">
        <QRCodeSVG value={o.pickup_token} size={140} />
        <div>
          <p><b>{o.rider_id ? "A rider is coming to pick this up" : "Waiting for a rider to pick this up"}</b></p>
          <p className="shp-hint">Attach this QR to the bag. The rider will scan it.</p>
        </div>
      </div>}
    </article>);
  }

  if (loaded && !shop) return (<div className="shp">
    <p className="shp-calm"><b>No shop is linked to this account</b>Ask Quicky to link your shop to this phone number, then refresh this page.</p>
  </div>);

  const histShown = histAll ? hist : hist.slice(0, 5);
  const alerts = out.length + low.length;

  return (<div className="shp">
    <audio ref={audio} src="/alert.mp3" loop />

    <div className="shp-bar">
      <div>
        <h2 className="shp-name">{shop?.name ?? "Your shop"}</h2>
        {shop && <span className="shp-state"><span className={"shp-dot" + (shop.is_open && shop.status === "approved" ? " on" : "")} />
          {shop.status !== "approved" ? "Not live yet" : shop.is_open ? "Open for orders" : "Closed"}</span>}
      </div>
      <div className="shp-tools">
        <button className="alt" onClick={toggleSound}>{sound ? "Order sound: on" : "Turn on order sound"}</button>
        {shop && shop.status === "approved" && <button className={shop.is_open ? "danger" : ""} onClick={toggleOpen}>{shop.is_open ? "Close shop" : "Open shop"}</button>}
      </div>
    </div>

    {!sound && <p className="shp-hint">Tap &ldquo;Turn on order sound&rdquo; once, so you hear every new order.</p>}
    {shop?.status === "pending" && <p className="shp-warn">Your shop is waiting for approval from Quicky. You will start getting orders once it is approved.</p>}
    {shop?.status === "suspended" && <p className="shp-warn">Your shop is suspended, so you are not getting orders. Please contact Quicky.</p>}
    {shop?.status === "approved" && !shop.is_open && <p className="shp-warn">Your shop is closed. Customers cannot order from you until you open it.</p>}
    {loadErr && <p className="shp-err" role="alert">Could not load your orders: {loadErr}</p>}
    {toast && <p className={"shp-toast" + (toast.ok ? "" : " bad")} role="status">{toast.text}</p>}

    <div className="shp-tiles">
      <button className={"shp-tile" + (newCount ? " hot" : "")} onClick={() => setCol("new")}><b>{newCount}</b><span>New orders</span></button>
      <button className="shp-tile" onClick={() => setCol("packing")}><b>{lists.packing.length}</b><span>To pack</span></button>
      <button className="shp-tile" onClick={() => setCol("ready")}><b>{lists.ready.length}</b><span>Ready for pickup</span></button>
      <Link className="shp-tile good" href="/shop/earnings"><b>{rupee(today.sales)}</b><span>Sales today</span><small>{today.count} delivered</small></Link>
      <Link className={"shp-tile" + (out.length ? " hot" : low.length ? " warn" : "")} href="/shop/inventory">
        <b>{alerts}</b><span>Stock alerts</span>
        <small>{alerts === 0 ? "All items are in stock" : [out.length ? `${out.length} out of stock` : "", low.length ? `${low.length} running low` : ""].filter(Boolean).join(", ")}</small>
      </Link>
    </div>
    <span className="shp-live"><span className="shp-dot on" /> Live. New orders appear here by themselves.</span>

    {live.length === 0 ? (
      <p className="shp-calm"><b>No orders right now</b>When a customer orders from your shop, it shows up here with a sound.</p>
    ) : (<>
      <div className="shp-chips">
        {(Object.keys(COL_TITLE) as Col[]).map((k) => (
          <button key={k} className={"shp-chip" + (col === k ? " on" : "") + (k === "new" && newCount > 0 && col !== k ? " alert" : "")} onClick={() => setCol(k)}>
            {COL_TITLE[k]} <i>{lists[k].length}</i>
          </button>))}
      </div>
      <div className="shp-board">
        {(Object.keys(COL_TITLE) as Col[]).map((k) => (
          <section key={k} className={"shp-col" + (col === k ? " on" : "")}>
            <h3 className="shp-colh">{COL_TITLE[k]} <i>{lists[k].length}</i></h3>
            {lists[k].length === 0 ? <p className="shp-none">{COL_EMPTY[k]}</p> : lists[k].map(card)}
          </section>))}
      </div>
    </>)}

    <section className="shp-hist">
      <h3>Recent orders</h3>
      {hist.length === 0 ? <p className="shp-hint">Finished orders will show up here.</p> : <>
        {histShown.map((o) => (
          <div className="shp-hrow" key={o.id}>
            <span className={"shp-badge " + (STATUS_TONE[o.status] ?? "")}>{STATUS_LABEL[o.status] ?? o.status}</span>
            <span className="shp-id">#{String(o.id).slice(0, 6)}</span>
            <span className="shp-time">{ago(o.created_at, now)}</span>
            <span className="shp-sum">{o.order_items.map((it) => `${it.qty} × ${it.products?.name ?? "Item"}`).join(", ")}</span>
            <b>{rupee(o.total)}</b>
          </div>))}
        {hist.length > 5 && <button className="shp-more" onClick={() => setHistAll(!histAll)}>{histAll ? "Show less" : `Show all ${hist.length}`}</button>}
      </>}
    </section>
  </div>);
}
