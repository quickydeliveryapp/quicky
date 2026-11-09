"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import RoleGate from "@/components/RoleGate";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/messages";
import { useProfile } from "@/lib/useProfile";
import OnboardPanel from "./OnboardPanel";
import { RiderDetailsFields, checkDetails, emptyDetails, fromRow, vehicleLabel, idLabel, telHref, type Details } from "./RiderDetails";
import "../admin/admin.css";
import "./areamanager.css";

type Tab = "orders" | "riders" | "shops" | "onboard";
// the sidebar address (/areamanager/riders ...) -> the section it shows; /areamanager itself is Orders
const SLUG: Record<string, Tab> = { riders: "riders", shops: "shops", onboard: "onboard" };
type Filter = "all" | "active" | "unassigned" | "delayed" | "delivered" | "cancelled";

const STATUS_LABEL: Record<string, string> = {
  placed: "Placed", accepted: "Accepted", packed: "Packed", picked_up: "On the way", delivered: "Delivered", cancelled: "Cancelled",
};
const STATUS_TONE: Record<string, string> = { delivered: "ok", cancelled: "bad", picked_up: "info" };
const FILTERS: [Filter, string][] = [
  ["all", "All"], ["active", "In progress"], ["unassigned", "No rider"], ["delayed", "Delayed"], ["delivered", "Delivered"], ["cancelled", "Cancelled"],
];

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

