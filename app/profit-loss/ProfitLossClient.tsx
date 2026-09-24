"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "../Header";
import Footer from "../Footer";

type DocumentType = "INVOICE" | "CR_NOTE" | "DR_NOTE";
type Sale = { id: string; invoice_no: string; sales_date: string; month: string; customer_name: string; sales_rep: string | null; sales_item_total: number; document_type: DocumentType; original_invoice_no: string | null };
type Cogs = { id: number; invoice_no: string; document_type: DocumentType; cogs_subtotal: number };
type Row = Sale & { revenue: number; cogs: number; profit: number };

const money = (value: number) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLabel = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).replaceAll(" ", "-");
const key = (type: DocumentType, number: string) => `${type}:${String(number).trim()}`;
const signedCogs = (type: DocumentType, value: number) => type === "CR_NOTE" ? -Math.abs(value) : Math.abs(value);

export default function ProfitLossClient({ sales, cogs }: { sales: Sale[]; cogs: Cogs[] }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [year, setYear] = useState("All");
  const [month, setMonth] = useState("All");
  const [customer, setCustomer] = useState("All");
  const [salesRep, setSalesRep] = useState("All");
  const [search, setSearch] = useState("");
  const cogsMap = useMemo(() => new Map(cogs.map((item) => [key(item.document_type, item.invoice_no), Number(item.cogs_subtotal || 0)])), [cogs]);
  const rows = useMemo<Row[]>(() => sales.map((sale) => {
    const revenue = Number(sale.sales_item_total || 0);
    const cost = signedCogs(sale.document_type, cogsMap.get(key(sale.document_type, sale.invoice_no)) ?? 0);
    return { ...sale, revenue, cogs: cost, profit: revenue - cost };
  }), [sales, cogsMap]);

  const years = useMemo(() => [...new Set(rows.map((item) => item.sales_date.slice(0, 4)))].filter(Boolean).sort().reverse(), [rows]);
  const months = useMemo(() => [...new Set(rows.filter((item) => year === "All" || item.sales_date.startsWith(`${year}-`)).map((item) => item.sales_date.slice(0, 7)))].filter(Boolean).sort().reverse(), [rows, year]);
  const customers = useMemo(() => [...new Set(rows.filter((item) => (year === "All" || item.sales_date.startsWith(`${year}-`)) && (month === "All" || item.sales_date.startsWith(month)) && (salesRep === "All" || (item.sales_rep || "Unassigned") === salesRep)).map((item) => item.customer_name))].sort(), [rows, year, month, salesRep]);
  const reps = useMemo(() => [...new Set(rows.filter((item) => (year === "All" || item.sales_date.startsWith(`${year}-`)) && (month === "All" || item.sales_date.startsWith(month)) && (customer === "All" || item.customer_name === customer)).map((item) => item.sales_rep || "Unassigned"))].sort(), [rows, year, month, customer]);
  useEffect(() => { if (month !== "All" && !months.includes(month)) setMonth("All"); }, [month, months]);
  useEffect(() => { if (customer !== "All" && !customers.includes(customer)) setCustomer("All"); }, [customer, customers]);
  useEffect(() => { if (salesRep !== "All" && !reps.includes(salesRep)) setSalesRep("All"); }, [salesRep, reps]);

  const filtered = useMemo(() => rows.filter((item) =>
    (year === "All" || item.sales_date.startsWith(`${year}-`)) &&
    (month === "All" || item.sales_date.startsWith(month)) &&
    (customer === "All" || item.customer_name === customer) &&
    (salesRep === "All" || (item.sales_rep || "Unassigned") === salesRep) &&
    (!search.trim() || `${item.invoice_no} ${item.original_invoice_no ?? ""} ${item.customer_name}`.toLowerCase().includes(search.trim().toLowerCase()))
  ), [rows, year, month, customer, salesRep, search]);

  const totals = useMemo(() => filtered.reduce((sum, item) => ({
    invoiceRevenue: sum.invoiceRevenue + (item.document_type === "INVOICE" ? item.revenue : 0),
    creditRevenue: sum.creditRevenue + (item.document_type === "CR_NOTE" ? Math.abs(item.revenue) : 0),
    debitRevenue: sum.debitRevenue + (item.document_type === "DR_NOTE" ? item.revenue : 0),
    revenue: sum.revenue + item.revenue,
    cogs: sum.cogs + item.cogs,
    profit: sum.profit + item.profit,
  }), { invoiceRevenue: 0, creditRevenue: 0, debitRevenue: 0, revenue: 0, cogs: 0, profit: 0 }), [filtered]);
  const margin = totals.revenue ? totals.profit / totals.revenue * 100 : 0;
  const monthly = useMemo(() => Array.from(filtered.reduce((map, item) => {
    const monthKey = item.sales_date.slice(0, 7);
    const value = map.get(monthKey) ?? { month: monthKey, revenue: 0, cogs: 0, profit: 0 };
    value.revenue += item.revenue; value.cogs += item.cogs; value.profit += item.profit; map.set(monthKey, value); return map;
  }, new Map<string, { month: string; revenue: number; cogs: number; profit: number }>()).values()).sort((a, b) => b.month.localeCompare(a.month)), [filtered]);

  return <div className="dashboard-shell" dir={lang === "ar" ? "rtl" : "ltr"}>
    <Header active="profitLoss" lang={lang} onToggleLang={() => setLang((value) => value === "en" ? "ar" : "en")} />
    <main className="profit-loss-page">
      <section className="page-hero"><div><p>FINANCIAL PERFORMANCE</p><h1>Profit &amp; Loss</h1><span>Revenue and COGS before VAT, after credit and debit note adjustments.</span></div><strong>{filtered.length} documents</strong></section>
      <section className="profit-loss-kpis">
        <article><span>Invoice Revenue</span><strong>{money(totals.invoiceRevenue)}</strong><small>Before VAT</small></article>
        <article><span>Credit Notes (−)</span><strong>{money(totals.creditRevenue)}</strong><small>Revenue reduction</small></article>
        <article><span>Debit Notes (+)</span><strong>{money(totals.debitRevenue)}</strong><small>Revenue addition</small></article>
        <article className="profit-loss-kpi--net"><span>Net Revenue</span><strong>{money(totals.revenue)}</strong><small>Invoice − CR + DR</small></article>
        <article><span>Net COGS</span><strong>{money(totals.cogs)}</strong><small>Invoice − CR + DR</small></article>
        <article className={totals.profit >= 0 ? "profit-loss-kpi--profit" : "profit-loss-kpi--loss"}><span>{totals.profit >= 0 ? "Gross Profit" : "Gross Loss"}</span><strong>{money(Math.abs(totals.profit))}</strong><small>Margin {margin.toFixed(2)}%</small></article>
      </section>
      <section className="profit-loss-card profit-loss-toolbar">
        <label>Year<select value={year} onChange={(event) => { setYear(event.target.value); setMonth("All"); }}><option value="All">All Years</option>{years.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Month<select value={month} onChange={(event) => setMonth(event.target.value)}><option value="All">All Months</option>{months.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Customer<select value={customer} onChange={(event) => setCustomer(event.target.value)}><option value="All">All Customers</option>{customers.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Sales Rep<select value={salesRep} onChange={(event) => setSalesRep(event.target.value)}><option value="All">All Reps</option>{reps.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Search<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Invoice or customer" /></label>
        <button type="button" onClick={() => { setYear("All"); setMonth("All"); setCustomer("All"); setSalesRep("All"); setSearch(""); }}>Clear Filters</button>
      </section>
      <section className="profit-loss-grid">
        <article className="profit-loss-card"><h2>Monthly Performance</h2><div className="table-scroll"><table><thead><tr><th>Month</th><th>Net Revenue</th><th>Net COGS</th><th>Gross Profit / Loss</th><th>Margin</th></tr></thead><tbody>{monthly.map((item) => <tr key={item.month}><td><strong>{item.month}</strong></td><td>{money(item.revenue)}</td><td>{money(item.cogs)}</td><td className={item.profit >= 0 ? "profit-positive" : "profit-negative"}>{money(item.profit)}</td><td>{item.revenue ? (item.profit / item.revenue * 100).toFixed(2) : "0.00"}%</td></tr>)}</tbody></table></div></article>
        <article className="profit-loss-card profit-loss-detail"><h2>Document Profitability</h2><div className="table-scroll"><table><thead><tr><th>Type</th><th>No.</th><th>Date</th><th>Customer</th><th>Sales Rep</th><th>Revenue</th><th>COGS</th><th>Profit / Loss</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><span className={`cogs-type cogs-type--${item.document_type.toLowerCase()}`}>{item.document_type === "INVOICE" ? "Invoice" : item.document_type === "CR_NOTE" ? "CR Note" : "DR Note"}</span></td><td>{item.invoice_no}</td><td>{dateLabel(item.sales_date)}</td><td>{item.customer_name}</td><td>{item.sales_rep || "Unassigned"}</td><td>{money(item.revenue)}</td><td>{money(item.cogs)}</td><td className={item.profit >= 0 ? "profit-positive" : "profit-negative"}><strong>{money(item.profit)}</strong></td></tr>)}</tbody></table></div>{!filtered.length && <p className="cogs-empty">No documents match the selected filters.</p>}</article>
      </section>
    </main><Footer lang={lang} />
  </div>;
}
