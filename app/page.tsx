"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type P = { id: string; name: string; unit: string; image_url: string | null; price: number };

export default function Home() {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [products, setProducts] = useState<P[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [address, setAddress] = useState("");
  const [msg, setMsg] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setMsg("Location allow karo, tabhi products dikhenge")
    );
  }, []);

  useEffect(() => {
    if (!pos) return;
    supabase.rpc("browse_products", { p_lat: pos.lat, p_lng: pos.lng }).then(({ data, error }) => {
      if (error) setMsg(error.message); else setProducts(data as P[]);
      setLoaded(true);
    });
  }, [pos]);

  const add = (id: string, d: number) =>
    setCart((c) => { const q = Math.max(0, (c[id] || 0) + d); const n = { ...c }; q ? (n[id] = q) : delete n[id]; return n; });

  const total = products.reduce((s, p) => s + (cart[p.id] || 0) * Number(p.price), 0);

  async function checkout() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { window.location.href = "/login"; return; }
    if (!pos || !address) { setMsg("Address likho"); return; }
    const items = Object.entries(cart).map(([product_id, qty]) => ({ product_id, qty }));
    const { data, error } = await supabase.rpc("place_order", { p_lat: pos.lat, p_lng: pos.lng, p_address: address, p_items: items });
    if (error) setMsg(error.message); else { window.location.href = "/orders/" + data; }
  }

  return (<>
    {msg && <p>{msg}</p>}
    {!pos && !msg && <p>Location dhoondh rahe hain...</p>}
    {loaded && !products.length && !msg && <p>Is area mein abhi koi shop ya product available nahi hai.</p>}
    <div className="grid">
      {products.map((p) => (
        <div className="card" key={p.id}>
          <b>{p.name}</b><div>{p.unit}</div><div>₹{p.price}</div>
          <button onClick={() => add(p.id, 1)}>Add</button>{" "}
          {cart[p.id] ? <><button className="alt" onClick={() => add(p.id, -1)}>-</button> {cart[p.id]}</> : null}
        </div>))}
    </div>
    {total > 0 && <div style={{ marginTop: 16 }}>
      <h3>Cart: ₹{total.toFixed(2)} (Cash on Delivery)</h3>
      <input placeholder="Delivery address" value={address} onChange={(e) => setAddress(e.target.value)} />
      <button onClick={checkout}>Order karo</button>
    </div>}
  </>);
}
