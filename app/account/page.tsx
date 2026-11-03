"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function Account() {
  const [phone, setPhone] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { setPhone(null); window.dispatchEvent(new Event("open-login")); return; }
      setPhone(data.user.phone ? "+" + data.user.phone : "");
    });
  }, []);

  if (phone === undefined) return <p className="muted">Loading...</p>;
  if (phone === null) return <p>Please log in to see your account.</p>;
  return (<div>
    <h3 style={{ marginTop: 0 }}>My Account</h3>
    <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div><div className="muted">Mobile number</div><b>{phone}</b></div>
      <button className="alt" onClick={async () => { await supabase.auth.signOut(); window.location.href = "/"; }}>Logout</button>
    </div>
    <Link href="/orders" className="oitem" style={{ marginTop: 12 }}><b>My Orders</b><span className="muted">View all &rarr;</span></Link>
  </div>);
}
