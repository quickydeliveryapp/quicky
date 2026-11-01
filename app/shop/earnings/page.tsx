"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/messages";

export default function Earnings() {
  const [r, setR] = useState<any>(null);
  const [msg, setMsg] = useState("Loading...");
  useEffect(() => {
    supabase.rpc("shop_summary").then(({ data, error }) => {
      if (error) setMsg(friendly(error.message)); else if (!data?.length) setMsg("No shop found for your account."); else { setR(data[0]); setMsg(""); }
    });
  }, []);
  if (!r) return <p>{msg}</p>;
  return (<div>
    <h3>{r.out_name}: earnings</h3>
    <div className="card" style={{ lineHeight: 1.9 }}>
      Delivered orders: <b>{r.orders_count}</b><br />
      Item value: ₹{r.gross}<br />
      Quicky commission: − ₹{r.commission}<br />
      Your earnings: <b>₹{r.earned}</b><br />
      Paid so far: ₹{r.paid}<br />
      <span style={{ fontSize: 22 }}>Balance: <b>₹{r.balance}</b></span>
    </div>
  </div>);
}
