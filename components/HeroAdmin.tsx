"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const LABELS = ["Slide 1: Fresh & Healthy", "Slide 2: Delivery in 15 min", "Slide 3: Dairy & Bakery", "Slide 4: Free Delivery"];

// Admin dashboard mein <HeroAdmin /> render karo. Sirf image upload hoti hai, text code mein fixed hai.
export default function HeroAdmin() {
  const [urls, setUrls] = useState<string[]>(["", "", "", ""]);
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.from("hero_slides").select("id,image_url").order("id").then(({ data }) => {
      if (!data) return;
      const u = ["", "", "", ""];
      (data as any[]).forEach((r) => { u[r.id - 1] = r.image_url; });
      setUrls(u);
    });
  }, []);

  const checkImage = (file: File) => new Promise<{ ok: boolean; warn: string }>((resolve) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(src);
      if (img.naturalWidth < 1600) return resolve({ ok: false, warn: "Image kam se kam 1600px wide honi chahiye." });
      const r = img.naturalWidth / img.naturalHeight;
      resolve({ ok: true, warn: Math.abs(r - 2) > 0.25 ? " (Note: ratio 2:1 nahi hai, crop ho sakta hai.)" : "" });
    };
    img.onerror = () => { URL.revokeObjectURL(src); resolve({ ok: false, warn: "File image nahi hai." }); };
    img.src = src;
  });

  async function upload(slot: number, file: File) {
    setMsg("");
    const check = await checkImage(file);
    if (!check.ok) { setMsg(check.warn); return; }
    setBusy(slot);
    const ext = (file.name.split(".").pop() || "webp").toLowerCase();
    const path = `slide-${slot}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("hero").upload(path, file, { upsert: false, contentType: file.type });
    if (error) { setBusy(null); setMsg(error.message); return; }
    const url = supabase.storage.from("hero").getPublicUrl(path).data.publicUrl;
    const { error: e2 } = await supabase.from("hero_slides").upsert({ id: slot, image_url: url, updated_at: new Date().toISOString() });
    setBusy(null);
    if (e2) { setMsg(e2.message); return; }
    setUrls((u) => { const c = [...u]; c[slot - 1] = url; return c; });
    setMsg(`Slide ${slot} update ho gaya.${check.warn}`);
  }

  return (
    <section style={{ margin: "24px 0", padding: 20, border: "1px solid #E7EEE4", borderRadius: 14, background: "#fff" }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 18 }}>Hero banners</h3>
      <p style={{ margin: "0 0 16px", color: "#6B7A71", fontSize: 13 }}>
        Recommended: 2400×1200 px (2:1), kam se kam 1600 px wide, 300 KB se chhoti WebP ya JPG.
      </p>
      {LABELS.map((label, k) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderTop: "1px solid #E7EEE4" }}>
          <div style={{ width: 160, height: 80, borderRadius: 10, overflow: "hidden", background: "#F4F8F2", flex: "none" }}>
            {urls[k] && <img src={urls[k]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
            <input type="file" accept="image/webp,image/jpeg,image/png" disabled={busy !== null}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(k + 1, f); e.target.value = ""; }} />
            {busy === k + 1 && <div style={{ fontSize: 12, color: "#6B7A71" }}>Upload ho raha hai...</div>}
          </div>
        </div>
      ))}
      {msg && <p style={{ margin: "12px 0 0", color: "#045F2A", fontSize: 13 }}>{msg}</p>}
    </section>
  );
}
