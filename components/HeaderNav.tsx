"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function HeaderNav() {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState("customer");

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        setLoggedIn(true);
        const { data: p } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
        if (p) setRole(p.role);
      }
      setReady(true);
    });
  }, []);

  if (!ready) return null;
  const shop = role === "shop_owner" || role === "admin";
  const rider = role === "rider" || role === "admin";
  const staff = role === "admin" || role === "area_manager";

  return (<nav>
    {shop && <><Link className="navlink" href="/shop">Orders</Link><Link className="navlink" href="/shop/inventory">Inventory</Link><Link className="navlink" href="/shop/earnings">Kamayi</Link></>}
    {rider && <Link className="navlink" href="/rider">Rider</Link>}
    {staff && <Link className="navlink" href="/admin">Admin</Link>}
    {loggedIn
      ? <button className="navlink" onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}>Logout</button>
      : <Link className="navlink navlogin" href="/login">Login</Link>}
  </nav>);
}
