"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type O = { id: string; status: string; total: number; created_at: string };
const label: Record<string, string> = { placed: "Order placed", accepted: "Accepted", packed: "Packed", picked_up: "On the way", delivered: "Delivered", cancelled: "Cancelled" };

export default function Account() {
  const [phone, setPhone] = useState<string | null | undefined>(undefined);
  const [orders, setOrders] = useState<O[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setPhone(null); window.dispatchEvent(new Event("open-login")); return; }
      setPhone(data.user.phone ? "+" + data.user.phone : "");
      const { data: o } = await supabase.from("orders").select("id,status,total,created_at")
        .eq("customer_id", data.user.id).order("created_at", { ascending: false }).limit(20);
      setOrders((o as O[]) || []);
    });
  }, []);

  if (phone === undefined) return <p className="muted">Loading...</p>;
  if (phone === null) return <p>Please log in to see your account.</p>;
  return (<div>
    <h3 style={{ marginTop: 0 }}>My Account</h3>
    <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div><div className="muted">Mobile number</div><b>{phone}</b></div>
      <button className="alt" onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}>Logout</button>
    </div>
    <h3>My Orders</h3>
    {!orders.length && <p className="muted">No orders yet.</p>}
    {orders.map((o) => (
      <Link key={o.id} href={"/orders/" + o.id} className="oitem">
        <div><b>₹{o.total}</b><div className="muted">{new Date(o.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</div></div>
        <span className={"ost" + (o.status === "delivered" ? " ok" : o.status === "cancelled" ? " bad" : "")}>{label[o.status] || o.status}</span>
      </Link>))}
  </div>);
}
