"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useProfile } from "@/lib/useProfile";
import { ROLE_LABEL, type Role } from "@/lib/roles";

// Renders children only for the allowed roles.
// Anyone else (logged out, or logged in with a different role) is sent to the login page and comes back here
// after logging in with the right account. The login dialog says which role this page is for.
// This is a UX guard. The real protection is the RLS policies in supabase/roles.sql.
export default function RoleGate({ allow, children }: { allow: Role[]; children: React.ReactNode }) {
  const { loading, profile } = useProfile();
  const router = useRouter();
  const path = usePathname();
  const ok = !!profile && allow.includes(profile.role);

  useEffect(() => {
    if (loading || ok) return;
    const need = profile ? "&need=" + encodeURIComponent(ROLE_LABEL[allow[0]]) : "";
    router.replace("/login?next=" + encodeURIComponent(path || "/") + need);
  }, [loading, ok, profile, router, path]);

  if (loading || !ok) return <p style={{ padding: 24, color: "#6B7A71" }}>Loading...</p>;
  return <>{children}</>;
}
