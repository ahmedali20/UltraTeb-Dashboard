"use client";

import { useMemo, useState } from "react";
import Header from "../../Header";
import Footer from "../../Footer";

type Invoice = { id: string; invoice_no: string; sales_date: string; due_date: string | null; month: string; customer_name: string; sales_rep: string | null; sales_item_total: number; tax: number; total_sales: number };
type Note = { id: string; invoice_no: string; sales_date: string; document_type: "CR_NOTE" | "DR_NOTE"; note_reason: string | null; sales_item_total: number; tax: number; total_sales: number };
type Cogs = { id: number; invoice_no: string; document_type: "INVOICE" | "CR_NOTE" | "DR_NOTE"; cogs_subtotal: number; cogs_vat: number; total: number };
type Wht = { id: number; wht_amount: number; collected_amount: number; collection_date: string | null };

const money = (value: number) => `EGP ${Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (value: string | null) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function InvoiceDetailsClient({ invoice, notes, customer, wht, cogs, isAdmin }: { invoice: Invoice; notes: Note[]; customer: { customer_official_name: string | null; payment_terms_days: number | null } | null; wht: Wht[]; cogs: Cogs[]; isAdmin: boolean }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const noteTotals = useMemo(() => notes.reduce((sum, note) => {
    const sign = note.document_type === "CR_NOTE" ? -1 : 1;
    return sum + sign * Math.abs(Number(note.total_sales || 0));
  }, 0), [notes]);
  const adjustedSales = Number(invoice.total_sales || 0) + noteTotals;
  const cogsTotals = useMemo(() => cogs.reduce((sum, item) => {
    const sign = item.document_type === "CR_NOTE" ? -1 : 1;
    return { subtotal: sum.subtotal + sign * Number(item.cogs_subtotal || 0), vat: sum.vat + sign * Number(item.cogs_vat || 0), total: sum.total + sign * Number(item.total || 0) };
  }, { subtotal: 0, vat: 0, total: 0 }), [cogs]);
  const whtTotal = wht.reduce((sum, item) => sum + Number(item.wht_amount || 0), 0);
  const whtCollected = wht.reduce((sum, item) => sum + Number(item.collected_amount || 0), 0);
  const overdue = Boolean(invoice.due_date && new Date(`${invoice.due_date}T23:59:59`) < new Date());

  return (
    <div className="dashboard-shell invoice-details-shell" dir={lang === "ar" ? "rtl" : "ltr"}>
      <Header active="sales" lang={lang} onToggleLang={() => setLang((value) => value === "en" ? "ar" : "en")} />
      <main className="invoice-details-page">
        <a className="invoice-details-back" href="/sales#all-records">← Back to Invoices</a>
        <section className="invoice-details-heading">
          <div><p>INVOICE DETAILS</p><h1>Invoice {invoice.invoice_no}</h1><strong>{customer?.customer_official_name || invoice.customer_name}</strong><span>{invoice.sales_rep || "No Sales Representative"}</span></div>
          <div className={`invoice-status invoice-status--${overdue ? "overdue" : "pending"}`}><span>Status</span><strong>{overdue ? "Overdue" : "Pending"}</strong></div>
        </section>

        <div className="invoice-details-grid invoice-details-grid--top">
          <section className="invoice-detail-card"><h2>Stored Amounts</h2><dl>
            <div><dt>Issue Date</dt><dd>{dateLabel(invoice.sales_date)}</dd></div><div><dt>Due Date</dt><dd>{dateLabel(invoice.due_date)}</dd></div><div><dt>Payment Terms</dt><dd>{customer?.payment_terms_days ?? 0} days</dd></div>
            <div><dt>Subtotal (net)</dt><dd>{money(invoice.sales_item_total)}</dd></div><div><dt>VAT</dt><dd>{money(invoice.tax)}</dd></div><div className="invoice-detail-total"><dt>Invoice Total</dt><dd>{money(invoice.total_sales)}</dd></div>
          </dl></section>
          <section className="invoice-detail-card"><h2>Settlement Signals</h2><p className="invoice-detail-note">Customer payments are not currently recorded in the dashboard, so the stored invoice cannot be marked paid automatically.</p><div className="invoice-signal-grid"><article><span>Adjusted Sales</span><strong>{money(adjustedSales)}</strong></article><article><span>Recorded Collection</span><strong>{money(0)}</strong></article><article><span>Remaining</span><strong>{money(adjustedSales)}</strong></article></div></section>
        </div>

        <section className="invoice-detail-card"><h2>Invoice Summary</h2><div className="invoice-summary-row"><div><span>Description</span><strong>Sales invoice {invoice.invoice_no}</strong></div><div><span>Subtotal</span><strong>{money(invoice.sales_item_total)}</strong></div><div><span>VAT</span><strong>{money(invoice.tax)}</strong></div><div><span>Total</span><strong>{money(invoice.total_sales)}</strong></div></div><p className="invoice-detail-note">Product-level line items are not stored in the current dashboard.</p></section>

        <div className="invoice-details-grid">
          <section className="invoice-detail-card"><h2>Credit / Debit Notes</h2>{notes.length ? <div className="invoice-linked-list">{notes.map((note) => <article key={note.id}><div><span>{note.document_type === "CR_NOTE" ? "Credit Note" : "Debit Note"}</span><strong>{note.invoice_no}</strong><small>{note.note_reason || "No reason recorded"}</small></div><div><span>{dateLabel(note.sales_date)}</span><strong>{money(note.total_sales)}</strong></div></article>)}</div> : <p className="invoice-detail-empty">No credit or debit notes linked.</p>}</section>
          <section className="invoice-detail-card"><h2>Collected WHT</h2>{wht.length ? <><div className="invoice-signal-grid"><article><span>WHT Amount</span><strong>{money(whtTotal)}</strong></article><article><span>Collected</span><strong>{money(whtCollected)}</strong></article></div></> : <p className="invoice-detail-empty">No WHT collection linked.</p>}</section>
        </div>

        {isAdmin && <section className="invoice-detail-card invoice-detail-cogs"><h2>Confidential COGS</h2>{cogs.length ? <div className="invoice-signal-grid"><article><span>Net COGS Subtotal</span><strong>{money(cogsTotals.subtotal)}</strong></article><article><span>Net COGS VAT</span><strong>{money(cogsTotals.vat)}</strong></article><article><span>Net COGS Total</span><strong>{money(cogsTotals.total)}</strong></article><article><span>Gross Profit</span><strong>{money((Number(invoice.sales_item_total || 0) + notes.reduce((sum, note) => sum + (note.document_type === "CR_NOTE" ? -1 : 1) * Math.abs(Number(note.sales_item_total || 0)), 0)) - cogsTotals.subtotal)}</strong></article></div> : <p className="invoice-detail-empty">No COGS record is linked to this invoice.</p>}</section>}
      </main>
      <Footer lang={lang} />
    </div>
  );
}
