"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type Person = { id: string; role: string; full_name: string | null; is_online: boolean };

type Order = {
  id: string;
  status: string;
  total: number | null;
  address: string | null;
  fulfilment_shop_id: string | null;
  rider_id: string | null;
  created_at: string;
};

const CLOSED = ["delivered", "cancelled"];
const DELAY_MS = 30 * 60 * 1000;
const REFRESH_MS = 30 * 1000;

const STATUS_LABEL: Record<string, string> = {
  placed: "Placed",
  packed: "Packed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const FILTERS: [string, string][] = [
  ["open", "Open"],
  ["unassigned", "Unassigned"],
  ["delayed", "Delayed"],
  ["placed", "Placed"],
  ["packed", "Packed"],
  ["out_for_delivery", "Out for delivery"],
  ["delivered", "Delivered"],
  ["cancelled", "Cancelled"],
  ["all", "All"],
];

const card: React.CSSProperties = { flex: 1, minWidth: 130, padding: 12, border: "1px solid #E7EEE4", borderRadius: 12, background: "#fff" };
const input: React.CSSProperties = { padding: "6px 8px", borderRadius: 8, border: "1px solid #E7EEE4", fontSize: 13 };

export default function OrdersPanel({ people }: { people: Person[] }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("open");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Orders of today, limited to the manager's area by RLS.
  const load = useCallback(async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from("orders")
      .select("id,status,total,address,fulfilment_shop_id,rider_id,created_at")
      .gte("created_at", start.toISOString())
      .order("created_at", { ascending: false });
    if (error) setErr(error.message);
    else { setErr(""); setOrders((data as Order[]) ?? []); }
    setNow(Date.now());
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const nameOf = (id: string | null) => {
    if (!id) return "-";
    const p = people.find((x) => x.id === id);
    return p?.full_name || id.slice(0, 8);
  };
  const onlineRiders = people.filter((p) => p.role === "rider" && p.is_online);

  const isOpen = (o: Order) => !CLOSED.includes(o.status);
  const isUnassigned = (o: Order) => isOpen(o) && !o.rider_id;
  const isDelayed = (o: Order) => isOpen(o) && now - new Date(o.created_at).getTime() > DELAY_MS;

  const visible = orders.filter((o) => {
    switch (filter) {
      case "open": return isOpen(o);
      case "unassigned": return isUnassigned(o);
      case "delayed": return isDelayed(o);
      case "all": return true;
      default: return o.status === filter;
    }
  });

  const delivered = orders.filter((o) => o.status === "delivered");
  const summary: [string, string | number][] = [
    ["Total today", orders.length],
    ["Delivered", delivered.length],
    ["Pending", orders.filter(isOpen).length],
    ["Cancelled", orders.filter((o) => o.status === "cancelled").length],
    ["Sales", "₹" + delivered.reduce((s, o) => s + Number(o.total ?? 0), 0).toFixed(0)],
  ];

  async function assign(orderId: string, riderId: string) {
    if (!riderId) return;
    setBusy(true);
    setErr("");
    const { error } = await supabase.rpc("am_assign_rider", { p_order_id: orderId, p_rider_id: riderId });
    setBusy(false);
    if (error) setErr(error.message);
    else load();
  }

  return (
    <section style={{ marginTop: 24 }}>
      <h3 style={{ margin: "0 0 10px", fontSize: 16 }}>Orders today</h3>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        {summary.map(([label, value]) => (
          <div key={label} style={card}>
            <div style={{ fontSize: 12, color: "#6B7A71" }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13 }}>Show</span>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={input}>
          {FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <span style={{ fontSize: 12, color: "#6B7A71" }}>
          Orders open for more than 30 minutes are marked Delayed. Orders without a rider are marked Unassigned.
        </span>
      </div>

      {err && <p style={{ color: "#C62828", fontSize: 13 }}>{err}</p>}
      {visible.length === 0 && <p style={{ color: "#6B7A71", fontSize: 13 }}>No orders in this view.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visible.map((o) => {
          const delayed = isDelayed(o);
          const unassigned = isUnassigned(o);
          const border = delayed ? "#C62828" : unassigned ? "#E0A800" : "#E7EEE4";
          return (
            <div key={o.id} style={{ ...card, flex: "none", borderLeft: `4px solid ${border}`, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ minWidth: 150 }}>
                <div style={{ fontWeight: 600 }}>#{o.id.slice(0, 8)}</div>
                <div style={{ fontSize: 12, color: "#6B7A71" }}>{new Date(o.created_at).toLocaleTimeString()}</div>
              </div>
              <div style={{ flex: 1, minWidth: 160, fontSize: 13 }}>
                <div>{o.address || "No address"}</div>
                <div style={{ color: "#6B7A71" }}>Shop: {nameOf(o.fulfilment_shop_id)}</div>
              </div>
              <div style={{ fontSize: 13, minWidth: 110 }}>{STATUS_LABEL[o.status] ?? o.status}</div>
              <div style={{ fontSize: 13, minWidth: 120 }}>
                {delayed && <span style={{ color: "#C62828", fontWeight: 600, marginRight: 6 }}>Delayed</span>}
                {unassigned && !delayed && <span style={{ color: "#B07A00", fontWeight: 600, marginRight: 6 }}>Unassigned</span>}
                Rider: {nameOf(o.rider_id)}
              </div>
              <div style={{ marginLeft: "auto", fontWeight: 700 }}>₹{Number(o.total ?? 0).toFixed(0)}</div>
              {isOpen(o) && (
                <select disabled={busy || onlineRiders.length === 0} value={o.rider_id ?? ""}
                  onChange={(e) => assign(o.id, e.target.value)} style={input}>
                  <option value="">{onlineRiders.length ? "Assign rider" : "No online rider"}</option>
                  {onlineRiders.map((r) => <option key={r.id} value={r.id}>{r.full_name || r.id.slice(0, 8)}</option>)}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
