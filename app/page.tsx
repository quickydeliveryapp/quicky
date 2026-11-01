"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/messages";
import { getState, setState, useStore } from "@/lib/store";
import { CATS, OTHER, SHOW_EMPTY_CATEGORIES, categorize, isEnabled } from "@/lib/categories";
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

  // Band (disabled) categories ke products customer ko nahi dikhte
  const visible = useMemo(() => products.filter((p) => isEnabled(categorize(p.category))), [products]);

  const groups = useMemo(() => {
    const m = new Map<string, P[]>();
    for (const p of visible) { const k = categorize(p.category); m.set(k, [...(m.get(k) || []), p]); }
    return m;
  }, [visible]);

  const sidebar = [...CATS.filter((c) => c.enabled && (SHOW_EMPTY_CATEGORIES || groups.has(c.name))), ...(groups.has(OTHER) ? [{ name: OTHER, icon: "🛒", enabled: true }] : [])];

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? visible.filter((p) => p.name.toLowerCase().includes(t) || (p.category || "").toLowerCase().includes(t)) : [];
  }, [visible, q]);

  const searching = q.trim().length > 0;
  const active = sel && sidebar.some((c) => c.name === sel) ? sel : null;
  const pick = (name: string | null) => { setSel(name); window.scrollTo({ top: 0 }); };

  return (
    <div className={"shell" + (searching || !visible.length ? " nosb" : "")}>
      {!searching && visible.length > 0 && (
        <aside className="cats" aria-label="Categories">
          <button className={"cat" + (!active ? " on" : "")} onClick={() => pick(null)}><span className="ic">🛍️</span><span>All</span></button>
          {sidebar.map((c) => (
            <button key={c.name} className={"cat" + (active === c.name ? " on" : "") + (groups.has(c.name) ? "" : " dim")} onClick={() => pick(c.name)}>
              <span className="ic">{c.icon}</span><span>{c.name}</span>
            </button>
          ))}
        </aside>
      )}

      <div className="content">
        {msg && <p>{msg}</p>}
        {!loc && <p>Choose your delivery location to see products near you.</p>}
        {loc && !loaded && <p className="muted">Loading products...</p>}
        {loc && loaded && !visible.length && !msg && <p>No shops or products are available in your area yet.</p>}

        {fees && visible.length > 0 && !searching && <div className="strip">Free delivery on orders above ₹{Number(fees.free_delivery_above)}</div>}

        {searching ? (<>
          <h3>Results for &ldquo;{q}&rdquo;</h3>
          {!results.length && visible.length > 0 && <p>No products match your search.</p>}
          <div className="grid">{results.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </>) : active ? (<>
          <h3>{active}</h3>
          {!groups.get(active)?.length && <p className="muted">No products in this category near you yet.</p>}
          <div className="grid">{(groups.get(active) || []).map((p) => <ProductCard key={p.id} p={p} />)}</div>
        </>) : sidebar.filter((c) => groups.has(c.name)).map((c) => {
          const items = groups.get(c.name)!;
          return (
            <section className="sec" key={c.name}>
              <div className="sechead">
                <h3>{c.name}</h3>
                {items.length > 4 && <button className="seeall" onClick={() => pick(c.name)}>See all</button>}
              </div>
              <div className="row">{items.slice(0, 10).map((p) => <ProductCard key={p.id} p={p} />)}</div>
            </section>);
        })}
      </div>
    </div>
  );
}
