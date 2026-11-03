"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type O = { id: string; status: string; total: number; created_at: string };
const label: Record<string, string> = { placed: "Order placed", accepted: "Accepted", packed: "Packed", picked_up: "On the way", delivered: "Delivered", cancelled: "Cancelled" };

export default function Orders() {
  const [state, setState] = useState<"loading" | "out" | "in">("loading");
  const [orders, setOrders] = useState<O[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setState("out"); window.dispatchEvent(new Event("open-login")); return; }
      const { data: o } = await supabase.from("orders").select("id,status,total,created_at")
        .eq("customer_id", data.user.id).order("created_at", { ascending: false }).limit(30);
      setOrders((o as O[]) || []); setState("in");
    });
  }, []);

  if (state === "loading") return <p className="muted">Loading...</p>;
  if (state === "out") return <p>Please log in to see your orders.</p>;
  return (<div>
    <h3 style={{ marginTop: 0 }}>My Orders</h3>
    {!orders.length && <p className="muted">No orders yet.</p>}
    {orders.map((o) => (
      <Link key={o.id} href={"/orders/" + o.id} className="oitem">
        <div><b>₹{o.total}</b><div className="muted">{new Date(o.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</div></div>
        <span className={"ost" + (o.status === "delivered" ? " ok" : o.status === "cancelled" ? " bad" : "")}>{label[o.status] || o.status}</span>
      </Link>))}
  </div>);
}
