// Run from the project root:  node apply-categories.js
// Makes the customer app and the shop inventory read categories from the database (Admin > Categories).
// If the database list cannot be read, the old list in lib/categories.ts is used, so nothing breaks. Safe to run twice.
const fs = require("fs");
const fail = (m) => { console.error("STOP: " + m); process.exit(1); };
const read = (f) => { if (!fs.existsSync(f)) fail(f + " not found. Run this from the project root."); return fs.readFileSync(f, "utf8"); };

// ---------- lib/categories.ts ----------
const LIB = "lib/categories.ts";
let lib = read(LIB);
let libDone = lib.includes("useCategories");
const catsLoop = "for (const [name, re] of RULES) if (re.test(t)) return name;";
const tail = "export const SHOW_EMPTY_CATEGORIES";
if (!libDone) {
  if (!lib.includes(catsLoop)) fail("the categorize() loop was not found in " + LIB + ". Send me this file.");
  if (!lib.includes(tail)) fail("SHOW_EMPTY_CATEGORIES was not found in " + LIB + ". Send me this file.");
}

// ---------- app/page.tsx ----------
const PG = "app/page.tsx";
let pg = read(PG);
const pgDone = pg.includes("useCategories");
const pgImp = 'import { CATS, OTHER, SHOW_EMPTY_CATEGORIES, categorize, isEnabled } from "@/lib/categories";';
const pgVis = "const visible = useMemo(() => products.filter((p) => isEnabled(categorize(p.category))), [products]);";
if (!pgDone) for (const [n, w] of [[pgImp, "the categories import"], [pgVis, "the 'visible' list"]]) if (!pg.includes(n)) fail(w + " was not found in " + PG + ". Send me this file.");

// ---------- app/shop/inventory/page.tsx ----------
const INV = "app/shop/inventory/page.tsx";
let inv = read(INV);
const invDone = inv.includes("useCategories");
const invImp = 'import { CATS, categorize, OTHER } from "@/lib/categories";';
const invOpt = "const CAT_OPTIONS = CATS.filter((c) => c.enabled).map((c) => c.name);";
const invFn = /export default function (\w+)\(([^)]*)\)\s*\{\n/;
if (!invDone) {
  for (const [n, w] of [[invImp, "the categories import"], [invOpt, "the CAT_OPTIONS list"]]) if (!inv.includes(n)) fail(w + " was not found in " + INV + ". Send me this file.");
  if (!invFn.test(inv)) fail("the page component was not found in " + INV + ". Send me this file.");
}

// everything checked: now write
if (!libDone) {
  lib = 'import { useEffect, useState } from "react";\nimport { supabase } from "@/lib/supabase";\n' + lib;
  lib = lib.replace(catsLoop, "for (const [name, re] of RULES) if (re.test(t) && CATS.some((c) => c.name === name)) return name;");
  lib = lib.replace(/\s*$/, "\n") + `
// ---- Categories from the database (Admin > Categories). The list at the top of this file is the fallback. ----
let catsLoad: Promise<void> | null = null;
function loadCats(): Promise<void> {
  if (!catsLoad) catsLoad = (async () => {
    try {
      const { data, error } = await supabase.from("categories").select("name,icon,img,enabled").order("sort");
      if (!error && data && data.length) {
        CATS.splice(0, CATS.length, ...data.map((r: any) => ({ name: String(r.name), icon: r.icon || "bag", img: r.img || "", enabled: !!r.enabled })));
      }
    } catch {}
  })();
  return catsLoad;
}
if (typeof window !== "undefined") loadCats();

// Call this at the top of a page that shows categories. It re-draws the page once the database list has arrived
// (the number it returns changes then, so lists built from categories can depend on it).
export function useCategories(): number {
  const [ver, setVer] = useState(0);
  useEffect(() => { let on = true; loadCats().then(() => { if (on) setVer((v) => v + 1); }); return () => { on = false; }; }, []);
  return ver;
}
`;
  fs.writeFileSync(LIB, lib);
  console.log("Updated " + LIB);
} else console.log(LIB + " already updated.");

if (!pgDone) {
  pg = pg.replace(pgImp, 'import { CATS, OTHER, SHOW_EMPTY_CATEGORIES, categorize, isEnabled, useCategories } from "@/lib/categories";');
  pg = pg.replace(pgVis, "const catVer = useCategories(); // re-draws once the category list from the database arrives\n  const visible = useMemo(() => products.filter((p) => isEnabled(categorize(p.category))), [products, catVer]);");
  fs.writeFileSync(PG, pg);
  console.log("Updated " + PG);
} else console.log(PG + " already updated.");

if (!invDone) {
  inv = inv.replace(invImp, 'import { CATS, categorize, OTHER, useCategories } from "@/lib/categories";');
  inv = inv.replace(invOpt, "const catOptions = () => CATS.filter((c) => c.enabled).map((c) => c.name);");
  inv = inv.split("CAT_OPTIONS").join("catOptions()");
  inv = inv.replace(invFn, (m) => m + "  useCategories(); // re-draws once the category list from the database arrives\n");
  fs.writeFileSync(INV, inv);
  console.log("Updated " + INV);
} else console.log(INV + " already updated.");
console.log("Done. Now run: npm run build");
