"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import HeroSlide, { type SlideView, DEFAULT_ADJ } from "@/components/HeroSlide";

export const FALLBACK = ["/hero-1-v5.webp", "/hero-2-v5.webp", "/hero-3-v5.webp", "/hero-4-v5.webp"];

// Defaults: admin dashboard mein text khaali chhodne par yahi dikhega. {amount} = free delivery threshold
export const META = [
  { alt: "Smiling shopper carrying fresh vegetables at a market", chip: "", chipIcon: "leaf", title: "Fresh picks, every day", cta: "Shop Now", bg: "#E4F3D1" },
  { alt: "Smiling delivery rider with a bag of fresh vegetables", chip: "", chipIcon: "truck", title: "Groceries in 15 minutes", cta: "Shop Now", bg: "#E9F6DD" },
  { alt: "Smiling child holding a glass of milk at breakfast", chip: "", chipIcon: "bag", title: "Morning essentials, always", cta: "Shop Now", bg: "#E5F6D5" },
  { alt: "Happy family unpacking fresh groceries in the kitchen", chip: "", chipIcon: "truck", title: "Stock up, save more", cta: "Shop Now", bg: "#E6F8D5" },
];

type Row = {
  id: number; image_url: string | null; chip: string | null; title: string | null; cta: string | null; show_text: boolean | null;
  m_zoom: number | null; m_fx: number | null; m_fy: number | null; d_zoom: number | null; d_fx: number | null; d_fy: number | null;
};
export const HERO_COLS = "id,image_url,chip,title,cta,show_text,m_zoom,m_fx,m_fy,d_zoom,d_fx,d_fy";

export default function Hero({ freeAbove, onShop }: { freeAbove?: number; onShop?: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    supabase.from("hero_slides").select(HERO_COLS).order("id").then(({ data }) => {
      if (data?.length) setRows(data as Row[]);
    });
  }, []);

  const amt = freeAbove !== undefined ? `₹${freeAbove}` : null;
  const SLIDES: SlideView[] = META.map((m, k) => {
    const r = rows.find((x) => x.id === k + 1);
    // Default chip nahi hai: sirf admin ne likha ho to dikhega. {amount} = free delivery limit
    let chip = r?.chip || "";
    if (chip.includes("{amount}")) chip = amt ? chip.replace("{amount}", amt) : chip.replace("{amount}", "").trim();
    return {
      img: r?.image_url || FALLBACK[k],
      alt: m.alt, bg: m.bg, chipIcon: m.chipIcon,
      chip,
      title: r?.title || m.title,
      cta: r?.cta || m.cta,
      showText: r?.show_text !== false,
      m: { z: r?.m_zoom ?? DEFAULT_ADJ.z, x: r?.m_fx ?? DEFAULT_ADJ.x, y: r?.m_fy ?? DEFAULT_ADJ.y },
      d: { z: r?.d_zoom ?? DEFAULT_ADJ.z, x: r?.d_fx ?? DEFAULT_ADJ.x, y: r?.d_fy ?? DEFAULT_ADJ.y },
    };
  });

  const trackRef = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const paused = useRef(false);

  const go = (n: number) => {
    const el = trackRef.current;
    if (!el) return;
    const k = (n + SLIDES.length) % SLIDES.length;
    el.scrollTo({ left: k * el.clientWidth, behavior: "smooth" });
    setI(k);
  };

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => { if (!paused.current) go((i + 1) % SLIDES.length); }, 5000);
    return () => clearInterval(t);
  }, [i]);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const k = Math.round(el.scrollLeft / el.clientWidth);
    if (k !== i && k >= 0 && k < SLIDES.length) setI(k);
  };

  const pause = () => { paused.current = true; };
  const resume = () => { paused.current = false; };

  return (
    <section className="hcar" aria-roledescription="carousel" aria-label="Offers">
      <div className="htrack" ref={trackRef} onScroll={onScroll}
        onMouseEnter={pause} onMouseLeave={resume} onTouchStart={pause} onTouchEnd={resume}>
        {SLIDES.map((s, k) => (
          <HeroSlide key={k} s={s} index={k} total={SLIDES.length} eager={k === 0} onShop={onShop} />
        ))}
      </div>
      <div className="hdots">
        {SLIDES.map((_, k) => (
          <button key={k} className={"hdot" + (k === i ? " on" : "")} aria-label={`Show slide ${k + 1}`} onClick={() => go(k)} />
        ))}
      </div>
    </section>
  );
}
