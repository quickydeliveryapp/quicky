"use client";
import { useMemo, useState } from "react";
import OrderCard, { isActive, isDelayed } from "./OrderCard";
import { Search } from "./ui";
import "../shop/shop.css";
import "./home.css";

type Filter = "all" | "active" | "delayed" | "delivered" | "cancelled";
const FILTERS: [Filter, string][] = [["all", "All"], ["active", "In progress"], ["delayed", "Delayed"], ["delivered", "Delivered"], ["cancelled", "Cancelled"]];

// Admin > Orders: every recent order, with search and status filters. Cards look like the shop dashboard's.
export default function OrdersPage({ orders, now, shopName, riderPhone }: {
  orders: any[]; now: number; shopName: (id: string) => string | undefined; riderPhone: (id: string) => string | undefined;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const matched = useMemo(() => {
    const n = q.trim().toLowerCase();
    return !n ? orders : orders.filter((o) =>
      String(o.id).toLowerCase().includes(n) || String(o.address ?? "").toLowerCase().includes(n) ||
      String((o.fulfilment_shop_id && shopName(o.fulfilment_shop_id)) ?? "").toLowerCase().includes(n) ||
      String((o.rider_id && riderPhone(o.rider_id)) ?? "").toLowerCase().includes(n));
  }, [orders, q, shopName, riderPhone]);
  const counts: Record<Filter, number> = {
    all: matched.length, active: matched.filter(isActive).length, delayed: matched.filter((o) => isDelayed(o, now)).length,
    delivered: matched.filter((o) => o.status === "delivered").length, cancelled: matched.filter((o) => o.status === "cancelled").length,
  };
  const list = matched.filter((o) => filter === "all" ? true : filter === "active" ? isActive(o) : filter === "delayed" ? isDelayed(o, now) : o.status === filter);

  return (<div className="shp adm-home">
    <div className="ui-bar"><Search value={q} onChange={setQ} placeholder="Search by order number, address, shop or rider" /></div>
    <div className="adm-pills">
      {FILTERS.map(([k, label]) => (
        <button key={k} className={"shp-chip" + (filter === k ? " on" : "")} aria-pressed={filter === k} onClick={() => setFilter(k)}>{label} <i>{counts[k]}</i></button>))}
    </div>
    {list.length === 0 ? <p className="shp-calm"><b>No orders here</b>Nothing matches this filter yet.</p> : <div className="adm-orderlist">
      {list.map((o) => (
        <OrderCard key={o.id} o={o} now={now} shop={o.fulfilment_shop_id ? shopName(o.fulfilment_shop_id) : undefined} rider={o.rider_id ? riderPhone(o.rider_id) : undefined} />))}
    </div>}
    {orders.length >= 100 && <p className="shp-hint">Showing the latest 100 orders.</p>}
  </div>);
}
