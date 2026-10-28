"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
export default function Login() {
  const [phone, setPhone] = useState("+91"); const [otp, setOtp] = useState(""); const [sent, setSent] = useState(false); const [msg, setMsg] = useState("");
  async function send() { const { error } = await supabase.auth.signInWithOtp({ phone }); error ? setMsg(error.message) : setSent(true); }
  async function verify() { const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" }); error ? setMsg(error.message) : (window.location.href = "/"); }
  return (<div><h3>Login</h3>
    <input value={phone} onChange={(e) => setPhone(e.target.value)} />
    {sent && <input placeholder="OTP" value={otp} onChange={(e) => setOtp(e.target.value)} />}
    <button onClick={sent ? verify : send}>{sent ? "Verify" : "OTP bhejo"}</button><p>{msg}</p></div>);
}
