"use client";
// One order, drawn the same way as on the shop dashboard (classes come from app/shop/shop.css).

export const STATUS_LABEL: Record<string, string> = { placed: "New", accepted: "Packing", packed: "Ready", picked_up: "On the way", delivered: "Delivered", cancelled: "Cancelled" };
export const STATUS_TONE: Record<string, string> = { delivered: "ok", cancelled: "bad", picked_up: "info" };

export const rupee = (n: any) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
export const minsSince = (ts: string, now: number) => Math.max(0, Math.floor((now - new Date(ts).getTime()) / 60000));
export function ago(ts: string, now: number) {
  const m = minsSince(ts, now);
  if (m < 1) return "just now";
  if (m < 60) return m + " min ago";
  const h = Math.floor(m / 60);
  return h < 24 ? h + " h ago" : new Date(ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
const clock = (ts: string) => new Date(ts).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

export const isActive = (o: any) => o.status !== "delivered" && o.status !== "cancelled";
export const isDelayed = (o: any, now: number) =>
  !!((o.status === "picked_up" && o.expected_delivery_at && new Date(o.expected_delivery_at).getTime() < now) ||
     (o.status === "placed" && now - new Date(o.created_at).getTime() > 5 * 60000));

export default function OrderCard({ o, now, shop, rider }: { o: any; now: number; shop?: string; rider?: string }) {
  const late = isDelayed(o, now);
  const wait = minsSince(o.created_at, now);
  return (<article className={"shp-order" + (late ? " late" : "")}>
    <div className="shp-top">
      <span className={"shp-badge " + (STATUS_TONE[o.status] ?? "")}>{STATUS_LABEL[o.status] ?? o.status}</span>
      {late && <span className="shp-badge bad">Delayed</span>}
      <span className="shp-id">#{String(o.id).slice(0, 6)}</span>
      <span className={"shp-time" + (late ? " late" : "")}>{o.status === "placed" ? `Waiting ${wait} min` : ago(o.created_at, now)}</span>
      <b className="shp-amt">{rupee(o.total)}</b>
    </div>
    <div className="shp-addr">{o.address}</div>
    <dl className="adm-meta" style={{ marginTop: 12 }}>
      <div><dt>Shop</dt><dd>{shop || "—"}</dd></div>
      <div><dt>Rider</dt><dd>{o.rider_id ? (rider ?? "—") : "Not assigned yet"}</dd></div>
      {o.status === "picked_up" && o.expected_delivery_at && <div><dt>Expected by</dt><dd>{clock(o.expected_delivery_at)}</dd></div>}
      {o.cash_collected != null && <div><dt>Cash received</dt><dd>{rupee(o.cash_collected)}</dd></div>}
    </dl>
  </article>);
}
