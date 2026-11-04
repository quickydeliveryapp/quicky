"use client";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/lib/icons";

type Slide = { img: string; alt: string; chip: string; chipIcon: string; title: string[]; sub: string; cta: string; grad: string; ink: string; subInk: string };

export default function Hero({ freeAbove, onShop }: { freeAbove?: number; onShop?: () => void }) {
  const SLIDES: Slide[] = [
    { img: "/hero-1.webp", alt: "Fresh vegetables spilling out of a paper grocery bag", chip: "Fresh & Healthy", chipIcon: "leaf",
      title: ["Fresh Groceries", "at Your Doorstep"], sub: "Quality products. Great prices. Delivered fast.", cta: "Shop Now",
      grad: "linear-gradient(120deg,#F1F9EA 0%,#DDF0D0 100%)", ink: "#0E3B26", subInk: "#3F5B4A" },
    { img: "/hero-2.webp", alt: "Family unpacking fresh groceries together in a bright kitchen", chip: "Delivery in 15 min", chipIcon: "truck",
      title: ["Groceries in", "15 Minutes"], sub: "Packed fresh and delivered to your door, fast.", cta: "Order Now",
      grad: "linear-gradient(120deg,#E6F4FA 0%,#CDEBF7 100%)", ink: "#0E3B26", subInk: "#3F5B4A" },
    { img: "/hero-3.webp", alt: "Bread, milk, butter and eggs on a wooden kitchen counter", chip: "Dairy, Bread & Eggs", chipIcon: "bag",
      title: ["Milk, Bread & Eggs,", "Always in Stock"], sub: "Your everyday essentials, ready when you need them.", cta: "Shop Dairy",
      grad: "linear-gradient(120deg,#FFF8E7 0%,#FCEFD0 100%)", ink: "#3A2A0E", subInk: "#5C4B2E" },
    { img: "/hero-4.webp", alt: "Smiling delivery rider with a bag of fresh groceries on a scooter", chip: "Free Delivery", chipIcon: "truck",
      title: ["Free Delivery on Orders", freeAbove !== undefined ? `Above ₹${freeAbove}` : "Above a Minimum Order"],
      sub: "Stock up on your weekly groceries and save on delivery.", cta: "Start Shopping",
      grad: "linear-gradient(120deg,#EEF8F0 0%,#D6EFDB 100%)", ink: "#0E3B26", subInk: "#3F5B4A" },
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

  // Auto-slide: 5 sec, touch ya hover par ruk jaata hai; reduced-motion users ke liye band
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
          <div className="hslide" key={k} role="group" aria-roledescription="slide" aria-label={`${k + 1} of ${SLIDES.length}`}
            style={{ color: s.ink }}>
            <img className="hslide-img" src={s.img} alt={s.alt} loading={k === 0 ? "eager" : "lazy"} decoding="async" />
            <div className="hslide-copy">
              <span className="hchip" style={{ color: "#0C7D1D" }}><Icon name={s.chipIcon} size={16} /> {s.chip}</span>
              <h2 style={{ color: s.ink }}>{s.title.map((t, n) => <span key={n}>{t}{n < s.title.length - 1 && <br />}</span>)}</h2>
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
