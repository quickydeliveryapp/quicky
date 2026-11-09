"use client";
import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/messages";
import "./deposit.css";

type R = { out_rider: string; rider_phone: string; deliveries: number; collected: number; deposited: number; pending: number };
const VPA = /^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9]{1,63}$/;
const rupee = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const money = (n: number) => Math.round(n * 100) / 100;

// Collect a rider's deposit: show a UPI QR with the amount, or record cash. The rider scans the QR in the rider app.
export default function DepositPanel() {
  const [riders, setRiders] = useState<R[]>([]);
  const [upi, setUpi] = useState<string | null>(null);
  const [limit, setLimit] = useState(200);
  const [rid, setRid] = useState("");
  const [amt, setAmt] = useState("");
  const [method, setMethod] = useState<"upi" | "cash">("upi");
  const [upiText, setUpiText] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const say = (text: string, ok = true) => setToast({ text, ok });
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 6000); return () => clearTimeout(t); }, [toast]);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const [rc, pf, fe] = await Promise.all([
      supabase.rpc("rider_cash"),
      supabase.from("profiles").select("upi_id").eq("id", u.user.id).single(),
      supabase.from("fee_settings").select("*").eq("id", 1).single(),
    ]);
    if (!rc.error) setRiders(((rc.data as any[]) || []).map((r) => ({ ...r, deliveries: Number(r.deliveries), collected: Number(r.collected), deposited: Number(r.deposited), pending: Number(r.pending) })));
    if (pf.data) setUpi((pf.data as any).upi_id ?? null);
    if (fe.data) setLimit(Number((fe.data as any).rider_cash_limit ?? 200));
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const sorted = [...riders].sort((a, b) => b.pending - a.pending);
  const sel = riders.find((r) => r.out_rider === rid);
  const a = Number(amt);
  const valid = !!sel && a > 0;
  const pick = (id: string) => { setRid(id); const r = riders.find((x) => x.out_rider === id); setAmt(r && r.pending > 0 ? String(r.pending) : ""); };
  const status = (r: R) => r.pending > 0 ? `Owes ${rupee(r.pending)}` : r.pending < 0 ? `Advance ${rupee(-r.pending)}` : "Settled";
  const link = upi && valid ? `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent("Quicky")}&am=${a.toFixed(2)}&cu=INR&tn=${encodeURIComponent("Rider deposit")}` : "";

  async function saveUpi() {
    const v = upiText.trim();
    if (!VPA.test(v)) { say("That does not look like a valid UPI ID (for example name@bank).", false); return; }
    const { error } = await supabase.rpc("set_my_upi", { p_upi: v });
    if (error) say(friendly(error.message), false); else { say("Your UPI ID is saved."); setUpiText(""); load(); }
  }
  async function record() {
    if (!sel || !valid) return;
    if (!window.confirm(`Confirm that you received ${rupee(a)} from ${sel.rider_phone} by ${method === "upi" ? "UPI" : "cash"}?`)) return;
    setBusy(true);
    const { error } = await supabase.rpc("record_deposit", { p_rider: sel.out_rider, p_amount: a, p_method: method });
    setBusy(false);
    if (error) { say(friendly(error.message), false); return; }
    const left = money(sel.pending - a);
    say(left > 0 ? `Recorded ${rupee(a)}. ${sel.rider_phone} still has ${rupee(left)} to deposit.`
      : left === 0 ? `Recorded ${rupee(a)}. ${sel.rider_phone} is all settled.`
      : `Recorded ${rupee(a)}. ${sel.rider_phone} now has an advance balance of ${rupee(-left)}, adjusted against the next collections.`);
    setAmt(""); load();
  }

  return (<section className="dep" aria-label="Collect rider deposit">
    <h3>Collect a rider&apos;s deposit</h3>
    <p className="dep-hint">Riders see the Deposit option once they hold more than {rupee(limit)} of Quicky&apos;s money. Choose the rider and the amount, then show the QR or take the cash.</p>
    {toast && <p className={"dep-toast" + (toast.ok ? "" : " bad")} role="status">{toast.text}</p>}

    <div className="dep-form">
      <label><span>Rider</span>
        <select value={rid} onChange={(e) => pick(e.target.value)}>
          <option value="">Choose a rider</option>
          {sorted.map((r) => <option key={r.out_rider} value={r.out_rider}>{r.rider_phone} · {status(r)}</option>)}
        </select></label>
      <label><span>Amount received (₹)</span>
        <input inputMode="decimal" placeholder="₹ 0" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ""))} /></label>
    </div>

    <div className="dep-seg" role="group" aria-label="How is the rider paying?">
      <button className={method === "upi" ? "on" : ""} aria-pressed={method === "upi"} onClick={() => setMethod("upi")}>UPI (show QR)</button>
      <button className={method === "cash" ? "on" : ""} aria-pressed={method === "cash"} onClick={() => setMethod("cash")}>Cash</button>
    </div>

    {method === "upi" && (upi ? (valid ? (
      <div className="dep-qr">
        <QRCodeSVG value={link} size={200} />
        <b>{rupee(a)}</b>
        <p>Ask {sel!.rider_phone} to scan this QR in the rider app. It pays to <b style={{ fontSize: 14 }}>{upi}</b>.</p>
      </div>
    ) : <p className="dep-hint">Choose a rider and enter the amount to show the QR.</p>) : (
      <div>
        <p className="dep-hint">Add your UPI ID first. The deposit QR pays to it.</p>
        <div className="dep-upi" style={{ marginTop: 8 }}>
          <input placeholder="your UPI ID, e.g. name@bank" aria-label="Your UPI ID" value={upiText} onChange={(e) => setUpiText(e.target.value)} autoCapitalize="none" autoCorrect="off" />
          <button className="dep-go" disabled={!upiText.trim()} onClick={saveUpi}>Save</button>
        </div>
      </div>))}

    <button className="dep-go" disabled={!valid || busy || (method === "upi" && !upi)} onClick={record}>
      {busy ? "Please wait..." : method === "upi" ? `I received ${valid ? rupee(a) : "the payment"} on UPI` : `Record cash received${valid ? " " + rupee(a) : ""}`}
    </button>
    {method === "upi" && <p className="dep-hint">UPI does not tell Quicky by itself. Press the button once the money shows in your UPI app, so the rider&apos;s balance updates.</p>}

    {sorted.length > 0 && <>
      <h3 style={{ marginTop: 6 }}>Riders in your area</h3>
      <div className="dep-list">
        {sorted.map((r) => (<div className="dep-row" key={r.out_rider}>
          <div className="grow"><b>{r.rider_phone}</b><small>{status(r)} · collected {rupee(r.collected)}, deposited {rupee(r.deposited)}</small></div>
          {r.pending > limit && <span className="dep-badge">Over limit</span>}
          <button className="dep-pick" onClick={() => pick(r.out_rider)}>Collect</button>
        </div>))}
      </div></>}
  </section>);
}
