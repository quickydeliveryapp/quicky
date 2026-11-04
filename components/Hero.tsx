"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Icon } from "@/lib/icons";

const FALLBACK = ["/hero-1-v5.webp", "/hero-2-v5.webp", "/hero-3-v5.webp", "/hero-4-v5.webp"];

// Text, chip aur colours yahin se badlenge. Image admin dashboard se aati hai.
const META = [
  { alt: "Smiling shopper carrying fresh vegetables at a market", chip: "Fresh & Healthy", chipIcon: "leaf", title: "Fresh picks, every day", bg: "#E4F3D1" },
  { alt: "Smiling delivery rider with a bag of fresh vegetables", chip: "Delivery in 15 min", chipIcon: "truck", title: "Groceries in 15 minutes", bg: "#E9F6DD" },
  { alt: "Smiling child holding a glass of milk at breakfast", chip: "Dairy & Bakery", chipIcon: "bag", title: "Morning essentials, always", bg: "#E5F6D5" },
  { alt: "Happy family unpacking fresh groceries in the kitchen", chip: "Free Delivery", chipIcon: "truck", title: "Stock up, save more", bg: "#E6F8D5" },
];

export default function Hero({ freeAbove, onShop }: { freeAbove?: number; onShop?: () => void }) {
  const [imgs, setImgs] = useState<string[]>(FALLBACK);

  useEffect(() => {
    supabase.from("hero_slides").select("id,image_url").order("id").then(({ data }) => {
      if (!data?.length) return;
      setImgs(FALLBACK.map((f, k) => (data as any[]).find((r) => r.id === k + 1)?.image_url || f));
    });
  }, []);

  const SLIDES = META.map((m, k) => ({
    ...m,
    img: imgs[k],
    chip: k === 3 && freeAbove !== undefined ? `Free above ₹${freeAbove}` : m.chip,
  }));

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
          <div className="hslide" key={k} role="group" aria-roledescription="slide" aria-label={`${k + 1} of ${SLIDES.length}`} style={{ background: s.bg }}>
            <img className="hslide-img" src={s.img} alt={s.alt} loading={k === 0 ? "eager" : "lazy"} decoding="async" />
            <div className="hslide-copy">
              <span className="hchip"><Icon name={s.chipIcon} size={16} /> {s.chip}</span>
              <div className="hline">
                <h2>{s.title}</h2>
                <button onClick={onShop}>Shop Now <Icon name="arrowRight" size={14} sw={2} /></button>
              </div>
            </div>
          </div>
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
