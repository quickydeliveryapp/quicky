// Sidebar ki fixed categories (display order). enabled:false = abhi customer ko nahi dikhegi (licence/age-check ke baad true karna)
export type Cat = { name: string; icon: string; enabled: boolean };
export const CATS: Cat[] = [
  { name: "Paan Corner", icon: "leaf", enabled: false },
  { name: "Dairy, Bread & Eggs", icon: "milk", enabled: true },
  { name: "Fruits & Vegetables", icon: "produce", enabled: true },
  { name: "Cold Drinks & Juices", icon: "drink", enabled: true },
  { name: "Snacks & Munchies", icon: "snack", enabled: true },
  { name: "Breakfast & Instant Food", icon: "bowl", enabled: true },
  { name: "Sweet Tooth", icon: "sweet", enabled: true },
  { name: "Bakery & Biscuits", icon: "cookie", enabled: true },
  { name: "Tea, Coffee & Milk Drinks", icon: "mug", enabled: true },
  { name: "Atta, Rice & Dal", icon: "grain", enabled: true },
  { name: "Masala, Oil & More", icon: "oil", enabled: true },
  { name: "Sauces & Spreads", icon: "jar", enabled: true },
  { name: "Chicken, Meat & Fish", icon: "bag", enabled: false },
  { name: "Organic & Healthy Living", icon: "sprout", enabled: true },
  { name: "Baby Care", icon: "baby", enabled: true },
  { name: "Pharma & Wellness", icon: "pill", enabled: false },
  { name: "Cleaning Essentials", icon: "spray", enabled: true },
  { name: "Home & Office", icon: "home", enabled: true },
  { name: "Personal Care", icon: "pump", enabled: true },
  { name: "Pet Care", icon: "paw", enabled: true },
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
