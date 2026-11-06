import RoleGate from "@/components/RoleGate";

// Only the rider role can open this dashboard.
export default function RiderLayout({ children }: { children: React.ReactNode }) {
  return <RoleGate allow={["rider"]}>{children}</RoleGate>;
}
