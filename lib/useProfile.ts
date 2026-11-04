"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isRole, type Role } from "@/lib/roles";

export type Profile = { id: string; role: Role; area: string | null; full_name: string | null };
type State = { loading: boolean; profile: Profile | null };

// Current user's profile (role + area). profile = null when logged out.
export function useProfile(): State {
  const [st, setSt] = useState<State>({ loading: true, profile: null });

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { if (alive) setSt({ loading: false, profile: null }); return; }
      const { data } = await supabase.from("profiles").select("id,role,area,full_name").eq("id", session.user.id).maybeSingle();
      if (!alive) return;
      // Unknown or missing role is treated as a customer (least privilege).
      const role: Role = isRole(data?.role) ? data!.role : "customer";
      setSt({ loading: false, profile: { id: session.user.id, role, area: data?.area ?? null, full_name: data?.full_name ?? null } });
    };
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { load(); });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);

  return st;
}
