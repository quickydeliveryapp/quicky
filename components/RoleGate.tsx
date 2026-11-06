"use client";
import { useCallback, useEffect } from "react";
import { useProfile } from "@/lib/useProfile";
import { ROLE_LABEL, type Role } from "@/lib/roles";

// Renders children only for the allowed roles.
// For anyone else (logged out, or logged in with a different role) the login dialog opens right here,
// so the address stays the clean permalink (/shop, /admin ...). After logging in the page reloads.
// This is a UX guard. The real protection is the RLS policies in supabase/roles.sql.
export default function RoleGate({ allow, children }: { allow: Role[]; children: React.ReactNode }) {
  const { loading, profile } = useProfile();
  const ok = !!profile && allow.includes(profile.role);
  const need = ROLE_LABEL[allow[0]];
  const openLogin = useCallback(() => { window.dispatchEvent(new CustomEvent("open-login", { detail: { need } })); }, [need]);

  useEffect(() => { if (!loading && !ok) openLogin(); }, [loading, ok, openLogin]);

  if (loading) return <p style={{ padding: 24, color: "#6B7A71" }}>Loading...</p>;
  if (!ok) return (
    <div style={{ padding: "56px 24px", textAlign: "center" }}>
      <p style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700 }}>{need} login</p>
      <p style={{ margin: "0 0 18px", color: "#6B7A71" }}>
        {profile ? `You are logged in with a different account. This page is only for ${need} accounts.` : `Log in with your ${need} account to open this page.`}
      </p>
      <button onClick={openLogin}>Log in</button>
    </div>
  );
  return <>{children}</>;
}
