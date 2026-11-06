"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useProfile } from "@/lib/useProfile";
import { homeFor, type Role } from "@/lib/roles";

// Renders children only for the allowed roles. Others are sent to their own home.
// Logged-out visitors go to the login page and come back here afterwards.
// This is a UX guard. The real protection is the RLS policies in supabase/roles.sql.
export default function RoleGate({ allow, children }: { allow: Role[]; children: React.ReactNode }) {
  const { loading, profile } = useProfile();
  const router = useRouter();
  const path = usePathname();
  const ok = !!profile && allow.includes(profile.role);

  useEffect(() => {
    if (loading || ok) return;
    router.replace(profile ? homeFor(profile.role) : "/login?next=" + encodeURIComponent(path || "/"));
  }, [loading, ok, profile, router, path]);

  if (loading || !ok) return <p style={{ padding: 24, color: "#6B7A71" }}>Loading...</p>;
  return <>{children}</>;
}
