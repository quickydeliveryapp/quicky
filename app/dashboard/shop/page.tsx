"use client";
import RoleGate from "@/components/RoleGate";

export default function ShopDashboard() {
  return (
    <RoleGate allow={["shop"]}>
      <h2 style={{ margin: "0 0 4px" }}>Shop</h2>
      <p style={{ margin: 0, color: "#6B7A71", fontSize: 13 }}>Your own products and your own orders only.</p>
      {/* Move your existing shop dashboard here. */}
    </RoleGate>
  );
}
