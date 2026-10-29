import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sa = JSON.parse(Deno.env.get("FIREBASE_SERVICE_ACCOUNT")!);
const b64u = (b: ArrayBuffer | string) => {
  const s = typeof b === "string" ? btoa(b) : btoa(String.fromCharCode(...new Uint8Array(b)));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function accessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64u(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${head}.${body}`));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${body}.${b64u(sig)}` }) });
  return (await r.json()).access_token;
}

Deno.serve(async (req) => {
  if (req.headers.get("x-webhook-secret") !== Deno.env.get("WEBHOOK_SECRET")) return new Response("forbidden", { status: 403 });
  const { type, record, old_record } = await req.json();
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let userIds: string[] = []; let msg: { title: string; body: string; url: string } | null = null;

  const newForShop = record.status === "placed" && record.fulfilment_shop_id &&
    (type === "INSERT" || old_record?.fulfilment_shop_id !== record.fulfilment_shop_id);
  if (newForShop) {
    const { data } = await db.from("shops").select("owner_id").eq("id", record.fulfilment_shop_id).single();
    if (data?.owner_id) userIds = [data.owner_id];
    msg = { title: "🔔 Naya order aaya!", body: `₹${record.total} · ${record.address}`, url: "/shop" };
  } else if (type === "UPDATE" && record.status === "packed" && old_record?.status !== "packed" && !record.rider_id) {
    const { data } = await db.from("profiles").select("id").eq("role", "rider").eq("is_online", true);
    userIds = (data || []).map((p) => p.id);
    msg = { title: "📦 Order pickup ke liye ready", body: `₹${record.total} · ${record.address}`, url: "/rider" };
  }
  if (!msg || !userIds.length) return new Response("nothing to send");

  const { data: rows } = await db.from("device_tokens").select("token").in("user_id", userIds);
  const at = await accessToken();
  let sent = 0;
  for (const { token } of rows || []) {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST", headers: { Authorization: `Bearer ${at}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { token, data: { ...msg, tag: record.id } } }) });
    if (r.ok) sent++;
    else if (r.status === 404 || r.status === 400) await db.from("device_tokens").delete().eq("token", token);
  }
  return new Response(`sent ${sent}`);
});
