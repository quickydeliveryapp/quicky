"use client";
import { useEffect, useState } from "react";
import RoleGate from "@/components/RoleGate";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";

type Row = { id: string; role: string; full_name: string | null };

function AreaView() {
  const { profile } = useProfile();
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState("");

  // RLS limits this to shops and riders in the manager's own area.
  useEffect(() => {
    if (!profile) return;
    supabase.from("profiles").select("id,role,full_name").in("role", ["shop", "rider"]).order("role").then(({ data, error }) => {
      if (error) setErr(error.message); else setRows((data as Row[]) ?? []);
    });
  }, [profile]);

  const shops = rows.filter((r) => r.role === "shop");
  const riders = rows.filter((r) => r.role === "rider");
  const List = ({ title, items }: { title: string; items: Row[] }) => (
    <div style={{ flex: 1, minWidth: 240, padding: 14, border: "1px solid #E7EEE4", borderRadius: 12, background: "#fff" }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>{title} ({items.length})</h3>
      {items.length === 0 ? <p style={{ margin: 0, color: "#6B7A71", fontSize: 13 }}>None in your area yet.</p>
        : <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>{items.map((r) => <li key={r.id}>{r.full_name || r.id.slice(0, 8)}</li>)}</ul>}
    </div>
  );

  return (
    <>
      <h2 style={{ margin: "0 0 4px" }}>Area manager</h2>
      <p style={{ margin: "0 0 12px", color: "#6B7A71", fontSize: 13 }}>
        {profile?.area ? `Shops and riders in ${profile.area}. ` : "No area assigned yet. Ask an admin to assign one. "}
        You cannot edit banners, users or other areas.
      </p>
      {err && <p style={{ color: "#C62828", fontSize: 13 }}>{err}</p>}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <List title="Shops" items={shops} />
        <List title="Riders" items={riders} />
      </div>
      {/* Area orders and rider assignment go here once the orders table is wired (see supabase/roles.sql). */}
    </>
  );
}

export default function AreaManagerDashboard() {
  return <RoleGate allow={["area_manager"]}><AreaView /></RoleGate>;
}
