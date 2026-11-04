"use client";
import { Icon } from "@/lib/icons";
import { MoveIcon } from "@/components/HeroIcons";

export type Adj = { z: number; x: number; y: number };
export const DEFAULT_ADJ: Adj = { z: 1, x: 0.5, y: 0.5 };

// Text block: x/y = fraction of slide width/height (0 = default position), s = title size multiplier
export type TAdj = { x: number; y: number; s: number };
export const DEFAULT_T: TAdj = { x: 0, y: 0, s: 1 };
export const DEFAULT_WEIGHT = 800;

// Title fonts. key is stored in the database (t_font); "" = the site font. The families are loaded in globals.css.
export const FONTS: { key: string; label: string; stack: string }[] = [
  { key: "", label: "Site default", stack: "" },
  { key: "poppins", label: "Poppins", stack: "'Poppins', sans-serif" },
  { key: "montserrat", label: "Montserrat", stack: "'Montserrat', sans-serif" },
  { key: "nunito", label: "Nunito", stack: "'Nunito', sans-serif" },
  { key: "baloo", label: "Baloo 2", stack: "'Baloo 2', sans-serif" },
  { key: "playfair", label: "Playfair Display", stack: "'Playfair Display', serif" },
];
export const fontStack = (key: string) => FONTS.find((f) => f.key === key)?.stack ?? "";

export type SlideView = {
  img: string;
  alt: string;
  bg: string;
  title: string;
  cta: string;
  showText: boolean;
  m: Adj; // mobile zoom/position
  d: Adj; // desktop zoom/position
  tm: TAdj; // mobile text position/size
  td: TAdj; // desktop text position/size
  weight: number; // title font weight
  color: string; // title color ("" = default)
  font: string; // title font key ("" = site font)
};

// In the admin, text is edited directly on the image through these callbacks.
export type EditProps = {
  ph: { title: string; cta: string }; // default shown on the live site when the field is empty
  onTitle: (v: string) => void;
  onCta: (v: string) => void;
};

function Auto({ value, ph, max, onChange }: { value: string; ph: string; max: number; onChange: (v: string) => void }) {
  return (
    <span className="hs-auto">
      <span className="hs-ghost" aria-hidden>{value || ph || " "}</span>
      <input className="hs-field" value={value} placeholder={ph} maxLength={max} spellCheck={false}
        onChange={(e) => onChange(e.target.value)} />
    </span>
  );
}

// The live site and the admin preview both use this component, so the preview matches exactly.
// device: admin preview only (forces mobile/desktop). On the live site the CSS media query decides.
export default function HeroSlide({
  s, index, total, eager, device, edit, onShop, imgRef,
}: {
  s: SlideView; index: number; total: number; eager?: boolean;
  device?: "m" | "d"; edit?: EditProps; onShop?: () => void;
  imgRef?: React.Ref<HTMLImageElement>;
}) {
  const vars = {
    "--mz": s.m.z, "--mx": s.m.x, "--my": s.m.y,
    "--dz": s.d.z, "--dx": s.d.x, "--dy": s.d.y,
    "--mtx": s.tm.x, "--mty": s.tm.y, "--mts": s.tm.s,
    "--dtx": s.td.x, "--dty": s.td.y, "--dts": s.td.s,
    "--tfw": s.weight, ...(s.color ? { "--tc": s.color } : {}),
    ...(fontStack(s.font) ? { "--tff": fontStack(s.font) } : {}),
    background: s.bg,
  } as React.CSSProperties;
  const cls = "hs" + (device === "m" ? " pm" : device === "d" ? " pd" : "") + (edit ? " edit" : "");

  return (
    <div className={cls} style={vars} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${total}`}>
      <img ref={imgRef} className="hs-img" src={s.img} alt={s.alt} draggable={false}
        loading={eager ? "eager" : "lazy"} decoding="async" />
      {s.showText && (
        <div className="hs-copy">
          <div className="hs-low">
            <div className="hs-ttl">
              {edit && <span className="hs-move" data-move title="Drag to move the title"><MoveIcon size={12} /> Title</span>}
              <h2>
                {edit
                  ? <textarea className="hs-field" rows={2} maxLength={40} value={s.title} placeholder={edit.ph.title}
                      onChange={(e) => edit.onTitle(e.target.value)} />
                  : s.title}
              </h2>
            </div>
            {edit
              ? <span className="hs-btn">
                  <Auto value={s.cta} ph={edit.ph.cta} max={16} onChange={edit.onCta} />
                  <Icon name="arrowRight" size={14} sw={2} />
                </span>
              : <button className="hs-btn" onClick={onShop}>{s.cta} <Icon name="arrowRight" size={14} sw={2} /></button>}
          </div>
        </div>
      )}
    </div>
  );
}
