"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/messages";
import HeroAdmin from "@/components/HeroAdmin";
import * as catLib from "@/lib/categories";
import "./admin.css";
import "./dash.css";
import { DataTable, Stop, SidePanel, KV, type Col } from "./ui";
import { IBag, IClock, IRider, IShop, ICash, ICheck, ICross, IArrow, ISearch } from "./icons";

type Tab = "orders" | "riders" | "shops" | "commission" | "settlement" | "cash" | "fees" | "hero";
// the sidebar address -> the section it shows
const SLUG: Record<string, Tab> = { orders: "orders", riders: "riders", shops: "shops", commission: "commission", payouts: "settlement", "rider-cash": "cash", fees: "fees", banners: "hero" };
type Filter = "all" | "active" | "delayed" | "delivered" | "cancelled";

const STATUS_LABEL: Record<string, string> = {
  placed: "Placed", accepted: "Accepted", packed: "Packed", picked_up: "On the way", delivered: "Delivered", cancelled: "Cancelled",
};
const STATUS_TONE: Record<string, string> = { delivered: "ok", cancelled: "bad", picked_up: "info" };
const FILTERS: [Filter, string][] = [["all", "All"], ["active", "In progress"], ["delayed", "Delayed"], ["delivered", "Delivered"], ["cancelled", "Cancelled"]];
const SHOP_TONE: Record<string, string> = { approved: "ok", suspended: "bad", pending: "" };
const SHOP_ORDER: Record<string, number> = { pending: 0, suspended: 1, approved: 2 };

const RANGES: [string, string][] = [["7", "Last 7 Days"], ["30", "Last 30 Days"], ["90", "Last 90 Days"], ["0", "All time"]];
const shortDate = (ts: string) => new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const longDate = (ts: string) => new Date(ts).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
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

// category name -> picture, read from lib/categories.ts (the same pictures the customer app uses)
const CAT_IMG: Record<string, string> = {};
(Object.values(catLib) as unknown[]).forEach((v) => {
  if (Array.isArray(v)) v.forEach((c: any) => { if (c && typeof c.name === "string" && typeof c.img === "string") CAT_IMG[c.name.toLowerCase()] = c.img; });
});
function CatPic({ name }: { name: string }) {
  const src = CAT_IMG[String(name).toLowerCase()];
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img className="adm-cat-img" src={src} alt="" loading="lazy" /> : <span className="adm-av">{String(name).charAt(0)}</span>;
}

