import { setState } from "./store";

const FALLBACK = "Current location";
type Place = { label: string; city: string; postcode?: string };

// OpenStreetMap ke address se: poora label (area, shehar, district, state) aur sirf shehar (header ke liye)
function parse(a: any, fallback?: string): Place {
  const pick = (...ks: string[]) => { for (const k of ks) if (a[k]) return String(a[k]); return ""; };
  const city = pick("city", "town", "village", "municipality", "county") || pick("state_district");
  const parts = [pick("road"), pick("neighbourhood", "suburb", "quarter", "hamlet", "residential", "city_district"), city, pick("state_district")].filter(Boolean);
  const uniq = [...new Set(parts)];
  if (uniq.length < 3 && a.state) uniq.push(String(a.state));
  const label = uniq.slice(0, 4).join(", ") || fallback || FALLBACK;
  // 6-digit pincode if the map has one ("173 205" and "173205;173206" both work)
  const postcode = String(a.postcode ?? "").replace(/\s/g, "").match(/[1-9]\d{5}/)?.[0];
  return { label, city: city || uniq[0] || label, postcode };
}

const isReal = (p: Place | null): p is Place => !!p && p.label !== FALLBACK && p.city !== FALLBACK;

// One look-up at OpenStreetMap. zoom 17 = street level, 14 = area level (works better in villages and small towns).
// Returns the place, null (it answered but had no usable address) or undefined (blocked or offline: do not ask again).
async function osm(lat: number, lng: number, zoom: number): Promise<Place | null | undefined> {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=en&zoom=${zoom}&lat=${lat}&lon=${lng}`);
    if (!r.ok) return undefined; // blocked or too many requests
    const j = await r.json();
    if (!j || !j.address) return null;
    const p = parse(j.address, j.display_name);
    return isReal(p) ? p : null;
  } catch { return undefined; }
}

// Backup service, only used when OpenStreetMap gives nothing. It also gives a pincode when it knows one.
async function backup(lat: number, lng: number): Promise<Place | null> {
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
    if (!r.ok) return null;
    const j = await r.json();
    const city = String(j.city || j.locality || "");
    const label = [...new Set([j.locality, j.city, j.principalSubdivision].filter(Boolean).map(String))].join(", ");
    const postcode = String(j.postcode ?? "").replace(/\s/g, "").match(/[1-9]\d{5}/)?.[0];
    const p: Place = { label, city: city || label, postcode };
    return isReal(p) ? p : null;
  } catch { return null; }
}

// Nominatim fair use: sirf button/Enter pe search, reverse result localStorage mein cache.
// A failed look-up is never cached, so the name appears the next time the app opens.
export async function reverse(lat: number, lng: number): Promise<Place> {
  const key = `qk_rev5_${lat.toFixed(3)}_${lng.toFixed(3)}`;
  try { const c = JSON.parse(localStorage.getItem(key) || "null"); if (isReal(c)) return c; } catch {}
  const first = await osm(lat, lng, 17);
  let p: Place | null | undefined = first ?? (first === null ? await osm(lat, lng, 14) : undefined);
  if (!p) p = await backup(lat, lng);
  else if (!p.postcode) { const b = await backup(lat, lng); if (b?.postcode) p = { ...p, postcode: b.postcode }; }
  if (!p) return { label: FALLBACK, city: FALLBACK };
  try { localStorage.setItem(key, JSON.stringify(p)); } catch {}
  return p;
}

export async function searchPlaces(q: string) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=in&limit=5&q=${encodeURIComponent(q)}`);
  const j = await r.json();
  return (j as any[]).map((x) => {
    const p = parse(x.address || {}, String(x.display_name));
    return { lat: Number(x.lat), lng: Number(x.lon), label: String(x.display_name), city: p.city, pincode: p.postcode };
  });
}

export function detectAndSet(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("Location is not supported on this device")); return; }
    navigator.geolocation.getCurrentPosition(async (p) => {
      const lat = p.coords.latitude, lng = p.coords.longitude;
      const place = await reverse(lat, lng);
      setState({ loc: { lat, lng, label: place.label, city: place.city, pincode: place.postcode }, locOpen: false });
      resolve();
    }, () => reject(new Error("Location permission was denied")), { timeout: 10000 });
  });
}
