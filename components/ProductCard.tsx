"use client";
import { changeQty, useStore } from "@/lib/store";

export type P = { id: string; name: string; unit: string | null; image_url: string | null; category: string | null; price: number };

export default function ProductCard({ p }: { p: P }) {
  const { cart } = useStore();
  const qty = cart[p.id]?.qty || 0;
  const info = { name: p.name, unit: p.unit || "", price: Number(p.price) };
  return (
    <div className="pcard">
      {p.image_url && <img className="pimg" src={p.image_url} alt="" loading="lazy" width={160} height={160} />}
      <div className="pname">{p.name}</div>
      <div className="muted">{p.unit}</div>
      <div className="prow">
        <span className="price">₹{p.price}</span>
        {qty
          ? <span className="stepper"><button aria-label="Decrease quantity" onClick={() => changeQty(p.id, -1)}>−</button><span>{qty}</span><button aria-label="Increase quantity" onClick={() => changeQty(p.id, 1, info)}>+</button></span>
          : <button className="add" onClick={() => changeQty(p.id, 1, info)}>Add</button>}
      </div>
    </div>
  );
}
