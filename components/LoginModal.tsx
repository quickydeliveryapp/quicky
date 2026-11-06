"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/messages";
import { homeForRole, ROLE_LABEL } from "@/lib/roles";


// ?next=/admin: only same-site paths are allowed (no //evil.com, no /login loop)
function safeNext(): string | null {
  const n = new URLSearchParams(window.location.search).get("next");
  return n && /^\/(?![\/\\]|login)/.test(n) ? n : null;
}

// Kahin se bhi kholne ke liye: window.dispatchEvent(new Event("open-login"))
export default function LoginModal() {
  const router = useRouter();
  const pathname = usePathname();
  const routeOpen = useRef(false); // true while the dialog is open because we are on /login
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [digits, setDigits] = useState("");
  const [otp, setOtp] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [need, setNeed] = useState(""); // ?need=Shop: this page is for a different role than the one logged in
  const inputRef = useRef<HTMLInputElement>(null);

  const phoneOk = /^[6-9]\d{9}$/.test(digits);
  const otpOk = /^\d{6}$/.test(otp);

  function close() {
    setOpen(false); setStep("phone"); setOtp(""); setMsg("");
    if (window.location.pathname === "/login") router.replace("/");
  }
  function back() { setStep("phone"); setOtp(""); setMsg(""); }

  // The header is mounted for the whole app, so /login can be reached without a page reload
  // (e.g. a role gate redirect). React to the path, not only to the first load.
  useEffect(() => {
    if (pathname === "/login") {
      routeOpen.current = true;
      setOpen(true);
      const n = new URLSearchParams(window.location.search).get("need") ?? "";
      setNeed(Object.values(ROLE_LABEL).includes(n) ? n : "");
    } else if (routeOpen.current) {
      routeOpen.current = false;
      setOpen(false); setStep("phone"); setOtp(""); setMsg(""); setNeed("");
    }
  }, [pathname]);

  useEffect(() => {
    // Optional detail: { need: "Shop" } shows which account this page is for (sent by RoleGate)
    const h = (e: Event) => {
      const n = (e as CustomEvent<{ need?: string }>).detail?.need ?? "";
      setNeed(Object.values(ROLE_LABEL).includes(n) ? n : "");
      setOpen(true);
    };
    window.addEventListener("open-login", h);
    return () => window.removeEventListener("open-login", h);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", k);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", k); };
  }, [open]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open, step]);

  async function send() {
    setBusy(true); setMsg("");
    // On a role page (/admin, /shop ...) only existing accounts can log in. No automatic sign up.
    const { error } = await supabase.auth.signInWithOtp({ phone: "+91" + digits, ...(need ? { options: { shouldCreateUser: false } } : {}) });
    setBusy(false);
    if (error) setMsg(need && /signups?\s+not\s+allowed|not\s+found/i.test(error.message) ? `No ${need} account found for this number.` : friendly(error.message));
    else setStep("otp");
  }
  async function verify() {
    setBusy(true); setMsg("");
    const { data, error } = await supabase.auth.verifyOtp({ phone: "+91" + digits, token: otp, type: "sms" });
    if (error) { setBusy(false); setMsg(friendly(error.message)); return; }
    // Opened from the storefront Login button: stay on the same page
    if (window.location.pathname !== "/login") { window.location.reload(); return; }
    // Opened on /login: go back to the page the user wanted, else straight to their own dashboard, else home
    let target = safeNext();
    if (!target && data.user) {
      const { data: p } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      target = p ? homeForRole(p.role) : null;
    }
    window.location.assign(target ?? "/");
  }

  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={need ? `${need} login` : "Log in or sign up"}>
        <button className="mback" aria-label="Back" onClick={step === "otp" ? back : close}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
        <div className="mbody">
          <img className="mlogo" src="/icon-192.png" alt="Quicky" width={72} height={72} />
          <h2>{step === "phone" ? (need ? `${need} login` : "Log in or Sign up") : "Verify your number"}</h2>
          <p className="sub">{step === "phone" ? (need ? `Enter your ${need} account mobile number to get an OTP` : "Enter your mobile number to get an OTP") : `Enter the 6-digit OTP sent to +91 ${digits}`}</p>

          {step === "phone" ? (
            <div className="phone">
              <span>+91</span>
              <input ref={inputRef} inputMode="numeric" autoComplete="tel-national" placeholder="Enter mobile number" value={digits}
                onChange={(e) => setDigits(e.target.value.replace(/\D/g, "").slice(0, 10))}
                onKeyDown={(e) => { if (e.key === "Enter" && phoneOk && !busy) send(); }} />
            </div>
          ) : (
            <div className="phone">
              <input ref={inputRef} inputMode="numeric" autoComplete="one-time-code" placeholder="Enter OTP" value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => { if (e.key === "Enter" && otpOk && !busy) verify(); }} />
            </div>
          )}

          {msg && <p className="merr">{msg}</p>}
          <button className="mbtn" disabled={busy || (step === "phone" ? !phoneOk : !otpOk)} onClick={step === "phone" ? send : verify}>
            {busy ? "Please wait..." : step === "phone" ? "Continue" : "Verify"}
          </button>
        </div>
        {!need && <div className="mfoot">By continuing, you agree to our Terms of service &amp; Privacy policy</div>}
      </div>
    </div>
  );
}