const Card = ({ title, sub, tools, children }: { title: string; sub?: React.ReactNode; tools?: React.ReactNode; children: React.ReactNode }) => (
  <section className="dash-card" aria-label={title}>
    <div className="dash-card-head">
      <div><h3>{title}</h3>{sub && <p className="dash-sub">{sub}</p>}</div>
      {tools && <div className="dash-tools">{tools}</div>}
    </div>
    {children}
  </section>
);
const DSearch = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <label className="dash-search"><ISearch />
    <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} /></label>
);
function Pills<K extends string>({ items, value, onChange }: { items: [K, string, number][]; value: K; onChange: (k: K) => void }) {
  return (<div className="dash-pills" role="tablist">
    {items.map(([k, label, n]) => (
      <button key={k} role="tab" aria-selected={value === k} className={"dash-pill" + (value === k ? " on" : "")} onClick={() => onChange(k)}>{label} ({n})</button>))}
  </div>);
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
  const [q, setQ] = useState("");
  const [rTab, setRTab] = useState<"all" | "online" | "offline" | "pending">("all");
  const [sTab, setSTab] = useState<"all" | "pending" | "approved" | "suspended">("all");
  const [range, setRange] = useState("30");
  const [userName, setUserName] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const closePanel = useCallback(() => setOpenId(null), []);
  useEffect(() => { setQ(""); setOpenId(null); }, [tab]);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return; // logged-out visitors get the login dialog from the role gate in app/admin/layout.tsx
    const meta: any = u.user.user_metadata ?? {};
    setUserName(String(meta.full_name ?? meta.name ?? "").trim());
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
  // Orders in the chosen date range that match the search box; the pill counts are taken from this list
  const orderNeedle = q.trim().toLowerCase();
  const inRange = orders.filter((o) => {
    if (range !== "0" && now - new Date(o.created_at).getTime() > Number(range) * 86400000) return false;
    if (!orderNeedle) return true;
    return [String(o.id).slice(0, 6), o.id, o.address, o.fulfilment_shop_id && shopName(o.fulfilment_shop_id), o.rider_id && riderPhone(o.rider_id)]
      .some((v) => v && String(v).toLowerCase().includes(orderNeedle));
  });
  const counts: Record<Filter, number> = {
    all: inRange.length,
    active: inRange.filter(isActive).length,
    delayed: inRange.filter(delayed).length,
    delivered: inRange.filter((o) => o.status === "delivered").length,
    cancelled: inRange.filter((o) => o.status === "cancelled").length,
  };
  // the four top cards always show the live picture, whatever range or search is chosen
  const liveActive = orders.filter(isActive).length;
  const liveDelayed = orders.filter(delayed).length;
  const shown = inRange.filter((o) =>
    filter === "all" ? true : filter === "active" ? isActive(o) : filter === "delayed" ? delayed(o) : o.status === filter);
  const selOrder = tab === "orders" ? orders.find((o) => o.id === openId) : undefined;
  const toApprove = role === "admin" ? shops.filter((s) => s.status === "pending").length : riders.filter((r) => !r.rider_approved).length;
  const sortedShops = [...shops].sort((a, b) => (SHOP_ORDER[a.status] ?? 3) - (SHOP_ORDER[b.status] ?? 3));

  // ---- Riders and Shops tables ----
  const cashOf = new Map<string, any>(cash.map((c) => [c.out_rider, c]));
  const settleOf = new Map<string, any>(settle.map((x) => [x.out_shop_id, x]));
  const cashLimit = Number(fees?.rider_cash_limit ?? Infinity);
  const needle = q.trim().toLowerCase();
  const ridersOnline = riders.filter((r) => r.is_online).length;
  const ridersWaiting = riders.filter((r) => !r.rider_approved).length;
  const riderRows = riders
    .filter((r) => (rTab === "all" ? true : rTab === "online" ? r.is_online : rTab === "offline" ? !r.is_online : !r.rider_approved))
    .filter((r) => !needle || String(r.phone ?? "").toLowerCase().includes(needle))
    .sort((a, b) => Number(!!a.rider_approved) - Number(!!b.rider_approved) || Number(!!b.is_online) - Number(!!a.is_online) || String(a.phone).localeCompare(String(b.phone)));
  const shopRows = sortedShops
    .filter((x) => sTab === "all" || x.status === sTab)
    .filter((x) => !needle || String(x.name ?? "").toLowerCase().includes(needle) || String(x.address ?? "").toLowerCase().includes(needle));
  const shopStatus = (st: string) => (st === "pending" ? "Pending" : st === "approved" ? "Approved" : "Suspended");

  const riderAction = (r: any) => r.rider_approved
    ? <button className="sm danger" onClick={() => ask("Revoke approval for " + r.phone + "? They won't be able to take orders.", () => run(supabase.rpc("set_rider_approved", { p_id: r.id, p_ok: false })))}>Revoke approval</button>
    : <button className="sm" onClick={() => run(supabase.rpc("set_rider_approved", { p_id: r.id, p_ok: true }))}>Approve rider</button>;
  const shopAction = (x: any) => x.status === "approved"
    ? <button className="sm danger" onClick={() => ask("Suspend " + x.name + "? It will stop receiving orders.", () => run(supabase.from("shops").update({ status: "suspended" }).eq("id", x.id)))}>Suspend shop</button>
    : <button className="sm" onClick={() => run(supabase.from("shops").update({ status: "approved" }).eq("id", x.id))}>{x.status === "suspended" ? "Reinstate shop" : "Approve shop"}</button>;

  const riderCols: Col<any>[] = [
    { key: "rider", label: "Rider", sort: (a, b) => String(a.phone).localeCompare(String(b.phone)), render: (r) => (
      <div className="ui-who"><span className="adm-av">{String(r.phone || "?").slice(-2)}</span>
        <div><span className="ui-name">{r.phone}</span><span className="ui-meta">{cashOf.get(r.id)?.deliveries ?? 0} deliveries<span className="show-sm"> · {r.is_online ? "Online" : "Offline"} · {r.rider_approved ? "Approved" : "Pending"}</span></span></div></div>) },
    { key: "status", label: "Status", hideSm: true, sort: (a, b) => Number(!!a.is_online) - Number(!!b.is_online), render: (r) => (
      <span className="ui-state"><span className={"adm-dot" + (r.is_online ? " on" : "")} />{r.is_online ? "Online" : "Offline"}</span>) },
    { key: "approval", label: "Approval", hideSm: true, sort: (a, b) => Number(!!a.rider_approved) - Number(!!b.rider_approved), render: (r) => (
      <span className={"adm-badge " + (r.rider_approved ? "ok" : "")}>{r.rider_approved ? "Approved" : "Pending"}</span>) },
    { key: "cash", label: "Cash to deposit", num: true, hideSm: true, sort: (a, b) => Number(cashOf.get(a.id)?.pending ?? 0) - Number(cashOf.get(b.id)?.pending ?? 0), render: (r) => {
      const p = cashOf.get(r.id)?.pending;
      if (p == null) return "—";
      return Number(p) < 0 ? rupee(Math.abs(Number(p))) + " advance" : <span className={Number(p) > cashLimit ? "ui-neg" : undefined}>{rupee(p)}</span>; } },
    { key: "act", label: "", render: (r) => <Stop><div className="ui-act">{riderAction(r)}</div></Stop> },
  ];
  const shopCols: Col<any>[] = [
    { key: "shop", label: "Shop", sort: (a, b) => String(a.name).localeCompare(String(b.name)), render: (x) => (
      <div className="ui-who"><span className="adm-av">{String(x.name || "?").charAt(0).toUpperCase()}</span>
        <div><span className="ui-name">{x.name}</span><span className="ui-meta">{x.address || "No address added"}<span className="show-sm"> · {shopStatus(x.status)}</span></span></div></div>) },
    { key: "status", label: "Status", hideSm: true, sort: (a, b) => (SHOP_ORDER[a.status] ?? 3) - (SHOP_ORDER[b.status] ?? 3), render: (x) => (
      <span className={"adm-badge " + (SHOP_TONE[x.status] ?? "")}>{shopStatus(x.status)}</span>) },
    { key: "orders", label: "Delivered", num: true, hideSm: true, sort: (a, b) => Number(settleOf.get(a.id)?.orders_count ?? 0) - Number(settleOf.get(b.id)?.orders_count ?? 0), render: (x) => String(settleOf.get(x.id)?.orders_count ?? 0) },
    { key: "due", label: "Balance due", num: true, hideSm: true, sort: (a, b) => Number(settleOf.get(a.id)?.balance ?? 0) - Number(settleOf.get(b.id)?.balance ?? 0), render: (x) => (settleOf.get(x.id) ? rupee(settleOf.get(x.id).balance) : "—") },
    { key: "act", label: "", render: (x) => <Stop><div className="ui-act">{shopAction(x)}</div></Stop> },
  ];
  const selRider = tab === "riders" ? riders.find((r) => r.id === openId) : undefined;
  const selShop = tab === "shops" ? shops.find((x) => x.id === openId) : undefined;
  const headSub = tab === "riders"
    ? `${riders.length} rider${riders.length === 1 ? "" : "s"} · ${ridersOnline} online${ridersWaiting ? ` · ${ridersWaiting} waiting for approval` : ""}`
    : tab === "shops"
      ? `${shops.length} shop${shops.length === 1 ? "" : "s"}${toApprove && role === "admin" ? ` · ${toApprove} waiting for approval` : ""}`
      : undefined;

  return (<div className={"adm" + (tab === "orders" ? "" : " dash-offset")}>
    {tab === "orders"
      ? <div className="dash-welcome"><h2>{userName ? `Welcome back, ${userName}!` : "Welcome back!"}</h2><p>Here&apos;s what&apos;s happening with your platform.</p></div>
      : null}
    {tab === "orders" && (
    <div className="dash-stats">
      {([
        ["green", <IBag key="i" />, liveActive, "Orders in progress"],
        [liveDelayed ? "bad" : "blue", <IClock key="i" />, liveDelayed, "Delayed orders"],
        ["green", <IRider key="i" />, ridersOnline, "Riders online"],
        ["purple", <IShop key="i" />, toApprove, role === "admin" ? "Shops waiting for approval" : "Riders waiting for approval"],
      ] as [string, React.ReactNode, number, string][]).map(([tone, icon, n, label]) => (
        <div className={"dash-stat " + tone} key={label}>
          <span className="dash-stat-ic">{icon}</span>
          <div><b>{n}</b><span className="dash-stat-l">{label}</span></div>
        </div>))}
    </div>
    )}
    {toast && <p className={"adm-toast" + (toast.ok ? "" : " bad")} role="status">{toast.text}</p>}

    {tab === "orders" && <section className="dash-card" aria-label="Orders">
      <div className="dash-card-head">
        <h3>Orders</h3>
        <div className="dash-tools">
          <label className="dash-search"><ISearch />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search orders..." aria-label="Search orders" /></label>
          <select className="dash-range" value={range} onChange={(e) => setRange(e.target.value)} aria-label="Date range">
            {RANGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="dash-pills" role="tablist">
        {FILTERS.map(([k, label]) => (
          <button key={k} role="tab" aria-selected={filter === k} className={"dash-pill" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>
            {label} ({counts[k]})
          </button>))}
      </div>
      {orders.length >= 50 && <p className="dash-note">Showing your latest 50 orders.</p>}
      {shown.length === 0 ? <Empty>{orders.length === 0 ? "No orders here yet." : "No orders match."}</Empty> : <div className="dash-list">
        {shown.map((o) => {
          const late = delayed(o);
          const shop = o.fulfilment_shop_id && shopName(o.fulfilment_shop_id);
          return (<article className={"dash-row" + (late ? " late" : "")} key={o.id}>
            <div className="dash-main">
              <div className="dash-badges">
                <span className={"dash-badge " + (STATUS_TONE[o.status] ?? "")}>
                  {o.status === "delivered" ? <ICheck /> : o.status === "cancelled" ? <ICross /> : <IClock size={20} />}
                  {STATUS_LABEL[o.status] ?? o.status}
                </span>
                {late && <span className="dash-badge bad">Delayed</span>}
              </div>
              <p className="dash-id">#{String(o.id).slice(0, 6)} • {shortDate(o.created_at)}</p>
              <p className="dash-addr">{o.address}</p>
            </div>
            <div className="dash-cell c1"><IShop size={22} /><div><span>Shop</span><b>{shop || "—"}</b></div></div>
            <div className="dash-cell c2"><IRider size={22} /><div><span>Rider</span><b>{o.rider_id ? (riderPhone(o.rider_id) ?? "—") : "Not assigned yet"}</b></div></div>
            <div className="dash-cell c3">{o.cash_collected != null && <><ICash /><div><span>Cash received</span><b>{rupee(o.cash_collected)}</b></div></>}</div>
            <div className="dash-end">
              <b className="dash-amt">{rupee(o.total)}</b>
              <button className="dash-view" onClick={() => setOpenId(o.id)}>View Details <IArrow /></button>
            </div>
          </article>);
        })}
      </div>}
    </section>}

    {tab === "riders" && <Card title="Riders" sub={headSub} tools={<DSearch value={q} onChange={setQ} placeholder="Search by phone number" />}>
      <Pills value={rTab} onChange={setRTab} items={[
        ["all", "All", riders.length], ["online", "Online", ridersOnline], ["offline", "Offline", riders.length - ridersOnline], ["pending", "Waiting for approval", ridersWaiting]]} />
      <DataTable cols={riderCols} rows={riderRows} rowKey={(r) => r.id} onOpen={(r) => setOpenId(r.id)}
        empty={<Empty>{riders.length === 0 ? "No riders have signed up yet." : "No riders match."}</Empty>} />
    </Card>}

    {tab === "shops" && <Card title="Shops" sub={headSub} tools={<DSearch value={q} onChange={setQ} placeholder="Search by shop name or address" />}>
      <Pills value={sTab} onChange={setSTab} items={[
        ["all", "All", shops.length], ["pending", "Pending", shops.filter((x) => x.status === "pending").length],
        ["approved", "Approved", shops.filter((x) => x.status === "approved").length], ["suspended", "Suspended", shops.filter((x) => x.status === "suspended").length]]} />
      <DataTable cols={shopCols} rows={shopRows} rowKey={(x) => x.id} onOpen={(x) => setOpenId(x.id)}
        empty={<Empty>{shops.length === 0 ? "No shops have signed up yet." : "No shops match."}</Empty>} />
    </Card>}

    {tab === "commission" && <Card title="Commission" sub="Commission % by category. Changes apply to new orders only.">
      {rates.length === 0 ? <Empty>No categories set up yet.</Empty> : <div className="dash-grid">
        {rates.map((c) => (<div className="dash-tile" key={c.category}>
          <span className="adm-cat"><CatPic name={c.category} /><span>{c.category}</span></span>
          <span className="dash-pct"><input className="dash-input" style={{ width: 84 }} defaultValue={c.rate} inputMode="decimal" aria-label={c.category + " commission percent"}
            onBlur={(e) => Number(e.target.value) !== Number(c.rate) && run(supabase.from("category_commissions").update({ rate: Number(e.target.value) }).eq("category", c.category))} /> %</span>
        </div>))}
      </div>}
    </Card>}

    {tab === "settlement" && <Card title="Shop Payouts" sub={settle.length ? `${settle.length} shop${settle.length === 1 ? "" : "s"}` : undefined}>
      {settle.length === 0 ? <Empty>No shop earnings yet. They appear after the first delivered order.</Empty> : <div className="dash-list">
        {settle.map((r) => (
          <article className="dash-row" key={r.out_shop_id}>
            <div className="dash-main">
              <div className="ui-who"><span className="adm-av">{String(r.out_name || "?").charAt(0).toUpperCase()}</span>
                <div><p className="dash-addr">{r.out_name}</p><p className="dash-id" style={{ margin: "2px 0 0" }}>{r.orders_count} delivered orders</p></div></div>
              <p className="dash-id">Item value {rupee(r.gross)} minus commission {rupee(r.commission)}</p>
            </div>
            <div className="dash-cell c1"><ICash /><div><span>Earned</span><b>{rupee(r.earned)}</b></div></div>
            <div className="dash-cell c2"><ICash /><div><span>Paid out</span><b>{rupee(r.paid)}</b></div></div>
            <div className="dash-cell c3"><ICash /><div><span>Balance due</span><b className="dash-hl">{rupee(r.balance)}</b></div></div>
            <div className="dash-end">
              <button className="dash-view" onClick={() => { const a = Number(window.prompt("Payout amount (₹)?")); if (a > 0) run(supabase.rpc("record_payout", { p_shop: r.out_shop_id, p_amount: a, p_note: "" })); }}>Record payout <IArrow /></button>
            </div>
          </article>))}
      </div>}
    </Card>}

    {tab === "cash" && <Card title="Rider Cash" sub={cash.length ? `${cash.length} rider${cash.length === 1 ? "" : "s"}` : undefined}>
      {cash.length === 0 ? <Empty>No rider cash to show yet.</Empty> : <div className="dash-list">
        {cash.map((r) => {
          const over = Number(r.pending) > Number(fees?.rider_cash_limit ?? Infinity);
          return (<article className={"dash-row" + (over ? " late" : "")} key={r.out_rider}>
            <div className="dash-main">
              <div className="ui-who"><span className="adm-av">{String(r.rider_phone || "?").slice(-2)}</span>
                <div><p className="dash-addr">{r.rider_phone}</p><p className="dash-id" style={{ margin: "2px 0 0" }}>{r.deliveries} deliveries</p></div></div>
              {over && <div className="dash-badges" style={{ marginTop: 10 }}><span className="dash-badge bad">Over limit</span></div>}
            </div>
            <div className="dash-cell c1"><ICash /><div><span>Collected</span><b>{rupee(r.collected)}</b></div></div>
            <div className="dash-cell c2"><ICash /><div><span>Deposited</span><b>{rupee(r.deposited)}</b></div></div>
            <div className="dash-cell c3"><ICash /><div><span>{Number(r.pending) < 0 ? "Advance balance" : "Still to deposit"}</span><b className="dash-hl">{rupee(Math.abs(Number(r.pending)))}</b></div></div>
            <div className="dash-end">
              <button className="dash-view" onClick={() => { const a = Number(window.prompt("Cash deposited by rider (₹)?")); if (a > 0) run(supabase.rpc("record_cash_deposit", { p_rider: r.out_rider, p_amount: a })); }}>Record deposit <IArrow /></button>
            </div>
          </article>);
        })}
      </div>}
    </Card>}

    {tab === "fees" && <Card title="Fees & Limits" sub="Changes save when you leave the box.">
      {fees ? <>
        <div className="dash-grid">
          {[["delivery_fee", "Delivery fee (₹)"], ["free_delivery_above", "Free delivery above (₹)"], ["small_cart_threshold", "Small cart fee applies below (₹)"], ["small_cart_fee", "Small cart fee (₹)"], ["rider_cash_limit", "Rider cash limit (₹)"]].map(([k, l]) => (
            <label className="dash-tile dash-field" key={k}><span>{l}</span>
              <input className="dash-input" defaultValue={fees[k]} inputMode="decimal"
                onBlur={(e) => Number(e.target.value) !== Number(fees[k]) && run(supabase.from("fee_settings").update({ [k]: Number(e.target.value) }).eq("id", 1))} /></label>))}
        </div>
        <p className="dash-note">Rider cash limit: a rider sees the Deposit option once they hold more than this much of Quicky&apos;s money.</p>
        <h4 className="dash-h">Profit per delivered order</h4>
        {summary && Number(summary.delivered) > 0 ? (() => {
          const n = Number(summary.delivered);
          const rev = (Number(summary.commission) + Number(summary.fees)) / n;
          const profit = rev - Number(riderCost || 0) - Number(packCost || 0);
          return (<div className="dash-tile dash-profit">
            <div className="dash-figs">
              <div className="dash-fig"><span>Delivered orders</span><b>{n}</b></div>
              <div className="dash-fig"><span>Quicky revenue per order</span><b>{rupee(rev.toFixed(2))}</b></div>
              <div className={"dash-fig " + (profit < 0 ? "neg" : "hl")}><span>Profit per order</span><b>{rupee(profit.toFixed(2))}</b></div>
            </div>
            <p className="dash-note" style={{ margin: 0 }}>Revenue is commission {rupee(summary.commission)} plus delivery and small cart fees {rupee(summary.fees)}.</p>
            <div className="dash-grid">
              <label className="dash-field"><span>Rider cost per order (₹)</span>
                <input className="dash-input" value={riderCost} onChange={(e) => setRiderCost(e.target.value)} inputMode="decimal" /></label>
              <label className="dash-field"><span>Packing and other cost per order (₹)</span>
                <input className="dash-input" value={packCost} onChange={(e) => setPackCost(e.target.value)} inputMode="decimal" /></label>
            </div>
          </div>);
        })() : <Empty>No delivered orders with the new fees yet.</Empty>}
      </> : <Empty>Fee settings could not be loaded.</Empty>}
    </Card>}

    {tab === "hero" && <Card title="Banners"><HeroAdmin freeAbove={fees ? Number(fees.free_delivery_above) : undefined} /></Card>}

    {selOrder && (
      <SidePanel title={"Order #" + String(selOrder.id).slice(0, 6)} onClose={closePanel}
        sub={<>{STATUS_LABEL[selOrder.status] ?? selOrder.status} · {ago(selOrder.created_at, now)}</>}>
        <div className="adm-figs">
          <Fig label="Order total" value={rupee(selOrder.total)} cls="hl" />
          <Fig label="Cash received" value={selOrder.cash_collected != null ? rupee(selOrder.cash_collected) : "—"} />
        </div>
        <KV rows={[
          ["Status", (STATUS_LABEL[selOrder.status] ?? selOrder.status) + (delayed(selOrder) ? " (delayed)" : "")],
          ["Placed on", longDate(selOrder.created_at)],
          ...(selOrder.status === "picked_up" && selOrder.expected_delivery_at ? [["Expected by", clock(selOrder.expected_delivery_at)] as [string, React.ReactNode]] : []),
          ["Address", selOrder.address || "—"],
          ["Shop", (selOrder.fulfilment_shop_id && shopName(selOrder.fulfilment_shop_id)) || "—"],
          ["Rider", selOrder.rider_id ? (riderPhone(selOrder.rider_id) ?? "—") : "Not assigned yet"],
          ["Order ID", String(selOrder.id)],
        ]} />
      </SidePanel>)}

    {selRider && (() => { const c = cashOf.get(selRider.id); return (
      <SidePanel title={selRider.phone || "Rider"} onClose={closePanel}
        sub={<><span className={"adm-dot" + (selRider.is_online ? " on" : "")} /> {selRider.is_online ? "Online now" : "Offline"}</>}
        footer={<>
          {riderAction(selRider)}
          {c && <button className="sm alt" onClick={() => { const a = Number(window.prompt("Cash deposited by rider (₹)?")); if (a > 0) run(supabase.rpc("record_cash_deposit", { p_rider: selRider.id, p_amount: a })); }}>Record deposit</button>}
        </>}>
        {c ? <div className="adm-figs">
          <Fig label="Deliveries" value={c.deliveries} />
          <Fig label="Collected" value={rupee(c.collected)} />
          <Fig label="Deposited" value={rupee(c.deposited)} />
          <Fig label={Number(c.pending) < 0 ? "Advance balance" : "Still to deposit"} value={rupee(Math.abs(Number(c.pending)))} cls="hl" />
        </div> : <p className="adm-hint">No deliveries or cash recorded for this rider yet.</p>}
        <KV rows={[["Approval", selRider.rider_approved ? "Approved" : "Waiting for approval"], ["Availability", selRider.is_online ? "Online" : "Offline"], ["Phone", selRider.phone || "—"], ["Rider ID", String(selRider.id).slice(0, 8)]]} />
      </SidePanel>); })()}

    {selShop && (() => { const st = settleOf.get(selShop.id); return (
      <SidePanel title={selShop.name || "Shop"} sub={selShop.address || "No address added"} onClose={closePanel}
        footer={<>
          {shopAction(selShop)}
          {st && <button className="sm alt" onClick={() => { const a = Number(window.prompt("Payout amount (₹)?")); if (a > 0) run(supabase.rpc("record_payout", { p_shop: selShop.id, p_amount: a, p_note: "" })); }}>Record payout</button>}
        </>}>
        {st ? <div className="adm-figs">
          <Fig label="Earned" value={rupee(st.earned)} />
          <Fig label="Paid out" value={rupee(st.paid)} />
          <Fig label="Balance due" value={rupee(st.balance)} cls="hl" />
        </div> : <p className="adm-hint">No earnings yet. They appear after the first delivered order.</p>}
        <KV rows={[["Status", shopStatus(selShop.status)], ["Delivered orders", String(st?.orders_count ?? 0)], ["Item value", st ? rupee(st.gross) : "—"], ["Commission", st ? rupee(st.commission) : "—"]]} />
      </SidePanel>); })()}
  </div>);
}
