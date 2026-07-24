"use client";

import { useMemo, useState } from "react";
import Header from "../Header";
import Footer from "../Footer";

type ReportSale = {
  id: string;
  invoice_no: string;
  sales_date: string;
  month: string;
  customer_name: string;
  sales_rep: string | null;
  sales_item_total: number;
  tax: number;
  total_sales: number;
};

function normalizeRep(value: string | null) {
  return value?.trim() || "Unassigned";
}

function money(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function ReportsClient({ sales }: { sales: ReportSale[] }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [month, setMonth] = useState("All");
  const [customer, setCustomer] = useState("All");
  const [salesRep, setSalesRep] = useState("All");
  const dir = lang === "ar" ? "rtl" : "ltr";

  const months = useMemo(
    () =>
      Array.from(new Set(sales.map((sale) => sale.month).filter(Boolean))).sort(
        (a, b) => b.localeCompare(a)
      ),
    [sales]
  );
  const customers = useMemo(
    () =>
      Array.from(
        new Set(sales.map((sale) => sale.customer_name).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
    [sales]
  );
  const reps = useMemo(
    () =>
      Array.from(new Set(sales.map((sale) => normalizeRep(sale.sales_rep)))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [sales]
  );

  const filtered = useMemo(
    () =>
      sales
        .filter(
          (sale) =>
            (!startDate || sale.sales_date >= startDate) &&
            (!endDate || sale.sales_date <= endDate) &&
            (month === "All" || sale.month === month) &&
            (customer === "All" || sale.customer_name === customer) &&
            (salesRep === "All" || normalizeRep(sale.sales_rep) === salesRep)
        )
        .sort((a, b) => {
          const date = a.sales_date.localeCompare(b.sales_date);
          return (
            date ||
            a.invoice_no.localeCompare(b.invoice_no, undefined, {
              numeric: true,
              sensitivity: "base",
            })
          );
        }),
    [sales, startDate, endDate, month, customer, salesRep]
  );

  const totals = filtered.reduce(
    (result, sale) => ({
      item: result.item + Number(sale.sales_item_total || 0),
      tax: result.tax + Number(sale.tax || 0),
      total: result.total + Number(sale.total_sales || 0),
    }),
    { item: 0, tax: 0, total: 0 }
  );

  function clearFilters() {
    setStartDate("");
    setEndDate("");
    setMonth("All");
    setCustomer("All");
    setSalesRep("All");
  }

  function exportCsv() {
    const rows = [
      [
        "Invoice No",
        "Sales Date",
        "Month",
        "Customer",
        "Sales Rep",
        "Sales Item Total",
        "TAX",
        "Total Sales",
      ],
      ...filtered.map((sale) => [
        sale.invoice_no,
        sale.sales_date,
        sale.month,
        sale.customer_name,
        normalizeRep(sale.sales_rep),
        sale.sales_item_total,
        sale.tax,
        sale.total_sales,
      ]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `ultra-teb-sales-report-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div dir={dir} className="report-page">
      <Header
        active="reports"
        lang={lang}
        onToggleLang={() => setLang(lang === "en" ? "ar" : "en")}
      />
      <main className="report-layout">
        <section className="report-heading">
          <div>
            <p>ULTRA TEB</p>
            <h1>Sales Report</h1>
            <span>Filter, review, print, or export your invoice performance.</span>
          </div>
          <div className="report-actions">
            <button type="button" onClick={exportCsv}>Export CSV</button>
            <button type="button" onClick={() => window.print()}>
              Print / Save PDF
            </button>
          </div>
        </section>

        <section className="report-filters">
          <label>
            From
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          <label>
            Month
            <select value={month} onChange={(event) => setMonth(event.target.value)}>
              <option value="All">All Months</option>
              {months.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>
            Customer
            <select value={customer} onChange={(event) => setCustomer(event.target.value)}>
              <option value="All">All Customers</option>
              {customers.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>
            Sales Rep
            <select value={salesRep} onChange={(event) => setSalesRep(event.target.value)}>
              <option value="All">All Sales Reps</option>
              {reps.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <button type="button" onClick={clearFilters}>Clear Filters</button>
        </section>

        <section className="report-kpis">
          <article><span>Total Invoices</span><strong>{filtered.length}</strong></article>
          <article><span>Item Total</span><strong>{money(totals.item)}</strong></article>
          <article><span>Total TAX</span><strong>{money(totals.tax)}</strong></article>
          <article className="report-kpi-primary"><span>Total Sales</span><strong>{money(totals.total)}</strong></article>
        </section>

        <section className="report-table-card">
          <div className="report-table-title">
            <div><p>DETAILED RECORDS</p><h2>Invoice Sales</h2></div>
            <strong>{filtered.length} records</strong>
          </div>
          <div className="report-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice No</th><th>Date</th><th>Month</th><th>Customer</th>
                  <th>Sales Rep</th><th>Item Total</th><th>TAX</th><th>Total Sales</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sale) => (
                  <tr key={sale.id}>
                    <td><strong>{sale.invoice_no}</strong></td>
                    <td>{sale.sales_date}</td><td>{sale.month}</td>
                    <td>{sale.customer_name || "-"}</td><td>{normalizeRep(sale.sales_rep)}</td>
                    <td>{money(Number(sale.sales_item_total || 0))}</td>
                    <td>{money(Number(sale.tax || 0))}</td>
                    <td><strong>{money(Number(sale.total_sales || 0))}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filtered.length && <div className="report-empty">No records match these filters.</div>}
        </section>
      </main>
      <Footer lang={lang} />
    </div>
  );
}
