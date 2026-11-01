// Category ka order aur icon. Naye/anjaan categories bhi chalte hain (end mein, 🛒 icon ke saath)
const ORDER = ["fresh produce", "fruits & vegetables", "dairy", "staples", "snacks", "beverages", "personal care"];

export const catName = (c: string | null | undefined) => (c || "").trim() || "Other";
export const catKey = (c: string | null | undefined) => catName(c).toLowerCase();

export function iconFor(name: string) {
  const n = name.toLowerCase();
  if (/fruit|veg|produce/.test(n)) return "🥬";
  if (/dairy|milk|egg|curd/.test(n)) return "🥛";
  if (/staple|atta|rice|dal|grain|oil/.test(n)) return "🌾";
  if (/snack|chip|biscuit|namkeen/.test(n)) return "🍿";
  if (/bever|drink|juice|tea|coffee/.test(n)) return "🥤";
  if (/personal|care|beauty|hygiene/.test(n)) return "🧴";
  if (/bake|bread/.test(n)) return "🍞";
  if (/clean|home|house/.test(n)) return "🧽";
  return "🛒";
}

export function sortGroups<T extends { name: string }>(entries: [string, T][]) {
  const rank = (k: string) => { const i = ORDER.indexOf(k); return i === -1 ? 99 : i; };
  return entries.sort((a, b) => rank(a[0]) - rank(b[0]) || a[1].name.localeCompare(b[1].name));
}
