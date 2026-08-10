"use client";

import { useMemo, useState } from "react";
import Header from "../Header";
import Footer from "../Footer";

type Cheque = { id: number; invoice_id: string; invoice_no: string; customer_name: string; collection_date: string; amount: number; reference_no: string | null; notes: string | null; cheque_status: string; cheque_status_date: string };
const workflow = ["IN_TREASURY", "UNDER_COLLECTION", "COLLECTED", "REFUSED", "RETURNED_TO_CUSTOMER"] as const;
const labels: Record<string, string> = { IN_TREASURY: "In Treasury", UNDER_COLLECTION: "Under Collection", COLLECTED: "Collected", REFUSED: "Refused", RETURNED_TO_CUSTOMER: "Returned to Customer" };
const money = (value: number) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLabel = (value: string | null) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).replaceAll(" ", "-") : "—";

export default function ChequesClient({ initialCheques, canEdit }: { initialCheques: Cheque[]; canEdit: boolean }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [cheques, setCheques] = useState(initialCheques);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { status: string; statusDate: string }>>({});
  const filtered = useMemo(() => cheques.filter((cheque) => (filter === "ALL" || cheque.cheque_status === filter) && (!search.trim() || `${cheque.customer_name} ${cheque.invoice_no} ${cheque.reference_no ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()))), [cheques, filter, search]);
  const totals = useMemo(() => workflow.reduce((result, status) => ({ ...result, [status]: cheques.filter((cheque) => cheque.cheque_status === status).reduce((sum, cheque) => sum + Number(cheque.amount || 0), 0) }), {} as Record<string, number>), [cheques]);

  function draft(cheque: Cheque) { return drafts[cheque.id] ?? { status: cheque.cheque_status, statusDate: new Date().toISOString().slice(0, 10) }; }
  function change(id: number, key: "status" | "statusDate", value: string) { setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? { status: cheques.find((item) => item.id === id)?.cheque_status ?? "IN_TREASURY", statusDate: new Date().toISOString().slice(0, 10) }), [key]: value } })); }
  async function save(cheque: Cheque) {
    const values = draft(cheque); setSavingId(cheque.id);
    try { const response = await fetch("/api/cheques", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: cheque.id, ...values }) }); const result = await response.json().catch(() => ({})); if (!response.ok) return alert(result.error || "Unable to update cheque."); setCheques((current) => current.map((item) => item.id === cheque.id ? result.data : item)); setDrafts((current) => { const next = { ...current }; delete next[cheque.id]; return next; }); } finally { setSavingId(null); }
  }

  return <div className="dashboard-shell" dir={lang === "ar" ? "rtl" : "ltr"}><Header active="cheques" lang={lang} onToggleLang={() => setLang((value) => value === "en" ? "ar" : "en")} /><main className="cheques-page">
    <section className="cheques-hero"><div><p>TREASURY CONTROL</p><h1>Cheques</h1><span>Track every cheque from receipt until collection or return.</span></div></section>
    <section className="cheque-kpis">{workflow.map((status) => <button key={status} className={filter === status ? "active" : ""} onClick={() => setFilter(filter === status ? "ALL" : status)}><span>{labels[status]}</span><strong>EGP {money(totals[status] ?? 0)}</strong><small>{cheques.filter((cheque) => cheque.cheque_status === status).length} cheques</small></button>)}</section>
    <section className="cheques-table-card"><div className="cheques-toolbar"><div><h2>Cheque Register</h2><span>{filtered.length} records</span></div><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="ALL">All Statuses</option>{workflow.map((status) => <option key={status} value={status}>{labels[status]}</option>)}</select><input placeholder="Search customer, invoice or cheque" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="table-scroll"><table><thead><tr><th>Received</th><th>Customer</th><th>Invoice</th><th>Cheque No.</th><th>Amount</th><th>Current Status</th><th>Status Date</th><th>Notes</th>{canEdit && <th>Update Status</th>}</tr></thead><tbody>{filtered.map((cheque) => { const values = draft(cheque); return <tr key={cheque.id}><td>{dateLabel(cheque.collection_date)}</td><td>{cheque.customer_name}</td><td><a href={`/sales/${cheque.invoice_id}`}>{cheque.invoice_no}</a></td><td><strong>{cheque.reference_no}</strong></td><td>EGP {money(cheque.amount)}</td><td><span className={`cheque-badge cheque-badge--${cheque.cheque_status.toLowerCase()}`}>{labels[cheque.cheque_status]}</span></td><td>{dateLabel(cheque.cheque_status_date)}</td><td>{cheque.notes || "—"}</td>{canEdit && <td><div className="cheque-update"><select value={values.status} onChange={(event) => change(cheque.id, "status", event.target.value)}>{workflow.map((status) => <option key={status} value={status}>{labels[status]}</option>)}</select><input type="date" value={values.statusDate} onChange={(event) => change(cheque.id, "statusDate", event.target.value)} /><button className="primary" disabled={savingId === cheque.id || values.status === cheque.cheque_status} onClick={() => save(cheque)}>{savingId === cheque.id ? "Saving…" : "Save"}</button></div></td>}</tr>; })}{!filtered.length && <tr><td colSpan={canEdit ? 9 : 8} className="collection-empty">No cheques found.</td></tr>}</tbody></table></div></section>
  </main><Footer lang={lang} /></div>;
}

