"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getState, initStore, setState, useStore } from "@/lib/store";
import { detectAndSet, reverse } from "@/lib/geo";
import { Icon } from "@/lib/icons";

export default function Header() {
  const { loc, q, cart } = useStore();
  const path = usePathname();
  const router = useRouter();
  const [role, setRole] = useState("customer");
  const [loggedIn, setLoggedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [eta, setEta] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    initStore();
    const saved = getState().loc;
    if (!saved) detectAndSet().catch(() => setState({ locOpen: true }));
    else reverse(saved.lat, saved.lng).then((p) => {
      const cur = getState().loc;
      if (cur && cur.lat === saved.lat && cur.lng === saved.lng && p.label !== "Current location" && (cur.city !== p.city || cur.label !== p.label)) setState({ loc: { ...cur, label: p.label, city: p.city } });
    });
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setLoggedIn(true);
        const { data: p } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
        if (p) setRole(p.role);
      }
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!loc) { setEta(undefined); return; }
    supabase.rpc("delivery_eta", { p_lat: loc.lat, p_lng: loc.lng }).then(({ data, error }) => setEta(error ? undefined : (data as number | null)));
  }, [loc?.lat, loc?.lng]);

  const items = Object.values(cart);
  const count = items.reduce((s, i) => s + i.qty, 0);
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);

  const etaText = !loc ? "Select your location"
    : eta === undefined ? "Delivery in minutes"
    : eta === null ? "Not serviceable yet"
    : `Delivery in ${Math.min(eta, 60)}${eta > 60 ? "+" : ""} minutes`;

  const etaShort = !loc ? "Set location" : eta === undefined ? "Fast delivery" : eta === null ? "Not serviceable" : `${Math.min(eta, 60)}${eta > 60 ? "+" : ""} min`;

  const etaMobile = typeof eta === "number" ? `Delivery in ${Math.min(eta, 60)}${eta > 60 ? "+" : ""} min` : etaShort;

  const shop = role === "shop_owner" || role === "admin";
  const rider = role === "rider" || role === "admin";
  const staff = role === "admin" || role === "area_manager";
  const links: string[][] = [
    ...(shop ? [["/shop", "Orders"], ["/shop/inventory", "Inventory"], ["/shop/earnings", "Earnings"]] : []),
    ...(rider ? [["/rider", "Rider"]] : []),
    ...(staff ? [["/admin", "Admin"]] : []),
  ];

  return (<>
    <header className="hdr">
      <Link href="/" className="brand hlogo" aria-label="Quicky home">
        <img src="/logo-nav-v3.webp" alt="Quicky" width={168} height={56} decoding="async" />
      </Link>

      <button className="hloc" onClick={() => setState({ locOpen: true })} aria-label="Change delivery location">
        <span className="hl1"><span className="eta-l">{etaText}</span><span className="eta-s">{etaMobile}</span></span>
        <span className="hl2"><span className="pin"><Icon name="pin" size={15} /></span><span className="t">{loc ? (loc.city || loc.label) : "Choose location"}</span>
          <Icon name="chevronDown" size={16} sw={2} /></span>
      </button>

      <label className="hsearch">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        <input type="search" placeholder='Search "milk"' aria-label="Search products" value={q}
          onChange={(e) => { setState({ q: e.target.value }); if (e.target.value && path !== "/") router.push("/"); }} />
      </label>

      {authReady && (loggedIn
        ? <button className="hlogin" onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}>Logout</button>
        : <button className="hlogin" onClick={() => window.dispatchEvent(new Event("open-login"))}>Login</button>)}

      <button className={"hcart" + (count ? " on" : "")} onClick={() => setState({ cartOpen: true })}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 7H6" /></svg>
        {count ? <span className="c2"><b>{count} item{count > 1 ? "s" : ""}</b><span>₹{total.toFixed(0)}</span></span> : <b>My Cart</b>}
      </button>
    </header>
    {links.length > 0 && <nav className="subnav">{links.map(([href, label]) => <Link key={href} className="navlink" href={href}>{label}</Link>)}</nav>}
  </>);
}
