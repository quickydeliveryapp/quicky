"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/messages";
import { getState, setState, useStore } from "@/lib/store";
import { catKey, catName, iconFor, sortGroups } from "@/lib/categories";
import ProductCard, { P } from "@/components/ProductCard";

export default function Home() {
  const { loc, q } = useStore();
  const [products, setProducts] = useState<P[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [fees, setFees] = useState<any>(null);
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("fee_settings").select("free_delivery_above").eq("id", 1).single().then(({ data }) => setFees(data));
  }, []);

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

  const groups = useMemo(() => {
    const m = new Map<string, { name: string; items: P[] }>();
    for (const p of products) {
      const k = catKey(p.category);
      if (!m.has(k)) m.set(k, { name: catName(p.category), items: [] });
      m.get(k)!.items.push(p);
    }
    return sortGroups([...m.entries()]);
  }, [products]);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? products.filter((p) => p.name.toLowerCase().includes(t) || (p.category || "").toLowerCase().includes(t)) : [];
  }, [products, q]);

  const searching = q.trim().length > 0;
  const active = groups.find(([k]) => k === sel);
  const pick = (k: string | null) => { setSel(k); window.scrollTo({ top: 0 }); };

  return (<>
    {msg && <p>{msg}</p>}
    {!loc && <p>Choose your delivery location to see products near you.</p>}
    {loc && !loaded && <p className="muted">Loading products...</p>}
    {loc && loaded && !products.length && !msg && <p>No shops or products are available in your area yet.</p>}

    {fees && products.length > 0 && !searching && <div className="strip">Free delivery on orders above ₹{Number(fees.free_delivery_above)}</div>}

    {!searching && groups.length > 0 && (
      <div className="cats" aria-label="Categories">
        <button className={"cat" + (!active ? " on" : "")} onClick={() => pick(null)}><span className="ic">🛍️</span>All</button>
        {groups.map(([k, g]) => (
          <button key={k} className={"cat" + (active?.[0] === k ? " on" : "")} onClick={() => pick(k)}><span className="ic">{iconFor(g.name)}</span>{g.name}</button>
        ))}
      </div>
    )}

    {searching ? (<>
      <h3>Results for &ldquo;{q}&rdquo;</h3>
      {!results.length && products.length > 0 && <p>No products match your search.</p>}
      <div className="grid">{results.map((p) => <ProductCard key={p.id} p={p} />)}</div>
    </>) : active ? (<>
      <h3>{active[1].name}</h3>
      <div className="grid">{active[1].items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
    </>) : groups.map(([k, g]) => (
      <section className="sec" key={k}>
        <div className="sechead">
          <h3>{g.name}</h3>
          {g.items.length > 5 && <button className="seeall" onClick={() => pick(k)}>See all</button>}
        </div>
        <div className="row">{g.items.slice(0, 10).map((p) => <ProductCard key={p.id} p={p} />)}</div>
      </section>
    ))}
  </>);
}
