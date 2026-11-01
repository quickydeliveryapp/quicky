"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/messages";
import { changeQty, setState, useStore } from "@/lib/store";
import { Icon } from "@/lib/icons";

export default function CartDrawer() {
  const { cart, cartOpen, loc } = useStore();
  const router = useRouter();
  const [fees, setFees] = useState<any>(null);
  const [addr, setAddr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => setState({ cartOpen: false });
  useEffect(() => {
    if (!cartOpen) return;
    document.body.style.overflow = "hidden";
    setAddr((a) => a || loc?.label || "");
    supabase.from("fee_settings").select("*").eq("id", 1).single().then(({ data }) => setFees(data));
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", k);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", k); };
  }, [cartOpen]);

  const entries = Object.entries(cart);
  const total = entries.reduce((s, [, i]) => s + i.qty * i.price, 0);
  const del = fees ? (total >= Number(fees.free_delivery_above) ? 0 : Number(fees.delivery_fee)) : 0;
  const small = fees && total < Number(fees.small_cart_threshold) ? Number(fees.small_cart_fee) : 0;

  async function placeOrder() {
    setMsg("");
    if (!loc) { setState({ cartOpen: false, locOpen: true }); return; }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { close(); window.dispatchEvent(new Event("open-login")); return; }
    if (!addr.trim()) { setMsg("Please enter your delivery address"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("place_order", {
      p_lat: loc.lat, p_lng: loc.lng, p_address: addr.trim(),
      p_items: entries.map(([product_id, i]) => ({ product_id, qty: i.qty })) });
    setBusy(false);
    if (error) { setMsg(friendly(error.message)); return; }
    setState({ cart: {}, cartOpen: false });
    router.push("/orders/" + data);
  }

  if (!cartOpen) return null;
  return (
    <div className="drawer-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="My Cart">
        <div className="dhead">My Cart<button className="dx" aria-label="Close cart" onClick={close}><Icon name="x" size={18} sw={2} /></button></div>
        <div className="dbody">
          {!entries.length ? <div className="empty">Your cart is empty</div> : <>
            {entries.map(([id, i]) => (
              <div className="ditem" key={id}>
                <div className="n"><div className="pname">{i.name}</div><div className="muted">{i.unit}</div></div>
                <span className="stepper"><button aria-label="Decrease quantity" onClick={() => changeQty(id, -1)}><Icon name="minus" size={14} sw={2.2} /></button><span>{i.qty}</span><button aria-label="Increase quantity" onClick={() => changeQty(id, 1)}><Icon name="plus" size={14} sw={2.2} /></button></span>
                <b>₹{(i.qty * i.price).toFixed(0)}</b>
              </div>))}
            <div className="bill">
              <div><span>Items total</span><span>₹{total.toFixed(2)}</span></div>
              <div><span>Delivery charge</span><span>{del === 0 ? <b className="free">FREE</b> : "₹" + del}</span></div>
              {small > 0 && <div><span>Small cart charge</span><span>₹{small}</span></div>}
              <div className="tot"><span>Grand total</span><span>₹{(total + del + small).toFixed(2)}</span></div>
            </div>
            {fees && del > 0 && <p className="muted">Add ₹{(Number(fees.free_delivery_above) - total).toFixed(0)} more for free delivery</p>}
            <p style={{ margin: "16px 0 4px", fontWeight: 600 }}>Delivery address</p>
            <input placeholder="House no., building, street" value={addr} onChange={(e) => setAddr(e.target.value)} />
            <p className="muted">Payment: Cash on Delivery</p>
            {msg && <p className="merr">{msg}</p>}
          </>}
        </div>
        {!!entries.length && <div className="dfoot"><button disabled={busy} onClick={placeOrder}>{busy ? "Placing order..." : `Place order · ₹${(total + del + small).toFixed(0)}`}</button></div>}
      </aside>
    </div>
  );
}
