"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/lib/icons";

type Slide = { img: string; alt: string; chip: string; chipIcon: string; title: string; sub: string; cta: string; ink: string; subInk: string };

export default function Hero({ freeAbove, onShop }: { freeAbove?: number; onShop?: () => void }) {
  const SLIDES: Slide[] = [
    { img: "/hero-1-v4.webp", alt: "Smiling shopper carrying fresh vegetables at a market", chip: "Fresh & Healthy", chipIcon: "leaf",
      title: "Fresh Daily.", sub: "Farm-fresh, at your door.", cta: "Shop Now", ink: "#0E3B26", subInk: "#3F5B4A" },
    { img: "/hero-2-v4.webp", alt: "Smiling delivery rider with a bag of fresh vegetables", chip: "Delivery in 15 min", chipIcon: "truck",
      title: "Super Fast.", sub: "Groceries in 15 minutes.", cta: "Order Now", ink: "#0E3B26", subInk: "#3F5B4A" },
    { img: "/hero-3-v4.webp", alt: "Smiling child holding a glass of milk at breakfast", chip: "Dairy & Bakery", chipIcon: "bag",
      title: "Daily Essentials", sub: "Milk, bread & eggs, always fresh.", cta: "Shop Dairy", ink: "#3A2A0E", subInk: "#5C4B2E" },
    { img: "/hero-4-v4.webp", alt: "Happy family unpacking fresh groceries in the kitchen", chip: "Free Delivery", chipIcon: "truck",
      title: "Free Delivery", sub: freeAbove !== undefined ? `On orders above ₹${freeAbove}.` : "On big orders.", cta: "Start Shopping", ink: "#0E3B26", subInk: "#3F5B4A" },
  ];

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
          <div className="hslide" key={k} role="group" aria-roledescription="slide" aria-label={`${k + 1} of ${SLIDES.length}`} style={{ color: s.ink }}>
            <img className="hslide-img" src={s.img} alt={s.alt} loading={k === 0 ? "eager" : "lazy"} decoding="async" />
            <div className="hslide-copy">
              <span className="hchip" style={{ color: "#0C7D1D" }}><Icon name={s.chipIcon} size={16} /> {s.chip}</span>
              <h2 style={{ color: s.ink }}>{s.title}</h2>
              <p style={{ color: s.subInk }}>{s.sub}</p>
              <button onClick={onShop}>{s.cta} <Icon name="arrowRight" size={16} sw={2} /></button>
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
