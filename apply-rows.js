// Run from the project root:  node apply-rows.js
// Turns the cards in the admin and area manager lists into one vertical single-line list, like the sidebar. Safe to run twice.
const fs = require("fs");
const F = "components/DashShell.tsx";
if (!fs.existsSync(F)) { console.error("STOP: " + F + " not found. Run this from the project root."); process.exit(1); }
let s = fs.readFileSync(F, "utf8");
if (s.includes("dash-rows.css")) console.log("Already applied.");
else {
  const anchor = 'import "./dash-sidebar.css";';
  if (!s.includes(anchor)) { console.error("STOP: the dash-sidebar.css import was not found in " + F + ". Send me this file."); process.exit(1); }
  fs.writeFileSync(F, s.replace(anchor, anchor + '\nimport "./dash-rows.css";'));
  console.log("Single-line list rows switched on.");
}
console.log("Done. Now run: npm run build");
