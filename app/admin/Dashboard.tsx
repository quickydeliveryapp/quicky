"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import OrderCard, { STATUS_LABEL, STATUS_TONE, ago, isDelayed, minsSince, rupee } from "./OrderCard";
import "../shop/shop.css";
import "./home.css";

type Col = "new" | "shop" | "road";
const COL_TITLE: Record<Col, string> = { new: "New orders", shop: "With the shop", road: "On the way" };
const COL_EMPTY: Record<Col, string> = { new: "No new orders.", shop: "Nothing is being packed.", road: "No order is out for delivery." };

// Admin home. Same look as the shop dashboard: top bar, number tiles, a New | With the shop | On the way board, recent orders.
export default function Dashboard({ orders, riders, shops, cash, now, role, shopName, riderPhone }: {
  orders: any[]; riders: any[]; shops: any[]; cash: any[]; now: number; role: string;
  shopName: (id: string) => string | undefined; riderPhone: (id: string) => string | undefined;
}) {
  const router = useRouter();
  const [col, setCol] = useState<Col>("new");
  const [histAll, setHistAll] = useState(false);

  const live = orders.filter((o) => ["placed", "accepted", "packed", "picked_up"].includes(o.status))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const lists: Record<Col, any[]> = {
    new: live.filter((o) => o.status === "placed"),
    shop: live.filter((o) => o.status === "accepted" || o.status === "packed"),
    road: live.filter((o) => o.status === "picked_up"),
  };
  const hist = orders.filter((o) => o.status === "delivered" || o.status === "cancelled")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 20);
  const histShown = histAll ? hist : hist.slice(0, 5);

  const waitingNew = lists.new.filter((o) => minsSince(o.created_at, now) >= 5).length;
  const delayedRoad = lists.road.filter((o) => isDelayed(o, now)).length;
  const online = riders.filter((r) => r.is_online).length;
  const ridersWaiting = riders.filter((r) => !r.rider_approved).length;
  const shopsWaiting = shops.filter((s) => s.status === "pending").length;
  const cashHeld = cash.reduce((a, c) => a + Math.max(0, Number(c.pending || 0)), 0);
  const isAdmin = role === "admin";

  return (<div className="shp adm-home">
    <div className="shp-bar">
      <div>
        <h2 className="shp-name">{isAdmin ? "Admin dashboard" : "Area dashboard"}</h2>
        <span className="shp-state"><span className="shp-dot on" />Live. Orders update by themselves.</span>
      </div>
      <div className="shp-tools">
        <button className="alt" onClick={() => router.push("/")}>Customer view</button>
      </div>
    </div>

    <div className="shp-tiles">
      <button className={"shp-tile" + (waitingNew ? " hot" : "")} onClick={() => setCol("new")}>
        <b>{lists.new.length}</b><span>New orders</span><small>{waitingNew ? `${waitingNew} waiting over 5 min` : "Waiting for a shop to accept"}</small>
      </button>
      <button className="shp-tile" onClick={() => setCol("shop")}>
        <b>{lists.shop.length}</b><span>With the shop</span><small>Being packed or ready</small>
      </button>
      <button className={"shp-tile" + (delayedRoad ? " hot" : "")} onClick={() => setCol("road")}>
        <b>{lists.road.length}</b><span>On the way</span><small>{delayedRoad ? `${delayedRoad} running late` : "On time"}</small>
      </button>
      <Link className="shp-tile good" href="/admin/riders">
        <b>{online}</b><span>Riders online</span><small>{ridersWaiting ? `${ridersWaiting} waiting for approval` : `${riders.length} in total`}</small>
      </Link>
      {isAdmin && <Link className={"shp-tile" + (shopsWaiting ? " warn" : "")} href="/admin/shops">
        <b>{shopsWaiting}</b><span>Shops waiting for approval</span><small>{shopsWaiting ? "Tap to review" : `${shops.length} shops in total`}</small>
      </Link>}
      <Link className={"shp-tile" + (cashHeld > 0 ? " warn" : "")} href={isAdmin ? "/admin/rider-cash" : "/areamanager/deposits"}>
        <b>{rupee(cashHeld)}</b><span>Cash with riders</span><small>Still to be deposited</small>
      </Link>
    </div>
    <span className="shp-live"><span className="shp-dot on" /> Live. New orders appear here by themselves.</span>

    {live.length === 0 ? (
      <p className="shp-calm"><b>No orders right now</b>When a customer places an order, it shows up here.</p>
    ) : (<>
      <div className="shp-chips">
        {(Object.keys(COL_TITLE) as Col[]).map((k) => (
          <button key={k} className={"shp-chip" + (col === k ? " on" : "") + (k === "new" && lists.new.length > 0 && col !== k ? " alert" : "")} onClick={() => setCol(k)}>
            {COL_TITLE[k]} <i>{lists[k].length}</i>
          </button>))}
      </div>
      <div className="shp-board">
        {(Object.keys(COL_TITLE) as Col[]).map((k) => (
          <section key={k} className={"shp-col" + (col === k ? " on" : "")}>
            <h3 className="shp-colh">{COL_TITLE[k]} <i>{lists[k].length}</i></h3>
            {lists[k].length === 0 ? <p className="shp-none">{COL_EMPTY[k]}</p> : lists[k].map((o) => (
              <OrderCard key={o.id} o={o} now={now} shop={o.fulfilment_shop_id ? shopName(o.fulfilment_shop_id) : undefined} rider={o.rider_id ? riderPhone(o.rider_id) : undefined} />))}
          </section>))}
      </div>
    </>)}

    <section className="shp-hist">
      <h3>Recent orders</h3>
      {hist.length === 0 ? <p className="shp-hint">Delivered and cancelled orders will show up here.</p> : <>
        {histShown.map((o) => (
          <div className="shp-hrow" key={o.id}>
            <span className={"shp-badge " + (STATUS_TONE[o.status] ?? "")}>{STATUS_LABEL[o.status] ?? o.status}</span>
            <span className="shp-id">#{String(o.id).slice(0, 6)}</span>
            <span className="shp-time">{ago(o.created_at, now)}</span>
            <span className="shp-sum">{(o.fulfilment_shop_id && shopName(o.fulfilment_shop_id)) || "—"} → {o.rider_id ? (riderPhone(o.rider_id) ?? "—") : "no rider"}</span>
            <b>{rupee(o.total)}</b>
          </div>))}
        {hist.length > 5 && <button className="shp-more" onClick={() => setHistAll(!histAll)}>{histAll ? "Show less" : `Show all ${hist.length}`}</button>}
      </>}
      <p className="shp-hint" style={{ marginTop: 10 }}>See every order on the <Link href="/admin/orders">Orders</Link> page.</p>
    </section>
  </div>);
}
