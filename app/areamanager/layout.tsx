"use client";
import RoleGate from "@/components/RoleGate";
import DashShell from "@/components/DashShell";
import { useProfile } from "@/lib/useProfile";
import { AREA_NAV } from "@/lib/dashNav";

// Only area managers can open this dashboard. The sidebar is on every page here.
export default function AreaManagerLayout({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  return <RoleGate allow={["area_manager"]}><DashShell groups={AREA_NAV} title={profile?.area ? `Area: ${profile.area}` : "Area manager"}>{children}</DashShell></RoleGate>;
}
