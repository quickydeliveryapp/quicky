"use client";
import { useSyncExternalStore } from "react";

export type Loc = { lat: number; lng: number; label: string; city?: string } | null;
export type CartItem = { qty: number; name: string; unit: string; price: number };
type State = { loc: Loc; q: string; cart: Record<string, CartItem>; cartOpen: boolean; locOpen: boolean };

// Chhota shared store: header, home page, cart drawer aur location dialog sab isse jude hain
let state: State = { loc: null, q: "", cart: {}, cartOpen: false, locOpen: false };
const subs = new Set<() => void>();

export const getState = () => state;
export function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  try {
    if ("loc" in patch) localStorage.setItem("qk_loc", JSON.stringify(state.loc));
    if ("cart" in patch) localStorage.setItem("qk_cart", JSON.stringify(state.cart));
  } catch {}
  subs.forEach((f) => f());
}
export function initStore() {
  try {
    const loc = JSON.parse(localStorage.getItem("qk_loc") || "null");
    const cart = JSON.parse(localStorage.getItem("qk_cart") || "{}");
    state = { ...state, loc, cart };
    subs.forEach((f) => f());
  } catch {}
}
export function useStore() {
  return useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, getState, getState);
}
export function changeQty(id: string, d: number, info?: Omit<CartItem, "qty">) {
  const cart = { ...state.cart };
  const cur = cart[id];
  const qty = Math.max(0, (cur?.qty ?? 0) + d);
  if (qty === 0) delete cart[id];
  else if (cur || info) cart[id] = { ...(cur ?? info!), ...(info ?? {}), qty };
  setState({ cart });
}
