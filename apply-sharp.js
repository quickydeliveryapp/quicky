// Run from the project root:  node apply-sharp.js
// Turns every rounded corner in the admin and area manager dashboards into a sharp one. Safe to run twice.
const fs = require("fs");
const F = "components/DashShell.tsx";
if (!fs.existsSync(F)) { console.error("STOP: " + F + " not found. Run this from the project root."); process.exit(1); }
let s = fs.readFileSync(F, "utf8");
if (s.includes("dash-sharp.css")) console.log("Already applied.");
else {
  const anchor = 'import "./dash-sidebar.css";';
  if (!s.includes(anchor)) { console.error("STOP: the dash-sidebar.css import was not found in " + F + ". Send me this file."); process.exit(1); }
  fs.writeFileSync(F, s.replace(anchor, anchor + '\nimport "./dash-sharp.css";'));
  console.log("Sharp corners switched on.");
}
console.log("Done. Now run: npm run build");
