"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import HeroSlide, { type Adj, type SlideView, DEFAULT_ADJ } from "@/components/HeroSlide";
import { META, FALLBACK, HERO_COLS } from "@/components/Hero";

type Draft = { image_url: string; chip: string; title: string; cta: string; show_text: boolean; m: Adj; d: Adj };
type Device = "m" | "d";

const blank = (): Draft => ({ image_url: "", chip: "", title: "", cta: "", show_text: true, m: { ...DEFAULT_ADJ }, d: { ...DEFAULT_ADJ } });
// Preview frame ka asli size (live site jitna): phone 390x200, desktop ~940x320 (sidebar ke baad content width)
const FRAME: Record<Device, { w: number; h: number; label: string }> = {
  m: { w: 390, h: 200, label: "Mobile" },
  d: { w: 940, h: 320, label: "Desktop" },
};
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const snap = (d: Draft) => JSON.stringify(d);
const ZOOM_MIN = 1, ZOOM_MAX = 3;

// Admin dashboard mein <HeroAdmin freeAbove={...} /> render karo.
// Text seedha image ke upar type karo, image ko drag + zoom se adjust karo, Mobile/Desktop preview toggle se dekho.
export default function HeroAdmin({ freeAbove }: { freeAbove?: number }) {
  const [slides, setSlides] = useState<Draft[]>([blank(), blank(), blank(), blank()]);
  const [saved, setSaved] = useState<string[]>(["", "", "", ""]);
  const [active, setActive] = useState(1);
  const [device, setDevice] = useState<Device>("m");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [dragging, setDragging] = useState(false);
  const [avail, setAvail] = useState(0);

  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ px: number; py: number; a: Adj } | null>(null);

  useEffect(() => {
    supabase.from("hero_slides").select(HERO_COLS).order("id").then(({ data, error }) => {
      if (error) { setMsg(error.message + " (supabase/hero.sql dobara run karo?)"); return; }
      const s = [1, 2, 3, 4].map(blank);
      (data as any[] | null)?.forEach((r) => {
        if (r.id < 1 || r.id > 4) return;
        s[r.id - 1] = {
          image_url: r.image_url ?? "", chip: r.chip ?? "", title: r.title ?? "", cta: r.cta ?? "", show_text: r.show_text !== false,
          m: { z: r.m_zoom ?? 1, x: r.m_fx ?? 0.5, y: r.m_fy ?? 0.5 },
          d: { z: r.d_zoom ?? 1, x: r.d_fx ?? 0.5, y: r.d_fy ?? 0.5 },
        };
      });
      setSlides(s); setSaved(s.map(snap));
    });
  }, []);

  // Preview ko available width mein fit karne ke liye scale
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setAvail(el.clientWidth));
    ro.observe(el); setAvail(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const cur = slides[active - 1];
  const meta = META[active - 1];
  const fr = FRAME[device];
  const sc = avail ? Math.min(1, avail / fr.w) : 1;
  const adj = cur[device];
  const dirty = (i: number) => snap(slides[i]) !== saved[i];

  const patch = (fn: (d: Draft) => Draft) => setSlides((arr) => arr.map((d, i) => (i === active - 1 ? fn(d) : d)));
  const setAdj = (p: Partial<Adj>) => patch((d) => ({ ...d, [device]: { ...d[device], ...p } }));
  const setZoom = (z: number) => setAdj({ z: r3(clamp(z, ZOOM_MIN, ZOOM_MAX)) });

  // ---- Image ko drag karke position set karna (image ungli/mouse ke saath chalti hai) ----
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("input,textarea,button")) return; // text edit par drag nahi
    drag.current = { px: e.clientX, py: e.clientY, a: { ...adj } };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = drag.current, img = imgRef.current;
    if (!st || !img || !img.naturalWidth) return;
    const cs = Math.max(fr.w / img.naturalWidth, fr.h / img.naturalHeight); // object-fit: cover ka scale
    const ovX = st.a.z * img.naturalWidth * cs - fr.w;  // zoom ke baad jitni image bahar nikli hai
    const ovY = st.a.z * img.naturalHeight * cs - fr.h;
    const dx = (e.clientX - st.px) / sc, dy = (e.clientY - st.py) / sc;
    setAdj({
      x: ovX > 1 ? r3(clamp(st.a.x - dx / ovX, 0, 1)) : st.a.x,
      y: ovY > 1 ? r3(clamp(st.a.y - dy / ovY, 0, 1)) : st.a.y,
    });
  };
  const onUp = () => { drag.current = null; setDragging(false); };

  // ---- Image upload (min 1600px wide) ----
  const checkImage = (file: File) => new Promise<{ ok: boolean; warn: string }>((resolve) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(src);
      if (img.naturalWidth < 1600) return resolve({ ok: false, warn: "Image kam se kam 1600px wide honi chahiye." });
      const r = img.naturalWidth / img.naturalHeight;
      resolve({ ok: true, warn: Math.abs(r - 2) > 0.25 ? " (Note: ratio 2:1 nahi hai, zoom/drag se adjust kar lo.)" : "" });
    };
    img.onerror = () => { URL.revokeObjectURL(src); resolve({ ok: false, warn: "File image nahi hai." }); };
    img.src = src;
  });

  async function uploadImage(file: File) {
    const slot = active;
    setMsg("");
    const check = await checkImage(file);
    if (!check.ok) { setMsg(check.warn); return; }
    setBusy(true);
    const ext = (file.name.split(".").pop() || "webp").toLowerCase();
    const path = `slide-${slot}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("hero").upload(path, file, { upsert: false, contentType: file.type });
    if (error) { setBusy(false); setMsg(error.message); return; }
    const url = supabase.storage.from("hero").getPublicUrl(path).data.publicUrl;
    // Nayi image = nayi framing, isliye zoom/position reset
    const { error: e2 } = await supabase.from("hero_slides").update({
      image_url: url, m_zoom: 1, m_fx: 0.5, m_fy: 0.5, d_zoom: 1, d_fx: 0.5, d_fy: 0.5, updated_at: new Date().toISOString(),
    }).eq("id", slot);
    setBusy(false);
    if (e2) { setMsg(e2.message); return; }
    const upd: Draft = { ...slides[slot - 1], image_url: url, m: { ...DEFAULT_ADJ }, d: { ...DEFAULT_ADJ } };
    setSlides((arr) => arr.map((d, i) => (i === slot - 1 ? upd : d)));
    // Image/framing DB mein save ho chuki. Text ka pending change ho to dirty (•) bana rahega.
    setSaved((sv) => sv.map((v, i) => {
      if (i !== slot - 1 || !v) return v;
      const old: Draft = JSON.parse(v);
      return snap({ ...old, image_url: url, m: { ...DEFAULT_ADJ }, d: { ...DEFAULT_ADJ } });
    }));
    setMsg(`Slide ${slot} ki image update ho gayi.${check.warn}`);
  }

  // ---- Save: text + show/hide + dono devices ki zoom/position ----
  async function save() {
    const slot = active, d = cur;
    setMsg(""); setBusy(true);
    const { error } = await supabase.from("hero_slides").update({
      chip: d.chip.trim() || null, title: d.title.trim() || null, cta: d.cta.trim() || null, show_text: d.show_text,
      m_zoom: d.m.z, m_fx: d.m.x, m_fy: d.m.y, d_zoom: d.d.z, d_fx: d.d.x, d_fy: d.d.y,
      updated_at: new Date().toISOString(),
    }).eq("id", slot);
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setSaved((sv) => sv.map((v, i) => (i === slot - 1 ? snap(slides[i]) : v)));
    setMsg(`Slide ${slot} save ho gaya. Live site par dikh jayega.`);
  }

  const chipDefault = "Chip (optional)";
  const view: SlideView = {
    img: cur.image_url || FALLBACK[active - 1], alt: meta.alt, bg: meta.bg, chipIcon: meta.chipIcon,
    chip: cur.chip, title: cur.title, cta: cur.cta, showText: cur.show_text, m: cur.m, d: cur.d,
  };

  const pill = (on: boolean): React.CSSProperties => ({ padding: "7px 16px", borderRadius: 999, fontSize: 13 });

  return (
    <section style={{ margin: "24px 0", padding: 20, border: "1px solid #E7EEE4", borderRadius: 14, background: "#fff" }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 18 }}>Hero banners</h3>
      <p style={{ margin: "0 0 14px", color: "#6B7A71", fontSize: 13 }}>
        Text seedha image ke upar click karke likho (title/button khaali chhodoge to default dikhega, chip khaali = chip nahi dikhega). Image ko <b>drag</b> karke position aur neeche ke <b>zoom</b> se size set karo.
        Mobile aur Desktop ki setting alag save hoti hai.
      </p>

      <div className="dash-tabs" style={{ marginBottom: 12 }}>
        {[1, 2, 3, 4].map((n) => (
          <button key={n} className={n === active ? "" : "alt"} onClick={() => setActive(n)}>
            Slide {n}{dirty(n - 1) ? " •" : ""}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "#6B7A71" }}>Preview:</span>
        {(["m", "d"] as Device[]).map((dv) => (
          <button key={dv} className={dv === device ? "" : "alt"} style={pill(dv === device)} onClick={() => setDevice(dv)}>
            {dv === "m" ? "📱 " : "🖥 "}{FRAME[dv].label}
          </button>
        ))}
      </div>

      <div ref={wrapRef} style={{ width: "100%" }}>
        <div style={{ width: fr.w * sc, height: fr.h * sc, margin: "0 auto", border: "1px solid #E7EEE4", borderRadius: 24, overflow: "hidden" }}>
          <div className={dragging ? "drag" : ""} style={{ width: fr.w, height: fr.h, transform: `scale(${sc})`, transformOrigin: "top left" }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            <HeroSlide
              s={view} index={active - 1} total={4} eager device={device} imgRef={imgRef}
              edit={{
                ph: { chip: chipDefault, title: meta.title, cta: meta.cta },
                onChip: (v) => patch((d) => ({ ...d, chip: v })),
                onTitle: (v) => patch((d) => ({ ...d, title: v })),
                onCta: (v) => patch((d) => ({ ...d, cta: v })),
              }}
            />
          </div>
        </div>
      </div>
      <p style={{ margin: "6px 0 0", textAlign: "center", color: "#6B7A71", fontSize: 12 }}>
        {FRAME[device].label} preview{sc < 1 ? ` (${Math.round(sc * 100)}% size mein dikh raha hai)` : ""} · image ko pakad ke khiskao
      </p>

      <div style={{ marginTop: 14, padding: 14, background: "#F4F8F2", borderRadius: 12 }}>
        <div style={{ fontSize: 12, color: "#6B7A71", marginBottom: 6 }}>
          Zoom ({FRAME[device].label} ke liye): <b style={{ color: "#16231C" }}>{adj.z.toFixed(2)}×</b>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="alt" aria-label="Zoom out" disabled={busy || adj.z <= ZOOM_MIN} onClick={() => setZoom(adj.z - 0.1)} style={{ padding: "6px 14px" }}>−</button>
          <input type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={0.01} value={adj.z} onChange={(e) => setZoom(Number(e.target.value))} style={{ flex: 1 }} aria-label="Zoom" />
          <button className="alt" aria-label="Zoom in" disabled={busy || adj.z >= ZOOM_MAX} onClick={() => setZoom(adj.z + 0.1)} style={{ padding: "6px 14px" }}>+</button>
          <button className="alt" disabled={busy} onClick={() => setAdj({ ...DEFAULT_ADJ })} style={{ padding: "6px 14px" }}>Reset</button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, marginTop: 14 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <input type="file" accept="image/webp,image/jpeg,image/png" disabled={busy}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={cur.show_text} onChange={(e) => patch((d) => ({ ...d, show_text: e.target.checked }))} />
            Text dikhao (band karne par sirf image)
          </label>
          <button onClick={save} disabled={busy || !dirty(active - 1)} style={{ marginLeft: "auto" }}>
            {busy ? "Ruko..." : dirty(active - 1) ? "Save karo" : "Saved ✓"}
          </button>
        </div>
        <p style={{ margin: "10px 0 0", color: "#6B7A71", fontSize: 12 }}>
          Image: 2400×1200 px (2:1), kam se kam 1600 px wide. Slide 4 ke chip mein <b>{"{amount}"}</b> likhoge to free delivery limit se badal jayega.
          Nayi image upload karne par zoom/position reset ho jati hai.
        </p>
      </div>
      {msg && <p style={{ margin: "12px 0 0", color: "#045F2A", fontSize: 13 }}>{msg}</p>}
    </section>
  );
}
