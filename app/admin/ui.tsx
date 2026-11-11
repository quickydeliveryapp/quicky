"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import "./ui.css";

// Shared building blocks for the admin pages: page header, search, tabs with counts, sortable table, side panel.

export function PageHead({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (<div className="ui-head">
    <div><h2 className="adm-title">{title}</h2>{sub && <p className="ui-sub-head">{sub}</p>}</div>
    {children && <div className="ui-head-actions">{children}</div>}
  </div>);
}

export function Search({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (<label className="ui-search">
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><line x1="20" y1="20" x2="16.5" y2="16.5" /></svg>
    <input type="search" value={value} placeholder={placeholder} aria-label={placeholder} onChange={(e) => onChange(e.target.value)} />
  </label>);
}

export function Tabs<K extends string>({ items, value, onChange }: { items: [K, string, number][]; value: K; onChange: (k: K) => void }) {
  return (<div className="ui-tabs" role="tablist">
    {items.map(([k, label, n]) => (
      <button key={k} role="tab" aria-selected={value === k} className={"ui-tab" + (value === k ? " on" : "")} onClick={() => onChange(k)}>
        {label}<i>{n}</i>
      </button>))}
  </div>);
}

export type Col<T> = {
  key: string; label: string; render: (row: T) => React.ReactNode;
  sort?: (a: T, b: T) => number; num?: boolean; hideSm?: boolean;
};

// Click a column title to sort. Rows come in the order the page gives them until a column is chosen.
export function DataTable<T>({ cols, rows, rowKey, onOpen, empty }: {
  cols: Col<T>[]; rows: T[]; rowKey: (r: T) => string; onOpen?: (r: T) => void; empty: React.ReactNode;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const list = useMemo(() => {
    const c = sort && cols.find((x) => x.key === sort.key);
    if (!sort || !c?.sort) return rows;
    return [...rows].sort((a, b) => c.sort!(a, b) * sort.dir);
  }, [rows, sort, cols]);
  const toggle = (k: string) => setSort((s) => (s?.key === k ? (s.dir === 1 ? { key: k, dir: -1 } : null) : { key: k, dir: 1 }));
  if (rows.length === 0) return <>{empty}</>;
  return (<div className="ui-table-wrap">
    <table className="ui-table">
      <thead><tr>
        {cols.map((c) => (
          <th key={c.key} scope="col" className={(c.num ? "num " : "") + (c.hideSm ? "hide-sm" : "")}
            aria-sort={sort?.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
            {c.sort
              ? <button className="ui-th" onClick={() => toggle(c.key)}>{c.label}<span aria-hidden="true">{sort?.key === c.key ? (sort.dir === 1 ? " ↑" : " ↓") : ""}</span></button>
              : c.label}
          </th>))}
      </tr></thead>
      <tbody>
        {list.map((r) => (
          <tr key={rowKey(r)} className={onOpen ? "click" : ""} onClick={onOpen ? () => onOpen(r) : undefined}>
            {cols.map((c) => <td key={c.key} className={(c.num ? "num " : "") + (c.hideSm ? "hide-sm" : "")}>{c.render(r)}</td>)}
          </tr>))}
      </tbody>
    </table>
  </div>);
}

// Buttons inside a table row must not also open the row's panel
export const Stop = ({ children }: { children: React.ReactNode }) => <span className="ui-stop" onClick={(e) => e.stopPropagation()}>{children}</span>;

// Details drawer that slides in from the right. Esc, the dark area and the close button all close it.
export function SidePanel({ title, sub, onClose, children, footer }: {
  title: string; sub?: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode;
}) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (<div className="ui-over" onClick={onClose}>
    <aside className="ui-panel" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
      <div className="ui-panel-head">
        <div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>
        <button ref={close} className="ui-x" aria-label="Close" onClick={onClose}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
        </button>
      </div>
      <div className="ui-panel-body">{children}</div>
      {footer && <div className="ui-panel-foot">{footer}</div>}
    </aside>
  </div>);
}

export const KV = ({ rows }: { rows: [string, React.ReactNode][] }) => (
  <dl className="ui-kv">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
);
