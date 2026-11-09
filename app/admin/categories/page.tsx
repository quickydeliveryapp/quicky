"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { friendly } from "@/lib/messages";
import "../admin.css";
import "./categories.css";

type Row = { name: string; icon: string; img: string; enabled: boolean; sort: number };

// A picked picture -> a small 200px square (kept inside the database, so no storage setup is needed)
function smallPicture(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) { reject(new Error("Choose a picture file (JPG, PNG or WebP).")); return; }
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(url);
      const S = 200, c = document.createElement("canvas");
      c.width = S; c.height = S;
      const ctx = c.getContext("2d");
      if (!ctx) { reject(new Error("This browser cannot resize pictures.")); return; }
      const r = Math.min(S / im.width, S / im.height), w = im.width * r, h = im.height * r;
      ctx.drawImage(im, (S - w) / 2, (S - h) / 2, w, h);
      const out = c.toDataURL("image/webp", 0.85);
      if (out.length > 120000) reject(new Error("That picture is too detailed. Try a simpler one.")); else resolve(out);
    };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read that picture.")); };
    im.src = url;
  });
}

const Pic = ({ r }: { r: Row }) => r.img
  // eslint-disable-next-line @next/next/no-img-element
  ? <img className="cat-pic" src={r.img} alt="" loading="lazy" />
  : <span className="adm-av cat-letter">{r.name.charAt(0)}</span>;

export default function AdminCategories() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  const [pic, setPic] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null);
  const say = (text: string, ok = true) => setToast({ text, ok });

  const load = useCallback(async () => {
    const [c, n] = await Promise.all([
      supabase.from("categories").select("name,icon,img,enabled,sort").order("sort"),
      supabase.rpc("admin_category_counts"),
    ]);
    if (c.error) { setRows([]); setToast({ text: friendly(c.error.message) + " (Has 019_categories.sql been run in Supabase?)", ok: false }); return; }
    setRows((c.data as Row[]) || []);
    const m: Record<string, number> = {};
    ((n.data as any[]) || []).forEach((x) => { m[x.out_category] = Number(x.out_count); });
    setCounts(m);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); }, [toast]);

  async function pick(file: File | undefined, then: (img: string) => void) {
    if (!file) return;
    try { then(await smallPicture(file)); } catch (e: any) { say(e.message, false); }
  }
  async function call(fn: string, args: Record<string, unknown>, ok: string, after?: () => void) {
    setBusy(true);
    const { error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) say(friendly(error.message), false);
    else { say(ok); after?.(); load(); }
  }
  const add = () => {
    if (name.trim().length < 2) { say("Enter the category name.", false); return; }
    call("admin_add_category", { p_name: name.trim(), p_img: pic, p_icon: "bag", p_rate: 0 },
      "Category added. Set its commission in the Commission section.", () => { setName(""); setPic(""); });
  };
  const remove = (r: Row) => {
    if (window.confirm(`Remove "${r.name}"? This cannot be undone.`)) call("admin_remove_category", { p_name: r.name }, "Category removed.");
  };

  if (rows === null) return <p className="adm-empty">Loading...</p>;
  return (<div className="adm">
    <p className="adm-hint">Categories customers see on the home page and shops pick from when adding a product. Hidden categories stay in the list but customers and shops do not see them.</p>
    {toast && <p className={"adm-toast" + (toast.ok ? "" : " bad")} role="status">{toast.text}</p>}

    <div className="adm-card">
      <span className="adm-name">Add a category</span>
      <div className="cat-add">
        <label className="cat-name"><span>Category name</span>
          <input type="text" maxLength={40} placeholder="e.g. Frozen Food" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <div className="cat-file-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {pic && <img className="cat-pic" src={pic} alt="Chosen picture" />}
          <label className="cat-file">{pic ? "Change picture" : "Choose picture"}
            <input type="file" accept="image/*" onChange={(e) => { pick(e.target.files?.[0], setPic); e.target.value = ""; }} /></label>
        </div>
        <button disabled={busy || name.trim().length < 2} onClick={add}>Add category</button>
      </div>
      <p className="adm-hint">The picture is optional. A square picture on a plain background looks best.</p>
    </div>

    {rows.length === 0 ? <p className="adm-empty">No categories yet.</p> : <div className="adm-grid">
      {rows.map((r) => { const n = counts[r.name.toLowerCase()] ?? 0; return (
        <div className="adm-card" key={r.name}>
          <div className="adm-head">
            <Pic r={r} />
            <div><span className="adm-name">{r.name}</span><span className="adm-sub">{n} product{n === 1 ? "" : "s"}</span></div>
            <span className={"adm-badge " + (r.enabled ? "ok" : "off")}>{r.enabled ? "Visible" : "Hidden"}</span>
          </div>
          <div className="adm-actions">
            <button className="alt" disabled={busy} onClick={() => call("admin_set_category", { p_name: r.name, p_enabled: !r.enabled }, r.enabled ? "Hidden from customers." : "Now visible to customers.")}>{r.enabled ? "Hide" : "Show"}</button>
            <label className="cat-file">Change picture
              <input type="file" accept="image/*" disabled={busy} onChange={(e) => { pick(e.target.files?.[0], (img) => call("admin_set_category", { p_name: r.name, p_img: img }, "Picture updated.")); e.target.value = ""; }} /></label>
            <button className="danger" disabled={busy || n > 0} title={n > 0 ? "Products still use this category. Hide it instead." : undefined} onClick={() => remove(r)}>Remove</button>
          </div>
          {n > 0 && <p className="adm-hint">Can&apos;t be removed while it has products. Hide it instead.</p>}
        </div>); })}
    </div>}
  </div>);
}
