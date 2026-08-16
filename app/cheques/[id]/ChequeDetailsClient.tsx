"use client";

import { useState } from "react";
import Header from "../../Header";
import Footer from "../../Footer";

type Cheque = { id: number; customer_name: string; bank_name: string; cheque_no: string; collection_date: string; cheque_date: string; amount: number; cheque_status: string; cheque_status_date: string; notes: string | null };
type Allocation = { id: number; invoice_id: string; invoice_no: string; allocated_amount: number; wht_deducted_amount: number; invoice?: { sales_date: string; due_date: string | null; customer_name: string; total_sales: number; sales_rep: string | null } };
const money = (value: number) => `EGP ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (value: string | null) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function ChequeDetailsClient({ cheque, allocations }: { cheque: Cheque; allocations: Allocation[] }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const allocatedTotal = allocations.reduce((sum, item) => sum + Number(item.allocated_amount || 0), 0);
  return <div className="dashboard-shell invoice-details-shell" dir={lang === "ar" ? "rtl" : "ltr"}>
    <Header active="cheques" lang={lang} onToggleLang={() => setLang((value) => value === "en" ? "ar" : "en")} />
    <main className="invoice-details-page">
      <a className="invoice-details-back" href="/cheques">← Back to Cheques</a>
      <section className="invoice-details-heading"><div><p>CHEQUE DETAILS</p><h1>Cheque {cheque.cheque_no}</h1><strong>{cheque.customer_name}</strong><span>{cheque.bank_name || "Bank not recorded"}</span></div><div className="invoice-status invoice-status--pending"><span>Status</span><strong>{cheque.cheque_status.replaceAll("_", " ")}</strong></div></section>
      <div className="invoice-details-grid invoice-details-grid--top">
        <section className="invoice-detail-card"><h2>Cheque Information</h2><dl><div><dt>Customer</dt><dd>{cheque.customer_name}</dd></div><div><dt>Bank Name</dt><dd>{cheque.bank_name || "—"}</dd></div><div><dt>Cheque Number</dt><dd>{cheque.cheque_no}</dd></div><div><dt>Collection Date</dt><dd>{dateLabel(cheque.collection_date)}</dd></div><div><dt>Cheque Date</dt><dd>{dateLabel(cheque.cheque_date)}</dd></div><div><dt>Status Date</dt><dd>{dateLabel(cheque.cheque_status_date)}</dd></div></dl></section>
        <section className="invoice-detail-card"><h2>Allocation Summary</h2><p className="invoice-detail-note">The cheque is counted against invoice balances only when its status is Collected.</p><div className="invoice-signal-grid"><article><span>Cheque Amount</span><strong>{money(cheque.amount)}</strong></article><article><span>Allocated</span><strong>{money(allocatedTotal)}</strong></article><article><span>Unallocated</span><strong>{money(Number(cheque.amount) - allocatedTotal)}</strong></article><article><span>Invoices</span><strong>{allocations.length}</strong></article></div></section>
      </div>
      <section className="invoice-detail-card"><h2>Linked Invoices</h2><div className="invoice-collection-table"><table><thead><tr><th>Invoice No.</th><th>Invoice Date</th><th>Due Date</th><th>Sales Rep</th><th>Invoice Total</th><th>Cheque Allocation</th><th>WHT Deducted</th></tr></thead><tbody>{[...allocations].sort((a, b) => (a.invoice?.due_date || "9999-12-31").localeCompare(b.invoice?.due_date || "9999-12-31")).map((allocation) => <tr key={allocation.id}><td><a className="invoice-number-link" href={`/sales/${allocation.invoice_id}`}>{allocation.invoice_no}</a></td><td>{dateLabel(allocation.invoice?.sales_date || null)}</td><td>{dateLabel(allocation.invoice?.due_date || null)}</td><td>{allocation.invoice?.sales_rep || "—"}</td><td>{money(allocation.invoice?.total_sales || 0)}</td><td><strong>{money(allocation.allocated_amount)}</strong></td><td>{Number(allocation.wht_deducted_amount || 0) ? money(allocation.wht_deducted_amount) : "No"}</td></tr>)}</tbody></table></div></section>
      {cheque.notes && <section className="invoice-detail-card"><h2>Notes</h2><p className="invoice-detail-note">{cheque.notes}</p></section>}
    </main><Footer lang={lang} />
  </div>;
}
