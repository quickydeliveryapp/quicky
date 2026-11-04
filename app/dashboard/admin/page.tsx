"use client";
import RoleGate from "@/components/RoleGate";
import HeroAdmin from "@/components/HeroAdmin";

export default function AdminDashboard() {
  return (
    <RoleGate allow={["admin"]}>
      <h2 style={{ margin: "0 0 4px" }}>Admin</h2>
      <p style={{ margin: "0 0 12px", color: "#6B7A71", fontSize: 13 }}>Full access: banners, users and roles, areas, all products and orders.</p>
      <HeroAdmin />
      {/* Move your existing admin sections (users, orders, products) here. */}
    </RoleGate>
  );
}
