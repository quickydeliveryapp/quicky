// Sidebar menus for the admin and area manager dashboards. Each item has its own fixed address.
export type NavItem = { href: string; label: string; icon: string };
export type NavGroup = { title?: string; items: NavItem[] };

export const ADMIN_NAV: NavGroup[] = [
  { title: "Operations", items: [
    { href: "/admin", label: "Orders", icon: "orders" },
    { href: "/admin/riders", label: "Riders", icon: "bike" },
    { href: "/admin/shops", label: "Shops", icon: "store" },
  ] },
  { title: "Money", items: [
    { href: "/admin/commission", label: "Commission", icon: "percent" },
    { href: "/admin/payouts", label: "Shop payouts", icon: "wallet" },
    { href: "/admin/rider-cash", label: "Rider cash", icon: "cash" },
    { href: "/admin/fees", label: "Fees and limits", icon: "sliders" },
  ] },
  { title: "Content", items: [
    { href: "/admin/banners", label: "Banners", icon: "image" },
  ] },
];

export const AREA_NAV: NavGroup[] = [
  { items: [
    { href: "/areamanager", label: "Team", icon: "users" },
    { href: "/areamanager/orders", label: "Orders", icon: "orders" },
    { href: "/areamanager/deposits", label: "Deposits", icon: "wallet" },
  ] },
];
