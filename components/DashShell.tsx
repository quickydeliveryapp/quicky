"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavGroup } from "@/lib/dashNav";
import "./dash-sidebar.css";

// Outline icons (24x24, drawn in the text colour). The names match lib/dashNav.ts.
const ICONS: Record<string, React.ReactNode> = {
  orders: <><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12h6M9 16h4" /></>,
  bike: <><circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" /><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM12 17.5V14l-3-3 4-3 2 3h2" /></>,
  store: <><path d="M3 9l1-5h16l1 5" /><path d="M4 9v11h16V9" /><path d="M9 20v-6h6v6" /><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /></>,
  percent: <><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>,
  wallet: <><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></>,
  cash: <><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /><path d="M6 12h.01M18 12h.01" /></>,
  sliders: <><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></>,
  grid: <><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
  userplus: <><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" /></>,
  menu: <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>,
  close: <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>,
};

function Icon({ name }: { name: string }) {
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ICONS[name] ?? <circle cx="12" cy="12" r="4" />}
  </svg>);
}

// A link is "current" on its own address, and on addresses below it (except the top one, like /admin, which only matches itself)
function isCurrent(path: string, href: string) {
  if (path === href) return true;
  return href.split("/").length > 2 && path.startsWith(href + "/");
}

function Menu({ groups, path, onGo }: { groups: NavGroup[]; path: string; onGo?: () => void }) {
  return (<nav aria-label="Dashboard sections" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
    {groups.map((g, gi) => (<div key={gi}>
      {g.title && <p className="dsb-gt">{g.title}</p>}
      <div className="dsb-list">
        {g.items.map((it) => (
          <Link key={it.href} href={it.href} className="dsb-link" aria-current={isCurrent(path, it.href) ? "page" : undefined} onClick={onGo}>
            <Icon name={it.icon} /><span>{it.label}</span>
          </Link>))}
      </div>
    </div>))}
  </nav>);
}

// Sidebar for the admin and area manager dashboards: a fixed column on a laptop, a top bar with a slide-in menu on a phone.
export default function DashShell({ groups, title, children }: { groups: NavGroup[]; title?: string; children: React.ReactNode }) {
  const path = usePathname() || "";
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const current = groups.flatMap((g) => g.items).find((i) => isCurrent(path, i.href));

  return (<div className="dsb">
    <aside className="dsb-side">
      {title && <p className="dsb-title">{title}</p>}
      <Menu groups={groups} path={path} />
    </aside>
    <div className="dsb-content">
      <div className="dsb-bar">
        <button type="button" className="dsb-menu" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}><Icon name="menu" /></button>
        <span className="dsb-cur">{current?.label ?? title ?? "Menu"}</span>
      </div>
      {children}
    </div>
    {open && (<div className="dsb-over" onClick={() => setOpen(false)}>
      <div className="dsb-drawer" role="dialog" aria-modal="true" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
        <div className="dsb-dh"><b>{title ?? "Menu"}</b>
          <button type="button" className="dsb-x" aria-label="Close menu" onClick={() => setOpen(false)}><Icon name="close" /></button></div>
        <Menu groups={groups} path={path} onGo={() => setOpen(false)} />
      </div>
    </div>)}
  </div>);
}
