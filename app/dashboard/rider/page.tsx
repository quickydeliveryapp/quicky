"use client";
import RoleGate from "@/components/RoleGate";

export default function RiderDashboard() {
  return (
    <RoleGate allow={["rider"]}>
      <h2 style={{ margin: "0 0 4px" }}>Rider</h2>
      <p style={{ margin: 0, color: "#6B7A71", fontSize: 13 }}>Only deliveries assigned to you.</p>
      {/* Move your existing rider dashboard here. */}
    </RoleGate>
  );
}
