"use client";
import Link from "next/link";
import { useProfile } from "@/lib/useProfile";
import { ROLE_LABEL } from "@/lib/roles";

// Shared shell for all dashboards.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const isAdmin = profile?.role === "admin";
  const isArea = profile?.role === "area_manager";
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px" }}>
      {profile && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          {!isArea && <span style={{ fontWeight: 700 }}>{ROLE_LABEL[profile.role]} dashboard</span>}
          {profile.area && <span style={{ fontSize: 13, color: "#6B7A71" }}>Area: {profile.area}</span>}
          {isAdmin && <Link href="/" style={{ marginLeft: "auto", fontSize: 13 }}>Customer view</Link>}
        </div>
      )}
      {children}
    </div>
  );
}
