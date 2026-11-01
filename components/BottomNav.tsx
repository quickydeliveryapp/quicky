"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { setState, useStore } from "@/lib/store";

const I = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round", strokeLinejoin: "round" } as const;

// Sirf phone pe dikhta hai (CSS se). Desktop pe header hi kaafi hai
export default function BottomNav() {
  const { cart } = useStore();
  const path = usePathname();
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setLoggedIn(!!data.user)); }, []);
  const count = Object.values(cart).reduce((s, i) => s + i.qty, 0);

  function categories() {
    if (path === "/") window.dispatchEvent(new Event("show-categories"));
    else { try { sessionStorage.setItem("qk_cats", "1"); } catch {} router.push("/"); }
  }
  function account() {
    if (loggedIn) router.push("/account"); else window.dispatchEvent(new Event("open-login"));
  }

  return (
    <nav className="tabs" aria-label="Main">
      <Link href="/" className={"tab" + (path === "/" ? " on" : "")} onClick={() => setState({ q: "" })}>
        <svg {...I}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>Home
      </Link>
      <button className="tab" onClick={categories}>
        <svg {...I}><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></svg>Categories
      </button>
      <button className="tab" onClick={() => setState({ cartOpen: true })}>
        <svg {...I}><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2 3h3l2.7 12.4a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 7H6" /></svg>Cart
        {count > 0 && <span className="bd">{count}</span>}
      </button>
      <button className={"tab" + (path === "/account" ? " on" : "")} onClick={account}>
        <svg {...I}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></svg>{loggedIn ? "Account" : "Login"}
      </button>
    </nav>
  );
}
