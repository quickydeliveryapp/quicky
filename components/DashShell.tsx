"use client";
import { useEffect, useState } from "react";

export type NavItem = { key: string; label: string; icon?: string; badge?: number; tone?: "bad" | "warn" };

// Simple outline icons (24x24, drawn with the text colour)
const ICONS: Record<string, React.ReactNode> = {
  orders: <><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12h6M9 16h4" /></>,
  riders: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  shops: <><path d="M3 9l1-5h16l1 5" /><path d="M4 9v11h16V9" /><path d="M9 20v-6h6v6" /><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /></>,
  commission: <><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>,
  settlement: <><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></>,
  cash: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></>,
  fees: <><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></>,
  hero: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></>,
  onboard: <><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></>,
};
ICONS.deposits = ICONS.cash;

function Icon({ name }: { name?: string }) {
  return (<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ICONS[name ?? ""] ?? <circle cx="12" cy="12" r="4" />}
  </svg>);
}

// Sidebar on wide screens, a slide-in menu on phones. Replaces the row of pill tabs.
export default function DashShell({ items, active, onSelect, children }: {
  items: NavItem[]; active: string; onSelect: (key: string) => void; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const current = items.find((i) => i.key === active);

  return (<div className="adm-shell">
    <button type="button" className="adm-menu-btn" aria-expanded={open} aria-controls="adm-side" onClick={() => setOpen(true)}>
      <Icon name={current?.icon} /><span>{current?.label ?? "Menu"}</span><em>Menu</em>
    </button>
    {open && <div className="adm-scrim" onClick={() => setOpen(false)} />}
    <nav id="adm-side" className={"adm-side" + (open ? " open" : "")} aria-label="Dashboard sections">
      <button type="button" className="adm-close" onClick={() => setOpen(false)}>Close menu</button>
      {items.map((i) => (
        <button type="button" key={i.key} className={"adm-nav" + (i.key === active ? " on" : "")} aria-current={i.key === active ? "page" : undefined}
          onClick={() => { onSelect(i.key); setOpen(false); }}>
          <Icon name={i.icon ?? i.key} /><span>{i.label}</span>
          {!!i.badge && <i className={"adm-nav-badge" + (i.tone === "bad" ? " bad" : "")}>{i.badge}</i>}
        </button>))}
    </nav>
    <div className="adm-main">{children}</div>
  </div>);
}
