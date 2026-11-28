"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/messages";
import "../admin.css";
import "./pincodes.css";
import { PageHead, Search, DataTable, Stop, type Col } from "../ui";

type Row = { pincode: string; label: string | null; enabled: boolean; created_at: string };

export default function AdminPincodes() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [codes, setCodes] = useState("");
  const [label, setLabel] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const say = (text: string, ok = true) => setToast({ text, ok });

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("service_pincodes").select("pincode,label,enabled,created_at").order("pincode");
    if (error) { setRows([]); say(friendly(error.message) + " (Has 020_pincodes.sql been run in Supabase?)", false); return; }
    setRows((data as Row[]) || []);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); }, [toast]);

  async function call(fn: string, args: Record<string, unknown>, ok: (data: any) => string, after?: () => void) {
    setBusy(true);
    const { data, error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) say(friendly(error.message), false); else { say(ok(data)); after?.(); load(); }
  }

  function add() {
    const tokens = Array.from(new Set(codes.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean)));
    if (tokens.length === 0) { say("Enter at least one pincode.", false); return; }
    const bad = tokens.filter((t) => !/^[1-9]\d{5}$/.test(t));
    if (bad.length) { say(`${bad.slice(0, 3).join(", ")}${bad.length > 3 ? " and more" : ""} ${bad.length === 1 ? "is not a valid" : "are not valid"} 6-digit pincode${bad.length === 1 ? "" : "s"}.`, false); return; }
    call("admin_add_pincodes", { p_pincodes: tokens, p_label: label.trim() || null },
      (n) => Number(n) === tokens.length ? `Added ${n} pincode${Number(n) === 1 ? "" : "s"}.` : `Added ${n}. ${tokens.length - Number(n)} already in the list.`,
      () => { setCodes(""); setLabel(""); });
  }
  const remove = (r: Row) => { if (window.confirm(`Remove ${r.pincode}${r.label ? " (" + r.label + ")" : ""}? Customers there will no longer be able to order.`)) call("admin_remove_pincode", { p_pincode: r.pincode }, () => "Pincode removed."); };
  const toggle = (r: Row) => call("admin_set_pincode", { p_pincode: r.pincode, p_enabled: !r.enabled }, () => (r.enabled ? "Paused. No orders from this pincode." : "Delivering to this pincode again."));

  const list = rows ?? [];
  const on = list.filter((r) => r.enabled).length;
  const needle = q.trim().toLowerCase();
  const shown = useMemo(() => list.filter((r) => !needle || r.pincode.includes(needle) || (r.label ?? "").toLowerCase().includes(needle)), [list, needle]);

  const cols: Col<Row>[] = [
    { key: "pin", label: "Pincode", sort: (a, b) => a.pincode.localeCompare(b.pincode), render: (r) => <span className="pin-code">{r.pincode}</span> },
    { key: "area", label: "Area", hideSm: true, sort: (a, b) => (a.label ?? "").localeCompare(b.label ?? ""), render: (r) => r.label || <span className="ui-meta">—</span> },
    { key: "status", label: "Status", sort: (a, b) => Number(b.enabled) - Number(a.enabled), render: (r) => (
      <span className={"adm-badge " + (r.enabled ? "ok" : "off")}>{r.enabled ? "Delivering" : "Paused"}</span>) },
    { key: "act", label: "", render: (r) => (<Stop><div className="ui-act">
      <button className="sm alt" disabled={busy} onClick={() => toggle(r)}>{r.enabled ? "Pause" : "Resume"}</button>
      <button className="sm danger" disabled={busy} onClick={() => remove(r)}>Remove</button>
    </div></Stop>) },
  ];

  if (rows === null) return <p className="adm-empty">Loading...</p>;
  return (<div className="adm">
    <PageHead title="Pincodes" sub={list.length ? `${list.length} pincode${list.length === 1 ? "" : "s"} · ${on} delivering` : "No pincodes added yet"} />
    {toast && <p className={"adm-toast" + (toast.ok ? "" : " bad")} role="status">{toast.text}</p>}

    {list.length === 0
      ? <p className="pin-note">The list is empty, so <b>every location is allowed</b>. Once you add a pincode, only the pincodes listed here (and switched on) can order.</p>
      : on === 0
        ? <p className="pin-note warn"><b>Every pincode is paused</b>, so customers cannot order from anywhere right now. Tap Resume on a pincode to start delivering again.</p>
        : <p className="pin-note">Only the pincodes marked <b>Delivering</b> can order. If the map cannot tell a customer&apos;s pincode, they are not blocked.</p>}

    <div className="adm-card">
      <span className="adm-name">Add pincodes</span>
      <div className="pin-add">
        <label className="pin-codes"><span>Pincode (add many with commas or spaces)</span>
          <input inputMode="numeric" placeholder="e.g. 173205, 173206" value={codes} onChange={(e) => setCodes(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} /></label>
        <label className="pin-label"><span>Area name (optional)</span>
          <input placeholder="e.g. Baddi" maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} /></label>
        <button disabled={busy || !codes.trim()} onClick={add}>Add</button>
      </div>
    </div>

    {list.length > 0 && <div className="ui-bar"><Search value={q} onChange={setQ} placeholder="Search by pincode or area" /></div>}
    <DataTable cols={cols} rows={shown} rowKey={(r) => r.pincode} empty={list.length ? <p className="adm-empty">No pincode matches.</p> : <></>} />
  </div>);
}
