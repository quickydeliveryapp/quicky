// Sidebar ki fixed categories (display order). enabled:false = abhi customer ko nahi dikhegi (licence/age-check ke baad true karna)
// img = category ki photo (public/cats/). Baad mein apni photos se badalni hon toh bas wahi file replace karo
export type Cat = { name: string; icon: string; img: string; enabled: boolean };
export const CATS: Cat[] = [
  { name: "Paan Corner", icon: "leaf", img: "/cats/paan.webp", enabled: false },
  { name: "Dairy, Bread & Eggs", icon: "milk", img: "/cats/dairy.webp", enabled: true },
  { name: "Fruits & Vegetables", icon: "produce", img: "/cats/fruits.webp", enabled: true },
  { name: "Cold Drinks & Juices", icon: "drink", img: "/cats/drinks.webp", enabled: true },
  { name: "Snacks & Munchies", icon: "snack", img: "/cats/snacks.webp", enabled: true },
  { name: "Breakfast & Instant Food", icon: "bowl", img: "/cats/breakfast.webp", enabled: true },
  { name: "Sweet Tooth", icon: "sweet", img: "/cats/sweets.webp", enabled: true },
  { name: "Bakery & Biscuits", icon: "cookie", img: "/cats/bakery.webp", enabled: true },
  { name: "Tea, Coffee & Milk Drinks", icon: "mug", img: "/cats/tea.webp", enabled: true },
  { name: "Atta, Rice & Dal", icon: "grain", img: "/cats/atta.webp", enabled: true },
  { name: "Masala, Oil & More", icon: "oil", img: "/cats/masala.webp", enabled: true },
  { name: "Sauces & Spreads", icon: "jar", img: "/cats/sauces.webp", enabled: true },
  { name: "Chicken, Meat & Fish", icon: "bag", img: "/cats/meat.webp", enabled: false },
  { name: "Organic & Healthy Living", icon: "sprout", img: "/cats/organic.webp", enabled: true },
  { name: "Baby Care", icon: "baby", img: "/cats/baby.webp", enabled: true },
  { name: "Pharma & Wellness", icon: "pill", img: "/cats/pharma.webp", enabled: false },
  { name: "Cleaning Essentials", icon: "spray", img: "/cats/cleaning.webp", enabled: true },
  { name: "Home & Office", icon: "home", img: "/cats/home.webp", enabled: true },
  { name: "Personal Care", icon: "pump", img: "/cats/personal.webp", enabled: true },
  { name: "Pet Care", icon: "paw", img: "/cats/pet.webp", enabled: true },
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
