"use client";

import { useMemo, useState } from "react";
import Header from "../Header";
import Footer from "../Footer";

type VatRecord = { id: string; invoice_no: string; sales_date: string; document_type: "INVOICE" | "CR_NOTE" | "DR_NOTE"; vat_customer_name: string; customer_trn: string; customer_address: string; sales_item_total: number; tax: number; total_sales: number; wht: number };
const cairoToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const monthStart = () => `${cairoToday().slice(0, 7)}-01`;
const money = (value: number) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLabel = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).replaceAll(" ", "-");

export default function VatSalesClient({ records }: { records: VatRecord[] }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(cairoToday());
  const [documentType, setDocumentType] = useState("All");
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => records.filter((record) => record.sales_date >= from && record.sales_date <= to && (documentType === "All" || record.document_type === documentType) && (!search.trim() || record.invoice_no.toLowerCase().includes(search.toLowerCase()) || record.vat_customer_name.toLowerCase().includes(search.toLowerCase()))), [records, from, to, documentType, search]);
  const totals = useMemo(() => filtered.reduce((sum, record) => {
    const sign = record.document_type === "CR_NOTE" ? -1 : 1;
    return { net: sum.net + sign * Math.abs(Number(record.sales_item_total || 0)), vat: sum.vat + sign * Math.abs(Number(record.tax || 0)), total: sum.total + sign * Math.abs(Number(record.total_sales || 0)), wht: sum.wht + Number(record.wht || 0) };
  }, { net: 0, vat: 0, total: 0, wht: 0 }), [filtered]);
  const missingTrn = filtered.filter((record) => !record.customer_trn).length;
  const missingAddress = filtered.filter((record) => !record.customer_address).length;

  return <div className="dashboard-shell vat-report-shell" dir={lang === "ar" ? "rtl" : "ltr"}>
    <Header active="vat" lang={lang} onToggleLang={() => setLang((value) => value === "en" ? "ar" : "en")} />
    <main className="vat-report-page">
      <section className="page-hero"><div><p>FINANCE & TAX</p><h1>VAT Sales Report</h1><span>Preview and export the Valid Invoices workbook in the approved VAT format.</span></div><button className="vat-export-button" disabled={!from || !to || from > to} onClick={() => { window.location.href = `/api/vat-report/sales?from=${from}&to=${to}`; }}>Download Excel</button></section>
      <section className="vat-report-filters"><label>From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label><label>Document Type<select value={documentType} onChange={(event) => setDocumentType(event.target.value)}><option value="All">All Documents</option><option value="INVOICE">Invoices</option><option value="CR_NOTE">Credit Notes</option><option value="DR_NOTE">Debit Notes</option></select></label><label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Invoice or customer" /></label></section>
      <section className="vat-report-kpis"><article><span>Records</span><strong>{filtered.length}</strong></article><article><span>Net Amount</span><strong>{money(totals.net)}</strong></article><article><span>Net VAT</span><strong>{money(totals.vat)}</strong></article><article><span>Grand Total</span><strong>{money(totals.total)}</strong></article></section>
      {(missingTrn > 0 || missingAddress > 0) && <section className="vat-quality-warning"><strong>Complete customer data before final submission</strong><span>{missingTrn} records missing a tax number · {missingAddress} records missing an address. Excel export remains available so you can review the gaps.</span><a href="/customers">Open Customers</a></section>}
      <section className="vat-report-table"><div className="table-scroll"><table><thead><tr><th>Document</th><th>Invoice No.</th><th>Customer</th><th>Tax Registration No.</th><th>Address</th><th>Date</th><th>Net Amount</th><th>VAT</th><th>WHT</th><th>Total</th></tr></thead><tbody>{filtered.map((record) => <tr key={record.id}><td>{record.document_type === "INVOICE" ? "Invoice" : record.document_type === "CR_NOTE" ? "CR Note" : "DR Note"}</td><td>{record.invoice_no}</td><td><strong>{record.vat_customer_name}</strong></td><td className={!record.customer_trn ? "vat-missing" : ""}>{record.customer_trn || "Missing"}</td><td className={!record.customer_address ? "vat-missing" : ""}>{record.customer_address || "Missing"}</td><td>{dateLabel(record.sales_date)}</td><td>{money(Math.abs(record.sales_item_total))}</td><td>{money(Math.abs(record.tax))}</td><td>{money(record.wht)}</td><td><strong>{money(Math.abs(record.total_sales))}</strong></td></tr>)}</tbody></table></div>{!filtered.length && <div className="vat-empty">No records in the selected period.</div>}</section>
    </main><Footer lang={lang} />
  </div>;
}
