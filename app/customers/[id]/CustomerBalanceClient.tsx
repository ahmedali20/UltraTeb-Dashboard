"use client";

import { useState } from "react";
import Header from "../../Header";
import Footer from "../../Footer";

type Customer = { customer_name: string; customer_official_name: string | null; sales_rep_name: string | null; payment_terms_days: number | null };
type Invoice = { id: string | number; invoice_no: string; sales_date: string; due_date: string | null; total_sales: number; expected_wht: number; collected_wht: number; customer_payments: number; remaining_wht: number; remaining_money: number };
const money = (value: number) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLabel = (value: string | null) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).replaceAll(" ", "-") : "—";

export default function CustomerBalanceClient({ customer, invoices }: { customer: Customer; invoices: Invoice[] }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const totals = invoices.reduce((sum, item) => ({ total: sum.total + Number(item.total_sales), payments: sum.payments + item.customer_payments, expectedWht: sum.expectedWht + item.expected_wht, collectedWht: sum.collectedWht + item.collected_wht, remainingMoney: sum.remainingMoney + item.remaining_money, remainingWht: sum.remainingWht + item.remaining_wht }), { total: 0, payments: 0, expectedWht: 0, collectedWht: 0, remainingMoney: 0, remainingWht: 0 });
  return <div className="dashboard-shell" dir={lang === "ar" ? "rtl" : "ltr"}>
    <Header active="customers" lang={lang} onToggleLang={() => setLang((value) => value === "en" ? "ar" : "en")} />
    <main className="invoice-details-page">
      <a className="invoice-details-back" href="/customers">← Back to Customers</a>
      <section className="invoice-details-heading"><div><p>CUSTOMER BALANCE</p><h1>{customer.customer_name}</h1><strong>{customer.customer_official_name || customer.customer_name}</strong><span>{customer.sales_rep_name || "No sales rep"} · {customer.payment_terms_days ?? 0} payment days</span></div></section>
      <section className="invoice-signal-grid">
        <article><span>Invoice Total</span><strong>EGP {money(totals.total)}</strong></article>
        <article><span>Customer Payments</span><strong>EGP {money(totals.payments)}</strong></article>
        <article><span>Remaining Money</span><strong>EGP {money(totals.remainingMoney)}</strong></article>
        <article><span>Expected WHT</span><strong>EGP {money(totals.expectedWht)}</strong></article>
        <article><span>Collected WHT</span><strong>EGP {money(totals.collectedWht)}</strong></article>
        <article><span>Remaining WHT</span><strong>EGP {money(totals.remainingWht)}</strong></article>
      </section>
      <section className="invoice-detail-card"><h2>Invoice Balances</h2><div className="table-scroll"><table><thead><tr><th>Invoice</th><th>Date</th><th>Due Date</th><th>Total</th><th>Payments</th><th>Expected WHT</th><th>Collected WHT</th><th>Remaining Money</th><th>Remaining WHT</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={String(invoice.id)}><td><a className="invoice-number-link" href={`/sales/${invoice.id}`}>{invoice.invoice_no}</a></td><td>{dateLabel(invoice.sales_date)}</td><td>{dateLabel(invoice.due_date)}</td><td>EGP {money(invoice.total_sales)}</td><td>EGP {money(invoice.customer_payments)}</td><td>EGP {money(invoice.expected_wht)}</td><td>EGP {money(invoice.collected_wht)}</td><td><strong>EGP {money(invoice.remaining_money)}</strong></td><td><strong>EGP {money(invoice.remaining_wht)}</strong></td></tr>)}{!invoices.length && <tr><td colSpan={9}>No invoices found for this customer.</td></tr>}</tbody></table></div></section>
    </main><Footer lang={lang} />
  </div>;
}
