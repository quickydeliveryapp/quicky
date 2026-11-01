"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/messages";
import { changeQty, getState, setState, useStore } from "@/lib/store";

type P = { id: string; name: string; unit: string | null; image_url: string | null; category: string | null; price: number };

export default function Home() {
  const { loc, q, cart } = useStore();
  const [products, setProducts] = useState<P[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!loc) { setLoaded(false); return; }
    setLoaded(false);
    supabase.rpc("browse_products", { p_lat: loc.lat, p_lng: loc.lng }).then(({ data, error }) => {
      if (error) setMsg(friendly(error.message)); else { setProducts(data as P[]); setMsg(""); }
      setLoaded(true);
    });
  }, [loc?.lat, loc?.lng]);

  // Cart mein purane price/naam ho toh taaza kar do
  useEffect(() => {
    if (!products.length) return;
    const n = { ...getState().cart }; let changed = false;
    for (const p of products) {
      const it = n[p.id];
      if (it && (it.price !== Number(p.price) || it.name !== p.name)) { n[p.id] = { ...it, price: Number(p.price), name: p.name }; changed = true; }
    }
    if (changed) setState({ cart: n });
  }, [products]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? products.filter((p) => p.name.toLowerCase().includes(t) || (p.category || "").toLowerCase().includes(t)) : products;
  }, [products, q]);

  return (<>
    {msg && <p>{msg}</p>}
    {!loc && <p>Choose your delivery location to see products near you.</p>}
    {loc && loaded && !products.length && !msg && <p>No shops or products are available in your area yet.</p>}
    {loc && loaded && products.length > 0 && !shown.length && <p>No products match &ldquo;{q}&rdquo;.</p>}
    <div className="grid">
      {shown.map((p) => {
        const qty = cart[p.id]?.qty || 0;
        const info = { name: p.name, unit: p.unit || "", price: Number(p.price) };
        return (
          <div className="pcard" key={p.id}>
            {p.image_url && <img className="pimg" src={p.image_url} alt="" loading="lazy" width={160} height={160} />}
            <div className="pname">{p.name}</div>
            <div className="muted">{p.unit}</div>
            <div className="prow">
              <span className="price">₹{p.price}</span>
              {qty
                ? <span className="stepper"><button aria-label="Decrease quantity" onClick={() => changeQty(p.id, -1)}>−</button><span>{qty}</span><button aria-label="Increase quantity" onClick={() => changeQty(p.id, 1, info)}>+</button></span>
                : <button className="add" onClick={() => changeQty(p.id, 1, info)}>Add</button>}
            </div>
          </div>);
      })}
    </div>
  </>);
}
