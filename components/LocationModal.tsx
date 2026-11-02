"use client";
import { useEffect, useState } from "react";
import { setState, useStore } from "@/lib/store";
import { detectAndSet, searchPlaces } from "@/lib/geo";

export default function LocationModal() {
  const { locOpen } = useStore();
  const [text, setText] = useState("");
  const [results, setResults] = useState<{ lat: number; lng: number; label: string; city?: string }[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => setState({ locOpen: false });
  useEffect(() => {
    if (!locOpen) return;
    document.body.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", k);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", k); };
  }, [locOpen]);

  async function find() {
    if (text.trim().length < 3) return;
    setBusy(true); setMsg("");
    try { const r = await searchPlaces(text.trim()); setResults(r); if (!r.length) setMsg("No places found. Try a different area or pincode."); }
    catch { setMsg("Search failed. Please try again."); }
    setBusy(false);
  }
  async function useMine() {
    setBusy(true); setMsg("");
    try { await detectAndSet(); } catch (e: any) { setMsg(e.message); }
    setBusy(false);
  }

  if (!locOpen) return null;
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Choose your location">
        <button className="mback" aria-label="Close" onClick={close}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
        <div className="mbody">
          <h2>Choose your location</h2>
          <p className="sub">We show products from shops that deliver to you</p>
          <button className="mbtn" disabled={busy} onClick={useMine}>Use my current location</button>
          <p className="muted" style={{ margin: "14px 0 8px" }}>or search for your area</p>
          <div className="phone">
            <input autoFocus placeholder="Area, street or pincode" value={text} onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") find(); }} />
            <button className="alt" disabled={busy} onClick={find} style={{ padding: "8px 14px" }}>Search</button>
          </div>
          {msg && <p className="merr">{msg}</p>}
          <ul className="lres">
            {results.map((r, i) => (<li key={i}><button onClick={() => { setState({ loc: r, locOpen: false }); }}>{r.label}</button></li>))}
          </ul>
        </div>
      </div>
    </div>
  );
}
