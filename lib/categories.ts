// Sidebar ki fixed categories (display order). enabled:false = abhi customer ko nahi dikhegi (licence/age-check ke baad true karna)
export type Cat = { name: string; icon: string; enabled: boolean };
export const CATS: Cat[] = [
  { name: "Paan Corner", icon: "🪔", enabled: false },
  { name: "Dairy, Bread & Eggs", icon: "🥛", enabled: true },
  { name: "Fruits & Vegetables", icon: "🥬", enabled: true },
  { name: "Cold Drinks & Juices", icon: "🥤", enabled: true },
  { name: "Snacks & Munchies", icon: "🍿", enabled: true },
  { name: "Breakfast & Instant Food", icon: "🥣", enabled: true },
  { name: "Sweet Tooth", icon: "🍫", enabled: true },
  { name: "Bakery & Biscuits", icon: "🍪", enabled: true },
  { name: "Tea, Coffee & Milk Drinks", icon: "☕", enabled: true },
  { name: "Atta, Rice & Dal", icon: "🌾", enabled: true },
  { name: "Masala, Oil & More", icon: "🌶️", enabled: true },
  { name: "Sauces & Spreads", icon: "🍯", enabled: true },
  { name: "Chicken, Meat & Fish", icon: "🍗", enabled: false },
  { name: "Organic & Healthy Living", icon: "🌱", enabled: true },
  { name: "Baby Care", icon: "🍼", enabled: true },
  { name: "Pharma & Wellness", icon: "💊", enabled: false },
  { name: "Cleaning Essentials", icon: "🧽", enabled: true },
  { name: "Home & Office", icon: "🏠", enabled: true },
  { name: "Personal Care", icon: "🧴", enabled: true },
  { name: "Pet Care", icon: "🐾", enabled: true },
];

// Shop owner category free-text likhta hai, isliye keyword se in categories mein map karte hain (upar se neeche, pehla match jeetta hai)
const RULES: [string, RegExp][] = [
  ["Paan Corner", /paan|tobacco|cigar|hookah/],
  ["Pharma & Wellness", /pharma|medic|wellness|tablet|syrup|\bdrug/],
  ["Chicken, Meat & Fish", /chicken|\bmeat|mutton|\bfish|seafood/],
  ["Baby Care", /\bbaby|diaper|infant/],
  ["Pet Care", /\bpets?\b|\bdog|pedigree/],
  ["Tea, Coffee & Milk Drinks", /\btea\b|coffee|milk drink|health drink|bournvita|horlicks/],
  ["Fruits & Vegetables", /fruit|\bveg|produce|fresh/],
  ["Dairy, Bread & Eggs", /dairy|milk|bread|\begg|curd|paneer|butter|cheese|yogurt|yoghurt/],
  ["Cold Drinks & Juices", /cold drink|juice|soda|bever|\bdrinks?\b|water|cola/],
  ["Snacks & Munchies", /snack|chips?\b|munch|namkeen|popcorn/],
  ["Breakfast & Instant Food", /breakfast|instant|noodle|cereal|oats|\bready/],
  ["Sweet Tooth", /sweet|chocolate|candy|ice.?cream|dessert/],
  ["Bakery & Biscuits", /bakery|biscuit|cookie|\bcake|rusk/],
  ["Atta, Rice & Dal", /\batta\b|\brice\b|\bdal\b|pulse|grain|staple|flour|grocer/],
  ["Masala, Oil & More", /masala|spice|\boil\b|\bghee|\bsalt\b|\bsugar/],
  ["Sauces & Spreads", /sauce|spread|ketchup|\bjam\b|mayo/],
  ["Organic & Healthy Living", /organic|healthy/],
  ["Cleaning Essentials", /clean|detergent|household|dish ?wash|\bmop|phenyl/],
  ["Home & Office", /\bhome\b|office|stationery|kitchen|utensil/],
  ["Personal Care", /personal|beauty|hygiene|soap|shampoo|skin|\bcare\b/],
];

export const OTHER = "Other";

export function categorize(raw: string | null | undefined): string {
  const t = (raw || "").trim().toLowerCase();
  if (!t) return OTHER;
  const exact = CATS.find((c) => c.name.toLowerCase() === t);
  if (exact) return exact.name;
  for (const [name, re] of RULES) if (re.test(t)) return name;
  return OTHER;
}

export const isEnabled = (name: string) => name === OTHER || !!CATS.find((c) => c.name === name)?.enabled;

// true = saari categories hamesha dikhengi (Blinkit jaisa). false = sirf wahi jinme abhi products hain
export const SHOW_EMPTY_CATEGORIES = true;
