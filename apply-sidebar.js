// Run from the project root:  node apply-sidebar.js
// Swaps the pill tabs in the admin dashboard for the sidebar. Safe to run twice.
const fs = require("fs");
const AD = "app/admin/page.tsx", CSS = "app/admin/admin.css";
const fail = (m) => { console.error("STOP: " + m); process.exit(1); };
if (!fs.existsSync(AD) || !fs.existsSync(CSS)) fail("run this from the project root (the folder that contains app/).");
if (!fs.existsSync("components/DashShell.tsx")) fail("components/DashShell.tsx is missing. Unzip the fix first.");

let s = fs.readFileSync(AD, "utf8");
if (s.includes("DashShell")) { console.log("Admin page already uses the sidebar."); }
else {
  const must = (needle, label) => { if (!s.includes(needle)) fail(label + " not found in " + AD + ". Send me this file and I will adjust."); };
  const imp = 'import HeroAdmin from "@/components/HeroAdmin";';
  const tabs = '    <div className="dash-tabs">\n      {tabs.map((t) => <button key={t} className={t === tab ? "" : "alt"} onClick={() => setTab(t)}>{TAB_LABEL[t]}</button>)}\n    </div>\n';
  const head = '  return (<div className="adm">\n    <div className="adm-stats">';
  const tail = "  </div>);\n}";
  must(imp, "the HeroAdmin import"); must(tabs, "the pill tabs block"); must(head, "the page start"); must(tail, "the page end");

  s = s.replace(imp, imp + '\nimport DashShell from "@/components/DashShell";');
  s = s.replace(tabs, "");
  s = s.replace(head,
`  const navItems = tabs.map((t) => ({
    key: t, label: TAB_LABEL[t], icon: t,
    badge: t === "orders" ? counts.delayed
      : t === "riders" && role !== "admin" ? riders.filter((r) => !r.rider_approved).length
      : t === "shops" ? shops.filter((x) => x.status === "pending").length : 0,
    tone: (t === "orders" ? "bad" : "warn") as "bad" | "warn",
  }));

  return (<div className="adm">
    <DashShell items={navItems} active={tab} onSelect={(k) => setTab(k as Tab)}>
    <div className="adm-stats">`);
  const i = s.lastIndexOf(tail);
  s = s.slice(0, i) + "    </DashShell>\n" + s.slice(i);
  fs.writeFileSync(AD, s);
  console.log("Admin page now uses the sidebar.");
}

let c = fs.readFileSync(CSS, "utf8");
if (c.includes("Sidebar navigation")) console.log("Sidebar styles already in admin.css.");
else { fs.writeFileSync(CSS, c.replace(/\s*$/, "\n") + fs.readFileSync("sidebar.css", "utf8")); console.log("Added the sidebar styles to admin.css."); }
console.log("Done. Now run: npm run build");
