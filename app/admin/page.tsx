"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/messages";
import HeroAdmin from "@/components/HeroAdmin";
import * as catLib from "@/lib/categories";
import "./admin.css";
import Dashboard from "./Dashboard";
import OrdersPage from "./OrdersPage";
import { PageHead, Search, Tabs, DataTable, Stop, SidePanel, KV, type Col } from "./ui";

type Tab = "dashboard" | "orders" | "riders" | "shops" | "commission" | "settlement" | "cash" | "fees" | "hero";
// the sidebar address -> the section it shows
const SLUG: Record<string, Tab> = { orders: "orders", riders: "riders", shops: "shops", commission: "commission", payouts: "settlement", "rider-cash": "cash", fees: "fees", banners: "hero" };

const TAB_LABEL: Record<Tab, string> = {
  dashboard: "Dashboard", orders: "Orders", riders: "Riders", shops: "Shops", commission: "Commission",
  settlement: "Shop payouts", cash: "Rider cash", fees: "Fees and limits", hero: "Banners",
};
const SHOP_TONE: Record<string, string> = { approved: "ok", suspended: "bad", pending: "" };
const SHOP_ORDER: Record<string, number> = { pending: 0, suspended: 1, approved: 2 };

const rupee = (n: any) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
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

const Empty = ({ children }: { children: React.ReactNode }) => <p className="adm-empty">{children}</p>;
const Fig = ({ label, value, cls = "" }: { label: string; value: React.ReactNode; cls?: string }) => (
  <div className={"adm-fig " + cls}><span>{label}</span><b>{value}</b></div>
);

export default function Admin() {
  const [role, setRole] = useState<string | null>(null);
  const path = usePathname() ?? "";
  const tab: Tab = SLUG[path.split("/")[2] ?? ""] ?? "dashboard";
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
  const [openId, setOpenId] = useState<string | null>(null);
  const closePanel = useCallback(() => setOpenId(null), []);
  useEffect(() => { setQ(""); setOpenId(null); }, [tab]);

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return; // logged-out visitors get the login dialog from the role gate in app/admin/layout.tsx
    const { data: me } = await supabase.from("profiles").select("role").eq("id", u.user.id).single();
    const r = me?.role ?? "customer"; setRole(r);
    if (r !== "admin" && r !== "area_manager") return;
    const [o, rd] = await Promise.all([
      supabase.from("orders").select("id,status,total,address,created_at,expected_delivery_at,cash_collected,fulfilment_shop_id,rider_id").order("created_at", { ascending: false }).limit(100),
      supabase.from("profiles").select("id,phone,is_online,rider_approved").eq("role", "rider")]);
    setOrders(o.data || []); setRiders(rd.data || []); setNow(Date.now());
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
  useEffect(() => {
    load();
    const ch = supabase.channel("admin-orders").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => load()).subscribe();
    const poll = setInterval(load, 30000); // safety net if the live connection drops
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => { supabase.removeChannel(ch); clearInterval(poll); clearInterval(tick); };
  }, []);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await p;
    setToast({ text: error ? friendly(error.message) : "Saved", ok: !error });
    load();
  };
  const ask = (text: string, fn: () => void) => { if (window.confirm(text)) fn(); };
  if (role === null) return <p className="adm-empty">Loading...</p>;
  if (role !== "admin" && role !== "area_manager") return <p className="adm-empty">You don&apos;t have access to this page.</p>;

  const shopName = (id: string) => shops.find((s) => s.id === id)?.name;
  const riderPhone = (id: string) => riders.find((r) => r.id === id)?.phone;
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

  return (<div className="adm">
    {tab !== "dashboard" && <PageHead title={TAB_LABEL[tab]} sub={headSub} />}
    {toast && <p className={"adm-toast" + (toast.ok ? "" : " bad")} role="status">{toast.text}</p>}

    {tab === "dashboard" && <Dashboard orders={orders} riders={riders} shops={shops} cash={cash} now={now} role={role} shopName={shopName} riderPhone={riderPhone} />}
    {tab === "orders" && <OrdersPage orders={orders} now={now} shopName={shopName} riderPhone={riderPhone} />}

    {tab === "riders" && <>
      <div className="ui-bar"><Search value={q} onChange={setQ} placeholder="Search by phone number" /></div>
      <Tabs value={rTab} onChange={setRTab} items={[
        ["all", "All", riders.length], ["online", "Online", ridersOnline], ["offline", "Offline", riders.length - ridersOnline], ["pending", "Waiting for approval", ridersWaiting]]} />
      <DataTable cols={riderCols} rows={riderRows} rowKey={(r) => r.id} onOpen={(r) => setOpenId(r.id)}
        empty={<Empty>{riders.length === 0 ? "No riders have signed up yet." : "No riders match."}</Empty>} />
    </>}

    {tab === "shops" && <>
      <div className="ui-bar"><Search value={q} onChange={setQ} placeholder="Search by shop name or address" /></div>
      <Tabs value={sTab} onChange={setSTab} items={[
        ["all", "All", shops.length], ["pending", "Pending", shops.filter((x) => x.status === "pending").length],
        ["approved", "Approved", shops.filter((x) => x.status === "approved").length], ["suspended", "Suspended", shops.filter((x) => x.status === "suspended").length]]} />
      <DataTable cols={shopCols} rows={shopRows} rowKey={(x) => x.id} onOpen={(x) => setOpenId(x.id)}
        empty={<Empty>{shops.length === 0 ? "No shops have signed up yet." : "No shops match."}</Empty>} />
    </>}

    {tab === "commission" && <>
      <p className="adm-hint">Commission % by category. Changes apply to new orders only.</p>
      {rates.length === 0 ? <Empty>No categories set up yet.</Empty> : <div className="adm-grid">
        {rates.map((c) => (<div className="adm-field" key={c.category}>
          <span className="adm-cat"><CatPic name={c.category} /><span>{c.category}</span></span>
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
