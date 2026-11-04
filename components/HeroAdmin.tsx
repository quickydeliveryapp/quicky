"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Draft = { image_url: string; chip: string; title: string; cta: string; show_text: boolean };
const EMPTY: Draft = { image_url: "", chip: "", title: "", cta: "", show_text: true };
const HINTS = ["Fresh & Healthy", "Delivery in 15 min", "Dairy & Bakery", "Free above {amount}"];

// Admin dashboard mein <HeroAdmin /> render karo. Image, chip, headline aur button text sab yahan se.
export default function HeroAdmin() {
  const [slides, setSlides] = useState<Draft[]>([EMPTY, EMPTY, EMPTY, EMPTY]);
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    supabase.from("hero_slides").select("id,image_url,chip,title,cta,show_text").order("id").then(({ data }) => {
      if (!data) return;
      const s = [EMPTY, EMPTY, EMPTY, EMPTY].map((e) => ({ ...e }));
      (data as any[]).forEach((r) => {
        s[r.id - 1] = { image_url: r.image_url ?? "", chip: r.chip ?? "", title: r.title ?? "", cta: r.cta ?? "", show_text: r.show_text !== false };
      });
      setSlides(s);
    });
  }, []);

  const set = (slot: number, field: keyof Draft, value: string) =>
    setSlides((arr) => arr.map((d, i) => (i === slot - 1 ? { ...d, [field]: value } : d)));

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

  async function uploadImage(slot: number, file: File) {
    setMsg("");
    const check = await checkImage(file);
    if (!check.ok) { setMsg(check.warn); return; }
    setBusy(slot);
    const ext = (file.name.split(".").pop() || "webp").toLowerCase();
    const path = `slide-${slot}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("hero").upload(path, file, { upsert: false, contentType: file.type });
    if (error) { setBusy(null); setMsg(error.message); return; }
    const url = supabase.storage.from("hero").getPublicUrl(path).data.publicUrl;
    const { error: e2 } = await supabase.from("hero_slides").update({ image_url: url, updated_at: new Date().toISOString() }).eq("id", slot);
    setBusy(null);
    if (e2) { setMsg(e2.message); return; }
    set(slot, "image_url", url);
    setMsg(`Slide ${slot} ki image update ho gayi.${check.warn}`);
  }

  async function saveText(slot: number) {
    setMsg("");
    const d = slides[slot - 1];
    setBusy(slot);
    // Khaali field = null, taaki code ka default text dikhe
    const { error } = await supabase.from("hero_slides").update({
      chip: d.chip.trim() || null, title: d.title.trim() || null, cta: d.cta.trim() || null, show_text: d.show_text,
      updated_at: new Date().toISOString(),
    }).eq("id", slot);
    setBusy(null);
    setMsg(error ? error.message : `Slide ${slot} ka text save ho gaya.`);
  }

  const field = (slot: number, key: "chip" | "title" | "cta", label: string, max: number) => (
    <label style={{ display: "block", marginBottom: 8 }}>
      <span style={{ display: "block", fontSize: 12, color: "#6B7A71", marginBottom: 4 }}>{label} ({slides[slot - 1][key].length}/{max})</span>
      <input value={slides[slot - 1][key]} maxLength={max} onChange={(e) => set(slot, key, e.target.value)}
        style={{ width: "100%" }} />
    </label>
  );

  return (
    <section style={{ margin: "24px 0", padding: 20, border: "1px solid #E7EEE4", borderRadius: 14, background: "#fff" }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 18 }}>Hero banners</h3>
      <p style={{ margin: "0 0 16px", color: "#6B7A71", fontSize: 13 }}>
        Image: 2400×1200 px (2:1), kam se kam 1600 px wide. Text khaali chhodne par default text dikhega. Slide 4 chip mein <b>{"{amount}"}</b> likhoge to wo free delivery ki limit se badal jaayega.
      </p>
      {[1, 2, 3, 4].map((slot) => (
        <div key={slot} style={{ padding: "16px 0", borderTop: "1px solid #E7EEE4", display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ width: 200, height: 100, borderRadius: 10, overflow: "hidden", background: "#F4F8F2", flex: "none" }}>
            {slides[slot - 1].image_url && <img src={slides[slot - 1].image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Slide {slot}</div>
            <input type="file" accept="image/webp,image/jpeg,image/png" disabled={busy !== null}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(slot, f); e.target.value = ""; }} />
            <div style={{ marginTop: 10 }}>
              {field(slot, "chip", `Chip (e.g. ${HINTS[slot - 1]})`, 30)}
              {field(slot, "title", "Headline", 40)}
              {field(slot, "cta", "Button text", 16)}
              <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 10px", fontSize: 14 }}>
                <input type="checkbox" checked={slides[slot - 1].show_text}
                  onChange={(e) => setSlides((arr) => arr.map((d, i) => (i === slot - 1 ? { ...d, show_text: e.target.checked } : d)))} />
                Text dikhao (band karne par sirf image dikhegi)
              </label>
              <button onClick={() => saveText(slot)} disabled={busy !== null}>
                {busy === slot ? "Save ho raha hai..." : "Text save karo"}
              </button>
            </div>
          </div>
        </div>
      ))}
      {msg && <p style={{ margin: "12px 0 0", color: "#045F2A", fontSize: 13 }}>{msg}</p>}
    </section>
  );
}
