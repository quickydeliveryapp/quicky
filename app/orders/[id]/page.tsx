"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type O = { status: string; total: number; expected_delivery_at: string | null };
const label: Record<string, string> = {
  placed: "Shop ko order bheja gaya", accepted: "Shop ne accept kiya", packed: "Packing ho gayi, rider aa raha hai",
  picked_up: "Rider nikal chuka hai 🛵", delivered: "Deliver ho gaya ✅", cancelled: "Order cancel ho gaya" };

export default function Track() {
  const { id } = useParams<{ id: string }>();
  const [o, setO] = useState<O | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const load = () => supabase.from("orders").select("status,total,expected_delivery_at").eq("id", id).single().then(({ data }) => data && setO(data as O));
    load();
    const ch = supabase.channel("order-" + id)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` }, load).subscribe();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(t); supabase.removeChannel(ch); };
  }, [id]);

  if (!o) return <p>Loading...</p>;
  const diff = o.expected_delivery_at ? new Date(o.expected_delivery_at).getTime() - now : null;
  const late = diff !== null && diff < 0;
  const abs = Math.abs(diff ?? 0);
  const mmss = `${Math.floor(abs / 60000)}:${String(Math.floor((abs % 60000) / 1000)).padStart(2, "0")}`;

  return (<div>
    <h3>{label[o.status] || o.status}</h3>
    <p>Total: ₹{o.total} (Cash on Delivery)</p>
    {o.status === "picked_up" && diff !== null && (
      <div style={{ fontSize: 48, fontWeight: 700, color: late ? "#DC2626" : "#16A34A" }}>
        {late ? `+${mmss} late` : mmss}
      </div>)}
  </div>);
}
