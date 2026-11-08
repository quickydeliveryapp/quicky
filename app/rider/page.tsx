"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/messages";
import "./rider.css";

type RO = {
  id: string; status: string; total: number; address: string; lat: number | null; lng: number | null; created_at: string;
  eta: string | null; rider: string | null; shopName: string | null; shopAddress: string | null; shopLat: number | null; shopLng: number | null; phone: string | null;
};
type Me = { id: string; phone: string | null; is_online: boolean; rider_approved: boolean; upi_id: string | null };
type Done = { id: string; total: number; cash_collected: number | null; payment_method: string | null; delivered_at: string | null; address: string };
type Pay = { method: "cash" | "upi"; received: string; returned: boolean; upiOk: boolean };
type Tab = "deliveries" | "cash" | "profile";

const rupee = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const clock = (ts: string) => new Date(ts).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const dayTime = (ts: string) => new Date(ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const money = (n: number) => Math.round(n * 100) / 100;
const VPA = /^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9]{1,63}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---- icons ----
const sv = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: "false" } as const;
const Bike = () => (<svg {...sv}><circle cx="6" cy="17" r="3.2" /><circle cx="18" cy="17" r="3.2" /><path d="M6 17l4-8h5l3 8" /><path d="M10 9L8.5 6H6" /><path d="M13.5 6h3" /></svg>);
const Wallet = () => (<svg {...sv}><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18" /><circle cx="16.5" cy="14.5" r="1.2" /></svg>);
const User = () => (<svg {...sv}><circle cx="12" cy="8" r="3.6" /><path d="M5 20c0-3.6 3-6 7-6s7 2.4 7 6" /></svg>);
const Phone = () => (<svg {...sv}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>);
const Navigate = () => (<svg {...sv}><path d="M3 11l18-8-8 18-2-8z" /></svg>);
const Scan = () => (<svg {...sv}><path d="M4 8V6a2 2 0 0 1 2-2h2" /><path d="M16 4h2a2 2 0 0 1 2 2v2" /><path d="M20 16v2a2 2 0 0 1-2 2h-2" /><path d="M8 20H6a2 2 0 0 1-2-2v-2" /><path d="M8 12h8" /></svg>);
const Cash = () => (<svg {...sv}><rect x="3" y="7" width="18" height="10" rx="2" /><circle cx="12" cy="12" r="2.4" /><path d="M6.5 10v.01M17.5 14v.01" /></svg>);
const QrIcon = () => (<svg {...sv}><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2v2h-2zM18 14h2v2M14 18h2v2M18 18h2v2" /></svg>);
const Store = () => (<svg {...sv}><path d="M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9" /><path d="M3 10l1.5-5h15L21 10" /><path d="M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /></svg>);
const Pin = () => (<svg {...sv}><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>);
const Pkg = () => (<svg {...sv}><path d="M3.5 8L12 3.5 20.5 8v8L12 20.5 3.5 16z" /><path d="M3.5 8L12 12.5 20.5 8" /><path d="M12 12.5v8" /></svg>);
const Check = () => (<svg {...sv}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>);
const Close = () => (<svg {...sv}><path d="M18 6L6 18M6 6l12 12" /></svg>);
const Return = () => (<svg {...sv}><path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg>);

// ---- camera scanner (pickup QR, own UPI QR) ----
function Scanner({ title, hint, onResult, onClose }: { title: string; hint: string; onResult: (v: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let stream: MediaStream | null = null, timer: number | null = null, dead = false, got = false;
    (async () => {
      if (!("BarcodeDetector" in window)) { setErr("Camera scanning is not supported in this browser. Please use Chrome on Android."); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (dead) { stream.getTracks().forEach((t) => t.stop()); return; }
        video.current!.srcObject = stream; await video.current!.play();
      } catch { setErr("Could not open the camera. Please allow camera access."); return; }
      const det = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
      timer = window.setInterval(async () => {
        try { const r = await det.detect(video.current!); if (r[0] && !got) { got = true; onResult(String(r[0].rawValue)); } } catch {}
      }, 400);
    })();
    return () => { dead = true; if (timer) clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, []);
  return (<div className="rdr-scan" role="dialog" aria-modal="true" aria-label={title}>
    <video ref={video} playsInline muted />
    <div className="rdr-frame" />
    <div className="rdr-scan-top"><b>{title}</b><button aria-label="Close" onClick={onClose}><Close /></button></div>
    <div className="rdr-scan-msg">{err || hint}</div>
  </div>);
}

function Steps({ at }: { at: 1 | 2 | 3 }) {
  const items = ["Accepted", "Picked up", "Delivered"];
  return (<div className="rdr-steps" aria-label={`Step ${at} of 3`}>
    {items.map((l, i) => (<span key={l} style={{ display: "contents" }}>
      {i > 0 && <span className={"rdr-bar" + (at > i ? " on" : "")} />}
      <span className={"rdr-step" + (at >= i + 1 ? " on" : "") + (at === i + 1 ? " now" : "")}><i>{at > i + 1 ? "✓" : i + 1}</i>{l}</span>
    </span>))}
  </div>);
}

export default function Rider() {
  const [me, setMe] = useState<Me | null>(null);
  const [orders, setOrders] = useState<RO[]>([]);
  const [done, setDone] = useState<Done[]>([]);
  const [deps, setDeps] = useState<{ amount: number; created_at: string }[]>([]);
  const [tab, setTab] = useState<Tab>("deliveries");
  const [pay, setPayState] = useState<Record<string, Pay>>({});
  const [scan, setScan] = useState<null | "pickup" | "upi">(null);
  const [upiText, setUpiText] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [now, setNow] = useState(Date.now());

  const say = (text: string, ok = true) => setToast({ text, ok });
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); }, [toast]);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [p, o, d, dp] = await Promise.all([
      supabase.from("profiles").select("id,phone,is_online,rider_approved,upi_id").eq("id", u.user.id).single(),
      supabase.rpc("rider_orders"),
      supabase.from("orders").select("id,total,cash_collected,payment_method,delivered_at,address").eq("status", "delivered").order("delivered_at", { ascending: false }),
      supabase.from("cash_deposits").select("amount,created_at").order("created_at", { ascending: false }),
    ]);
    if (p.data) setMe({ ...(p.data as Me), phone: (p.data as Me).phone ?? u.user.phone ?? null });
    if (o.error) say(friendly(o.error.message), false);
    else setOrders(((o.data as any[]) || []).map((r) => ({
      id: r.out_id, status: r.out_status, total: Number(r.out_total), address: r.out_address, lat: r.out_lat, lng: r.out_lng, created_at: r.out_created_at,
      eta: r.out_eta, rider: r.out_rider, shopName: r.out_shop_name, shopAddress: r.out_shop_address, shopLat: r.out_shop_lat, shopLng: r.out_shop_lng, phone: r.out_customer_phone,
    })));
    if (!d.error) setDone((d.data as Done[]) || []);
    if (!dp.error) setDeps(((dp.data as any[]) || []).map((r) => ({ amount: Number(r.amount), created_at: r.created_at })));
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel("rider-orders").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load).subscribe();
    const poll = setInterval(load, 20000);
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); clearInterval(tick); };
  }, [load]);

  // ---- derived ----
  const mine = orders.filter((o) => o.rider === me?.id);
  const avail = orders.filter((o) => !o.rider);
  const canTake = !!me?.is_online && !!me?.rider_approved;
  const collected = done.reduce((a, d) => a + Number(d.cash_collected || 0), 0);
  const deposited = deps.reduce((a, d) => a + d.amount, 0);
  const owe = money(collected - deposited);
  const todayStr = new Date().toDateString();
  const todays = done.filter((d) => d.delivered_at && new Date(d.delivered_at).toDateString() === todayStr);
  const todayCash = todays.reduce((a, d) => a + Number(d.cash_collected || 0), 0);

  // ---- actions ----
  async function toggleOnline() {
    if (!me) return;
    if (!me.rider_approved) { say("Your account is waiting for approval from Quicky.", false); return; }
    const { error } = await supabase.rpc("set_online", { p_online: !me.is_online });
    if (error) say(friendly(error.message), false);
    load();
  }
  async function claim(id: string) {
    setBusy(true);
    const { error } = await supabase.rpc("claim_order", { p_order_id: id });
    setBusy(false);
    if (error) say(friendly(error.message), false); else say("Delivery accepted. Go to the shop.");
    load();
  }
  async function pickup(text: string) {
    setScan(null);
    const token = text.trim();
    if (!UUID.test(token)) { say("This is not a Quicky pickup QR code.", false); return; }
    setBusy(true);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 }));
      const { data, error } = await supabase.rpc("pickup_order", { p_token: token, p_lat: pos.coords.latitude, p_lng: pos.coords.longitude });
      if (error) say(friendly(error.message), false); else say(`Picked up. Deliver by ${clock(String(data))}.`);
    } catch { say("Your location is needed to pick up the order. Please allow location access.", false); }
    setBusy(false);
    load();
  }
  async function saveUpi(v: string) {
    const { error } = await supabase.rpc("set_my_upi", { p_upi: v });
    if (error) say(friendly(error.message), false); else { say(v ? "UPI ID saved." : "UPI ID removed."); setUpiText(""); load(); }
  }
  function onUpiScan(text: string) {
    setScan(null);
    let id = text.trim();
    try { const pa = new URL(id).searchParams.get("pa"); if (pa) id = pa; } catch {}
    if (!VPA.test(id)) { say("This QR does not contain a UPI ID. Scan the QR from your UPI app.", false); return; }
    saveUpi(id);
  }

  const payOf = (id: string): Pay => pay[id] ?? { method: "cash", received: "", returned: false, upiOk: false };
  const setPay = (id: string, patch: Partial<Pay>) => setPayState((m) => ({ ...m, [id]: { ...payOf(id), ...patch } }));
  async function deliver(o: RO) {
    const p = payOf(o.id);
    setBusy(true);
    const { error } = await supabase.rpc("deliver_order", {
      p_order_id: o.id, p_method: p.method, p_received: p.method === "cash" ? Number(p.received) : null, p_change_returned: p.returned,
    });
    setBusy(false);
    if (error) { say(friendly(error.message), false); return; }
    setPayState((m) => { const n = { ...m }; delete n[o.id]; return n; });
    say(`Delivered. ${rupee(o.total)} added to the money you owe Quicky.`);
    load();
  }

  // ---- views ----
  function payment(o: RO) {
    const p = payOf(o.id);
    const total = money(o.total);
    const recv = Number(p.received);
    const has = p.received.trim() !== "" && !isNaN(recv);
    const diff = money(recv - total);
    const ok = p.method === "cash" ? has && recv >= total && (diff === 0 || p.returned) : p.upiOk;
    const notes = [100, 200, 500, 2000].filter((n) => n > total).slice(0, 3);
    const upiLink = me?.upi_id ? `upi://pay?pa=${encodeURIComponent(me.upi_id)}&pn=${encodeURIComponent("Quicky")}&am=${total.toFixed(2)}&cu=INR&tn=${encodeURIComponent("Quicky order " + o.id.slice(0, 6))}` : "";
    return (<div className="rdr-pay">
      <div className="rdr-seg" role="group" aria-label="How did the customer pay?">
        <button className={p.method === "cash" ? "on" : ""} onClick={() => setPay(o.id, { method: "cash", upiOk: false })}><Cash /> Cash</button>
        <button className={p.method === "upi" ? "on" : ""} onClick={() => setPay(o.id, { method: "upi", returned: false })}><QrIcon /> UPI</button>
      </div>

      {p.method === "cash" && <>
        <div className="rdr-field">
          <label htmlFor={"recv-" + o.id}>Cash received from the customer</label>
          <input id={"recv-" + o.id} inputMode="decimal" placeholder="₹ 0" value={p.received}
            onChange={(e) => setPay(o.id, { received: e.target.value.replace(/[^0-9.]/g, ""), returned: false })} />
        </div>
        <div className="rdr-chips">
          <button onClick={() => setPay(o.id, { received: String(total), returned: false })}>Exact {rupee(total)}</button>
          {notes.map((n) => <button key={n} onClick={() => setPay(o.id, { received: String(n), returned: false })}>{rupee(n)}</button>)}
        </div>
        {has && recv < total && <div className="rdr-note short" role="alert">Short by {rupee(money(total - recv))}. Collect the full bill of {rupee(total)} before delivering.</div>}
        {has && recv === total && <div className="rdr-note exact"><Check /> Exact amount. No change to return.</div>}
        {has && recv > total && <>
          <div className="rdr-note change" role="alert">
            <span><Return /> Return to the customer</span>
            <b>{rupee(diff)}</b>
            <span>The customer gave {rupee(recv)} for a bill of {rupee(total)}.</span>
          </div>
          <label className={"rdr-tick" + (p.returned ? " ok" : "")}>
            <input type="checkbox" checked={p.returned} onChange={(e) => setPay(o.id, { returned: e.target.checked })} />
            I have returned {rupee(diff)} to the customer
          </label>
        </>}
      </>}

      {p.method === "upi" && (me?.upi_id ? <>
        <div className="rdr-qr">
          <QRCodeSVG value={upiLink} size={190} />
          <p className="big">{rupee(total)}</p>
          <p>Ask the customer to scan this and pay to <b>{me.upi_id}</b></p>
        </div>
        <label className={"rdr-tick" + (p.upiOk ? " ok" : "")}>
          <input type="checkbox" checked={p.upiOk} onChange={(e) => setPay(o.id, { upiOk: e.target.checked })} />
          I received {rupee(total)} on UPI
        </label>
      </> : <div className="rdr-note short">
        You have not added your UPI yet.{" "}
        <button className="rdr-btn alt" style={{ marginTop: 8, padding: "8px 14px" }} onClick={() => setTab("profile")}>Add UPI in Profile</button>
      </div>)}

      <button className="rdr-btn" disabled={!ok || busy} onClick={() => deliver(o)}><Check /> {busy ? "Please wait..." : "Mark as delivered"}</button>
    </div>);
  }

  function activeCard(o: RO) {
    const picked = o.status === "picked_up";
    const late = picked && !!o.eta && new Date(o.eta).getTime() < now;
    const dest = (lat: number | null, lng: number | null) => lat != null && lng != null ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : "";
    return (<article className={"rdr-card" + (late ? " late" : "")} key={o.id}>
      <div className="rdr-top">
        <Steps at={picked ? 2 : 1} />
        {late && <span className="rdr-badge bad">Late</span>}
      </div>
      {!picked && <>
        <div className="rdr-line"><span className="rdr-ic"><Store /></span><div><b>Pick up from {o.shopName ?? "the shop"}</b><span>{o.shopAddress ?? "Ask Quicky for the shop address"}</span></div></div>
        <div className="rdr-line"><span className="rdr-ic"><Pin /></span><div><b>Deliver to</b><span>{o.address}</span></div></div>
        <div className="rdr-bill"><span>Bill to collect</span><b>{rupee(o.total)}</b></div>
        <div className="rdr-acts">
          {dest(o.shopLat, o.shopLng) && <a className="rdr-btn alt" href={dest(o.shopLat, o.shopLng)} target="_blank" rel="noreferrer"><Navigate /> Go to shop</a>}
          <button className="rdr-btn" disabled={busy} onClick={() => setScan("pickup")}><Scan /> Scan pickup QR</button>
        </div>
        <p className="rdr-hint">At the shop, scan the QR stuck on the bag to pick up the order.</p>
      </>}
      {picked && <>
        <div className="rdr-line"><span className="rdr-ic"><Pin /></span><div><b>Deliver to</b><span>{o.address}</span>{o.eta && <span>Deliver by {clock(o.eta)}</span>}</div></div>
        <div className="rdr-acts">
          {dest(o.lat, o.lng) && <a className="rdr-btn alt" href={dest(o.lat, o.lng)} target="_blank" rel="noreferrer"><Navigate /> Navigate</a>}
          {o.phone && <a className="rdr-btn alt" href={`tel:${o.phone}`}><Phone /> Call customer</a>}
        </div>
        <div className="rdr-bill"><span>Bill to collect</span><b>{rupee(o.total)}</b></div>
        {payment(o)}
      </>}
    </article>);
  }

  function availCard(o: RO) {
    return (<article className="rdr-card" key={o.id}>
      <div className="rdr-top"><span className="rdr-badge ok">Ready for pickup</span><span className="sp">#{o.id.slice(0, 6)}</span></div>
      <div className="rdr-line"><span className="rdr-ic"><Store /></span><div><b>{o.shopName ?? "Shop"}</b><span>{o.shopAddress ?? ""}</span></div></div>
      <div className="rdr-line"><span className="rdr-ic"><Pin /></span><div><b>Deliver to</b><span>{o.address}</span></div></div>
      <div className="rdr-bill"><span>Bill</span><b>{rupee(o.total)}</b></div>
      <button className="rdr-btn" disabled={busy} onClick={() => claim(o.id)}><Bike /> Accept delivery</button>
    </article>);
  }

  const phoneLabel = me?.phone ? "+" + me.phone.replace(/^\+/, "") : "Rider";

  return (<div className="rdr">
    <section className="rdr-me">
      <span className="rdr-av"><Bike /></span>
      <div className="rdr-me-t">
        <b>{me?.is_online ? "You are online" : "You are offline"}</b>
        <span>{me ? (me.rider_approved ? phoneLabel : "Waiting for approval") : "Loading..."}</span>
      </div>
      <input className="rdr-sw" type="checkbox" role="switch" aria-label="Go online" checked={!!me?.is_online} disabled={!me} onChange={toggleOnline} />
    </section>

    {toast && <p className={"rdr-toast" + (toast.ok ? "" : " bad")} role="status">{toast.text}</p>}

    <nav className="rdr-nav" aria-label="Rider sections">
      <button className={tab === "deliveries" ? "on" : ""} onClick={() => setTab("deliveries")}><Bike /> Deliveries{mine.length > 0 && <span className="rdr-bd">{mine.length}</span>}</button>
      <button className={tab === "cash" ? "on" : ""} onClick={() => setTab("cash")}><Wallet /> Cash</button>
      <button className={tab === "profile" ? "on" : ""} onClick={() => setTab("profile")}><User /> Profile</button>
    </nav>

    {tab === "deliveries" && <>
      {me && !me.rider_approved && <p className="rdr-toast bad">Your account is waiting for approval from Quicky. You can take orders once it is approved.</p>}
      {mine.length > 0 && <><h3 className="rdr-h">Your deliveries</h3>{mine.map(activeCard)}</>}
      {canTake && avail.length > 0 && <><h3 className="rdr-h">Ready for pickup ({avail.length})</h3>{avail.map(availCard)}</>}
      {mine.length === 0 && (!canTake || avail.length === 0) && (
        <div className="rdr-empty"><Pkg />
          <b>{!me?.rider_approved ? "Waiting for approval" : !me?.is_online ? "You are offline" : "No deliveries right now"}</b>
          <span>{!me?.rider_approved ? "Quicky will approve your account soon." : !me?.is_online ? "Go online to see orders that are ready for pickup." : "New orders appear here by themselves."}</span>
        </div>)}
    </>}

    {tab === "cash" && <>
      <div className="rdr-tiles">
        <div className="rdr-tile hl"><b>{rupee(owe)}</b><span>You need to deposit with Quicky</span></div>
        <div className="rdr-tile"><b>{todays.length}</b><span>Delivered today</span></div>
        <div className="rdr-tile"><b>{rupee(todayCash)}</b><span>Collected today</span></div>
        <div className="rdr-tile"><b>{rupee(collected)}</b><span>Collected in total</span></div>
        <div className="rdr-tile"><b>{rupee(deposited)}</b><span>Deposited in total</span></div>
      </div>
      <p className="rdr-hint">Cash and UPI payments both come to you, so both are added to the amount you deposit with Quicky.</p>
      <h3 className="rdr-h">Recent deliveries</h3>
      {done.length === 0 ? <div className="rdr-empty"><Wallet /><b>No deliveries yet</b><span>Your finished deliveries show up here.</span></div> : (
        <div className="rdr-card"><div className="rdr-list">
          {done.slice(0, 20).map((d) => (<div className="rdr-li" key={d.id}>
            <span className="rdr-ic">{d.payment_method === "upi" ? <QrIcon /> : <Cash />}</span>
            <div className="grow"><b>{rupee(Number(d.cash_collected ?? d.total))} {d.payment_method === "upi" ? "via UPI" : "in cash"}</b><span>{d.delivered_at ? dayTime(d.delivered_at) : ""} · {d.address}</span></div>
          </div>))}
        </div></div>)}
      {deps.length > 0 && <>
        <h3 className="rdr-h">Your deposits</h3>
        <div className="rdr-card"><div className="rdr-list">
          {deps.slice(0, 5).map((d, i) => (<div className="rdr-li" key={i}>
            <span className="rdr-ic"><Check /></span><div className="grow"><b>{rupee(d.amount)} deposited</b><span>{dayTime(d.created_at)}</span></div>
          </div>))}
        </div></div></>}
    </>}

    {tab === "profile" && <>
      <div className="rdr-card">
        <div className="rdr-line"><span className="rdr-ic"><User /></span><div><b>{phoneLabel}</b><span>Rider account</span></div>
          <span className={"rdr-badge " + (me?.rider_approved ? "ok" : "")} style={{ marginLeft: "auto" }}>{me?.rider_approved ? "Approved" : "Pending"}</span></div>
      </div>
      <div className="rdr-card">
        <div className="rdr-line"><span className="rdr-ic"><QrIcon /></span><div><b>Your UPI</b><span>{me?.upi_id ? me.upi_id : "Add your UPI ID to take UPI payments from customers."}</span></div></div>
        <div className="rdr-acts"><button className="rdr-btn alt" onClick={() => setScan("upi")}><Scan /> Scan my UPI QR</button></div>
        <div className="rdr-upi">
          <input placeholder="or type it, e.g. name@bank" aria-label="UPI ID" value={upiText} onChange={(e) => setUpiText(e.target.value)} autoCapitalize="none" autoCorrect="off" />
          <button className="rdr-btn" style={{ flex: "0 0 auto" }} disabled={!upiText.trim()} onClick={() => { if (!VPA.test(upiText.trim())) say("That does not look like a valid UPI ID (for example name@bank).", false); else saveUpi(upiText.trim()); }}>Save</button>
        </div>
        {me?.upi_id && <button className="rdr-btn alt" onClick={() => { if (window.confirm("Remove your UPI ID?")) saveUpi(""); }}>Remove UPI ID</button>}
        <p className="rdr-hint">At delivery, the app shows a QR with the exact bill for the customer to scan. The money comes to your account, and it is added to what you deposit with Quicky.</p>
      </div>
    </>}

    {scan === "pickup" && <Scanner title="Scan pickup QR" hint="Point the camera at the QR on the bag" onResult={pickup} onClose={() => setScan(null)} />}
    {scan === "upi" && <Scanner title="Scan your UPI QR" hint="Point the camera at the QR from your UPI app" onResult={onUpiScan} onClose={() => setScan(null)} />}
  </div>);
}
