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
type Done = { id: string; total: number; cash_collected: number | null; payment_method: string | null; delivered_at: string | null; address: string; cash_received: number | null; change_returned: number | null };
type Pay = { method: "cash" | "upi"; received: string; returned: boolean; upiOk: boolean };
type Tab = "deliveries" | "history" | "cash" | "profile";
type Range = "today" | "week" | "month" | "all";
type Prefs = { sound: boolean; vibrate: boolean; large: boolean };
const DEFAULT_PREFS: Prefs = { sound: true, vibrate: true, large: false };
type Sheet = { kind: "choose" } | { kind: "cash" } | { kind: "pay"; pa: string; pn: string; am: string; link: string };
const RANGES: [Range, string][] = [["today", "Today"], ["week", "7 days"], ["month", "30 days"], ["all", "All"]];

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
const History = () => (<svg {...sv}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4.5h4.5" /><path d="M12 7.5V12l3 2" /></svg>);
const Help = () => (<svg {...sv}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7" /><path d="M12 17h.01" /></svg>);
const Sliders = () => (<svg {...sv}><path d="M4 7h10M18 7h2M4 17h2M10 17h10" /><circle cx="16" cy="7" r="2" /><circle cx="8" cy="17" r="2" /></svg>);

// A small on/off switch with a text label, so the state never depends on colour alone
function Switch({ on, onChange, label, text, disabled }: { on: boolean; onChange: () => void; label: string; text?: string; disabled?: boolean }) {
  return (<button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={"rdr-tg" + (on ? " on" : "")} onClick={onChange}>
    {text && <span className="rdr-tg-t">{text}</span>}
    <span className="rdr-tg-k" aria-hidden="true"><i /></span>
  </button>);
}

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

const Chevrons = () => (<svg {...sv}><path d="M7 6l6 6-6 6" /><path d="M13 6l6 6-6 6" /></svg>);

// Slide the knob to the end to confirm. Keyboard and screen reader users can press the knob instead.
function SlideToConfirm({ label, onDone }: { label: string; onDone: () => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [drag, setDrag] = useState(false);
  const from = useRef(0);
  const max = () => Math.max(1, (track.current?.clientWidth ?? 0) - 60);
  const finish = () => { setX(0); setDrag(false); onDone(); };
  return (<div className="rdr-slide" ref={track}>
    <span className="rdr-slide-t" style={{ opacity: Math.max(0, 1 - (x / max()) * 1.4) }}>{label}</span>
    <button type="button" className="rdr-slide-k" role="slider" aria-label={`${label}. Drag right, or press Enter`}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((x / max()) * 100)}
      style={{ transform: `translateX(${x}px)`, transition: drag ? "none" : "transform .2s" }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); from.current = e.clientX - x; setDrag(true); }}
      onPointerMove={(e) => { if (drag) setX(Math.min(max(), Math.max(0, e.clientX - from.current))); }}
      onPointerUp={() => { if (!drag) return; setDrag(false); if (x >= max() * 0.85) finish(); else setX(0); }}
      onPointerCancel={() => { setDrag(false); setX(0); }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); const n = x + max() / 4; if (n >= max() * 0.85) finish(); else setX(n); }
        if (e.key === "ArrowLeft") { e.preventDefault(); setX(Math.max(0, x - max() / 4)); }
      }}
      onClick={(e) => { if (e.detail === 0) finish(); }}>
      <Chevrons />
    </button>
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
  const [deps, setDeps] = useState<{ amount: number; created_at: string; method: string }[]>([]);
  const [tab, setTab] = useState<Tab>("deliveries");
  const [pay, setPayState] = useState<Record<string, Pay>>({});
  const [scan, setScan] = useState<null | "pickup" | "upi" | "deposit">(null);
  const [upiText, setUpiText] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [ready, setReady] = useState(false);
  const [range, setRange] = useState<Range>("today");
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seen = useRef<Set<string> | null>(null);
  const [limit, setLimit] = useState(200);
  const [amUpis, setAmUpis] = useState<{ upi: string; name: string }[]>([]);
  const [sheet, setSheet] = useState<Sheet | null>(null);

  const say = (text: string, ok = true) => setToast({ text, ok });
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); }, [toast]);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [p, o, d, dp, fe, am] = await Promise.all([
      supabase.from("profiles").select("id,phone,is_online,rider_approved,upi_id").eq("id", u.user.id).single(),
      supabase.rpc("rider_orders"),
      supabase.from("orders").select("id,total,cash_collected,payment_method,delivered_at,address,cash_received,change_returned").eq("status", "delivered").order("delivered_at", { ascending: false }),
      supabase.from("cash_deposits").select("*").order("created_at", { ascending: false }),
      supabase.from("fee_settings").select("*").eq("id", 1).single(),
      supabase.rpc("my_area_manager_upis"),
    ]);
    if (p.data) setMe({ ...(p.data as Me), phone: (p.data as Me).phone ?? u.user.phone ?? null });
    if (o.error) say(friendly(o.error.message), false);
    else setOrders(((o.data as any[]) || []).map((r) => ({
      id: r.out_id, status: r.out_status, total: Number(r.out_total), address: r.out_address, lat: r.out_lat, lng: r.out_lng, created_at: r.out_created_at,
      eta: r.out_eta, rider: r.out_rider, shopName: r.out_shop_name, shopAddress: r.out_shop_address, shopLat: r.out_shop_lat, shopLng: r.out_shop_lng, phone: r.out_customer_phone,
    })));
    if (!d.error) setDone((d.data as Done[]) || []);
    if (!dp.error) setDeps(((dp.data as any[]) || []).map((r) => ({ amount: Number(r.amount), created_at: r.created_at, method: r.method ?? "cash" })));
    if (fe.data) setLimit(Number((fe.data as any).rider_cash_limit ?? 200));
    if (!am.error) setAmUpis(((am.data as any[]) || []).map((r) => ({ upi: String(r.out_upi), name: String(r.out_name) })));
    setReady(true);
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

  // ---- settings (kept on this phone) ----
  useEffect(() => { try { const v = localStorage.getItem("qk_rider_prefs"); if (v) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(v) }); } catch {} }, []);
  const setPref = (patch: Partial<Prefs>) => setPrefs((cur) => { const n = { ...cur, ...patch }; try { localStorage.setItem("qk_rider_prefs", JSON.stringify(n)); } catch {} return n; });

  // ---- tell the rider when a new order is ready for pickup ----
  useEffect(() => {
    if (!ready) return;
    const ids = avail.map((o) => o.id);
    if (seen.current === null) { seen.current = new Set(ids); return; }
    const fresh = canTake ? ids.filter((id) => !seen.current!.has(id)) : [];
    seen.current = new Set(ids);
    if (fresh.length === 0) return;
    say(fresh.length === 1 ? "A new order is ready for pickup." : `${fresh.length} new orders are ready for pickup.`);
    if (prefs.sound && audioRef.current) { const a = audioRef.current; a.currentTime = 0; a.play().catch(() => {}); setTimeout(() => a.pause(), 4000); }
    if (prefs.vibrate && typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate([200, 100, 200]);
  }, [orders, ready]);

  // ---- actions ----
  async function toggleOnline() {
    if (!me) return;
    if (!me.rider_approved) { say("Your account is waiting for approval from Quicky.", false); return; }
    if (me.is_online && mine.length > 0 && !window.confirm("You have a delivery in progress. Go offline anyway?")) return;
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
  function onDepositScan(text: string) {
    setScan(null);
    const t = text.trim();
    if (!/^upi:\/\//i.test(t)) { say("This is not a UPI payment QR. Ask your area manager to show the deposit QR.", false); return; }
    try {
      const q = new URL(t).searchParams;
      const pa = q.get("pa") || "";
      if (!VPA.test(pa)) throw new Error("bad");
      setSheet({ kind: "pay", pa, pn: q.get("pn") || "", am: q.get("am") || "", link: t });
    } catch { say("This is not a valid UPI payment QR.", false); }
  }
  useEffect(() => {
    if (!sheet) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setSheet(null); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [sheet]);

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
    const after = money(owe + o.total);
    say(after > 0 ? `Delivered. You now owe Quicky ${rupee(after)}.` : after === 0 ? "Delivered. Your balance with Quicky is settled." : `Delivered. You still have ${rupee(-after)} advance balance with Quicky.`);
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

  function depositCard() {
    if (owe <= 0) return null;
    const over = owe > limit;
    return (<section className={"rdr-dep" + (over ? " over" : "")} aria-label="Deposit">
      <div className="rdr-line">
        <span className="rdr-ic"><Wallet /></span>
        <div><b>{over ? `Please deposit ${rupee(owe)}` : `You hold ${rupee(owe)} of Quicky's money`}</b>
          <span>{over ? `This is more than the limit of ${rupee(limit)}.` : `You can deposit once it goes above ${rupee(limit)}.`}</span></div>
      </div>
      {over && <SlideToConfirm label="Slide to deposit" onDone={() => setSheet({ kind: "choose" })} />}
    </section>);
  }
  const creditNote = owe < 0 ? (<p className="rdr-note exact"><Check /> You have {rupee(-owe)} advance balance with Quicky. It is adjusted automatically against the payments you collect.</p>) : null;

  function depositSheet() {
    if (!sheet) return null;
    const close = () => setSheet(null);
    let body: React.ReactNode = null;
    if (sheet.kind === "choose") body = (<>
      <h3 className="rdr-h" style={{ margin: 0 }}>Deposit {rupee(owe)}</h3>
      <p className="rdr-hint">How do you want to pay Quicky?</p>
      <button className="rdr-opt" autoFocus onClick={() => { setSheet(null); setScan("deposit"); }}>
        <span className="rdr-ic"><QrIcon /></span><span><b>Pay by UPI</b><small>Scan the QR on your area manager&apos;s phone</small></span></button>
      <button className="rdr-opt" onClick={() => setSheet({ kind: "cash" })}>
        <span className="rdr-ic"><Cash /></span><span><b>Give cash</b><small>Hand it to your area manager</small></span></button>
    </>);
    if (sheet.kind === "cash") body = (<>
      <h3 className="rdr-h" style={{ margin: 0 }}>Give {rupee(owe)} in cash</h3>
      <p className="rdr-hint">Hand the cash to your area manager. They will record it, and your balance updates here. If you give more than you owe, the extra stays as your advance balance.</p>
      <button className="rdr-btn" autoFocus onClick={close}>Got it</button>
    </>);
    if (sheet.kind === "pay") {
      const known = amUpis.map((u) => u.upi.toLowerCase());
      const ver = known.length === 0 ? "unknown" : known.includes(sheet.pa.toLowerCase()) ? "ok" : "bad";
      const amName = amUpis.find((u) => u.upi.toLowerCase() === sheet.pa.toLowerCase())?.name;
      body = (<>
        <h3 className="rdr-h" style={{ margin: 0 }}>Check before you pay</h3>
        <div className="rdr-bill"><span>Amount</span><b>{sheet.am ? rupee(Number(sheet.am)) : "Set in your UPI app"}</b></div>
        <div className="rdr-line"><span className="rdr-ic"><User /></span><div><b>{amName || sheet.pn || "Payee"}</b><span>{sheet.pa}</span></div></div>
        {ver === "ok" && <p className="rdr-note exact"><Check /> This is your area manager&apos;s UPI ID.</p>}
        {ver === "unknown" && <p className="rdr-note change" style={{ flexDirection: "row" }}>We could not check this UPI ID. Make sure the name is your area manager before you pay.</p>}
        {ver === "bad" && <p className="rdr-note short" role="alert">This is not your area manager&apos;s UPI ID. Do not pay. Ask your area manager to show the QR from their Quicky dashboard.</p>}
        {ver !== "bad" && <a className="rdr-btn" href={sheet.link}><QrIcon /> Open UPI app</a>}
        <p className="rdr-hint">Your phone will ask which UPI app to pay with. After you pay, your area manager confirms it, and your balance updates here.</p>
        <button className="rdr-btn alt" onClick={close}>Cancel</button>
      </>);
    }
    return (<div className="rdr-sheet-bg" onClick={close}>
      <div className="rdr-sheet" role="dialog" aria-modal="true" aria-label="Deposit" onClick={(e) => e.stopPropagation()}>{body}</div>
    </div>);
  }

  const phoneLabel = me?.phone ? "+" + me.phone.replace(/^\+/, "") : "Rider";

  return (<div className="rdr" style={{ ["--tx" as string]: prefs.large ? 1.18 : 1 } as React.CSSProperties}>
    <audio ref={audioRef} src="/alert.mp3" preload="auto" />
    <section className="rdr-me">
      <span className="rdr-av"><Bike /></span>
      <div className="rdr-me-t">
        <b>{phoneLabel}</b>
        <span>{me ? (me.rider_approved ? "Approved rider" : "Waiting for approval") : "Loading..."}</span>
      </div>
      <Switch on={!!me?.is_online} text={me?.is_online ? "Online" : "Offline"} label={me?.is_online ? "Online. Tap to go offline" : "Offline. Tap to go online"} disabled={!me} onChange={toggleOnline} />
    </section>

    {toast && <p className={"rdr-toast" + (toast.ok ? "" : " bad")} role="status">{toast.text}</p>}

    <nav className="rdr-nav" aria-label="Rider sections">
      <button className={tab === "deliveries" ? "on" : ""} aria-current={tab === "deliveries" ? "page" : undefined} onClick={() => setTab("deliveries")}><Bike /> Deliveries{mine.length > 0 && <span className="rdr-bd" aria-label={`${mine.length} in progress`}>{mine.length}</span>}</button>
      <button className={tab === "history" ? "on" : ""} aria-current={tab === "history" ? "page" : undefined} onClick={() => setTab("history")}><History /> History</button>
      <button className={tab === "cash" ? "on" : ""} aria-current={tab === "cash" ? "page" : undefined} onClick={() => setTab("cash")}><Wallet /> Cash</button>
      <button className={tab === "profile" ? "on" : ""} aria-current={tab === "profile" ? "page" : undefined} onClick={() => setTab("profile")}><User /> Profile</button>
    </nav>

    {tab === "deliveries" && <>
      {depositCard()}
      {creditNote}
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
      {depositCard()}
      <div className="rdr-tiles">
        <div className="rdr-tile hl"><b>{rupee(Math.abs(owe))}</b><span>{owe > 0 ? "You need to deposit with Quicky" : owe < 0 ? "Advance balance with Quicky" : "All settled with Quicky"}</span></div>
        <div className="rdr-tile"><b>{todays.length}</b><span>Delivered today</span></div>
        <div className="rdr-tile"><b>{rupee(todayCash)}</b><span>Collected today</span></div>
        <div className="rdr-tile"><b>{rupee(collected)}</b><span>Collected in total</span></div>
        <div className="rdr-tile"><b>{rupee(deposited)}</b><span>Deposited in total</span></div>
      </div>
      <p className="rdr-hint">Cash and UPI payments both come to you, so both are added to what you owe Quicky. If you deposit more than you owe, the extra stays as an advance balance and is adjusted against your next payments.{limit > 0 ? ` Deposit limit: ${rupee(limit)}.` : ""}</p>
      {deps.length > 0 && <>
        <h3 className="rdr-h">Your deposits</h3>
        <div className="rdr-card"><div className="rdr-list">
          {deps.slice(0, 5).map((d, i) => (<div className="rdr-li" key={i}>
            <span className="rdr-ic"><Check /></span><div className="grow"><b>{rupee(d.amount)} deposited {d.method === "upi" ? "via UPI" : "in cash"}</b><span>{dayTime(d.created_at)}</span></div>
          </div>))}
        </div></div></>}
    </>}

    {tab === "history" && (() => {
      const sod = new Date(); sod.setHours(0, 0, 0, 0);
      const from = range === "today" ? sod.getTime() : range === "week" ? now - 7 * 86400000 : range === "month" ? now - 30 * 86400000 : 0;
      const list = done.filter((d) => d.delivered_at && new Date(d.delivered_at).getTime() >= from);
      const sum = (xs: Done[]) => xs.reduce((a, d) => a + Number(d.cash_collected ?? d.total), 0);
      const upiSum = sum(list.filter((d) => d.payment_method === "upi"));
      const all = sum(list);
      return (<>
        <div className="rdr-chips" role="group" aria-label="Time range">
          {RANGES.map(([k, l]) => <button key={k} className={range === k ? "on" : ""} aria-pressed={range === k} onClick={() => setRange(k)}>{l}</button>)}
        </div>
        <div className="rdr-tiles">
          <div className="rdr-tile"><b>{list.length}</b><span>Deliveries</span></div>
          <div className="rdr-tile"><b>{rupee(all)}</b><span>Collected</span></div>
          <div className="rdr-tile"><b>{rupee(all - upiSum)}</b><span>In cash</span></div>
          <div className="rdr-tile"><b>{rupee(upiSum)}</b><span>Via UPI</span></div>
        </div>
        {list.length === 0 ? <div className="rdr-empty"><History /><b>No deliveries in this time</b><span>Pick another time range above.</span></div> : (
          <div className="rdr-card"><div className="rdr-list">
            {list.slice(0, 100).map((d) => {
              const gave = Number(d.cash_received || 0), back = Number(d.change_returned || 0);
              return (<div className="rdr-li" key={d.id}>
                <span className="rdr-ic">{d.payment_method === "upi" ? <QrIcon /> : <Cash />}</span>
                <div className="grow">
                  <b>{rupee(Number(d.cash_collected ?? d.total))} {d.payment_method === "upi" ? "via UPI" : "in cash"}</b>
                  <span>{d.delivered_at ? dayTime(d.delivered_at) : ""} · {d.address}</span>
                  {back > 0 && <span>Customer gave {rupee(gave)}, you returned {rupee(back)}</span>}
                </div>
              </div>);
            })}
          </div>{list.length > 100 && <p className="rdr-hint">Showing the latest 100 deliveries.</p>}</div>)}
      </>);
    })()}

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

      <div className="rdr-card">
        <div className="rdr-line"><span className="rdr-ic"><Sliders /></span><div><b>Settings</b><span>Saved on this phone</span></div></div>
        <div className="rdr-set"><div><b>New order sound</b><span>Plays when an order is ready for pickup</span></div><Switch on={prefs.sound} label="New order sound" text={prefs.sound ? "On" : "Off"} onChange={() => setPref({ sound: !prefs.sound })} /></div>
        <div className="rdr-set"><div><b>Vibration</b><span>Buzzes when a new order comes</span></div><Switch on={prefs.vibrate} label="Vibration" text={prefs.vibrate ? "On" : "Off"} onChange={() => setPref({ vibrate: !prefs.vibrate })} /></div>
        <div className="rdr-set"><div><b>Large text</b><span>Makes the writing bigger</span></div><Switch on={prefs.large} label="Large text" text={prefs.large ? "On" : "Off"} onChange={() => setPref({ large: !prefs.large })} /></div>
      </div>

      <div className="rdr-card">
        <div className="rdr-line"><span className="rdr-ic"><Help /></span><div><b>How it works</b><span>Tap a question to open it</span></div></div>
        <details className="rdr-qa"><summary>How does a delivery work?</summary>
          <ol><li>Go online.</li><li>Accept an order that is ready for pickup.</li><li>Go to the shop and scan the QR on the bag.</li><li>Deliver it and collect the bill.</li><li>Choose cash or UPI, then tap Mark as delivered.</li></ol></details>
        <details className="rdr-qa"><summary>The customer gave more money</summary>
          <p>Enter the cash you received. The app shows the change to return. Give the change back, tick the box, and then you can mark the order as delivered.</p></details>
        <details className="rdr-qa"><summary>The customer gave less money</summary>
          <p>Collect the full bill first. The order cannot be marked as delivered until the cash matches the bill.</p></details>
        <details className="rdr-qa"><summary>How do UPI payments work?</summary>
          <p>Add your UPI above. At delivery choose UPI, and the customer scans the QR with the exact bill. Tick the box once the money reaches you.</p></details>
        <details className="rdr-qa"><summary>Where do I see what I owe Quicky?</summary>
          <p>Open the Cash tab. It shows the money you collected, what you already deposited, and what is left to deposit.</p></details>
      </div>
    </>}

    {scan === "pickup" && <Scanner title="Scan pickup QR" hint="Point the camera at the QR on the bag" onResult={pickup} onClose={() => setScan(null)} />}
    {scan === "upi" && <Scanner title="Scan your UPI QR" hint="Point the camera at the QR from your UPI app" onResult={onUpiScan} onClose={() => setScan(null)} />}
    {scan === "deposit" && <Scanner title="Scan the deposit QR" hint="Point the camera at the QR on your area manager's phone" onResult={onDepositScan} onClose={() => setScan(null)} />}
    {depositSheet()}
  </div>);
}
