// Single source of truth for roles, permissions and where each role lands.
export const ROLES = ["admin", "area_manager", "shop", "rider", "customer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  area_manager: "Area manager",
  shop: "Shop",
  rider: "Rider",
  customer: "Customer",
};

// Where each role goes after login. Customers have no dashboard, they use the storefront.
export const ROLE_HOME: Record<Role, string> = {
  admin: "/dashboard/admin",
  area_manager: "/dashboard/area-manager",
  shop: "/dashboard/shop",
  rider: "/dashboard/rider",
  customer: "/",
};

export type Perm =
  | "hero.manage" | "users.manage" | "areas.manage" | "products.manage_all" | "orders.view_all"
  | "area.view" | "area.shops_view" | "area.riders_view" | "area.orders_view" | "area.riders_assign"
  | "products.manage_own" | "orders.view_own_shop"
  | "deliveries.view_own" | "deliveries.update_own"
  | "orders.view_own";

export const PERMS: Record<Role, Perm[]> = {
  admin: ["hero.manage", "users.manage", "areas.manage", "products.manage_all", "orders.view_all", "area.view", "area.shops_view", "area.riders_view", "area.orders_view", "area.riders_assign"],
  // Area manager: read/coordinate inside their own area only. No hero, users, or global data.
  area_manager: ["area.view", "area.shops_view", "area.riders_view", "area.orders_view", "area.riders_assign"],
  shop: ["products.manage_own", "orders.view_own_shop"],
  rider: ["deliveries.view_own", "deliveries.update_own"],
  customer: ["orders.view_own"],
};

export const isRole = (v: unknown): v is Role => typeof v === "string" && (ROLES as readonly string[]).includes(v);
export const can = (role: Role | null | undefined, perm: Perm) => !!role && PERMS[role].includes(perm);
export const homeFor = (role: Role | null | undefined) => (role ? ROLE_HOME[role] : "/");
