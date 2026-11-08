"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/messages";
import { RiderDetailsFields, checkDetails, emptyDetails, type Details } from "./RiderDetails";

type Kind = "rider" | "shop";
type Invite = { out_id: string; out_phone: string; out_role: string; out_name: string | null; out_shop_name: string | null; out_created_at: string };
type Done = { kind: Kind; status: "added" | "invited"; phone: string; label: string; approved: boolean };

// "12.9716, 77.5946" (as copied from Google Maps) -> [lat, lng]
function parseLoc(t: string): [number, number] | null {
  const m = t.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]), lng = Number(m[2]);
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? [lat, lng] : null;
}
function normPhone(t: string): string | null {
  const d = t.replace(/\D/g, "");
  if (d.length === 10) return "91" + d;
  return d.length >= 11 && d.length <= 15 ? d : null;
}
const show = (p: string) => (p.length === 12 && p.startsWith("91") ? "+91 " + p.slice(2) : "+" + p);

// Onboard a rider or a shop: set up an existing account, or invite a phone number that has not signed in yet.
export default function OnboardPanel({ initialKind = "rider", onChanged }: { initialKind?: Kind; onChanged: () => void }) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [loc, setLoc] = useState("");
  const [det, setDet] = useState<Details>(emptyDetails());
  const [approve, setApprove] = useState(true);
  const [busy, setBusy] = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);

  const loadInvites = useCallback(async () => {
    const { data, error } = await supabase.rpc("am_invites");
    if (!error) setInvites((data as Invite[]) || []);
  }, []);
  useEffect(() => { loadInvites(); }, [loadInvites]);
  useEffect(() => { setKind(initialKind); }, [initialKind]);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 6000); return () => clearTimeout(t); }, [msg]);

  function useMyLocation() {
    if (!navigator.geolocation) { setMsg({ text: "This phone cannot share its location. Paste the coordinates instead.", ok: false }); return; }
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setLoc(p.coords.latitude.toFixed(6) + ", " + p.coords.longitude.toFixed(6)); setLocBusy(false); },
      () => { setLocBusy(false); setMsg({ text: "Could not get your location. Allow location access, or paste the coordinates instead.", ok: false }); },
      { enableHighAccuracy: true, timeout: 15000 });
  }

  async function submit() {
    const ph = normPhone(phone);
    if (!ph) { setMsg({ text: "Enter a valid 10-digit mobile number.", ok: false }); return; }
    let ll: [number, number] | null = null;
    if (kind === "rider") {
      if (!name.trim()) { setMsg({ text: "Enter the rider's full name.", ok: false }); return; }
      const bad = checkDetails(det);
      if (bad) { setMsg({ text: bad, ok: false }); return; }
    }
    if (kind === "shop") {
      if (!shopName.trim()) { setMsg({ text: "Enter the shop name.", ok: false }); return; }
      ll = parseLoc(loc);
      if (!ll) { setMsg({ text: "Add the shop location, for example 12.9716, 77.5946. Or tap Use my current location.", ok: false }); return; }
    }
    if (!window.confirm(`Onboard ${show(ph)} as a ${kind} in your area?`)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("am_onboard", {
      p_phone: ph, p_role: kind, p_name: name.trim() || null, p_approve: kind === "rider" ? approve : false,
      p_shop_name: kind === "shop" ? shopName.trim() : null, p_shop_address: kind === "shop" ? address.trim() || null : null,
      p_lat: ll ? ll[0] : null, p_lng: ll ? ll[1] : null,
      p_details: kind === "rider" ? det : null,
    });
    setBusy(false);
    if (error) { setMsg({ text: friendly(error.message), ok: false }); return; }
    setDone({ kind, status: data === "invited" ? "invited" : "added", phone: ph, label: kind === "shop" ? shopName.trim() : name.trim(), approved: kind === "rider" && approve });
    setPhone(""); setName(""); setShopName(""); setAddress(""); setLoc(""); setDet(emptyDetails());
    loadInvites(); onChanged();
  }

  async function cancel(i: Invite) {
    if (!window.confirm(`Cancel the invite for ${show(i.out_phone)}?`)) return;
    const { error } = await supabase.rpc("am_cancel_invite", { p_id: i.out_id });
    if (error) setMsg({ text: friendly(error.message), ok: false }); else { setMsg({ text: "Invite cancelled.", ok: true }); loadInvites(); }
  }

  const next = done && (done.status === "invited"
    ? <>Ask them to sign in with <b>{show(done.phone)}</b>. Their account is set up as soon as they log in{done.kind === "rider" && done.approved ? ", and the rider is approved already" : ""}.</>
    : done.kind === "rider"
      ? <>They can open the rider app now. {done.approved ? "They are approved, so they can go online and take orders." : "Approve them in the Riders tab before they can take orders."}</>
      : <>The shop is created and waiting for Quicky to approve it. Once approved it can add products and receive orders.</>);

  return (<div className="am-onb">
    <ol className="am-steps" aria-label="How onboarding works">
      <li><b>1. Enter details</b><span>Phone number. For a rider: vehicle, licence and emergency contact. For a shop: name and location.</span></li>
      <li><b>2. They sign in</b><span>With that phone number. If they already have an account, it is set up at once.</span></li>
      <li><b>3. Approval</b><span>You approve riders. Quicky approves shops.</span></li>
      <li><b>4. Go online</b><span>Riders and shops start taking orders.</span></li>
    </ol>

    {msg && <p className={"adm-toast" + (msg.ok ? "" : " bad")} role="status">{msg.text}</p>}

    {done ? (<div className="adm-card">
      <div className="adm-head"><span className="adm-av">✓</span>
        <div><span className="adm-name">{done.status === "invited" ? "Invite saved" : (done.kind === "shop" ? "Shop added" : "Rider added")}</span>
          <span className="adm-sub">{done.label ? done.label + " · " : ""}{show(done.phone)}</span></div>
        <span className={"adm-badge " + (done.status === "added" ? "ok" : "")}>{done.status === "invited" ? "Waiting for login" : "Set up"}</span>
      </div>
      <p className="adm-hint">{next}</p>
      <div className="adm-actions"><button onClick={() => setDone(null)}>Onboard another</button></div>
    </div>) : (<div className="adm-card">
      <div className="am-seg" role="group" aria-label="Who are you onboarding?">
        <button className={kind === "rider" ? "on" : ""} aria-pressed={kind === "rider"} onClick={() => setKind("rider")}>Rider</button>
        <button className={kind === "shop" ? "on" : ""} aria-pressed={kind === "shop"} onClick={() => setKind("shop")}>Shop</button>
      </div>
      <div className="am-form">
        <label><span>Mobile number</span>
          <input type="tel" inputMode="tel" placeholder="9999999995" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <label><span>{kind === "shop" ? "Owner name (optional)" : "Full name"}</span>
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} /></label>
        {kind === "shop" && <>
          <label><span>Shop name</span>
            <input placeholder="e.g. Sharma General Store" value={shopName} onChange={(e) => setShopName(e.target.value)} /></label>
          <label><span>Shop address (optional)</span>
            <input placeholder="Street, area" value={address} onChange={(e) => setAddress(e.target.value)} /></label>
          <label className="wide"><span>Shop location (latitude, longitude)</span>
            <div className="am-loc">
              <input inputMode="decimal" placeholder="e.g. 30.9010, 75.8573" value={loc} onChange={(e) => setLoc(e.target.value)} autoCapitalize="none" autoCorrect="off" />
              <button type="button" className="alt" disabled={locBusy} onClick={useMyLocation}>{locBusy ? "Finding..." : "Use my current location"}</button>
            </div>
          </label>
          <p className="adm-hint wide">Best done while you are standing at the shop. Orders are matched to shops by this location. You can also paste the coordinates from Google Maps.</p>
        </>}
      </div>
      {kind === "rider" && <>
        <h4 className="am-sub">Rider details</h4>
        <RiderDetailsFields value={det} onChange={setDet} />
      </>}
      {kind === "rider" && <label className="am-check"><input type="checkbox" checked={approve} onChange={(e) => setApprove(e.target.checked)} /> Approve this rider right away</label>}
      <div className="adm-actions"><button disabled={busy || !phone.trim()} onClick={submit}>{busy ? "Please wait..." : kind === "shop" ? "Onboard shop" : "Onboard rider"}</button></div>
    </div>)}

    <h3 className="adm-h">Waiting for first login{invites.length ? ` (${invites.length})` : ""}</h3>
    {invites.length === 0 ? <p className="adm-hint">No pending invites. When you onboard a number that has not signed in yet, it appears here.</p> : <div className="adm-grid">
      {invites.map((i) => (<div className="adm-card" key={i.out_id}>
        <div className="adm-head">
          <span className="adm-av">{i.out_role === "shop" ? "S" : "R"}</span>
          <div><span className="adm-name">{i.out_shop_name || i.out_name || show(i.out_phone)}</span><span className="adm-sub">{show(i.out_phone)}</span></div>
          <span className="adm-badge">{i.out_role === "shop" ? "Shop" : "Rider"}</span>
        </div>
        <div className="adm-actions"><button className="danger" onClick={() => cancel(i)}>Cancel invite</button></div>
      </div>))}
    </div>}
  </div>);
}
