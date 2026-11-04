"use client";
import { Icon } from "@/lib/icons";

export type Adj = { z: number; x: number; y: number };
export const DEFAULT_ADJ: Adj = { z: 1, x: 0.5, y: 0.5 };

export type SlideView = {
  img: string;
  alt: string;
  bg: string;
  chip: string;
  chipIcon: string;
  title: string;
  cta: string;
  showText: boolean;
  m: Adj; // mobile zoom/position
  d: Adj; // desktop zoom/position
};

// Admin mein text seedha image ke upar edit hota hai: inhi callbacks se.
export type EditProps = {
  ph: { chip: string; title: string; cta: string }; // khaali hone par live mein jo default dikhega
  onChip: (v: string) => void;
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

// Live site aur admin preview dono yahi component use karte hain, isliye preview 100% sahi dikhta hai.
// device: sirf admin preview mein (mobile/desktop force karne ke liye). Live site par CSS media query chalti hai.
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
    background: s.bg,
  } as React.CSSProperties;
  const cls = "hs" + (device === "m" ? " pm" : device === "d" ? " pd" : "") + (edit ? " edit" : "");

  return (
    <div className={cls} style={vars} role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${total}`}>
      <img ref={imgRef} className="hs-img" src={s.img} alt={s.alt} draggable={false}
        loading={eager ? "eager" : "lazy"} decoding="async" />
      {s.showText && (
        <div className="hs-copy">
          <span className="hs-chip">
            <Icon name={s.chipIcon} size={14} />
            {edit
              ? <Auto value={s.chip} ph={edit.ph.chip} max={30} onChange={edit.onChip} />
              : <span className="hs-chip-txt">{s.chip}</span>}
          </span>
          <div className="hs-low">
            <h2>
              {edit
                ? <textarea className="hs-field" rows={2} maxLength={40} value={s.title} placeholder={edit.ph.title}
                    onChange={(e) => edit.onTitle(e.target.value)} />
                : s.title}
            </h2>
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
