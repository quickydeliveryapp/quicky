// Run from the project root:  node apply-pincodes.js
// Makes the header say "Not serviceable" when the customer's pincode is not switched on in Admin > Pincodes. Safe to run twice.
const fs = require("fs");
const F = "components/Header.tsx";
const fail = (m) => { console.error("STOP: " + m); process.exit(1); };
if (!fs.existsSync(F)) fail(F + " not found. Run this from the project root.");
let s = fs.readFileSync(F, "utf8");
if (s.includes("pincode_serviceable")) { console.log("Header already checks pincodes."); process.exit(0); }

const a1 = 'if (cur && cur.lat === saved.lat && cur.lng === saved.lng && p.label !== "Current location" && (cur.city !== p.city || cur.label !== p.label)) setState({ loc: { ...cur, label: p.label, city: p.city } });';
const a2 = 'supabase.rpc("delivery_eta", { p_lat: loc.lat, p_lng: loc.lng }).then(({ data, error }) => setEta(error ? undefined : (data as number | null)));';
const a3 = "}, [loc?.lat, loc?.lng]);";
for (const [n, w] of [[a1, "the saved-location refresh line"], [a2, "the delivery_eta line"], [a3, "the effect's dependency list"]])
  if (!s.includes(n)) fail(w + " was not found in " + F + ". Send me this file and I will adjust.");

s = s.replace(a1, 'if (cur && cur.lat === saved.lat && cur.lng === saved.lng && p.label !== "Current location" && (cur.city !== p.city || cur.label !== p.label || cur.pincode !== p.postcode)) setState({ loc: { ...cur, label: p.label, city: p.city, pincode: p.postcode } });');
s = s.replace(a2, `Promise.all([
      supabase.rpc("delivery_eta", { p_lat: loc.lat, p_lng: loc.lng }),
      loc.pincode ? supabase.rpc("pincode_serviceable", { p_pincode: loc.pincode }) : Promise.resolve({ data: true, error: null }),
    ]).then(([e, pc]) => {
      const outside = !pc.error && pc.data === false; // this pincode is not switched on in Admin > Pincodes
      setEta(outside ? null : e.error ? undefined : (e.data as number | null));
    });`);
s = s.replace(a3, "}, [loc?.lat, loc?.lng, loc?.pincode]);");
fs.writeFileSync(F, s);
console.log("Header now checks pincodes.");
console.log("Done. Now run: npm run build");
