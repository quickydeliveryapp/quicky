"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { enablePush } from "@/lib/push";

export default function EnablePush() {
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    (async () => {
      if (typeof Notification === "undefined") return;
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      if (Notification.permission === "granted") enablePush().catch(() => {});
      else if (Notification.permission === "default") setShow(true);
    })();
  }, []);
  if (!show && !msg) return null;
  return (<div className="banner">
    {show && <button className="alt" onClick={() => enablePush().then(() => { setShow(false); setMsg(""); }).catch((e) => setMsg(e.message))}>🔔 Order alerts chalu karo</button>}
    {msg && <div>{msg}</div>}
  </div>);
}
