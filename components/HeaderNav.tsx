"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const link = { color: "#fff", marginLeft: 12 };

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

  return (<span>
    {shop && <><a href="/shop" style={link}>Orders</a><a href="/shop/inventory" style={link}>Inventory</a></>}
    {rider && <a href="/rider" style={link}>Rider</a>}
    {staff && <a href="/admin" style={link}>Admin</a>}
    {loggedIn
      ? <a href="#" style={link} onClick={async (e) => { e.preventDefault(); await supabase.auth.signOut(); window.location.href = "/"; }}>Logout</a>
      : <a href="/login" style={{ ...link, background: "#FACC15", color: "#111827", padding: "6px 12px", borderRadius: 8, fontWeight: 600, textDecoration: "none" }}>Login</a>}
  </span>);
}
