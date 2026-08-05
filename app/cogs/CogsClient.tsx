"use client";

import { useMemo, useState } from "react";
import Header from "../Header";
import Footer from "../Footer";

type CogsRecord = {
  id: number;
  customer_name: string;
  invoice_no: string;
  sales_date: string;
  month: string | null;
  cogs_subtotal: number;
  cogs_vat: number;
  total: number;
  updated_at: string;
};

const money = (value: number) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLabel = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).replaceAll(" ", "-");
const monthKey = (value: string) => value?.slice(0, 7) ?? "";

export default function CogsClient({ records }: { records: CogsRecord[] }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState("All");
  const [month, setMonth] = useState("All");
  const customers = useMemo(() => [...new Set(records.map((item) => item.customer_name))].sort(), [records]);
  const months = useMemo(() => [...new Set(records.map((item) => monthKey(item.sales_date)).filter(Boolean))].sort().reverse(), [records]);
  const filtered = useMemo(() => records.filter((item) =>
    (customer === "All" || item.customer_name === customer) &&
    (month === "All" || monthKey(item.sales_date) === month) &&
    (!search.trim() || item.invoice_no.toLowerCase().includes(search.trim().toLowerCase()) || item.customer_name.toLowerCase().includes(search.trim().toLowerCase()))
  ), [records, customer, month, search]);
  const totals = useMemo(() => filtered.reduce((sum, item) => ({
    subtotal: sum.subtotal + Number(item.cogs_subtotal || 0),
    vat: sum.vat + Number(item.cogs_vat || 0),
    total: sum.total + Number(item.total || 0),
  }), { subtotal: 0, vat: 0, total: 0 }), [filtered]);

  return (
    <div className="dashboard-shell cogs-shell" dir={lang === "ar" ? "rtl" : "ltr"}>
      <Header active="cogs" lang={lang} onToggleLang={() => setLang((value) => value === "en" ? "ar" : "en")} />
      <main className="cogs-page">
        <section className="page-hero">
          <div><p>FINANCIAL DATA</p><h1>Invoices COGS</h1><span>Confidential invoice costs imported from the Google Sheet.</span></div>
          <strong>{filtered.length} records</strong>
        </section>
        <section className="cogs-kpis">
          <article><span>COGS Sub Total</span><strong>{money(totals.subtotal)}</strong></article>
          <article><span>COGS VAT</span><strong>{money(totals.vat)}</strong></article>
          <article><span>Total Including VAT</span><strong>{money(totals.total)}</strong></article>
        </section>
        <section className="cogs-card cogs-toolbar">
          <label>Month<select value={month} onChange={(event) => setMonth(event.target.value)}><option value="All">All Months</option>{months.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Customer<select value={customer} onChange={(event) => setCustomer(event.target.value)}><option value="All">All Customers</option>{customers.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Invoice number or customer" /></label>
          <button type="button" onClick={() => { setMonth("All"); setCustomer("All"); setSearch(""); }}>Clear Filters</button>
        </section>
        <section className="cogs-card cogs-table-card">
          <div className="table-scroll"><table><thead><tr><th>Customer</th><th>Invoice No.</th><th>Sales Date</th><th>Month</th><th>COGS Sub Total</th><th>COGS VAT</th><th>Total</th></tr></thead>
          <tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.customer_name}</strong></td><td>{item.invoice_no}</td><td>{dateLabel(item.sales_date)}</td><td>{item.month || monthKey(item.sales_date)}</td><td>{money(item.cogs_subtotal)}</td><td>{money(item.cogs_vat)}</td><td><strong>{money(item.total)}</strong></td></tr>)}</tbody>
          <tfoot><tr><th colSpan={4}>Filtered Total</th><th>{money(totals.subtotal)}</th><th>{money(totals.vat)}</th><th>{money(totals.total)}</th></tr></tfoot></table></div>
          {!filtered.length && <div className="cogs-empty">No COGS records match the selected filters.</div>}
        </section>
      </main>
      <Footer lang={lang} />
    </div>
  );
}
