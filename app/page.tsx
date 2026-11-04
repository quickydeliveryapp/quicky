"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/messages";
import { getState, setState, useStore } from "@/lib/store";
import { CATS, OTHER, SHOW_EMPTY_CATEGORIES, categorize, isEnabled } from "@/lib/categories";
import ProductCard, { P } from "@/components/ProductCard";
import Hero from "@/components/Hero";
import { Icon } from "@/lib/icons";

// Category ki photo; photo na ho (jaise "Other") toh icon
function Thumb({ c, size }: { c: { icon: string; img: string }; size: number }) {
  return c.img ? <img src={c.img} alt="" loading="lazy" width={240} height={141} /> : <Icon name={c.icon} size={size} />;
}

// Products ka ek grid: jitne side-by-side aa sakein, phir neeche. Pehle 24, baaki "Show more" se (page tez rahe)
function ProductGrid({ items }: { items: P[] }) {
  const [n, setN] = useState(24);
  return (<>
    <div className="grid">{items.slice(0, n).map((p) => <ProductCard key={p.id} p={p} />)}</div>
    {n < items.length && <button className="alt more" onClick={() => setN(n + 24)}>Show more products</button>}
  </>);
}

export default function Home() {
  const { loc, q, cart } = useStore();
  const [products, setProducts] = useState<P[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [fees, setFees] = useState<any>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [allCats, setAllCats] = useState(false);

  // "Shop by Category" heading ko sticky header ke theek neeche laao (render ke baad, instant)
  const scrollToCats = () => {
    const go = () => {
      const el = document.getElementById("categories");
      if (!el) return;
      const headerH = document.querySelector(".hdr")?.getBoundingClientRect().height ?? 0;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - headerH - 12, behavior: "auto" });
    };
    requestAnimationFrame(() => requestAnimationFrame(go));
    setTimeout(go, 150);
  };

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

  // Bottom tab ka "Categories": saari categories kholo aur wahan scroll karo
  useEffect(() => {
    const go = () => { setSel(null); setAllCats(true); scrollToCats(); };
    try { if (sessionStorage.getItem("qk_cats")) { sessionStorage.removeItem("qk_cats"); go(); } } catch {}
    window.addEventListener("show-categories", go);
    return () => window.removeEventListener("show-categories", go);
  }, []);

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

  // Naam ke hisaab se A-Z (popular ka data aane par badal denge)
  const allSorted = useMemo(() => [...visible].sort((a, b) => a.name.localeCompare(b.name)), [visible]);

  const groups = useMemo(() => {
    const m = new Map<string, P[]>();
    for (const p of allSorted) { const k = categorize(p.category); m.set(k, [...(m.get(k) || []), p]); }
    return m;
  }, [allSorted]);

  const sidebar = [...CATS.filter((c) => c.enabled && (SHOW_EMPTY_CATEGORIES || groups.has(c.name))), ...(groups.has(OTHER) ? [{ name: OTHER, icon: "bag", img: "", enabled: true }] : [])];

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? allSorted.filter((p) => p.name.toLowerCase().includes(t) || (p.category || "").toLowerCase().includes(t)) : [];
  }, [allSorted, q]);

  const searching = q.trim().length > 0;
  const active = sel && sidebar.some((c) => c.name === sel) ? sel : null;
  const pick = (name: string | null) => {
    setSel(name);
    setAllCats(false); // category se aane/jaane par categories default (collapsed) view mein
    if (!name) window.scrollTo({ top: 0 });
  };
  const toCategories = scrollToCats;
  // Laptop pe left list sirf category kholne par dikhti hai (home pe tiles ki row hoti hai)
  const showSide = !searching && !!active && visible.length > 0;

  // Category chuni to uske heading par scroll karo (header ke neeche)
  useEffect(() => {
    if (!active || searching) return;
    // Page chhota hone ke baad browser scroll clamp karta hai, isliye render ke baad do baar, instant scroll
    const go = () => {
      const el = document.getElementById("cat-title");
      if (!el) return;
      const headerH = document.querySelector(".hdr")?.getBoundingClientRect().height ?? 0;
      const top = el.getBoundingClientRect().top + window.scrollY - headerH - 12;
      window.scrollTo({ top, behavior: "auto" });
    };
    requestAnimationFrame(() => requestAnimationFrame(go));
    const t = setTimeout(go, 150);
    return () => clearTimeout(t);
  }, [active]);

  return (
    <div className={"shell" + (showSide ? "" : " nosb")}>
      {showSide && (
        <aside className="cats" aria-label="Categories">
          <button className="cat" onClick={() => pick(null)}><span className="ic"><Icon name="bag" size={20} /></span><span>All</span></button>
          {sidebar.map((c) => (
            <button key={c.name} className={"cat" + (active === c.name ? " on" : "") + (groups.has(c.name) ? "" : " dim")} onClick={() => pick(c.name)}>
              <span className="ic"><Thumb c={c} size={20} /></span><span>{c.name}</span>
            </button>
          ))}
        </aside>
      )}

      <div className="content">
        {!searching && active && <button className="alt backrow" onClick={() => pick(null)}><Icon name="arrowLeft" size={16} sw={2} /> All categories</button>}

        {!searching && !active && <>
          <Hero freeAbove={fees ? Number(fees.free_delivery_above) : undefined} onShop={toCategories} />

          {fees && (() => {
            const threshold = Number(fees.free_delivery_above);
            const cartTotal = Object.values(cart).reduce((sum, i) => sum + i.qty * Number(i.price), 0);
            const left = Math.max(0, threshold - cartTotal);
            const pct = threshold > 0 ? Math.min(100, (cartTotal / threshold) * 100) : 100;
            return (
              <button className="freebar" onClick={() => setState({ cartOpen: true })}>
                <span className="fi"><Icon name="truck" size={28} sw={1.5} /></span>
                <div>
                  <b>{left > 0 ? `Add ₹${Math.ceil(left)} more for Free Delivery` : "Free Delivery unlocked!"}</b>
                  <span>{left > 0 ? `On orders above ₹${threshold}` : "Your order qualifies"}</span>
                  <div className="fbar"><i style={{ width: `${pct}%` }} /></div>
                </div>
                <Icon name="arrowRight" size={18} sw={2} />
              </button>
            );
          })()}

          <section id="categories" className="catsec">
            <div className="sechead">
              <h3>Shop by Category</h3>
              <button className="seeall" onClick={() => setAllCats((a) => !a)}>{allCats ? "Show less" : <>View All <Icon name="arrowRight" size={15} sw={2} /></>}</button>
            </div>
            <div className={"crow" + (allCats ? " all" : "")}>
              {sidebar.map((c) => (
                <button key={c.name} className="cchip" onClick={() => pick(c.name)}>
                  <span className="cimg"><Thumb c={c} size={28} /></span><span>{c.name}</span>
                </button>))}
            </div>
          </section>
        </>}

        {msg && <p>{msg}</p>}
        {!loc && <p>Choose your delivery location to see products near you.</p>}
        {loc && !loaded && <p className="muted">Loading products...</p>}
        {loc && loaded && !visible.length && !msg && <p>No shops or products are available in your area yet.</p>}

        {searching ? (<>
          <h3>Results for &ldquo;{q}&rdquo;</h3>
          {!results.length && visible.length > 0 && <p>No products match your search.</p>}
          <ProductGrid key={"s:" + q} items={results} />
        </>) : active ? (<>
          <h3 id="cat-title">{active}</h3>
          {!groups.get(active)?.length && <p className="muted">No products in this category near you yet.</p>}
          <ProductGrid key={"c:" + active} items={groups.get(active) || []} />
        </>) : visible.length > 0 && (<>
          <div className="sechead"><h3>All Products</h3></div>
          <ProductGrid key="all" items={allSorted} />
        </>)}
      </div>
    </div>
  );
}
