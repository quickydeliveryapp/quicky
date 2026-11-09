"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/messages";
import HeroAdmin from "@/components/HeroAdmin";
import "./admin.css";

type Tab = "orders" | "riders" | "shops" | "commission" | "settlement" | "cash" | "fees" | "hero";
// the sidebar address -> the section it shows
const SLUG: Record<string, Tab> = { orders: "orders", riders: "riders", shops: "shops", commission: "commission", payouts: "settlement", "rider-cash": "cash", fees: "fees", banners: "hero" };
type Filter = "all" | "active" | "delayed" | "delivered" | "cancelled";

const TAB_LABEL: Record<Tab, string> = {
  orders: "Orders", riders: "Riders", shops: "Shops", commission: "Commission",
  settlement: "Shop payouts", cash: "Rider cash", fees: "Fees and limits", hero: "Banners",
};
const STATUS_LABEL: Record<string, string> = {
  placed: "Placed", accepted: "Accepted", packed: "Packed", picked_up: "On the way", delivered: "Delivered", cancelled: "Cancelled",
};
const STATUS_TONE: Record<string, string> = { delivered: "ok", cancelled: "bad", picked_up: "info" };
const FILTERS: [Filter, string][] = [["all", "All"], ["active", "In progress"], ["delayed", "Delayed"], ["delivered", "Delivered"], ["cancelled", "Cancelled"]];
const SHOP_TONE: Record<string, string> = { approved: "ok", suspended: "bad", pending: "" };
const SHOP_ORDER: Record<string, number> = { pending: 0, suspended: 1, approved: 2 };

