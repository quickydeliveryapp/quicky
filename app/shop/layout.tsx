import RoleGate from "@/components/RoleGate";
import DashShell from "@/components/DashShell";
import { SHOP_NAV } from "@/lib/dashNav";
import "./sidebar.css";

// Only the shop role can open this dashboard. The sidebar is on every shop page.
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <RoleGate allow={["shop"]}><DashShell groups={SHOP_NAV} title="Shop">{children}</DashShell></RoleGate>;
}