function AreaView() {
  const { profile } = useProfile();
  const pathname = usePathname() || "";
  const router = useRouter();
  const tab: Tab = SLUG[pathname.split("/")[2] ?? ""] ?? "orders";
  const [filter, setFilter] = useState<Filter>("all");
  const [people, setPeople] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [shopNames, setShopNames] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<"rider" | "shop">("rider");
  const [shopInfo, setShopInfo] = useState<Record<string, any>>({});
  const [riderDet, setRiderDet] = useState<Record<string, Details>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDet, setEditDet] = useState<Details>(emptyDetails());
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const [now, setNow] = useState(Date.now());

  // Row level security limits all of this to the manager's own area.
  const load = useCallback(async () => {
    const [pe, o, sh, ms, rd] = await Promise.all([
      supabase.from("profiles").select("id,role,full_name,phone,is_online,rider_approved").in("role", ["shop", "rider"]).order("role"),
      supabase.from("orders").select("id,status,total,address,created_at,expected_delivery_at,cash_collected,fulfilment_shop_id,rider_id").order("created_at", { ascending: false }).limit(50),
      supabase.rpc("shop_summary"),
      supabase.rpc("am_shops"),
      supabase.rpc("am_rider_details"),
    ]);
    if (pe.error) setToast({ text: friendly(pe.error.message), ok: false }); else setPeople(pe.data || []);
    if (o.error) setToast({ text: friendly(o.error.message), ok: false }); else setOrders(o.data || []);
    const names: Record<string, string> = {};
    ((sh.data as any[]) || []).forEach((s) => { names[s.out_shop_id] = s.out_name; });
    setShopNames(names);
    const info: Record<string, any> = {};
    ((ms.data as any[]) || []).forEach((x) => { info[x.out_owner] = x; });
    setShopInfo(info);
    const rdm: Record<string, Details> = {};
    ((rd.data as any[]) || []).forEach((x) => { rdm[x.out_rider] = fromRow(x); });
    setRiderDet(rdm);
    setNow(Date.now());
  }, []);

  useEffect(() => { if (profile) load(); }, [profile, load]);
  useEffect(() => { const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t); }, [toast]);

  async function call(fn: string, args: Record<string, unknown>, after?: () => void) {
    setBusy(true);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) setToast({ text: friendly(error.message), ok: false });
    else { setToast({ text: "Saved", ok: true }); after?.(); load(); }
  }
  const ask = (text: string, fn: () => void) => { if (window.confirm(text)) fn(); };

  function startEdit(r: any) {
    setEditId(r.id); setEditName(r.full_name || ""); setEditDet(riderDet[r.id] ?? emptyDetails());
  }
  function saveEdit() {
    if (!editId) return;
    if (!editName.trim()) { setToast({ text: "Enter the rider's full name.", ok: false }); return; }
    const bad = checkDetails(editDet);
    if (bad) { setToast({ text: bad, ok: false }); return; }
    call("am_set_rider_details", { p_rider: editId, p_details: editDet, p_name: editName.trim() }, () => setEditId(null));
  }
  const goOnboard = (k: "rider" | "shop") => router.push("/areamanager/onboard#" + k);
  // /areamanager/onboard#shop opens the shop form
  useEffect(() => { setKind(window.location.hash === "#shop" ? "shop" : "rider"); }, [pathname]);

  const riders = people.filter((p) => p.role === "rider");
  const shops = people.filter((p) => p.role === "shop");
  const assignable = riders.filter((r) => r.is_online && r.rider_approved);
  const riderName = (id: string) => { const r = riders.find((x) => x.id === id); return r ? (r.full_name || r.phone || "Rider") : "—"; };

  const isActive = (o: any) => o.status !== "delivered" && o.status !== "cancelled";
  const delayed = (o: any) =>
    (o.status === "picked_up" && o.expected_delivery_at && new Date(o.expected_delivery_at).getTime() < now) ||
    (o.status === "placed" && now - new Date(o.created_at).getTime() > 5 * 60000);
  const unassigned = (o: any) => isActive(o) && !o.rider_id;
  const counts: Record<Filter, number> = {
    all: orders.length,
    active: orders.filter(isActive).length,
    unassigned: orders.filter(unassigned).length,
    delayed: orders.filter(delayed).length,
    delivered: orders.filter((o) => o.status === "delivered").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  };
  const shown = orders.filter((o) =>
    filter === "all" ? true : filter === "active" ? isActive(o) : filter === "unassigned" ? unassigned(o) : filter === "delayed" ? delayed(o) : o.status === filter);
  const waiting = riders.filter((r) => !r.rider_approved).length;

  return (<div className="adm">
    {profile && !profile.area && <p className="adm-hint">No area assigned yet. Ask an admin to assign one.</p>}

    <div className="adm-stats">
      <div className="adm-stat"><b>{counts.active}</b><span>Orders in progress</span></div>
      <div className={"adm-stat" + (counts.delayed ? " bad" : "")}><b>{counts.delayed}</b><span>Delayed orders</span></div>
      <div className="adm-stat"><b>{riders.filter((r) => r.is_online).length}</b><span>Riders online</span></div>
      <div className={"adm-stat" + (waiting ? " warn" : "")}><b>{waiting}</b><span>Riders waiting for approval</span></div>
    </div>

    {toast && <p className={"adm-toast" + (toast.ok ? "" : " bad")} role="status">{toast.text}</p>}

    {tab === "orders" && <>
      <div className="adm-chips">
        {FILTERS.map(([k, label]) => (
          <button key={k} className={"adm-chip" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>{label} <i>{counts[k]}</i></button>))}
      </div>
      <p className="adm-hint">Showing the latest 50 orders in your area.</p>
      {shown.length === 0 ? <Empty>No orders here yet.</Empty> : <div className="adm-list">
        {shown.map((o) => {
          const late = delayed(o);
          return (<article className={"adm-order" + (late ? " late" : "")} key={o.id}>
            <div className="adm-o-top">
              <span className={"adm-badge " + (STATUS_TONE[o.status] ?? "")}>{STATUS_LABEL[o.status] ?? o.status}</span>
              {late && <span className="adm-badge bad">Delayed</span>}
              {unassigned(o) && <span className="adm-badge">No rider</span>}
              <span className="adm-o-id">#{String(o.id).slice(0, 6)}</span>
              <span className="adm-o-time">{ago(o.created_at, now)}</span>
              <b className="adm-o-amt">{rupee(o.total)}</b>
            </div>
            <div className="adm-o-addr">{o.address}</div>
            <dl className="adm-meta">
              <div><dt>Shop</dt><dd>{(o.fulfilment_shop_id && shopNames[o.fulfilment_shop_id]) || "—"}</dd></div>
              <div><dt>Rider</dt><dd>{o.rider_id ? riderName(o.rider_id) : "Not assigned yet"}</dd></div>
              {o.status === "picked_up" && o.expected_delivery_at && <div><dt>Expected by</dt><dd>{clock(o.expected_delivery_at)}</dd></div>}
              {o.cash_collected != null && <div><dt>Cash received</dt><dd>{rupee(o.cash_collected)}</dd></div>}
            </dl>
            {isActive(o) && (<div className="am-assign">
              <span>Rider</span>
              <select className="am-select" aria-label="Assign a rider" disabled={busy || assignable.length === 0} value={o.rider_id ?? ""}
                onChange={(e) => e.target.value && call("am_assign_rider", { p_order_id: o.id, p_rider_id: e.target.value })}>
                <option value="">{assignable.length ? (o.rider_id ? "Change rider" : "Assign a rider") : "No approved rider is online"}</option>
                {assignable.map((r) => <option key={r.id} value={r.id}>{r.full_name || r.phone}</option>)}
              </select>
            </div>)}
          </article>);
        })}
      </div>}
    </>}

    {tab === "riders" && <>
      <div className="am-head"><p className="adm-hint">Riders in your area. Approve them so they can take orders.</p><button onClick={() => goOnboard("rider")}>+ Onboard a rider</button></div>
      {riders.length === 0 ? <Empty>No riders in your area yet. Tap Onboard a rider to add one.</Empty> : <div className="adm-grid">
        {riders.map((r) => { const d = riderDet[r.id]; const editing = editId === r.id; return (
          <div className="adm-card" key={r.id}>
            <div className="adm-head">
              <span className="adm-av">{String(r.phone || r.full_name || "?").slice(-2)}</span>
              <div><span className="adm-name">{r.full_name || r.phone}</span>
                <span className="adm-sub"><span className={"adm-dot" + (r.is_online ? " on" : "")} /> {r.is_online ? "Online" : "Offline"}{d ? " · " + vehicleLabel(d.vehicle_type) + (d.vehicle_number ? " " + d.vehicle_number : "") : ""}</span></div>
              <span className={"adm-badge " + (r.rider_approved ? "ok" : "")}>{r.rider_approved ? "Approved" : "Pending"}</span>
            </div>
            {!d && !editing && <p className="adm-hint">No details added yet. Add the vehicle, licence and emergency contact.</p>}
            {d && !editing && <details className="am-more">
              <summary>Rider details</summary>
              <dl className="adm-meta">
                <div><dt>Mobile</dt><dd>{r.phone ? <a href={telHref(r.phone)}>{r.phone}</a> : "—"}</dd></div>
                <div><dt>Vehicle</dt><dd>{vehicleLabel(d.vehicle_type)}{d.vehicle_number ? " · " + d.vehicle_number : ""}</dd></div>
                {d.licence_number && <div><dt>Licence</dt><dd>{d.licence_number}</dd></div>}
                {d.id_type && <div><dt>ID proof</dt><dd>{idLabel(d.id_type)} ending {d.id_last4}</dd></div>}
                <div><dt>Emergency contact</dt><dd>{d.emergency_name} · <a href={telHref(d.emergency_phone)}>{d.emergency_phone}</a></dd></div>
                {d.address && <div><dt>Address</dt><dd>{d.address}</dd></div>}
              </dl>
            </details>}
            {editing && (<div className="am-edit">
              <label className="am-one"><span>Full name</span><input value={editName} onChange={(e) => setEditName(e.target.value)} /></label>
              <RiderDetailsFields value={editDet} onChange={setEditDet} />
              <div className="adm-actions">
                <button disabled={busy} onClick={saveEdit}>Save details</button>
                <button className="alt" disabled={busy} onClick={() => setEditId(null)}>Cancel</button>
              </div>
            </div>)}
            <div className="adm-actions">
              {r.rider_approved
                ? <button className="danger" disabled={busy} onClick={() => ask("Revoke approval for " + (r.full_name || r.phone) + "? They won't be able to take orders.", () => call("set_rider_approved", { p_id: r.id, p_ok: false }))}>Revoke approval</button>
                : <button disabled={busy} onClick={() => call("set_rider_approved", { p_id: r.id, p_ok: true })}>Approve rider</button>}
              <button className="alt" disabled={busy} onClick={() => call("am_set_online", { p_id: r.id, p_online: !r.is_online })}>{r.is_online ? "Set offline" : "Set online"}</button>
              {!editing && <button className="alt" disabled={busy} onClick={() => startEdit(r)}>{d ? "Edit details" : "Add details"}</button>}
              <button className="danger" disabled={busy} onClick={() => ask("Remove this rider from your area?", () => call("am_remove_member", { p_id: r.id }))}>Remove</button>
            </div>
          </div>); })}
      </div>}
    </>}

    {tab === "shops" && <>
      <div className="am-head"><p className="adm-hint">Shops in your area. New shops need Quicky&apos;s approval before they get orders.</p><button onClick={() => goOnboard("shop")}>+ Onboard a shop</button></div>
      {shops.length === 0 ? <Empty>No shops in your area yet. Tap Onboard a shop to add one.</Empty> : <div className="adm-grid">
        {shops.map((s) => { const inf = shopInfo[s.id]; return (
          <div className="adm-card" key={s.id}>
            <div className="adm-head">
              <span className="adm-av">{String(inf?.out_name || s.full_name || "?").charAt(0).toUpperCase()}</span>
              <div><span className="adm-name">{inf?.out_name || s.full_name || String(s.id).slice(0, 8)}</span>
                <span className="adm-sub"><span className={"adm-dot" + (s.is_online ? " on" : "")} /> {s.is_online ? "Online" : "Offline"}{inf?.out_address ? " · " + inf.out_address : ""}</span></div>
              {inf && <span className={"adm-badge " + (inf.out_status === "approved" ? "ok" : inf.out_status === "suspended" ? "bad" : "")}>{inf.out_status === "approved" ? "Approved" : inf.out_status === "suspended" ? "Suspended" : "Awaiting approval"}</span>}
            </div>
            <div className="adm-actions">
              <button className="alt" disabled={busy} onClick={() => call("am_set_online", { p_id: s.id, p_online: !s.is_online })}>{s.is_online ? "Set offline" : "Set online"}</button>
              <button className="danger" disabled={busy} onClick={() => ask("Remove this shop from your area?", () => call("am_remove_member", { p_id: s.id }))}>Remove</button>
            </div>
          </div>); })}
      </div>}
    </>}

    {tab === "onboard" && <OnboardPanel initialKind={kind} onChanged={load} />}
  </div>);
}

export default function AreaManagerDashboard() {
  return <RoleGate allow={["area_manager"]}><AreaView /></RoleGate>;
}
