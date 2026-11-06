"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import HeroSlide, { type Adj, type TAdj, type SlideView, DEFAULT_ADJ, DEFAULT_T, DEFAULT_WEIGHT, FONTS } from "@/components/HeroSlide";
import { PhoneIcon, MonitorIcon, MinusIcon, PlusIcon, ResetIcon, CheckIcon, UploadIcon } from "@/components/HeroIcons";
import { META, FALLBACK, HERO_COLS } from "@/components/Hero";

type Draft = { image_url: string; title: string; cta: string; show_text: boolean; m: Adj; d: Adj; tm: TAdj; td: TAdj; weight: number; color: string; font: string };
type Device = "m" | "d";

const blank = (): Draft => ({ image_url: "", title: "", cta: "", show_text: true, m: { ...DEFAULT_ADJ }, d: { ...DEFAULT_ADJ }, tm: { ...DEFAULT_T }, td: { ...DEFAULT_T }, weight: DEFAULT_WEIGHT, color: "", font: "" });
// Preview frame size, same as the live site: phone 390x200, desktop ~940x320 (content width after the sidebar)
const FRAME: Record<Device, { w: number; h: number; label: string }> = {
  m: { w: 390, h: 200, label: "Mobile" },
  d: { w: 1200, h: 320, label: "Desktop" },
};
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const snap = (d: Draft) => JSON.stringify(d);
const ZOOM_MIN = 1, ZOOM_MAX = 3;
const SIZE_MIN = 0.6, SIZE_MAX = 1.8;
const WEIGHTS: [number, string][] = [[500, "Medium"], [600, "Semibold"], [700, "Bold"], [800, "Extra bold"], [900, "Black"]];
const COLORS = ["#0E3B26", "#16231C", "#0C7D1D", "#FFFFFF", "#E8590C", "#C2255C"];

