import RoleGate from "@/components/RoleGate";

// Only the admin role can open this dashboard.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RoleGate allow={["admin"]}>{children}</RoleGate>;
}
