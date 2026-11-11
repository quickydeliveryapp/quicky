import RoleGate from "@/components/RoleGate";
import DashShell from "@/components/DashShell";
import { ADMIN_NAV } from "@/lib/dashNav";
import AdminShell from "./AdminShell";

// Only the admin role can open this dashboard. The sidebar is on every admin page.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <RoleGate allow={["admin"]}><DashShell groups={ADMIN_NAV} title="Admin"><AdminShell>{children}</AdminShell></DashShell></RoleGate>;
}