const rupee = (n: any) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const clock = (ts: string) => new Date(ts).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
function ago(ts: string, now: number) {
  const m = Math.max(0, Math.floor((now - new Date(ts).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return m + " min ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + " h ago";
  return new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="adm-empty">{children}</p>;
const Fig = ({ label, value, cls = "" }: { label: string; value: React.ReactNode; cls?: string }) => (
  <div className={"adm-fig " + cls}><span>{label}</span><b>{value}</b></div>
);

export default function Admin() {
  const [role, setRole] = useState<string | null>(null);
  const path = usePathname() ?? "";
  const tab: Tab = SLUG[path.split("/")[2] ?? ""] ?? "orders";
  const [filter, setFilter] = useState<Filter>("all");
  const [orders, setOrders] = useState<any[]>([]);
  const [riders, setRiders] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [settle, setSettle] = useState<any[]>([]);
  const [cash, setCash] = useState<any[]>([]);
  const [fees, setFees] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [riderCost, setRiderCost] = useState("");
  const [packCost, setPackCost] = useState("");
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [now, setNow] = useState(Date.now());

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return; // logged-out visitors get the login dialog from the role gate in app/admin/layout.tsx
    const { data: me } = await supabase.from("profiles").select("role").eq("id", u.user.id).single();
    const r = me?.role ?? "customer"; setRole(r);
    if (r !== "admin" && r !== "area_manager") return;
    const [o, rd] = await Promise.all([
      supabase.from("orders").select("id,status,total,address,created_at,expected_delivery_at,cash_collected,fulfilment_shop_id,rider_id").order("created_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("id,phone,is_online,rider_approved").eq("role", "rider")]);
    setOrders(o.data || []); setRiders(rd.data || []);
    const cs = await supabase.rpc("rider_cash"); setCash(cs.data || []);
    if (r === "admin") {
      const [s, c] = await Promise.all([
        supabase.from("shops").select("id,name,address,status"),
        supabase.from("category_commissions").select("category,rate").order("category")]);
      setShops(s.data || []); setRates(c.data || []);
      const st = await supabase.rpc("shop_summary"); setSettle(st.data || []);
      const fe = await supabase.from("fee_settings").select("*").eq("id", 1).single(); setFees(fe.data);
      const sm = await supabase.rpc("quicky_summary"); setSummary(sm.data?.[0] ?? null);
    }
  }
  useEffect(() => { load(); const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await p;
    setToast({ text: error ? friendly(error.message) : "Saved", ok: !error });
    load();
  };
  const ask = (text: string, fn: () => void) => { if (window.confirm(text)) fn(); };
  const delayed = (o: any) =>
    (o.status === "picked_up" && o.expected_delivery_at && new Date(o.expected_delivery_at).getTime() < now) ||
    (o.status === "placed" && now - new Date(o.created_at).getTime() > 5 * 60000);

  if (role === null) return <p className="adm-empty">Loading...</p>;
  if (role !== "admin" && role !== "area_manager") return <p className="adm-empty">You don&apos;t have access to this page.</p>;

  const isActive = (o: any) => o.status !== "delivered" && o.status !== "cancelled";
  const shopName = (id: string) => shops.find((s) => s.id === id)?.name;
  const riderPhone = (id: string) => riders.find((r) => r.id === id)?.phone;
  const counts: Record<Filter, number> = {
    all: orders.length,
    active: orders.filter(isActive).length,
    delayed: orders.filter(delayed).length,
    delivered: orders.filter((o) => o.status === "delivered").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  };
  const shown = orders.filter((o) =>
    filter === "all" ? true : filter === "active" ? isActive(o) : filter === "delayed" ? delayed(o) : o.status === filter);
  const toApprove = role === "admin" ? shops.filter((s) => s.status === "pending").length : riders.filter((r) => !r.rider_approved).length;
  const sortedShops = [...shops].sort((a, b) => (SHOP_ORDER[a.status] ?? 3) - (SHOP_ORDER[b.status] ?? 3));

  return (<div className="adm">
    <h2 className="adm-title">{TAB_LABEL[tab]}</h2>
    {tab === "orders" && (
    <div className="adm-stats">
      <div className="adm-stat"><b>{counts.active}</b><span>Orders in progress</span></div>
      <div className={"adm-stat" + (counts.delayed ? " bad" : "")}><b>{counts.delayed}</b><span>Delayed orders</span></div>
      <div className="adm-stat"><b>{riders.filter((r) => r.is_online).length}</b><span>Riders online</span></div>
      <div className={"adm-stat" + (toApprove ? " warn" : "")}><b>{toApprove}</b><span>{role === "admin" ? "Shops waiting for approval" : "Riders waiting for approval"}</span></div>
    </div>

    )}
    {toast && <p className={"adm-toast" + (toast.ok ? "" : " bad")} role="status">{toast.text}</p>}

    {tab === "orders" && <>
      <div className="adm-chips">
        {FILTERS.map(([k, label]) => (
          <button key={k} className={"adm-chip" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>
            {label} <i>{counts[k]}</i>
          </button>))}
      </div>
      <p className="adm-hint">Showing your latest 50 orders.</p>
      {shown.length === 0 ? <Empty>No orders here yet.</Empty> : <div className="adm-list">
        {shown.map((o) => {
          const late = delayed(o);
          return (<article className={"adm-order" + (late ? " late" : "")} key={o.id}>
            <div className="adm-o-top">
              <span className={"adm-badge " + (STATUS_TONE[o.status] ?? "")}>{STATUS_LABEL[o.status] ?? o.status}</span>
              {late && <span className="adm-badge bad">Delayed</span>}
              <span className="adm-o-id">#{String(o.id).slice(0, 6)}</span>
              <span className="adm-o-time">{ago(o.created_at, now)}</span>
              <b className="adm-o-amt">{rupee(o.total)}</b>
            </div>
            <div className="adm-o-addr">{o.address}</div>
            <dl className="adm-meta">
              <div><dt>Shop</dt><dd>{(o.fulfilment_shop_id && shopName(o.fulfilment_shop_id)) || "—"}</dd></div>
              <div><dt>Rider</dt><dd>{o.rider_id ? (riderPhone(o.rider_id) ?? "—") : "Not assigned yet"}</dd></div>
              {o.status === "picked_up" && o.expected_delivery_at && <div><dt>Expected by</dt><dd>{clock(o.expected_delivery_at)}</dd></div>}
              {o.cash_collected != null && <div><dt>Cash received</dt><dd>{rupee(o.cash_collected)}</dd></div>}
            </dl>
          </article>);
        })}
      </div>}
    </>}

    {tab === "riders" && (riders.length === 0 ? <Empty>No riders have signed up yet.</Empty> : <div className="adm-grid">
      {riders.map((r) => (
        <div className="adm-card" key={r.id}>
          <div className="adm-head">
            <span className="adm-av">{String(r.phone || "?").slice(-2)}</span>
            <div><span className="adm-name">{r.phone}</span>
              <span className="adm-sub"><span className={"adm-dot" + (r.is_online ? " on" : "")} /> {r.is_online ? "Online" : "Offline"}</span></div>
            <span className={"adm-badge " + (r.rider_approved ? "ok" : "")}>{r.rider_approved ? "Approved" : "Pending"}</span>
          </div>
          <div className="adm-actions">
            {r.rider_approved
              ? <button className="danger" onClick={() => ask("Revoke approval for " + r.phone + "? They won't be able to take orders.", () => run(supabase.rpc("set_rider_approved", { p_id: r.id, p_ok: false })))}>Revoke approval</button>
              : <button onClick={() => run(supabase.rpc("set_rider_approved", { p_id: r.id, p_ok: true }))}>Approve rider</button>}
          </div>
        </div>))}
    </div>)}

    {tab === "shops" && (shops.length === 0 ? <Empty>No shops have signed up yet.</Empty> : <div className="adm-grid">
      {sortedShops.map((s) => (
        <div className="adm-card" key={s.id}>
          <div className="adm-head">
            <span className="adm-av">{String(s.name || "?").charAt(0).toUpperCase()}</span>
            <div><span className="adm-name">{s.name}</span><span className="adm-sub">{s.address || "No address added"}</span></div>
            <span className={"adm-badge " + (SHOP_TONE[s.status] ?? "")}>{s.status === "pending" ? "Pending" : s.status === "approved" ? "Approved" : "Suspended"}</span>
          </div>
          <div className="adm-actions">
            {s.status === "approved"
              ? <button className="danger" onClick={() => ask("Suspend " + s.name + "? It will stop receiving orders.", () => run(supabase.from("shops").update({ status: "suspended" }).eq("id", s.id)))}>Suspend shop</button>
              : <button onClick={() => run(supabase.from("shops").update({ status: "approved" }).eq("id", s.id))}>{s.status === "suspended" ? "Reinstate shop" : "Approve shop"}</button>}
          </div>
        </div>))}
    </div>)}

    {tab === "commission" && <>
      <p className="adm-hint">Commission % by category. Changes apply to new orders only.</p>
      {rates.length === 0 ? <Empty>No categories set up yet.</Empty> : <div className="adm-grid">
        {rates.map((c) => (<div className="adm-field" key={c.category}>
          <span>{c.category}</span>
          <span><input className="adm-input" style={{ width: 80 }} defaultValue={c.rate} inputMode="decimal" aria-label={c.category + " commission percent"}
            onBlur={(e) => Number(e.target.value) !== Number(c.rate) && run(supabase.from("category_commissions").update({ rate: Number(e.target.value) }).eq("category", c.category))} /> %</span>
        </div>))}
      </div>}
    </>}

    {tab === "settlement" && (settle.length === 0 ? <Empty>No shop earnings yet. They appear after the first delivered order.</Empty> : <div className="adm-grid">
      {settle.map((r) => (
        <div className="adm-card" key={r.out_shop_id}>
          <div className="adm-head">
            <span className="adm-av">{String(r.out_name || "?").charAt(0).toUpperCase()}</span>
            <div><span className="adm-name">{r.out_name}</span><span className="adm-sub">{r.orders_count} delivered orders</span></div>
          </div>
          <div className="adm-figs">
            <Fig label="Earned" value={rupee(r.earned)} />
            <Fig label="Paid out" value={rupee(r.paid)} />
            <Fig label="Balance due" value={rupee(r.balance)} cls="hl" />
          </div>
          <span className="adm-sub">Item value {rupee(r.gross)} minus commission {rupee(r.commission)}</span>
          <div className="adm-actions">
            <button onClick={() => { const a = Number(window.prompt("Payout amount (₹)?")); if (a > 0) run(supabase.rpc("record_payout", { p_shop: r.out_shop_id, p_amount: a, p_note: "" })); }}>Record payout</button>
          </div>
        </div>))}
    </div>)}

    {tab === "cash" && (cash.length === 0 ? <Empty>No rider cash to show yet.</Empty> : <div className="adm-grid">
      {cash.map((r) => (
        <div className="adm-card" key={r.out_rider}>
          <div className="adm-head">
            <span className="adm-av">{String(r.rider_phone || "?").slice(-2)}</span>
            <div><span className="adm-name">{r.rider_phone}</span><span className="adm-sub">{r.deliveries} deliveries</span></div>
            {Number(r.pending) > Number(fees?.rider_cash_limit ?? Infinity) && <span className="adm-badge bad">Over limit</span>}
          </div>
          <div className="adm-figs">
            <Fig label="Collected" value={rupee(r.collected)} />
            <Fig label="Deposited" value={rupee(r.deposited)} />
            <Fig label={Number(r.pending) < 0 ? "Advance balance" : "Still to deposit"} value={rupee(Math.abs(Number(r.pending)))} cls="hl" />
          </div>
          <div className="adm-actions">
            <button onClick={() => { const a = Number(window.prompt("Cash deposited by rider (₹)?")); if (a > 0) run(supabase.rpc("record_cash_deposit", { p_rider: r.out_rider, p_amount: a })); }}>Record deposit</button>
          </div>
        </div>))}
    </div>)}

    {tab === "fees" && (fees ? <>
      <div className="adm-grid">
        {[["delivery_fee", "Delivery fee (₹)"], ["free_delivery_above", "Free delivery above (₹)"], ["small_cart_threshold", "Small cart fee applies below (₹)"], ["small_cart_fee", "Small cart fee (₹)"], ["rider_cash_limit", "Rider cash limit (₹)"]].map(([k, l]) => (
          <label className="adm-field" key={k}><span>{l}</span>
            <input className="adm-input" defaultValue={fees[k]} inputMode="decimal"
              onBlur={(e) => Number(e.target.value) !== Number(fees[k]) && run(supabase.from("fee_settings").update({ [k]: Number(e.target.value) }).eq("id", 1))} /></label>))}
      </div>
      <p className="adm-hint">Rider cash limit: a rider sees the Deposit option once they hold more than this much of Quicky&apos;s money.</p>
      <h3 className="adm-h">Profit per delivered order</h3>
      {summary && Number(summary.delivered) > 0 ? (() => {
        const n = Number(summary.delivered);
        const rev = (Number(summary.commission) + Number(summary.fees)) / n;
        const profit = rev - Number(riderCost || 0) - Number(packCost || 0);
        return (<div className="adm-card">
          <div className="adm-figs">
            <Fig label="Delivered orders" value={n} />
            <Fig label="Quicky revenue per order" value={rupee(rev.toFixed(2))} />
            <Fig label="Profit per order" value={rupee(profit.toFixed(2))} cls={profit < 0 ? "neg" : "hl"} />
          </div>
          <span className="adm-sub">Revenue is commission {rupee(summary.commission)} plus delivery and small cart fees {rupee(summary.fees)}.</span>
          <label className="adm-field"><span>Rider cost per order (₹)</span>
            <input className="adm-input" value={riderCost} onChange={(e) => setRiderCost(e.target.value)} inputMode="decimal" /></label>
          <label className="adm-field"><span>Packing and other cost per order (₹)</span>
            <input className="adm-input" value={packCost} onChange={(e) => setPackCost(e.target.value)} inputMode="decimal" /></label>
        </div>);
      })() : <Empty>No delivered orders with the new fees yet.</Empty>}
    </> : <Empty>Fee settings could not be loaded.</Empty>)}

    {tab === "hero" && <HeroAdmin freeAbove={fees ? Number(fees.free_delivery_above) : undefined} />}
  </div>);
}
