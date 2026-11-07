"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/messages";
import { QRCodeSVG } from "qrcode.react";
import "./shop.css";

type Item = { qty: number; product_id: string; products: { name: string; unit: string | null } | null };
type O = { id: string; status: string; total: number; address: string; pickup_token: string; created_at: string; rider_id: string | null; order_items: Item[] };
type ShopRow = { id: string; name: string; is_open: boolean; status: string };
type Tab = "new" | "packing" | "ready" | "history";

const COLS = "id,status,total,address,pickup_token,created_at,rider_id,order_items(qty,product_id,products(name,unit))";
const TABS: [Tab, string][] = [["new", "New"], ["packing", "Packing"], ["ready", "Ready for pickup"], ["history", "History"]];
const STATUS_LABEL: Record<string, string> = { placed: "New", accepted: "Packing", packed: "Ready", picked_up: "Picked up", delivered: "Delivered", cancelled: "Cancelled" };
const STATUS_TONE: Record<string, string> = { delivered: "ok", cancelled: "bad", picked_up: "info" };
const EMPTY_TEXT: Record<Tab, string> = {
  new: "No new orders right now. You will hear a sound when one arrives.",
  packing: "Nothing to pack at the moment.",
  ready: "No orders waiting for a rider.",
  history: "No finished orders yet.",
};

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
  const [tab, setTab] = useState<Tab>("new");
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [sound, setSound] = useState(false);
  const [now, setNow] = useState(Date.now());
  const audio = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    const [l, h, s] = await Promise.all([
      supabase.from("orders").select(COLS).in("status", ["placed", "accepted", "packed"]).order("created_at"),
      supabase.from("orders").select(COLS).in("status", ["picked_up", "delivered", "cancelled"]).order("created_at", { ascending: false }).limit(30),
      supabase.from("shops").select("id,name,is_open,status").limit(1).maybeSingle(),
    ]);
    if (l.error) setToast({ text: friendly(l.error.message), ok: false });
    else setLive((l.data as unknown as O[]) || []);
    if (!h.error) setHist((h.data as unknown as O[]) || []);
    if (s.data) setShop(s.data as ShopRow);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel("shop-orders").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load).subscribe();
    const poll = setInterval(load, 30000); // safety net if the live connection drops
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); clearInterval(tick); };
  }, [load]);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  const by = (st: string) => live.filter((o) => o.status === st);
  const counts: Record<Tab, number> = { new: by("placed").length, packing: by("accepted").length, ready: by("packed").length, history: hist.length };

  // ---- order alert sound (browsers need one tap before they allow sound) ----
  const pendingRef = useRef(false);
  pendingRef.current = counts.new > 0;
  useEffect(() => {
    const a = audio.current; if (!a) return;
    if (sound && counts.new > 0) a.play().catch(() => {}); else a.pause();
  }, [sound, counts.new]);
  function toggleSound() {
    const a = audio.current;
    if (sound) { setSound(false); a?.pause(); return; }
    setSound(true);
    a?.play().then(() => { if (!pendingRef.current) a.pause(); }).catch(() => {});
  }
  useEffect(() => {
    const prev = document.title;
    if (counts.new > 0) document.title = `(${counts.new}) New order | Quicky`;
    return () => { document.title = prev; };
  }, [counts.new]);

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
        return (<li key={i}>
          {o.status === "accepted" && (
            <input type="checkbox" checked={!!ticked[tickKey(o.id, i)]} aria-label={`Packed: ${name}`}
              onChange={(e) => setTicked({ ...ticked, [tickKey(o.id, i)]: e.target.checked })} />)}
          <span className="shp-qty">{it.qty} ×</span>
          <span>{name}{it.products?.unit ? <small> {it.products.unit}</small> : null}</span>
          {o.status === "placed" && <button className="shp-link" onClick={() => outOfStock(it.product_id, name)}>Out of stock</button>}
        </li>);
      })}
    </ul>);
  }

  function card(o: O) {
    const wait = minsSince(o.created_at, now);
    const late = o.status === "placed" && wait >= 5;
    return (<article className={"shp-order" + (late ? " late" : "")} key={o.id}>
      <div className="shp-top">
        <span className={"shp-badge " + (STATUS_TONE[o.status] ?? "")}>{STATUS_LABEL[o.status] ?? o.status}</span>
        <span className="shp-id">#{String(o.id).slice(0, 6)}</span>
        <span className={"shp-time" + (late ? " late" : "")}>{o.status === "placed" ? `Waiting ${wait} min` : ago(o.created_at, now)}</span>
        <b className="shp-amt">{rupee(o.total)}</b>
      </div>
      {itemsList(o)}
      <div className="shp-addr">{o.address}</div>

      {o.status === "placed" && <div className="shp-actions">
        <button onClick={() => setStatus(o.id, "accepted")}>Accept order</button>
        <button className="alt" onClick={() => reject(o.id)}>Reject</button>
      </div>}
      {o.status === "accepted" && <>
        <div className="shp-actions">
          <button disabled={!allTicked(o)} onClick={() => setStatus(o.id, "packed")}>Mark as packed</button>
        </div>
        {!allTicked(o) && <p className="shp-need">Tick every item to mark this order as packed.</p>}
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

  const shown = tab === "history" ? hist : tab === "new" ? by("placed") : tab === "packing" ? by("accepted") : by("packed");

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
    {toast && <p className={"shp-toast" + (toast.ok ? "" : " bad")} role="status">{toast.text}</p>}

    <div className="shp-chips">
      {TABS.map(([k, label]) => (
        <button key={k} className={"shp-chip" + (tab === k ? " on" : "") + (k === "new" && counts.new > 0 && tab !== k ? " alert" : "")} onClick={() => setTab(k)}>
          {label} <i>{counts[k]}</i>
        </button>))}
    </div>

    {shown.length === 0 ? <p className="shp-empty">{EMPTY_TEXT[tab]}</p> : <div className="shp-list">{shown.map(card)}</div>}
  </div>);
}
