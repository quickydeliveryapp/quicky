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
  const [fees, setFees] = useState<any>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setMsg("Location allow karo, tabhi products dikhenge")
    );
  }, []);

  useEffect(() => {
    supabase.from("fee_settings").select("*").eq("id", 1).single().then(({ data }) => setFees(data));
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
  const del = fees ? (total >= Number(fees.free_delivery_above) ? 0 : Number(fees.delivery_fee)) : 0;
  const small = fees && total < Number(fees.small_cart_threshold) ? Number(fees.small_cart_fee) : 0;

  async function checkout() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { window.location.href = "/login"; return; }
    if (!pos || !address) { setMsg("Address likho"); return; }
    const items = Object.entries(cart).map(([product_id, qty]) => ({ product_id, qty }));
    const { data, error } = await supabase.rpc("place_order", { p_lat: pos.lat, p_lng: pos.lng, p_address: address, p_items: items });
    if (error) setMsg(error.message); else { window.location.href = "/orders/" + data; }
  }

  return (<>
    <p className="tagline">Groceries &amp; More. <b>Delivered Fast.</b></p>
    {msg && <p>{msg}</p>}
    {!pos && !msg && <p>Location dhoondh rahe hain...</p>}
    {loaded && !products.length && !msg && <p>Is area mein abhi koi shop ya product available nahi hai.</p>}
    <div className="grid">
      {products.map((p) => (
        <div className="pcard" key={p.id}>
          {p.image_url && <img className="pimg" src={p.image_url} alt="" loading="lazy" width={160} height={160} />}
          <div className="pname">{p.name}</div>
          <div className="muted">{p.unit}</div>
          <div className="prow">
            <span className="price">₹{p.price}</span>
            {cart[p.id]
              ? <span className="stepper"><button aria-label="Kam karo" onClick={() => add(p.id, -1)}>−</button><span>{cart[p.id]}</span><button aria-label="Zyada karo" onClick={() => add(p.id, 1)}>+</button></span>
              : <button className="add" onClick={() => add(p.id, 1)}>Add</button>}
          </div>
        </div>))}
    </div>
    {total > 0 && <div className="cartbar">
      <div className="card" style={{ marginBottom: 8 }}>
        <div>Items: ₹{total.toFixed(2)}</div>
        <div>Delivery: {del === 0 ? <span className="free">FREE</span> : "₹" + del}</div>
        {small > 0 && <div>Small cart fee: ₹{small}</div>}
        <h3>Total: ₹{(total + del + small).toFixed(2)} (Cash on Delivery)</h3>
        {fees && del > 0 && <small>₹{(Number(fees.free_delivery_above) - total).toFixed(0)} aur add karo, delivery free!</small>}
      </div>
      <input placeholder="Delivery address" value={address} onChange={(e) => setAddress(e.target.value)} />
      <button onClick={checkout}>Order karo</button>
    </div>}
  </>);
}
