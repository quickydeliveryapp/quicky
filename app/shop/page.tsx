"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { QRCodeSVG } from "qrcode.react";
type O = { pickup_token: string; id: string; status: string; total: number; address: string };
export default function Shop() {
  const [orders, setOrders] = useState<O[]>([]);
  const audio = useRef<HTMLAudioElement | null>(null);
  const load = async () => {
    const { data } = await supabase.from("orders").select("id,status,total,address,pickup_token").in("status", ["placed", "accepted", "packed"]).order("created_at");
    setOrders((data as O[]) || []);
  };
  useEffect(() => {
    load();
    const ch = supabase.channel("shop-orders").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);
  const pending = orders.some((o) => o.status === "placed");
  useEffect(() => {
    if (!audio.current) return;
    pending ? audio.current.play().catch(() => {}) : audio.current.pause();
  }, [pending]);
  const setStatus = (id: string, status: string) => supabase.from("orders").update({ status }).eq("id", id).then(load);
  const reject = (id: string) => supabase.rpc("reject_order", { p_order_id: id }).then(load);
  return (<div><h3>Live orders</h3>
    <audio ref={audio} src="/alert.mp3" loop />
    {orders.map((o) => (<div className="card" key={o.id} style={{ marginBottom: 8 }}>
      <b>₹{o.total}</b> · {o.status}<div>{o.address}</div>
      {o.status === "placed" && <><button onClick={() => setStatus(o.id, "accepted")}>Accept</button> <button className="alt" onClick={() => reject(o.id)}>Reject</button></>}
      {o.status === "accepted" && <button onClick={() => setStatus(o.id, "packed")}>Packed</button>}
      {o.status === "packed" && <div><p>Is QR ko bag pe lagao. Rider scan karega:</p><QRCodeSVG value={o.pickup_token} size={140} /></div>}
    </div>))}</div>);
}
