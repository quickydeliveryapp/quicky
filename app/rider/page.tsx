"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/messages";

type O = { id: string; status: string; total: number; address: string; lat: number; lng: number; rider_id: string | null };

export default function Rider() {
  const [orders, setOrders] = useState<O[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [online, setOnline] = useState(false);
  const [token, setToken] = useState("");
  const [cash, setCash] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { window.location.href = "/login"; return; }
    setMe(u.user.id);
    const { data: p } = await supabase.from("profiles").select("is_online").eq("id", u.user.id).single();
    setOnline(!!p?.is_online);
    const { data } = await supabase.from("orders").select("id,status,total,address,lat,lng,rider_id").in("status", ["packed", "picked_up"]);
    setOrders((data as O[]) || []);
  };
  useEffect(() => {
    load();
    const ch = supabase.channel("rider-orders").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load).subscribe();
    return () => { stopCam(); supabase.removeChannel(ch); };
  }, []);

  const run = async (p: PromiseLike<{ error: { message: string } | null }>, ok = "") => {
    const { error } = await p; setMsg(error ? friendly(error.message) : ok); load();
  };
  const toggle = () => run(supabase.rpc("set_online", { p_online: !online }));
  const claim = (id: string) => run(supabase.rpc("claim_order", { p_order_id: id }));
  const deliver = (o: O) => run(supabase.rpc("deliver_order", { p_order_id: o.id, p_cash: Number(cash[o.id] ?? o.total) }), "Delivered ✅");

  function pickup(t: string) {
    navigator.geolocation.getCurrentPosition(
      (pos) => run(supabase.rpc("pickup_order", { p_token: t.trim(), p_lat: pos.coords.latitude, p_lng: pos.coords.longitude }), "Picked up, timer started 🛵"),
      () => setMsg("Please allow location access; it is required for pickup"));
  }
  async function startCam() {
    if (!("BarcodeDetector" in window)) { setMsg("QR scanning isn't supported in this browser. Use Android Chrome or paste the token."); return; }
    stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    videoRef.current!.srcObject = stream.current; await videoRef.current!.play(); setScanning(true);
    const det = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
    timer.current = window.setInterval(async () => {
      const r = await det.detect(videoRef.current!);
      if (r[0]) { stopCam(); pickup(r[0].rawValue); }
    }, 500);
  }
  function stopCam() {
    if (timer.current) clearInterval(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop()); setScanning(false);
  }

  const mine = orders.filter((o) => o.rider_id === me);
  const open = orders.filter((o) => !o.rider_id);

  return (<div>
    <button className={online ? "" : "alt"} onClick={toggle}>{online ? "🟢 Online (tap to go offline)" : "⚪ Offline (tap to go online)"}</button>
    {msg && <p>{msg}</p>}
    <h3>My orders</h3>
    {mine.map((o) => (<div className="card" key={o.id} style={{ marginBottom: 8 }}>
      <b>₹{o.total}</b> · {o.status}<div>{o.address}</div>
      <a href={`https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}`} target="_blank">📍 Open map</a>
      {o.status === "picked_up" && <div>
        <input inputMode="decimal" placeholder={`Cash received (₹${o.total})`} value={cash[o.id] ?? ""} onChange={(e) => setCash({ ...cash, [o.id]: e.target.value })} />
        <button onClick={() => deliver(o)}>Delivered</button></div>}
    </div>))}
    {mine.some((o) => o.status === "packed") && <div className="card">
      <b>Pickup: scan the QR on the bag</b><br />
      <button className="alt" onClick={scanning ? stopCam : startCam}>{scanning ? "Close camera" : "📷 Scan QR"}</button>
      <video ref={videoRef} style={{ width: "100%", display: scanning ? "block" : "none", marginTop: 8 }} playsInline muted />
      <input placeholder="Or paste the token" value={token} onChange={(e) => setToken(e.target.value)} />
      <button onClick={() => pickup(token)}>Confirm pickup</button></div>}
    <h3>Available orders</h3>
    {open.map((o) => (<div className="card" key={o.id} style={{ marginBottom: 8 }}>
      <b>₹{o.total}</b><div>{o.address}</div><button onClick={() => claim(o.id)}>Take order</button></div>))}
    {!open.length && <p>No orders right now.</p>}
  </div>);
}
