// Run from the project root:  node apply-category-images.js
// Shows each category's picture (from lib/categories.ts) next to its name in Admin > Commission. Safe to run twice.
const fs = require("fs");
const AD = "app/admin/page.tsx", CSS = "app/admin/admin.css";
const fail = (m) => { console.error("STOP: " + m); process.exit(1); };
if (!fs.existsSync(AD) || !fs.existsSync(CSS)) fail("run this from the project root (the folder that contains app/).");

let s = fs.readFileSync(AD, "utf8");
if (s.includes("CatPic")) console.log("Admin page already shows category pictures.");
else {
  const imp = 'import HeroAdmin from "@/components/HeroAdmin";';
  const empty = "const Empty = (";
  const label = '<div className="adm-field" key={c.category}>\n          <span>{c.category}</span>';
  for (const [needle, what] of [[imp, "the HeroAdmin import"], [empty, "the Empty component"], [label, "the commission category row"]])
    if (!s.includes(needle)) fail(what + " not found in " + AD + ". Send me this file and I will adjust.");

  s = s.replace(imp, imp + '\nimport * as catLib from "@/lib/categories";');
  s = s.replace(empty, `// category name -> picture, read from lib/categories.ts (the same pictures the customer app uses)
const CAT_IMG: Record<string, string> = {};
(Object.values(catLib) as unknown[]).forEach((v) => {
  if (Array.isArray(v)) v.forEach((c: any) => { if (c && typeof c.name === "string" && typeof c.img === "string") CAT_IMG[c.name.toLowerCase()] = c.img; });
});
function CatPic({ name }: { name: string }) {
  const src = CAT_IMG[String(name).toLowerCase()];
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img className="adm-cat-img" src={src} alt="" loading="lazy" /> : <span className="adm-av">{String(name).charAt(0)}</span>;
}

` + empty);
  s = s.replace(label, '<div className="adm-field" key={c.category}>\n          <span className="adm-cat"><CatPic name={c.category} /><span>{c.category}</span></span>');
  fs.writeFileSync(AD, s);
  console.log("Admin Commission tab now shows category pictures.");
}

const c = fs.readFileSync(CSS, "utf8");
if (c.includes("Category pictures in Admin")) console.log("Styles already in admin.css.");
else { fs.writeFileSync(CSS, c.replace(/\s*$/, "\n") + fs.readFileSync("category-images.css", "utf8")); console.log("Added styles to admin.css."); }
console.log("Done. Now run: npm run build");
