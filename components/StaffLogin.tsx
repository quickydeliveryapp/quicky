"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/messages";
import "./staff-login.css";

const RESEND_SECS = 30;
const EMPTY = () => Array(6).fill("") as string[];

// Login page for the role dashboards (/admin, /areamanager, /shop, /rider).
// Existing accounts only: nobody signs up here. After a successful login the page reloads on the same address.
export default function StaffLogin({ role, signedInElsewhere }: { role: string; signedInElsewhere?: boolean }) {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [digits, setDigits] = useState("");
  const [code, setCode] = useState<string[]>(EMPTY());
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [secs, setSecs] = useState(0);
  const phoneRef = useRef<HTMLInputElement>(null);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const phoneOk = /^[6-9]\d{9}$/.test(digits);

  useEffect(() => { if (step === "phone") phoneRef.current?.focus(); else boxes.current[0]?.focus(); }, [step]);
  useEffect(() => {
    if (secs <= 0) return;
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs]);

  async function send() {
    if (!phoneOk || busy) return;
    setBusy(true); setMsg("");
    const { error } = await supabase.auth.signInWithOtp({ phone: "+91" + digits, options: { shouldCreateUser: false } });
    setBusy(false);
    if (error) {
      setMsg(/signups?\s+not\s+allowed|not\s+found/i.test(error.message) ? `No ${role} account found for this number.` : friendly(error.message));
      return;
    }
    setCode(EMPTY()); setSecs(RESEND_SECS); setStep("otp");
  }

  async function verify(token: string) {
    if (token.length !== 6 || busy) return;
    setBusy(true); setMsg("");
    const { error } = await supabase.auth.verifyOtp({ phone: "+91" + digits, token, type: "sms" });
    if (error) {
      setBusy(false);
      setMsg(/expired|invalid/i.test(error.message) ? "That code is incorrect or has expired. Please try again." : friendly(error.message));
      setCode(EMPTY()); boxes.current[0]?.focus();
      return;
    }
    window.location.reload(); // the role gate now sees the new session
  }

  // ---- 6 boxes ----
  function fill(start: number, text: string) {
    const next = [...code];
    text.slice(0, 6 - start).split("").forEach((ch, k) => { next[start + k] = ch; });
    setCode(next);
    boxes.current[Math.min(start + text.length, 5)]?.focus();
    if (next.every(Boolean)) verify(next.join(""));
  }
  function setAt(i: number, ch: string) {
    const next = [...code]; next[i] = ch;
    setCode(next);
    if (ch && i < 5) boxes.current[i + 1]?.focus();
    if (next.every(Boolean)) verify(next.join(""));
  }
  function onBox(i: number, v: string) {
    const d = v.replace(/\D/g, "");
    if (!d) { setAt(i, ""); return; }
    if (d.length > 1 && i === 0) { fill(0, d); return; } // SMS autofill gives the whole code at once
    setAt(i, d.slice(-1));
  }
  function onKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !code[i] && i > 0) { e.preventDefault(); setAt(i - 1, ""); boxes.current[i - 1]?.focus(); }
    else if (e.key === "ArrowLeft" && i > 0) boxes.current[i - 1]?.focus();
    else if (e.key === "ArrowRight" && i < 5) boxes.current[i + 1]?.focus();
  }
  function onPaste(i: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const d = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!d) return;
    e.preventDefault();
    fill(d.length >= 6 ? 0 : i, d);
  }

  function changeNumber() { setStep("phone"); setCode(EMPTY()); setMsg(""); setSecs(0); }

  return (
    <div className="sl">
      <div className="sl-top">
        <Link href="/" aria-label="Quicky home"><img src="/logo-nav-v3.webp" alt="Quicky" width={168} height={56} decoding="async" /></Link>
      </div>
      <div className="sl-main">
        <div className="sl-card">
          <h1>{role} login</h1>
          {signedInElsewhere && <p className="sl-note">You are signed in with a different account. Log in with your {role} number to continue.</p>}

          {step === "phone" ? (<>
            <p className="sl-sub" style={{ marginTop: 8 }}>Enter your registered mobile number to get a one-time code.</p>
            <label className="sl-label" htmlFor="sl-phone">Mobile number</label>
            <div className={"sl-phone" + (msg ? " err" : "")}>
              <span>+91</span>
              <input id="sl-phone" ref={phoneRef} inputMode="numeric" autoComplete="tel-national" placeholder="10-digit number" value={digits}
                onChange={(e) => { setDigits(e.target.value.replace(/\D/g, "").slice(0, 10)); if (msg) setMsg(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
            </div>
            {msg && <p className="sl-err" role="alert">{msg}</p>}
            <button className="sl-btn" disabled={!phoneOk || busy} onClick={send}>{busy ? "Sending..." : "Continue"}</button>
          </>) : (<>
            <p className="sl-sub" style={{ marginTop: 8 }}>
              Enter the 6-digit code sent to +91 {digits}.{" "}
              <button type="button" className="sl-link" onClick={changeNumber}>Change number</button>
            </p>
            <div className={"sl-otp" + (msg ? " err" : "")} role="group" aria-label="One-time code">
              {code.map((c, i) => (
                <input key={i} ref={(el) => { boxes.current[i] = el; }} value={c} inputMode="numeric" disabled={busy}
                  autoComplete={i === 0 ? "one-time-code" : "off"} aria-label={`Digit ${i + 1} of 6`}
                  onChange={(e) => onBox(i, e.target.value)} onKeyDown={(e) => onKey(i, e)} onPaste={(e) => onPaste(i, e)}
                  onFocus={(e) => e.target.select()} />
              ))}
            </div>
            {msg && <p className="sl-err" role="alert">{msg}</p>}
            <button className="sl-btn" disabled={busy || code.some((c) => !c)} onClick={() => verify(code.join(""))}>{busy ? "Verifying..." : "Verify and continue"}</button>
            <p className="sl-resend">
              {secs > 0
                ? `Resend code in 0:${String(secs).padStart(2, "0")}`
                : <button type="button" className="sl-link" disabled={busy} onClick={send}>Resend code</button>}
            </p>
          </>)}
        </div>
        <p className="sl-foot">Authorised staff only</p>
      </div>
    </div>
  );
}
