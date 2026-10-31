"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Earnings() {
  const [r, setR] = useState<any>(null);
  const [msg, setMsg] = useState("Loading...");
  useEffect(() => {
    supabase.rpc("shop_summary").then(({ data, error }) => {
      if (error) setMsg(error.message); else if (!data?.length) setMsg("Aapki koi shop nahi mili."); else { setR(data[0]); setMsg(""); }
    });
  }, []);
  if (!r) return <p>{msg}</p>;
  return (<div>
    <h3>{r.out_name}: kamayi</h3>
    <div className="card" style={{ lineHeight: 1.9 }}>
      Delivered orders: <b>{r.orders_count}</b><br />
      Item value: ₹{r.gross}<br />
      Quicky commission: − ₹{r.commission}<br />
      Aapki kamayi: <b>₹{r.earned}</b><br />
      Ab tak mila: ₹{r.paid}<br />
      <span style={{ fontSize: 22 }}>Baaki: <b>₹{r.balance}</b></span>
    </div>
  </div>);
}
