"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "../../Header";
import Footer from "../../Footer";

type Cheque = { id: number; customer_name: string; bank_name: string; cheque_no: string; collection_date: string; cheque_date: string; amount: number; cheque_status: string; cheque_status_date: string; notes: string | null };
type Allocation = { id: number; invoice_id: string; invoice_no: string; allocated_amount: number; cash_fraction: number; wht_deducted_amount: number; invoice?: { sales_date: string; due_date: string | null; customer_name: string; total_sales: number; sales_rep: string | null } };
const money = (value: number) => `EGP ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (value: string | null) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const workflow = ["IN_TREASURY", "UNDER_COLLECTION", "COLLECTED", "REFUSED", "RETURNED_TO_CUSTOMER"];
const labels: Record<string, string> = { IN_TREASURY: "In Treasury", UNDER_COLLECTION: "Under Collection", COLLECTED: "Collected", REFUSED: "Refused", RETURNED_TO_CUSTOMER: "Returned to Customer" };

export default function ChequeDetailsClient({ cheque, allocations, canEdit }: { cheque: Cheque; allocations: Allocation[]; canEdit: boolean }) {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [record, setRecord] = useState(cheque);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [details, setDetails] = useState({ chequeNo: cheque.cheque_no, bankName: cheque.bank_name || "", collectionDate: cheque.collection_date, chequeDate: cheque.cheque_date, amount: String(cheque.amount), notes: cheque.notes || "" });
  const [status, setStatus] = useState(cheque.cheque_status);
  const [statusDate, setStatusDate] = useState(new Date().toISOString().slice(0, 10));
  const allocatedTotal = allocations.reduce((sum, item) => sum + Number(item.allocated_amount || 0), 0);
  async function saveDetails() {
    setSaving(true);
    try {
      const response = await fetch("/api/cheques", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: record.id, action: "DETAILS", ...details, amount: Number(details.amount) }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return alert(result.error || "Unable to edit cheque.");
      setRecord(result.data); setEditing(false);
    } finally { setSaving(false); }
  }
  async function saveStatus() {
    setSaving(true);
    try {
      const response = await fetch("/api/cheques", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: record.id, status, statusDate }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return alert(result.error || "Unable to update cheque status.");
      setRecord(result.data);
    } finally { setSaving(false); }
  }
  async function deleteCheque() {
    if (!confirm(`Delete cheque ${record.cheque_no}? Its invoice allocations will also be removed.`)) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/cheques?id=${record.id}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return alert(result.error || "Unable to delete cheque.");
      router.push("/cheques"); router.refresh();
    } finally { setSaving(false); }
  }
  return <div className="dashboard-shell invoice-details-shell" dir={lang === "ar" ? "rtl" : "ltr"}>
    <Header active="cheques" lang={lang} onToggleLang={() => setLang((value) => value === "en" ? "ar" : "en")} />
    <main className="invoice-details-page">
      <a className="invoice-details-back" href="/cheques">← Back to Cheques</a>
      <section className="invoice-details-heading"><div><p>CHEQUE DETAILS</p><h1>Cheque {record.cheque_no}</h1><strong>{record.customer_name}</strong><span>{record.bank_name || "Bank not recorded"}</span></div><div className="invoice-status invoice-status--pending"><span>Status</span><strong>{labels[record.cheque_status] || record.cheque_status.replaceAll("_", " ")}</strong></div></section>
      {canEdit && <section className="invoice-detail-card"><div className="collections-heading"><div><p>CHEQUE CONTROL</p><h2>Edit and manage this cheque</h2></div><button type="button" onClick={() => setEditing((value) => !value)}>{editing ? "Cancel Edit" : "Edit Cheque"}</button></div>{editing && <div className="collection-form-grid"><label><span>Cheque No.</span><input value={details.chequeNo} onChange={(event) => setDetails({ ...details, chequeNo: event.target.value })} /></label><label><span>Bank Name</span><input value={details.bankName} onChange={(event) => setDetails({ ...details, bankName: event.target.value })} /></label><label><span>Collection Date</span><input type="date" value={details.collectionDate} onChange={(event) => setDetails({ ...details, collectionDate: event.target.value })} /></label><label><span>Cheque Date</span><input type="date" value={details.chequeDate} onChange={(event) => setDetails({ ...details, chequeDate: event.target.value })} /></label><label><span>Amount</span><input type="number" min={allocatedTotal} step="0.01" value={details.amount} onChange={(event) => setDetails({ ...details, amount: event.target.value })} /></label><label><span>Notes</span><input value={details.notes} onChange={(event) => setDetails({ ...details, notes: event.target.value })} /></label><div className="collection-form-actions"><button className="primary" disabled={saving} onClick={saveDetails}>{saving ? "Saving…" : "Save Cheque Details"}</button></div></div>}<div className="cheque-update"><select value={status} onChange={(event) => setStatus(event.target.value)}>{workflow.map((item) => <option key={item} value={item}>{labels[item]}</option>)}</select><input type="date" value={statusDate} onChange={(event) => setStatusDate(event.target.value)} /><button className="primary" disabled={saving || status === record.cheque_status} onClick={saveStatus}>Save Status</button><button className="danger" disabled={saving} onClick={deleteCheque}>Delete Cheque</button></div></section>}
      <div className="invoice-details-grid invoice-details-grid--top">
        <section className="invoice-detail-card"><h2>Cheque Information</h2><dl><div><dt>Customer</dt><dd>{record.customer_name}</dd></div><div><dt>Bank Name</dt><dd>{record.bank_name || "—"}</dd></div><div><dt>Cheque Number</dt><dd>{record.cheque_no}</dd></div><div><dt>Collection Date</dt><dd>{dateLabel(record.collection_date)}</dd></div><div><dt>Cheque Date</dt><dd>{dateLabel(record.cheque_date)}</dd></div><div><dt>Status Date</dt><dd>{dateLabel(record.cheque_status_date)}</dd></div></dl></section>
        <section className="invoice-detail-card"><h2>Allocation Summary</h2><p className="invoice-detail-note">The cheque is counted against invoice balances only when its status is Collected.</p><div className="invoice-signal-grid"><article><span>Cheque Amount</span><strong>{money(record.amount)}</strong></article><article><span>Allocated</span><strong>{money(allocatedTotal)}</strong></article><article><span>Unallocated</span><strong>{money(Number(record.amount) - allocatedTotal)}</strong></article><article><span>Invoices</span><strong>{allocations.length}</strong></article></div></section>
      </div>
      <section className="invoice-detail-card"><h2>Linked Invoices</h2><div className="invoice-collection-table"><table><thead><tr><th>Invoice No.</th><th>Invoice Date</th><th>Due Date</th><th>Sales Rep</th><th>Invoice Total</th><th>Cheque Allocation</th><th>Fraction</th><th>WHT Deducted</th></tr></thead><tbody>{[...allocations].sort((a, b) => (a.invoice?.due_date || "9999-12-31").localeCompare(b.invoice?.due_date || "9999-12-31")).map((allocation) => <tr key={allocation.id}><td><a className="invoice-number-link" href={`/sales/${allocation.invoice_id}`}>{allocation.invoice_no}</a></td><td>{dateLabel(allocation.invoice?.sales_date || null)}</td><td>{dateLabel(allocation.invoice?.due_date || null)}</td><td>{allocation.invoice?.sales_rep || "—"}</td><td>{money(allocation.invoice?.total_sales || 0)}</td><td><strong>{money(allocation.allocated_amount)}</strong></td><td>{Number(allocation.cash_fraction || 0) ? money(allocation.cash_fraction) : "—"}</td><td>{Number(allocation.wht_deducted_amount || 0) ? money(allocation.wht_deducted_amount) : "No"}</td></tr>)}</tbody></table></div></section>
      {record.notes && <section className="invoice-detail-card"><h2>Notes</h2><p className="invoice-detail-note">{record.notes}</p></section>}
    </main><Footer lang={lang} />
  </div>;
}
