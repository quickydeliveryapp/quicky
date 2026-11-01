import type { ReactNode } from "react";

// Ek hi style ke modern icons: 24px grid, 1.7 patli line, round ends, halka duotone fill. Koi library ya extra download nahi.
const F = { fill: "currentColor", fillOpacity: 0.14 } as const;

const ICONS: Record<string, ReactNode> = {
  milk: <><path d="M7 9h10v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z" {...F} /><path d="M7 9l2-5h6l2 5" /><path d="M10 14h4" /></>,
  produce: <><path d="M12 8c-2.2-1.6-6.5-1-6.5 4 0 4 2.6 8 6.5 8s6.5-4 6.5-8c0-5-4.3-5.6-6.5-4z" {...F} /><path d="M12 8V5" /><path d="M12 6c.8-2 2.6-2.8 4.5-2.5-.3 2-1.9 3-4.5 2.5z" /></>,
  drink: <><path d="M6.5 9h11l-1.4 11a1 1 0 0 1-1 .9H8.9a1 1 0 0 1-1-.9z" {...F} /><path d="M5.5 9h13" /><path d="M13.5 9l1.3-5.5H18" /><path d="M7.4 14h9.2" /></>,
  snack: <><path d="M6 4h12l-1 16H7z" {...F} /><path d="M6 7.5q1.5-1.5 3 0t3 0 3 0 3 0" /><circle cx="12" cy="14" r="2.6" /></>,
  bowl: <><path d="M4 12h16c0 4.4-3.6 8-8 8s-8-3.6-8-8z" {...F} /><path d="M9 8.5c0-1.6 1.5-1.6 1.5-3.2" /><path d="M14 8.5c0-1.6 1.5-1.6 1.5-3.2" /></>,
  sweet: <><rect x="4" y="6" width="16" height="12" rx="2.5" {...F} /><path d="M4 12h16" /><path d="M9.5 6v12" /><path d="M14.5 6v12" /></>,
  cookie: <><circle cx="12" cy="12" r="8.5" {...F} /><path d="M9 10h.01M14.5 9h.01M15 14.5h.01M9.5 15h.01M12 12.2h.01" strokeWidth="2.6" /></>,
  mug: <><path d="M5 9h11v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" {...F} /><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16" /><path d="M8.5 3.5c0 1.5 1.5 1.5 1.5 3" /><path d="M12.5 3.5c0 1.5 1.5 1.5 1.5 3" /></>,
  grain: <><path d="M12 21V9" /><path d="M12 8.5c-1.5-1.2-1.5-3.3 0-5.5 1.5 2.2 1.5 4.3 0 5.5z" {...F} /><path d="M12 13c-3 0-4.3-1.8-4.5-4 3 0 4.5 1.4 4.5 4z" {...F} /><path d="M12 13c3 0 4.3-1.8 4.5-4-3 0-4.5 1.4-4.5 4z" {...F} /><path d="M12 18c-3 0-4.3-1.8-4.5-4 3 0 4.5 1.4 4.5 4z" {...F} /><path d="M12 18c3 0 4.3-1.8 4.5-4-3 0-4.5 1.4-4.5 4z" {...F} /></>,
  oil: <><path d="M8 10h8v9a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z" {...F} /><path d="M10 10V6.5h4V10" /><path d="M10.5 3.5h3v3h-3z" /><path d="M12 13.5c-1.1 1.4-1.7 2.2-1.7 3a1.7 1.7 0 0 0 3.4 0c0-.8-.6-1.6-1.7-3z" /></>,
  jar: <><path d="M7 8.5h10V19a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z" {...F} /><rect x="6" y="4.5" width="12" height="4" rx="1" /><path d="M10 13.5h4" /></>,
  sprout: <><path d="M12 21v-9" /><path d="M12 12.5C12 8.4 9 6 5 6c0 4 3 6.5 7 6.5z" {...F} /><path d="M12 15c0-3 2.4-5 6-5 0 3.2-2.5 5-6 5z" {...F} /></>,
  baby: <><path d="M8 9h8v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z" {...F} /><path d="M9 6.5h6V9H9z" /><path d="M11 3.5h2v3h-2z" /><path d="M8 13h3M8 16.5h3" /></>,
  spray: <><path d="M6 12.5h8V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" {...F} /><path d="M8 12.5v-3h4v3" /><path d="M8 9.5V5.5h5l2.5 1.8V9.5" /><path d="M19 6.5h.01M19 9.5h.01M17.5 12h.01" strokeWidth="2.4" /></>,
  home: <><path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" {...F} /><path d="M10 21v-6h4v6" /></>,
  pump: <><path d="M8 10.5h8V20a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z" {...F} /><path d="M10 10.5v-2h4v2" /><path d="M12 8.5v-4h3.5" /></>,
  paw: <><path d="M12 20c-3 0-5-1.9-5-4 0-2.4 2.4-4.4 5-4.4s5 2 5 4.4c0 2.1-2 4-5 4z" {...F} /><circle cx="6" cy="10.5" r="1.6" {...F} /><circle cx="10" cy="6.8" r="1.6" {...F} /><circle cx="14" cy="6.8" r="1.6" {...F} /><circle cx="18" cy="10.5" r="1.6" {...F} /></>,
  pill: <><path d="M10.5 20.5a3.5 3.5 0 0 1-5-5l9-9a3.5 3.5 0 0 1 5 5z" {...F} /><path d="M9 9l6 6" /></>,
  leaf: <><path d="M5 19C5 10 10 5 19 5c0 9-5 14-14 14z" {...F} /><path d="M5 19L14 10" /></>,
  bag: <><path d="M5 8h14l-1 12.2a1 1 0 0 1-1 .8H7a1 1 0 0 1-1-.8z" {...F} /><path d="M9 8V6.5a3 3 0 0 1 6 0V8" /></>,
  hero: <><path d="M3.5 11h17l-1.8 8.2a1.5 1.5 0 0 1-1.5 1.2H6.8a1.5 1.5 0 0 1-1.5-1.2z" {...F} /><path d="M7 11l1-3h8l1 3" /><circle cx="9" cy="6.2" r="2.2" {...F} /><path d="M13 8c0-3 1.5-4.5 3.5-4.5.3 2.2-1 4.2-3.5 4.5z" {...F} /><path d="M8.5 15v2M12 15v2M15.5 15v2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  x: <path d="M18 6L6 18M6 6l12 12" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  bolt: <path d="M13 2L4 14h6l-1 8 9-12h-6z" {...F} />,
  pin: <><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" {...F} /><circle cx="12" cy="10" r="2.5" /></>,
  bell: <><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" {...F} /><path d="M10 21h4" /></>,
  shield: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" {...F} /><path d="M8.5 12l2.5 2.5 4.5-5" /></>,
  smile: <><circle cx="12" cy="12" r="9" {...F} /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><path d="M9 9.5h.01M15 9.5h.01" /></>,
};

export function Icon({ name, size = 24, sw = 1.7 }: { name: string; size?: number; sw?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {ICONS[name] ?? ICONS.bag}
    </svg>
  );
}
