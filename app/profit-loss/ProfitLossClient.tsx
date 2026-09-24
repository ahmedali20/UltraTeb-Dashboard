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

  async function downloadFilteredPdf() {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const purple: [number, number, number] = [80, 35, 155];
    const navy: [number, number, number] = [24, 39, 64];
    const muted: [number, number, number] = [92, 106, 128];
    const pale: [number, number, number] = [246, 248, 252];
    const loadImage = (path: string) => fetch(path).then((response) => response.blob()).then((blob) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    })).catch(() => "");
    const [logo, footerImage] = await Promise.all([
      loadImage("/brand/ultra-teb-logo.png"),
      loadImage("/brand/ultra-teb-footer.png"),
    ]);
    const brandedPages = new Set<number>();
    const drawBranding = () => {
      const page = doc.getCurrentPageInfo().pageNumber;
      if (brandedPages.has(page)) return;
      brandedPages.add(page);
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      if (logo) doc.addImage(logo, "PNG", 14, 8, 17, 24, undefined, "FAST");
      doc.setDrawColor(...purple);
      doc.setLineWidth(0.8);
      doc.line(14, 35, pageWidth - 14, 35);
      if (footerImage) doc.addImage(footerImage, "PNG", 14, pageHeight - 14, pageWidth - 28, 6, undefined, "FAST");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...muted);
      doc.text(`Page ${page}`, pageWidth - 14, pageHeight - 5, { align: "right" });
    };
    drawBranding();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...navy);
    doc.text("Profit & Loss Report", 37, 17);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text("Revenue and COGS before VAT, after credit and debit note adjustments", 37, 23);
    const filterText = [
      `Year: ${year === "All" ? "All" : year}`,
      `Month: ${month === "All" ? "All" : month}`,
      `Customer: ${customer === "All" ? "All" : customer}`,
      `Sales Rep: ${salesRep === "All" ? "All" : salesRep}`,
      search.trim() ? `Search: ${search.trim()}` : "",
    ].filter(Boolean).join("  |  ");
    doc.text(filterText, 14, 42);

    autoTable(doc, {
      startY: 47,
      head: [["Invoice Revenue", "Credit Notes", "Debit Notes", "Net Revenue", "Net COGS", totals.profit >= 0 ? "Gross Profit" : "Gross Loss", "Margin"]],
      body: [[money(totals.invoiceRevenue), money(totals.creditRevenue), money(totals.debitRevenue), money(totals.revenue), money(totals.cogs), money(Math.abs(totals.profit)), `${margin.toFixed(2)}%`]],
      theme: "grid",
      headStyles: { fillColor: purple, textColor: 255, fontStyle: "bold", halign: "center" },
      bodyStyles: { fillColor: pale, textColor: navy, fontStyle: "bold", halign: "right" },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: 14, right: 14 },
    });
    let nextY = (doc as any).lastAutoTable.finalY + 7;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...navy); doc.text("Monthly Performance", 14, nextY);
    autoTable(doc, {
      startY: nextY + 3,
      head: [["Month", "Net Revenue", "Net COGS", "Gross Profit / Loss", "Margin"]],
      body: monthly.map((item) => [item.month, money(item.revenue), money(item.cogs), money(item.profit), `${item.revenue ? (item.profit / item.revenue * 100).toFixed(2) : "0.00"}%`]),
      theme: "striped",
      headStyles: { fillColor: navy, textColor: 255 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
      styles: { fontSize: 7.5, cellPadding: 2.4 },
      margin: { left: 14, right: 14 },
    });
    nextY = (doc as any).lastAutoTable.finalY + 8;
    if (nextY > 165) { doc.addPage(); drawBranding(); nextY = 43; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...navy); doc.text("Document Profitability", 14, nextY);
    autoTable(doc, {
      startY: nextY + 3,
      head: [["Type", "No.", "Date", "Customer", "Sales Rep", "Revenue", "COGS", "Profit / Loss"]],
      body: filtered.map((item) => [
        item.document_type === "INVOICE" ? "Invoice" : item.document_type === "CR_NOTE" ? "CR Note" : "DR Note",
        item.invoice_no, dateLabel(item.sales_date), item.customer_name, item.sales_rep || "Unassigned",
        money(item.revenue), money(item.cogs), money(item.profit),
      ]),
      theme: "striped",
      headStyles: { fillColor: navy, textColor: 255 },
      columnStyles: { 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right", fontStyle: "bold" } },
      styles: { fontSize: 7, cellPadding: 2.2, overflow: "linebreak" },
      margin: { left: 14, right: 14, top: 40, bottom: 17 },
      didDrawPage: drawBranding,
    });
    const clean = (value: string) => value.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
    const period = month !== "All" ? month : year !== "All" ? year : "All-Periods";
    const subject = customer !== "All" ? customer : salesRep !== "All" ? salesRep : "All";
    doc.save(`Profit-Loss-${clean(period)}-${clean(subject)}.pdf`);
  }

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
        <button className="profit-loss-download" type="button" onClick={downloadFilteredPdf} disabled={!filtered.length}>Download Filtered PDF</button>
        <button type="button" onClick={() => { setYear("All"); setMonth("All"); setCustomer("All"); setSalesRep("All"); setSearch(""); }}>Clear Filters</button>
      </section>
      <section className="profit-loss-grid">
        <article className="profit-loss-card"><h2>Monthly Performance</h2><div className="table-scroll"><table><thead><tr><th>Month</th><th>Net Revenue</th><th>Net COGS</th><th>Gross Profit / Loss</th><th>Margin</th></tr></thead><tbody>{monthly.map((item) => <tr key={item.month}><td><strong>{item.month}</strong></td><td>{money(item.revenue)}</td><td>{money(item.cogs)}</td><td className={item.profit >= 0 ? "profit-positive" : "profit-negative"}>{money(item.profit)}</td><td>{item.revenue ? (item.profit / item.revenue * 100).toFixed(2) : "0.00"}%</td></tr>)}</tbody></table></div></article>
        <article className="profit-loss-card profit-loss-detail"><h2>Document Profitability</h2><div className="table-scroll"><table><thead><tr><th>Type</th><th>No.</th><th>Date</th><th>Customer</th><th>Sales Rep</th><th>Revenue</th><th>COGS</th><th>Profit / Loss</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><span className={`cogs-type cogs-type--${item.document_type.toLowerCase()}`}>{item.document_type === "INVOICE" ? "Invoice" : item.document_type === "CR_NOTE" ? "CR Note" : "DR Note"}</span></td><td>{item.invoice_no}</td><td>{dateLabel(item.sales_date)}</td><td>{item.customer_name}</td><td>{item.sales_rep || "Unassigned"}</td><td>{money(item.revenue)}</td><td>{money(item.cogs)}</td><td className={item.profit >= 0 ? "profit-positive" : "profit-negative"}><strong>{money(item.profit)}</strong></td></tr>)}</tbody></table></div>{!filtered.length && <p className="cogs-empty">No documents match the selected filters.</p>}</article>
      </section>
    </main><Footer lang={lang} />
  </div>;
}
