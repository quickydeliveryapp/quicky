"use client";
import { useProfile } from "@/lib/useProfile";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import StaffLogin from "@/components/StaffLogin";

// Renders children only for the allowed roles.
// Anyone else (logged out, or logged in with a different role) sees the staff login page right here,
// so the address stays the clean permalink (/shop, /admin ...). After logging in the page reloads.
// This is a UX guard. The real protection is the RLS policies in supabase/roles.sql.
export default function RoleGate({ allow, children }: { allow: Role[]; children: React.ReactNode }) {
  const { loading, profile } = useProfile();
  const ok = !!profile && allow.includes(profile.role);

  if (loading) return <p style={{ padding: 24, color: "#6B7A71" }}>Loading...</p>;
  if (!ok) return <StaffLogin role={ROLE_LABEL[allow[0]]} signedInElsewhere={!!profile} />;
  return <>{children}</>;
}