// Render <HeroAdmin freeAbove={...} /> inside the admin dashboard.
// Type text directly on the image, adjust the image with drag + zoom, and switch the Mobile/Desktop preview.
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
  const drag = useRef<{ kind: "img" | "txt"; px: number; py: number; a: Adj; t: TAdj } | null>(null);

  useEffect(() => {
    supabase.from("hero_slides").select(HERO_COLS).order("id").then(({ data, error }) => {
      if (error) { setMsg(error.message + " (try running supabase/hero.sql again)"); return; }
      const s = [1, 2, 3, 4].map(blank);
      (data as any[] | null)?.forEach((r) => {
        if (r.id < 1 || r.id > 4) return;
        s[r.id - 1] = {
          image_url: r.image_url ?? "", title: r.title ?? "", cta: r.cta ?? "", show_text: r.show_text !== false,
          m: { z: r.m_zoom ?? 1, x: r.m_fx ?? 0.5, y: r.m_fy ?? 0.5 },
          d: { z: r.d_zoom ?? 1, x: r.d_fx ?? 0.5, y: r.d_fy ?? 0.5 },
          tm: { x: r.m_tx ?? 0, y: r.m_ty ?? 0, s: r.m_ts ?? 1 },
          td: { x: r.d_tx ?? 0, y: r.d_ty ?? 0, s: r.d_ts ?? 1 },
          weight: r.t_weight ?? DEFAULT_WEIGHT, color: r.t_color ?? "", font: r.t_font ?? "",
        };
      });
      setSlides(s); setSaved(s.map(snap));
    });
  }, []);

  // Scale the preview to fit the available width
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
  const tk = device === "m" ? "tm" : "td";
  const tadj: TAdj = cur[tk];
  const dirty = (i: number) => snap(slides[i]) !== saved[i];

  const patch = (fn: (d: Draft) => Draft) => setSlides((arr) => arr.map((d, i) => (i === active - 1 ? fn(d) : d)));
  const setAdj = (p: Partial<Adj>) => patch((d) => ({ ...d, [device]: { ...d[device], ...p } }));
  const setT = (p: Partial<TAdj>) => patch((d) => ({ ...d, [tk]: { ...d[tk], ...p } }));
  const setZoom = (z: number) => setAdj({ z: r3(clamp(z, ZOOM_MIN, ZOOM_MAX)) });

  // ---- Drag the image to set its position ----
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const t = e.target as HTMLElement;
    const isMove = !!t.closest("[data-move]");
    if (!isMove && t.closest("input,textarea,button")) return; // no dragging while editing text
    drag.current = { kind: isMove ? "txt" : "img", px: e.clientX, py: e.clientY, a: { ...adj }, t: { ...tadj } };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = drag.current, img = imgRef.current;
    if (!st) return;
    const dx = (e.clientX - st.px) / sc, dy = (e.clientY - st.py) / sc;
    if (st.kind === "txt") { // title only: in fractions of the frame width/height (the button stays fixed)
      setT({ x: r3(clamp(st.t.x + dx / fr.w, -0.1, 0.8)), y: r3(clamp(st.t.y + dy / fr.h, -0.38, 0.4)) });
      return;
    }
    if (!img || !img.naturalWidth) return;
    const cs = Math.max(fr.w / img.naturalWidth, fr.h / img.naturalHeight); // object-fit: cover scale
    const ovX = st.a.z * img.naturalWidth * cs - fr.w;  // how much of the image overflows after zoom
    const ovY = st.a.z * img.naturalHeight * cs - fr.h;
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
      if (img.naturalWidth < 1600) return resolve({ ok: false, warn: "The image must be at least 1600px wide." });
      const r = img.naturalWidth / img.naturalHeight;
      resolve({ ok: true, warn: Math.abs(r - 2) > 0.25 ? " (Note: the ratio is not 2:1. Use zoom/drag to adjust.)" : "" });
    };
    img.onerror = () => { URL.revokeObjectURL(src); resolve({ ok: false, warn: "This file is not an image." }); };
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
    // New image = new framing, so reset zoom/position
    const { error: e2 } = await supabase.from("hero_slides").update({
      image_url: url, m_zoom: 1, m_fx: 0.5, m_fy: 0.5, d_zoom: 1, d_fx: 0.5, d_fy: 0.5, updated_at: new Date().toISOString(),
    }).eq("id", slot);
    setBusy(false);
    if (e2) { setMsg(e2.message); return; }
    const upd: Draft = { ...slides[slot - 1], image_url: url, m: { ...DEFAULT_ADJ }, d: { ...DEFAULT_ADJ } };
    setSlides((arr) => arr.map((d, i) => (i === slot - 1 ? upd : d)));
    // Image/framing is already saved in the DB. Any pending text change keeps the unsaved dot.
    setSaved((sv) => sv.map((v, i) => {
      if (i !== slot - 1 || !v) return v;
      const old: Draft = JSON.parse(v);
      return snap({ ...old, image_url: url, m: { ...DEFAULT_ADJ }, d: { ...DEFAULT_ADJ } });
    }));
    setMsg(`Slide ${slot} image updated.${check.warn}`);
  }

  // ---- Save: text + show/hide + zoom/position for both devices ----
  async function save() {
    const slot = active, d = cur;
    setMsg(""); setBusy(true);
    const { error } = await supabase.from("hero_slides").update({
      title: d.title.trim() || null, cta: d.cta.trim() || null, show_text: d.show_text,
      m_zoom: d.m.z, m_fx: d.m.x, m_fy: d.m.y, d_zoom: d.d.z, d_fx: d.d.x, d_fy: d.d.y,
      m_tx: d.tm.x, m_ty: d.tm.y, m_ts: d.tm.s, d_tx: d.td.x, d_ty: d.td.y, d_ts: d.td.s,
      t_weight: d.weight, t_color: d.color || null, t_font: d.font || null,
      updated_at: new Date().toISOString(),
    }).eq("id", slot);
    setBusy(false);
    if (error) { setMsg(error.message); return; }
    setSaved((sv) => sv.map((v, i) => (i === slot - 1 ? snap(slides[i]) : v)));
    setMsg(`Slide ${slot} saved. It is now live on the site.`);
  }

  const view: SlideView = {
    img: cur.image_url || FALLBACK[active - 1], alt: meta.alt, bg: meta.bg,
    title: cur.title, cta: cur.cta, showText: cur.show_text, m: cur.m, d: cur.d, tm: cur.tm, td: cur.td, weight: cur.weight, color: cur.color, font: cur.font,
  };

  const iconBtn: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px" };
  const pill = (on: boolean): React.CSSProperties => ({ padding: "7px 16px", borderRadius: 999, fontSize: 13 });

  return (
    <section style={{ margin: "24px 0", padding: 20, border: "1px solid #E7EEE4", borderRadius: 14, background: "#fff" }}>
      <h3 style={{ margin: "0 0 4px", fontSize: 18 }}>Hero banners</h3>
      <p style={{ margin: "0 0 14px", color: "#6B7A71", fontSize: 13 }}>
        Click the text on the image to edit it (leave it empty to use the default). <b>Drag</b> the image to set its position and use the <b>zoom</b> below to resize it. Move the title with the <b>Title</b> handle.
        Mobile and Desktop settings are saved separately.
      </p>

      <div className="dash-tabs" style={{ marginBottom: 12 }}>
        {[1, 2, 3, 4].map((n) => (
          <button key={n} className={n === active ? "" : "alt"} onClick={() => setActive(n)}>
            Slide {n}{dirty(n - 1) && <span aria-label="Unsaved changes" style={{ display: "inline-block", width: 6, height: 6, marginLeft: 6, borderRadius: 999, background: "currentColor", verticalAlign: "middle" }} />}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, color: "#6B7A71" }}>Preview:</span>
        {(["m", "d"] as Device[]).map((dv) => (
          <button key={dv} className={dv === device ? "" : "alt"} style={pill(dv === device)} onClick={() => setDevice(dv)}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{dv === "m" ? <PhoneIcon /> : <MonitorIcon />}{FRAME[dv].label}</span>
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
                ph: { title: meta.title, cta: meta.cta },
                onTitle: (v) => patch((d) => ({ ...d, title: v })),
                onCta: (v) => patch((d) => ({ ...d, cta: v })),
              }}
            />
          </div>
        </div>
      </div>
      <p style={{ margin: "6px 0 0", textAlign: "center", color: "#6B7A71", fontSize: 12 }}>
        {FRAME[device].label} preview{sc < 1 ? ` (shown at ${Math.round(sc * 100)}% size)` : ""} · drag the image or the Title handle to reposition
      </p>

      <div style={{ marginTop: 14, padding: 14, background: "#F4F8F2", borderRadius: 12 }}>
        <div style={{ fontSize: 12, color: "#6B7A71", marginBottom: 6 }}>
          Zoom ({FRAME[device].label}): <b style={{ color: "#16231C" }}>{adj.z.toFixed(2)}×</b>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="alt" aria-label="Zoom out" disabled={busy || adj.z <= ZOOM_MIN} onClick={() => setZoom(adj.z - 0.1)} style={iconBtn}><MinusIcon /></button>
          <input type="range" min={ZOOM_MIN} max={ZOOM_MAX} step={0.01} value={adj.z} onChange={(e) => setZoom(Number(e.target.value))} style={{ flex: 1 }} aria-label="Zoom" />
          <button className="alt" aria-label="Zoom in" disabled={busy || adj.z >= ZOOM_MAX} onClick={() => setZoom(adj.z + 0.1)} style={iconBtn}><PlusIcon /></button>
          <button className="alt" disabled={busy} onClick={() => setAdj({ ...DEFAULT_ADJ })} style={iconBtn}><ResetIcon />Reset</button>
        </div>

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #E7EEE4" }}>
          <div style={{ fontSize: 12, color: "#6B7A71", marginBottom: 6 }}>
            Title size ({FRAME[device].label}): <b style={{ color: "#16231C" }}>{tadj.s.toFixed(2)}×</b>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="alt" aria-label="Smaller" disabled={busy || tadj.s <= SIZE_MIN} onClick={() => setT({ s: r3(clamp(tadj.s - 0.05, SIZE_MIN, SIZE_MAX)) })} style={iconBtn}><MinusIcon /></button>
            <input type="range" min={SIZE_MIN} max={SIZE_MAX} step={0.01} value={tadj.s} onChange={(e) => setT({ s: Number(e.target.value) })} style={{ flex: 1 }} aria-label="Title size" />
            <button className="alt" aria-label="Larger" disabled={busy || tadj.s >= SIZE_MAX} onClick={() => setT({ s: r3(clamp(tadj.s + 0.05, SIZE_MIN, SIZE_MAX)) })} style={iconBtn}><PlusIcon /></button>
            <button className="alt" disabled={busy} onClick={() => setT({ ...DEFAULT_T })} style={iconBtn}><ResetIcon />Reset title</button>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, marginTop: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              Font
              <select value={cur.font} onChange={(e) => patch((d) => ({ ...d, font: e.target.value }))}
                style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #E7EEE4", font: "inherit", fontSize: 13 }}>
                {FONTS.map((f) => <option key={f.key} value={f.key} style={f.stack ? { fontFamily: f.stack } : undefined}>{f.label}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              Weight
              <select value={cur.weight} onChange={(e) => patch((d) => ({ ...d, weight: Number(e.target.value) }))}
                style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid #E7EEE4", font: "inherit", fontSize: 13 }}>
                {WEIGHTS.map(([w, n]) => <option key={w} value={w}>{n}</option>)}
              </select>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              Color
              {COLORS.map((c) => (
                <button key={c} aria-label={`Color ${c}`} onClick={() => patch((d) => ({ ...d, color: c }))}
                  style={{ width: 24, height: 24, padding: 0, borderRadius: 999, background: c, boxShadow: (cur.color || COLORS[0]).toLowerCase() === c.toLowerCase() ? "0 0 0 2px #fff, 0 0 0 4px #0C7D1D" : "inset 0 0 0 1px #C9D6C6" }} />
              ))}
              <input type="color" aria-label="Custom color" value={cur.color || COLORS[0]} onChange={(e) => patch((d) => ({ ...d, color: e.target.value }))}
                style={{ width: 32, height: 28, padding: 0, margin: 0, border: 0, background: "none" }} />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, marginTop: 14 }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span className="alt" style={{ ...iconBtn, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1 }}>
              <UploadIcon />Upload image
            </span>
            <input type="file" accept="image/webp,image/jpeg,image/png" disabled={busy} style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input type="checkbox" checked={cur.show_text} onChange={(e) => patch((d) => ({ ...d, show_text: e.target.checked }))} />
            Show text (turn off to show the image only)
          </label>
          <button onClick={save} disabled={busy || !dirty(active - 1)} style={{ marginLeft: "auto" }}>
            {busy ? "Please wait..." : dirty(active - 1) ? "Save" : <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><CheckIcon />Saved</span>}
          </button>
        </div>
        <p style={{ margin: "10px 0 0", color: "#6B7A71", fontSize: 12 }}>
          Image: 2400×1200 px (2:1), at least 1600 px wide.
          Uploading a new image resets zoom and position.
        </p>
      </div>
      {msg && <p style={{ margin: "12px 0 0", color: "#045F2A", fontSize: 13 }}>{msg}</p>}
    </section>
  );
}
