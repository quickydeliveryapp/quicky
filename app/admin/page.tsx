"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/messages";
import HeroAdmin from "@/components/HeroAdmin";

type Tab = "orders" | "riders" | "shops" | "commission" | "settlement" | "cash" | "fees" | "hero";

export default function Admin() {
  const [role, setRole] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("orders");
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
  const [msg, setMsg] = useState("");
  const [now, setNow] = useState(Date.now());

  async function load() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { window.location.href = "/login"; return; }
    const { data: me } = await supabase.from("profiles").select("role").eq("id", u.user.id).single();
    const r = me?.role ?? "customer"; setRole(r);
    if (r !== "admin" && r !== "area_manager") return;
    const [o, rd] = await Promise.all([
      supabase.from("orders").select("id,status,total,address,created_at,expected_delivery_at,cash_collected").order("created_at", { ascending: false }).limit(50),
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

  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await p; setMsg(error ? friendly(error.message) : "Done ✅"); load();
  };
  const delayed = (o: any) =>
    (o.status === "picked_up" && o.expected_delivery_at && new Date(o.expected_delivery_at).getTime() < now) ||
    (o.status === "placed" && now - new Date(o.created_at).getTime() > 5 * 60000);

  if (role === null) return <p>Loading...</p>;
  if (role !== "admin" && role !== "area_manager") return <p>You don't have access to this page.</p>;
  const tabs: Tab[] = role === "admin" ? ["orders", "riders", "shops", "commission", "settlement", "cash", "fees", "hero"] : ["orders", "riders", "cash"];

  return (<div>
    <div className="dash-tabs">
      {tabs.map((t) => <button key={t} className={t === tab ? "" : "alt"} onClick={() => setTab(t)}>{t}</button>)}
    </div>
    {msg && <p>{msg}</p>}

    {tab === "orders" && orders.map((o) => (
      <div className="card" key={o.id} style={{ marginBottom: 8, border: delayed(o) ? "2px solid #DC2626" : "none" }}>
        <b>₹{o.total}</b> · {o.status} {delayed(o) && <b style={{ color: "#DC2626" }}>⚠ DELAYED</b>}
        <div>{o.address}</div>
        {o.cash_collected != null && <small>Cash received: ₹{o.cash_collected}</small>}
      </div>))}

    {tab === "riders" && riders.map((r) => (
      <div className="card" key={r.id} style={{ marginBottom: 8 }}>
        <b>{r.phone}</b> · {r.is_online ? "🟢 online" : "⚪ offline"} · {r.rider_approved ? "approved" : "pending approval"}
        <div><button onClick={() => run(supabase.rpc("set_rider_approved", { p_id: r.id, p_ok: !r.rider_approved }))}>
          {r.rider_approved ? "Revoke approval" : "Approve"}</button></div>
      </div>))}

    {tab === "shops" && shops.map((s) => (
      <div className="card" key={s.id} style={{ marginBottom: 8 }}>
        <b>{s.name}</b> · {s.status}<div>{s.address}</div>
        <button onClick={() => run(supabase.from("shops").update({ status: "approved" }).eq("id", s.id))}>Approve</button>{" "}
        <button className="alt" onClick={() => run(supabase.from("shops").update({ status: "suspended" }).eq("id", s.id))}>Suspend</button>
      </div>))}

    {tab === "commission" && <div>
      <p>Item-wise commission % by category. Applies to new orders only.</p>
      {rates.map((c) => (<div className="card" key={c.category} style={{ marginBottom: 8 }}>
        <b>{c.category}</b>{" "}
        <input style={{ width: 70 }} defaultValue={c.rate} inputMode="decimal"
          onBlur={(e) => Number(e.target.value) !== Number(c.rate) && run(supabase.from("category_commissions").update({ rate: Number(e.target.value) }).eq("category", c.category))} /> %
      </div>))}
    </div>}
    {tab === "settlement" && settle.map((r) => (
      <div className="card" key={r.out_shop_id} style={{ marginBottom: 8 }}>
        <b>{r.out_name}</b> · {r.orders_count} orders
        <div>Item value ₹{r.gross} − Commission ₹{r.commission} = Earned ₹{r.earned}</div>
        <div>Paid out ₹{r.paid} · <b>Balance ₹{r.balance}</b></div>
        <button onClick={() => { const a = Number(window.prompt("Payout amount (₹)?")); if (a > 0) run(supabase.rpc("record_payout", { p_shop: r.out_shop_id, p_amount: a, p_note: "" })); }}>Record payout</button>
      </div>))}

    {tab === "cash" && cash.map((r) => (
      <div className="card" key={r.out_rider} style={{ marginBottom: 8 }}>
        <b>{r.rider_phone}</b> · {r.deliveries} deliveries
        <div>Cash collected ₹{r.collected} · Deposited ₹{r.deposited} · <b>Pending ₹{r.pending}</b></div>
        <button onClick={() => { const a = Number(window.prompt("Cash deposited by rider (₹)?")); if (a > 0) run(supabase.rpc("record_cash_deposit", { p_rider: r.out_rider, p_amount: a })); }}>Record deposit</button>
      </div>))}
    {tab === "fees" && fees && <div>
      {[["delivery_fee", "Delivery fee ₹"], ["free_delivery_above", "Free delivery above (₹)"], ["small_cart_threshold", "Small cart fee applies below (₹)"], ["small_cart_fee", "Small cart fee ₹"]].map(([k, l]) => (
        <div className="card" key={k} style={{ marginBottom: 8 }}><b>{l}</b>{" "}
          <input style={{ width: 90 }} defaultValue={fees[k]} inputMode="decimal"
            onBlur={(e) => Number(e.target.value) !== Number(fees[k]) && run(supabase.from("fee_settings").update({ [k]: Number(e.target.value) }).eq("id", 1))} /></div>))}
      <h3>Unit economics (per delivered order)</h3>
      {summary && Number(summary.delivered) > 0 ? (() => {
        const n = Number(summary.delivered);
        const rev = (Number(summary.commission) + Number(summary.fees)) / n;
        const profit = rev - Number(riderCost || 0) - Number(packCost || 0);
        return (<div className="card" style={{ lineHeight: 1.9 }}>
          Delivered orders: <b>{n}</b><br />
          Commission: ₹{summary.commission} · Fees: ₹{summary.fees}<br />
          Quicky revenue per order: <b>₹{rev.toFixed(2)}</b><br />
          Rider cost per order ₹ <input style={{ width: 70 }} value={riderCost} onChange={(e) => setRiderCost(e.target.value)} inputMode="decimal" /><br />
          Packing/other cost per order ₹ <input style={{ width: 70 }} value={packCost} onChange={(e) => setPackCost(e.target.value)} inputMode="decimal" /><br />
          <span style={{ fontSize: 20, color: profit < 0 ? "#DC2626" : "#16A34A" }}>Profit per order: <b>₹{profit.toFixed(2)}</b></span>
        </div>);
      })() : <p>No delivered orders yet (with the new fees).</p>}
    </div>}
    {tab === "hero" && <HeroAdmin freeAbove={fees ? Number(fees.free_delivery_above) : undefined} />}
  </div>);
}
