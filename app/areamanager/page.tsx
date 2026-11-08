"use client";
import { useCallback, useEffect, useState } from "react";
import RoleGate from "@/components/RoleGate";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/lib/useProfile";
import OrdersPanel from "./OrdersPanel";
import DepositPanel from "./DepositPanel";

type Row = { id: string; role: string; full_name: string | null; is_online: boolean };

const btn: React.CSSProperties = {
  padding: "4px 10px", fontSize: 12, borderRadius: 8,
  border: "1px solid #E7EEE4", background: "#fff", cursor: "pointer",
};

function AreaView() {
  const { profile } = useProfile();
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  // RLS limits this to shops and riders in the manager's own area.
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("profiles").select("id,role,full_name,is_online")
      .in("role", ["shop", "rider"]).order("role");
    if (error) setErr(error.message);
    else setRows((data as Row[]) ?? []);
  }, []);

  useEffect(() => { if (profile) load(); }, [profile, load]);

  async function call(fn: string, args: Record<string, unknown>, after?: () => void) {
    setBusy(true);
    setErr("");
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) setErr(error.message);
    else { after?.(); load(); }
  }

  function addMember() {
    const digits = phone.replace(/\D/g, "");
    if (!digits) return;
    const full = digits.length === 10 ? "91" + digits : digits;
    call("am_add_member", { p_phone: full }, () => setPhone(""));
  }

  function member(r: Row) {
    return (
      <li key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", flexWrap: "wrap" }}>
        <span style={{ flex: 1, minWidth: 120 }}>{r.full_name || r.id.slice(0, 8)}</span>
        <span style={{ fontSize: 12, color: r.is_online ? "#0C7D1D" : "#6B7A71" }}>
          {r.is_online ? "Online" : "Offline"}
        </span>
        <button disabled={busy} style={btn} onClick={() => call("am_set_online", { p_id: r.id, p_online: !r.is_online })}>
          {r.is_online ? "Set offline" : "Set online"}
        </button>
        <button disabled={busy} style={{ ...btn, color: "#C62828" }}
          onClick={() => { if (window.confirm("Remove this member from your area?")) call("am_remove_member", { p_id: r.id }); }}>
          Remove
        </button>
      </li>
    );
  }

  function list(title: string, role: string) {
    const items = rows.filter((r) => r.role === role);
    return (
      <div style={{ flex: 1, minWidth: 280, padding: 14, border: "1px solid #E7EEE4", borderRadius: 12, background: "#fff" }}>
        <h3 style={{ margin: "0 0 8px", fontSize: 15 }}>{title} ({items.length})</h3>
        {items.length === 0
          ? <p style={{ margin: 0, color: "#6B7A71", fontSize: 13 }}>None in your area yet.</p>
          : <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 14 }}>{items.map(member)}</ul>}
      </div>
    );
  }

  return (
    <>
      <h2 style={{ margin: "0 0 4px" }}>Area manager</h2>
      <p style={{ margin: "0 0 12px", color: "#6B7A71", fontSize: 13 }}>
        {profile?.area ? `Shops and riders in ${profile.area}. ` : "No area assigned yet. Ask an admin to assign one. "}
        You cannot edit banners, users or other areas.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <input
          type="tel"
          placeholder="Phone (9999999995)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #E7EEE4", minWidth: 220 }}
        />
        <button disabled={busy || !phone.trim()} onClick={addMember}
          style={{ ...btn, padding: "8px 14px", fontSize: 13, background: "#0C7D1D", color: "#fff", border: "none" }}>
          Add to area
        </button>
      </div>
      <p style={{ margin: "0 0 12px", color: "#6B7A71", fontSize: 12 }}>
        Only a shop or rider whose role is already set and who has no area can be added.
      </p>

      {err && <p style={{ color: "#C62828", fontSize: 13 }}>{err}</p>}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {list("Shops", "shop")}
        {list("Riders", "rider")}
      </div>

      <DepositPanel />

      <OrdersPanel people={rows} />
    </>
  );
}

export default function AreaManagerDashboard() {
  return <RoleGate allow={["area_manager"]}><AreaView /></RoleGate>;
}
