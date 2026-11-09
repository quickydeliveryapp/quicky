"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import OrdersPanel from "../OrdersPanel";

type Row = { id: string; role: string; full_name: string | null; is_online: boolean };

// Orders of the area, and assigning riders (the same panel as before, now on its own page).
export default function AreaOrders() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    supabase.from("profiles").select("id,role,full_name,is_online").in("role", ["shop", "rider"]).order("role")
      .then(({ data }) => setRows((data as Row[]) ?? []));
  }, []);
  return <OrdersPanel people={rows} />;
}
