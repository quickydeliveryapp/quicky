"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/lib/useProfile";
import { homeFor } from "@/lib/roles";

// /dashboard sends each user to the dashboard for their role.
export default function DashboardIndex() {
  const { loading, profile } = useProfile();
  const router = useRouter();
  useEffect(() => { if (!loading) router.replace(homeFor(profile?.role)); }, [loading, profile, router]);
  return <p style={{ padding: 24, color: "#6B7A71" }}>Loading...</p>;
}
