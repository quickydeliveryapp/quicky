import { setState } from "./store";

type Place = { label: string; city: string };

// OpenStreetMap ke address se: poora label (area, shehar, district, state) aur sirf shehar (header ke liye)
function parse(a: any, fallback?: string): Place {
  const pick = (...ks: string[]) => { for (const k of ks) if (a[k]) return String(a[k]); return ""; };
  const city = pick("city", "town", "village", "municipality", "county") || pick("state_district");
  const parts = [pick("road"), pick("neighbourhood", "suburb", "quarter", "hamlet", "residential", "city_district"), city, pick("state_district")].filter(Boolean);
  const uniq = [...new Set(parts)];
  if (uniq.length < 3 && a.state) uniq.push(String(a.state));
  const label = uniq.slice(0, 4).join(", ") || fallback || "Current location";
  return { label, city: city || uniq[0] || label };
}

// Nominatim fair use: sirf button/Enter pe search, reverse result localStorage mein cache
export async function reverse(lat: number, lng: number): Promise<Place> {
  const key = `qk_rev3_${lat.toFixed(3)}_${lng.toFixed(3)}`;
  try { const c = localStorage.getItem(key); if (c) return JSON.parse(c); } catch {}
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&lat=${lat}&lon=${lng}`);
    const j = await r.json();
    const p = parse(j.address || {}, j.display_name);
    try { localStorage.setItem(key, JSON.stringify(p)); } catch {}
    return p;
  } catch { return { label: "Current location", city: "Current location" }; }
}

export async function searchPlaces(q: string) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=in&limit=5&q=${encodeURIComponent(q)}`);
  const j = await r.json();
  return (j as any[]).map((x) => ({ lat: Number(x.lat), lng: Number(x.lon), label: String(x.display_name), city: parse(x.address || {}, String(x.display_name)).city }));
}

export function detectAndSet(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("Location is not supported on this device")); return; }
    navigator.geolocation.getCurrentPosition(async (p) => {
      const lat = p.coords.latitude, lng = p.coords.longitude;
      const place = await reverse(lat, lng);
      setState({ loc: { lat, lng, label: place.label, city: place.city }, locOpen: false });
      resolve();
    }, () => reject(new Error("Location permission was denied")), { timeout: 10000 });
  });
}
