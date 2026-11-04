"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useProfile } from "@/lib/useProfile";
import { ROLE_HOME, ROLE_LABEL } from "@/lib/roles";

// Shared shell for all dashboards: shows only the current role's own dashboard.
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const path = usePathname();
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px" }}>
      {profile && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
          <Link href={ROLE_HOME[profile.role]} style={{ fontWeight: 700, color: path.startsWith(ROLE_HOME[profile.role]) ? "#0C7D1D" : "inherit" }}>
            {ROLE_LABEL[profile.role]} dashboard
          </Link>
          {profile.area && <span style={{ fontSize: 13, color: "#6B7A71" }}>Area: {profile.area}</span>}
          <Link href="/" style={{ marginLeft: "auto", fontSize: 13 }}>Back to store</Link>
        </div>
      )}
      {children}
    </div>
  );
}
