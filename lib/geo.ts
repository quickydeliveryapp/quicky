import { setState } from "./store";

// Nominatim fair use: sirf button/Enter pe search, reverse result localStorage mein cache
export async function reverse(lat: number, lng: number): Promise<string> {
  const key = `qk_rev_${lat.toFixed(3)}_${lng.toFixed(3)}`;
  try { const c = localStorage.getItem(key); if (c) return c; } catch {}
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&lat=${lat}&lon=${lng}`);
    const j = await r.json();
    const a = j.address || {};
    const parts = [a.road, a.neighbourhood || a.suburb, a.city || a.town || a.village || a.county].filter(Boolean);
    const label = parts.length ? parts.join(", ") : j.display_name || "Current location";
    try { localStorage.setItem(key, label); } catch {}
    return label;
  } catch { return "Current location"; }
}

export async function searchPlaces(q: string) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=in&limit=5&q=${encodeURIComponent(q)}`);
  const j = await r.json();
  return (j as any[]).map((x) => ({ lat: Number(x.lat), lng: Number(x.lon), label: String(x.display_name) }));
}

export function detectAndSet(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("Location is not supported on this device")); return; }
    navigator.geolocation.getCurrentPosition(async (p) => {
      const lat = p.coords.latitude, lng = p.coords.longitude;
      setState({ loc: { lat, lng, label: await reverse(lat, lng) }, locOpen: false });
      resolve();
    }, () => reject(new Error("Location permission was denied")), { timeout: 10000 });
  });
}
