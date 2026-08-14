"use client";

import { useMemo, useState } from "react";
import Header from "../../Header";
import Footer from "../../Footer";

type Customer = { customer_name: string; customer_official_name: string | null; sales_rep_name: string | null; payment_terms_days: number | null };
type Invoice = { id: string | number; invoice_no: string; sales_date: string; due_date: string | null; total_sales: number; expected_wht: number; collected_wht: number; customer_payments: number; remaining_wht: number; remaining_money: number };
type BalanceFilter = "ALL" | "OPEN" | "SETTLED" | "OVERDUE";

const money = (value: number) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLabel = (value: string | null) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).replaceAll(" ", "-") : "—";

export default function CustomerBalanceClient({ customer, invoices }: { customer: Customer; invoices: Invoice[] }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<BalanceFilter>("ALL");
  const today = new Date().toISOString().slice(0, 10);
  const totals = useMemo(() => invoices.reduce((sum, item) => ({ total: sum.total + Number(item.total_sales), payments: sum.payments + item.customer_payments, expectedWht: sum.expectedWht + item.expected_wht, collectedWht: sum.collectedWht + item.collected_wht, remainingMoney: sum.remainingMoney + item.remaining_money, remainingWht: sum.remainingWht + item.remaining_wht }), { total: 0, payments: 0, expectedWht: 0, collectedWht: 0, remainingMoney: 0, remainingWht: 0 }), [invoices]);
  const filtered = useMemo(() => invoices.filter((invoice) => {
    const isOpen = invoice.remaining_money > 0.005 || invoice.remaining_wht > 0.005;
    const isOverdue = isOpen && Boolean(invoice.due_date && invoice.due_date < today);
    const matchesFilter = filter === "ALL" || (filter === "OPEN" && isOpen) || (filter === "SETTLED" && !isOpen) || (filter === "OVERDUE" && isOverdue);
    return matchesFilter && (!search.trim() || String(invoice.invoice_no).toLowerCase().includes(search.trim().toLowerCase()));
  }), [invoices, filter, search, today]);

  return <div className="dashboard-shell" dir={lang === "ar" ? "rtl" : "ltr"}>
    <Header active="customers" lang={lang} onToggleLang={() => setLang((value) => value === "en" ? "ar" : "en")} />
    <main className="customer-balance-page">
      <a className="invoice-details-back" href="/customers">← Back to Customers</a>
      <section className="customer-balance-hero">
        <div><p>ACCOUNTS RECEIVABLE</p><h1>{customer.customer_name}</h1><strong>{customer.customer_official_name || customer.customer_name}</strong><span>{customer.sales_rep_name || "No sales representative"} · Payment terms: {customer.payment_terms_days ?? 0} days</span></div>
        <div className="customer-balance-hero-total"><span>Total Outstanding</span><strong>EGP {money(totals.remainingMoney + totals.remainingWht)}</strong><small>{invoices.length} invoices</small></div>
      </section>

      <section className="customer-balance-groups">
        <div className="customer-balance-group"><div className="customer-balance-group-title"><span>Customer Payments</span><small>Cash, transfer and collected cheques</small></div><div className="customer-balance-cards"><article><span>Invoice Total</span><strong>EGP {money(totals.total)}</strong></article><article><span>Payments Received</span><strong>EGP {money(totals.payments)}</strong></article><article className="is-outstanding"><span>Remaining Money</span><strong>EGP {money(totals.remainingMoney)}</strong></article></div></div>
        <div className="customer-balance-group"><div className="customer-balance-group-title"><span>Withholding Tax</span><small>Expected and collected certificates</small></div><div className="customer-balance-cards"><article><span>Expected WHT</span><strong>EGP {money(totals.expectedWht)}</strong></article><article><span>Collected WHT</span><strong>EGP {money(totals.collectedWht)}</strong></article><article className="is-wht"><span>Remaining WHT</span><strong>EGP {money(totals.remainingWht)}</strong></article></div></div>
      </section>

      <section className="customer-balance-table-card">
        <div className="customer-balance-toolbar"><div><h2>Invoice Balance Statement</h2><span>{filtered.length} of {invoices.length} invoices</span></div><div className="customer-balance-filters"><select value={filter} onChange={(event) => setFilter(event.target.value as BalanceFilter)}><option value="ALL">All Invoices</option><option value="OPEN">Open Balances</option><option value="OVERDUE">Overdue</option><option value="SETTLED">Fully Settled</option></select><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice number" /></div></div>
        <div className="table-scroll"><table className="customer-balance-table"><thead><tr><th>Invoice No.</th><th>Invoice Date</th><th>Due Date</th><th className="number">Invoice Total</th><th className="number">Payments</th><th className="number">Expected WHT</th><th className="number">Collected WHT</th><th className="number money-balance">Remaining Money</th><th className="number wht-balance">Remaining WHT</th><th>Status</th></tr></thead><tbody>{filtered.map((invoice) => { const open = invoice.remaining_money > 0.005 || invoice.remaining_wht > 0.005; const overdue = open && Boolean(invoice.due_date && invoice.due_date < today); return <tr key={String(invoice.id)}><td><a className="invoice-number-link" href={`/sales/${invoice.id}`}>{invoice.invoice_no}</a></td><td>{dateLabel(invoice.sales_date)}</td><td className={overdue ? "date-overdue" : ""}>{dateLabel(invoice.due_date)}</td><td className="number">{money(invoice.total_sales)}</td><td className="number">{money(invoice.customer_payments)}</td><td className="number">{money(invoice.expected_wht)}</td><td className="number">{money(invoice.collected_wht)}</td><td className="number money-balance"><strong>{money(invoice.remaining_money)}</strong></td><td className="number wht-balance"><strong>{money(invoice.remaining_wht)}</strong></td><td><span className={`balance-status ${overdue ? "overdue" : open ? "open" : "settled"}`}>{overdue ? "Overdue" : open ? "Open" : "Settled"}</span></td></tr>; })}{!filtered.length && <tr><td colSpan={10} className="collection-empty">No invoices match the selected filter.</td></tr>}</tbody><tfoot><tr><td colSpan={3}>Filtered Total</td><td className="number">{money(filtered.reduce((sum, item) => sum + Number(item.total_sales), 0))}</td><td className="number">{money(filtered.reduce((sum, item) => sum + item.customer_payments, 0))}</td><td className="number">{money(filtered.reduce((sum, item) => sum + item.expected_wht, 0))}</td><td className="number">{money(filtered.reduce((sum, item) => sum + item.collected_wht, 0))}</td><td className="number money-balance">{money(filtered.reduce((sum, item) => sum + item.remaining_money, 0))}</td><td className="number wht-balance">{money(filtered.reduce((sum, item) => sum + item.remaining_wht, 0))}</td><td /></tr></tfoot></table></div>
      </section>
    </main><Footer lang={lang} />
  </div>;
}
