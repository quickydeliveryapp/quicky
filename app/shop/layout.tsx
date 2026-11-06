import RoleGate from "@/components/RoleGate";

// Only the shop role can open this dashboard.
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <RoleGate allow={["shop"]}>{children}</RoleGate>;
}
