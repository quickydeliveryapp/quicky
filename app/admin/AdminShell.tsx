"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import "./shell.css";

// Left sidebar + top bar around every admin page. Wrap the admin layout's {children} with <AdminShell>.
// Put the Quicky logo file in /public and pass it as logoSrc (for example "/logo.png"); without it the word "Quicky" is shown.

const sv = { viewBox: "0 0 24 24", width: 24, height: 24, fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const I = {
  home: <svg {...sv}><path d="M4 11 12 4l8 7" /><path d="M6 10v10h12V10" /><path d="M10 20v-5h4v5" /></svg>,
  orders: <svg {...sv}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5h6M9 11h6M9 15h4" /></svg>,
  riders: <svg {...sv}><circle cx="6" cy="17" r="3" /><circle cx="18" cy="17" r="3" /><path d="M6 17h5l3-6h-4M14 11l2 6M13 6h3l1 3" /></svg>,
  shops: <svg {...sv}><path d="M4 9.5 5.5 4h13L20 9.5" /><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" /><path d="M5.5 12.5V20h13v-7.5" /></svg>,
  pct: <svg {...sv}><path d="m19 5-14 14" /><circle cx="7" cy="7" r="2.2" /><circle cx="17" cy="17" r="2.2" /></svg>,
  wallet: <svg {...sv}><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3" /><rect x="4" y="8" width="16" height="12" rx="2.5" /><path d="M16 14h.01" /></svg>,
  cash: <svg {...sv}><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>,
  sliders: <svg {...sv}><path d="M6 4v16M12 4v16M18 4v16" /><path d="M4 9h4M10 15h4M16 8h4" /></svg>,
  grid: <svg {...sv}><rect x="4" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" /></svg>,
  image: <svg {...sv}><rect x="4" y="4" width="16" height="16" rx="2.5" /><circle cx="9" cy="9.5" r="1.6" /><path d="m5 18 5-5 3 3 2-2 4 4" /></svg>,
  bell: <svg {...sv}><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15L6 17Z" /><path d="M10 21h4" /></svg>,
  help: <svg {...sv} width={34} height={34}><path d="M5 14v-2a7 7 0 0 1 14 0v2" /><rect x="3.5" y="13" width="4" height="6" rx="1.5" /><rect x="16.5" y="13" width="4" height="6" rx="1.5" /><path d="M19 19c0 1.5-2 2-5 2" /></svg>,
  menu: <svg {...sv}><path d="M4 7h16M4 12h16M4 17h16" /></svg>,
};

type Item = { href: string; label: string; icon: React.ReactNode; adminOnly?: boolean };
const GROUPS: Item[][] = [
  [{ href: "/admin", label: "Dashboard", icon: I.home }, { href: "/admin/orders", label: "Orders", icon: I.orders },
   { href: "/admin/riders", label: "Riders", icon: I.riders }, { href: "/admin/shops", label: "Shops", icon: I.shops, adminOnly: true }],
  [{ href: "/admin/commission", label: "Commission", icon: I.pct, adminOnly: true }, { href: "/admin/payouts", label: "Shop Payouts", icon: I.wallet, adminOnly: true },
   { href: "/admin/rider-cash", label: "Rider Cash", icon: I.cash }, { href: "/admin/fees", label: "Fees & Limits", icon: I.sliders, adminOnly: true }],
  [{ href: "/admin/categories", label: "Categories", icon: I.grid, adminOnly: true }, { href: "/admin/banners", label: "Banners", icon: I.image, adminOnly: true }],
];

export default function AdminShell({ children, logoSrc, supportHref = "mailto:support@quicky.app" }: { children: React.ReactNode; logoSrc?: string; supportHref?: string }) {
  const path = (usePathname() ?? "").replace(/\/$/, "") || "/admin";
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const m: any = u.user.user_metadata ?? {};
      setName(String(m.full_name ?? m.name ?? "").trim());
      const { data: me } = await supabase.from("profiles").select("role").eq("id", u.user.id).single();
      setRole(me?.role ?? "");
    })();
  }, []);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [open]);

  const initials = name ? name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "A";
  return (<div className={"shell" + (open ? " open" : "")}>
    <aside className="shell-side" aria-label="Admin menu">
      <Link href="/admin" className="shell-logo">{logoSrc ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={logoSrc} alt="Quicky" /> : "Quicky"}</Link>
      <nav className="shell-nav">
        {GROUPS.map((g, i) => {
          const items = g.filter((x) => !x.adminOnly || role !== "area_manager");
          return items.length === 0 ? null : (<div key={i} style={{ display: "contents" }}>
            {i > 0 && <div className="shell-sep" />}
            {items.map((x) => {
              const on = x.href === "/admin" ? path === "/admin" : path === x.href || path.startsWith(x.href + "/");
              return <Link key={x.href} href={x.href} className={"shell-link" + (on ? " on" : "")} aria-current={on ? "page" : undefined}>{x.icon}{x.label}</Link>;
            })}
          </div>);
        })}
      </nav>
      <a className="shell-help" href={supportHref}>{I.help}<div><b>Need Help?</b><span>Contact Support →</span></div></a>
    </aside>
    <div className="shell-scrim" onClick={() => setOpen(false)} />
    <div className="shell-main">
      <header className="shell-top">
        <button className="shell-menu" aria-label="Open menu" onClick={() => setOpen(true)}>{I.menu}</button>
        <span className="shell-grow" />
        <button className="shell-bell" aria-label="Notifications">{I.bell}<i /></button>
        <div className="shell-user"><span className="shell-av">{initials}</span><span className="shell-name">{name || "Admin"}</span></div>
      </header>
      <main className="shell-page">{children}</main>
    </div>
  </div>);
}
