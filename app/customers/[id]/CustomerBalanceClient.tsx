"use client";

import { useMemo, useState } from "react";
import Header from "../../Header";
import Footer from "../../Footer";

type Customer = { customer_name: string; customer_official_name: string | null; sales_rep_name: string | null; payment_terms_days: number | null };
type Invoice = { id: string | number; invoice_no: string; sales_date: string; due_date: string | null; total_sales: number; expected_wht: number; collected_wht: number; customer_payments: number; cash_fraction: number; remaining_wht: number; remaining_money: number };
type BalanceFilter = "ALL" | "OPEN" | "PAID" | "WHT_PENDING" | "OVERDUE";

const money = (value: number) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLabel = (value: string | null) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).replaceAll(" ", "-") : "—";

export default function CustomerBalanceClient({ customer, invoices }: { customer: Customer; invoices: Invoice[] }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<BalanceFilter>("ALL");
  const today = new Date().toISOString().slice(0, 10);
  const totals = useMemo(() => invoices.reduce((sum, item) => ({ total: sum.total + Number(item.total_sales), payments: sum.payments + item.customer_payments, fractions: sum.fractions + item.cash_fraction, expectedWht: sum.expectedWht + item.expected_wht, collectedWht: sum.collectedWht + item.collected_wht, remainingMoney: sum.remainingMoney + item.remaining_money, remainingWht: sum.remainingWht + item.remaining_wht }), { total: 0, payments: 0, fractions: 0, expectedWht: 0, collectedWht: 0, remainingMoney: 0, remainingWht: 0 }), [invoices]);
  const filtered = useMemo(() => invoices.filter((invoice) => {
    const moneyOpen = invoice.remaining_money > 0.005;
    const whtPending = !moneyOpen && invoice.remaining_wht > 0.005;
    const isOverdue = moneyOpen && Boolean(invoice.due_date && invoice.due_date < today);
    const matchesFilter = filter === "ALL" || (filter === "OPEN" && moneyOpen) || (filter === "PAID" && !moneyOpen) || (filter === "WHT_PENDING" && whtPending) || (filter === "OVERDUE" && isOverdue);
    return matchesFilter && (!search.trim() || String(invoice.invoice_no).toLowerCase().includes(search.trim().toLowerCase()));
  }), [invoices, filter, search, today]);

  async function downloadPdf() {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const purple: [number, number, number] = [80, 35, 155];
    const loadImage = (path: string) => fetch(path).then((response) => response.blob()).then((blob) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); })).catch(() => "");
    const [logo, header, footer] = await Promise.all([loadImage("/brand/ultra-teb-logo.png"), loadImage("/brand/ultra-teb-header.png"), loadImage("/brand/ultra-teb-footer.png")]);
    const brandedPages = new Set<number>();
    function drawBrand() {
      const page = doc.getCurrentPageInfo().pageNumber;
      if (brandedPages.has(page)) return;
      brandedPages.add(page);
      const width = doc.internal.pageSize.getWidth();
      const height = doc.internal.pageSize.getHeight();
      if (header) doc.addImage(header, "PNG", 14, 8, 64, 19, undefined, "FAST");
      if (logo) { doc.saveGraphicsState(); doc.setGState(new (doc as any).GState({ opacity: 0.025 })); doc.addImage(logo, "PNG", 78, 104, 54, 78, undefined, "FAST"); doc.restoreGraphicsState(); }
      doc.setDrawColor(...purple); doc.setLineWidth(0.65); doc.line(15, 35, width - 15, 35);
      if (footer) doc.addImage(footer, "PNG", 16, height - 39, 178, 36.4, undefined, "FAST");
      doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(90, 90, 105); doc.text(`Page ${page}`, width / 2, height - 6, { align: "center" });
    }
    drawBrand();
    const pdfCustomerName = /[^\u0000-\u024f]/.test(customer.customer_official_name || "") ? customer.customer_name : (customer.customer_official_name || customer.customer_name);
    const reportTotals = filtered.reduce((sum, item) => ({ total: sum.total + Number(item.total_sales), payments: sum.payments + item.customer_payments, fractions: sum.fractions + item.cash_fraction, wht: sum.wht + item.expected_wht, collectedWht: sum.collectedWht + item.collected_wht, moneyDue: sum.moneyDue + item.remaining_money, whtDue: sum.whtDue + item.remaining_wht }), { total: 0, payments: 0, fractions: 0, wht: 0, collectedWht: 0, moneyDue: 0, whtDue: 0 });
    doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.setTextColor(...purple); doc.text("CUSTOMER BALANCE STATEMENT", 15, 48);
    doc.setFontSize(11); doc.setTextColor(35, 40, 52); doc.text(pdfCustomerName || "Customer", 15, 57);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(95, 100, 112); doc.text(`Statement date: ${new Date().toLocaleDateString("en-GB")}`, 195, 48, { align: "right" });
    doc.text(`${filtered.length} invoice${filtered.length === 1 ? "" : "s"} shown`, 195, 57, { align: "right" });
    const cards = [["INVOICE TOTAL", reportTotals.total], ["PAYMENTS", reportTotals.payments], ["FRACTIONS", reportTotals.fractions], ["WHT DEDUCTED", reportTotals.wht], ["MONEY DUE", reportTotals.moneyDue], ["WHT DUE", reportTotals.whtDue]] as const;
    cards.forEach(([label, value], index) => {
      const x = 15 + (index % 3) * 61; const y = 64 + Math.floor(index / 3) * 16; const emphasized = index >= 4;
      doc.setFillColor(emphasized ? 245 : 249, emphasized ? 240 : 249, emphasized ? 252 : 251); doc.setDrawColor(emphasized ? 190 : 224, emphasized ? 168 : 224, emphasized ? 225 : 230); doc.roundedRect(x, y, 57, 12.5, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "normal"); doc.setFontSize(6.2); doc.setTextColor(100, 104, 116); doc.text(label, x + 3, y + 4.2);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(emphasized ? purple[0] : 35, emphasized ? purple[1] : 40, emphasized ? purple[2] : 52); doc.text(`EGP ${money(value)}`, x + 3, y + 9.5);
    });
    autoTable(doc, {
      startY: 100,
      head: [["Invoice", "Invoice / Due Date", "Invoice Total", "Payments / Fraction", "WHT Deducted / Collected", "Money Due", "WHT Due", "Status"]],
      body: filtered.map((invoice) => { const moneyOpen = invoice.remaining_money > 0.005; const whtPending = !moneyOpen && invoice.remaining_wht > 0.005; const overdue = moneyOpen && Boolean(invoice.due_date && invoice.due_date < today); return [invoice.invoice_no, `${dateLabel(invoice.sales_date)}\n${dateLabel(invoice.due_date)}`, money(invoice.total_sales), `${money(invoice.customer_payments)}\n${money(invoice.cash_fraction)}`, `${money(invoice.expected_wht)}\n${money(invoice.collected_wht)}`, money(invoice.remaining_money), money(invoice.remaining_wht), overdue ? "OVERDUE" : moneyOpen ? "OPEN" : whtPending ? "WHT PENDING" : "PAID"]; }),
      foot: [["TOTAL", "", money(reportTotals.total), `${money(reportTotals.payments)}\n${money(reportTotals.fractions)}`, `${money(reportTotals.wht)}\n${money(reportTotals.collectedWht)}`, money(reportTotals.moneyDue), money(reportTotals.whtDue), ""]],
      margin: { top: 42, right: 15, bottom: 43, left: 15 },
      styles: { font: "helvetica", fontSize: 7, cellPadding: 2.1, lineColor: [218, 221, 228], lineWidth: 0.12, textColor: [35, 40, 52], overflow: "linebreak", valign: "middle" },
      headStyles: { fillColor: purple, textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
      footStyles: { fillColor: [239, 234, 247], textColor: purple, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 249, 251] },
      columnStyles: { 0: { cellWidth: 17, fontStyle: "bold" }, 1: { cellWidth: 25 }, 2: { cellWidth: 26, halign: "right" }, 3: { cellWidth: 28, halign: "right" }, 4: { cellWidth: 30, halign: "right" }, 5: { cellWidth: 22, halign: "right", fontStyle: "bold" }, 6: { cellWidth: 20, halign: "right", fontStyle: "bold" }, 7: { cellWidth: 17, halign: "center", fontStyle: "bold", fontSize: 6.2 } },
      didDrawPage: drawBrand,
    });
    const safeName = (customer.customer_name || "customer").replace(/[^a-zA-Z0-9\u0600-\u06FF]+/g, "-").replace(/^-|-$/g, "");
    doc.save(`Invoice-Balance-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return <div className="dashboard-shell" dir={lang === "ar" ? "rtl" : "ltr"}>
    <Header active="customers" lang={lang} onToggleLang={() => setLang((value) => value === "en" ? "ar" : "en")} />
    <main className="customer-balance-page">
      <a className="invoice-details-back" href="/customers">← Back to Customers</a>
      <section className="customer-balance-hero">
        <div><p>ACCOUNTS RECEIVABLE</p><h1>{customer.customer_name}</h1><strong>{customer.customer_official_name || customer.customer_name}</strong><span>{customer.sales_rep_name || "No sales representative"} · Payment terms: {customer.payment_terms_days ?? 0} days</span></div>
        <div className="customer-balance-hero-total"><span>Total Outstanding</span><strong>EGP {money(totals.remainingMoney + totals.remainingWht)}</strong><small>{invoices.length} invoices</small></div>
      </section>

      <section className="customer-balance-groups">
        <div className="customer-balance-group"><div className="customer-balance-group-title"><span>Customer Payments</span><small>Cash, transfer and collected cheques</small></div><div className="customer-balance-cards"><article><span>Invoice Total</span><strong>EGP {money(totals.total)}</strong></article><article><span>Payments Received</span><strong>EGP {money(totals.payments)}</strong></article><article><span>Cash Fraction Write-offs</span><strong>EGP {money(totals.fractions)}</strong></article><article className="is-outstanding"><span>Remaining Money</span><strong>EGP {money(totals.remainingMoney)}</strong></article></div></div>
        <div className="customer-balance-group"><div className="customer-balance-group-title"><span>Withholding Tax</span><small>Expected and collected certificates</small></div><div className="customer-balance-cards"><article><span>Expected WHT</span><strong>EGP {money(totals.expectedWht)}</strong></article><article><span>Collected WHT</span><strong>EGP {money(totals.collectedWht)}</strong></article><article className="is-wht"><span>Remaining WHT</span><strong>EGP {money(totals.remainingWht)}</strong></article></div></div>
      </section>

      <section className="customer-balance-table-card">
        <div className="customer-balance-toolbar"><div><h2>Invoice Balance Statement</h2><span>{filtered.length} of {invoices.length} invoices</span></div><div className="customer-balance-actions"><div className="customer-balance-filters"><select value={filter} onChange={(event) => setFilter(event.target.value as BalanceFilter)}><option value="ALL">All Invoices</option><option value="OPEN">Open Money Balances</option><option value="OVERDUE">Overdue Money</option><option value="PAID">Paid Invoices</option><option value="WHT_PENDING">Paid – WHT Pending</option></select><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice number" /></div><button className="primary customer-balance-pdf" type="button" onClick={downloadPdf}>Download PDF</button></div></div>
        <div className="table-scroll"><table className="customer-balance-table"><thead><tr><th>Invoice No.</th><th>Invoice Date</th><th>Due Date</th><th className="number">Invoice Total</th><th className="number">Payments</th><th className="number">Cash Fraction</th><th className="number">Expected WHT</th><th className="number">Collected WHT</th><th className="number money-balance">Remaining Money</th><th className="number wht-balance">Remaining WHT</th><th>Status</th></tr></thead><tbody>{filtered.map((invoice) => { const moneyOpen = invoice.remaining_money > 0.005; const whtPending = !moneyOpen && invoice.remaining_wht > 0.005; const overdue = moneyOpen && Boolean(invoice.due_date && invoice.due_date < today); return <tr key={String(invoice.id)}><td><a className="invoice-number-link" href={`/sales/${invoice.id}`}>{invoice.invoice_no}</a></td><td>{dateLabel(invoice.sales_date)}</td><td className={overdue ? "date-overdue" : ""}>{dateLabel(invoice.due_date)}</td><td className="number">{money(invoice.total_sales)}</td><td className="number">{money(invoice.customer_payments)}</td><td className="number">{money(invoice.cash_fraction)}</td><td className="number">{money(invoice.expected_wht)}</td><td className="number">{money(invoice.collected_wht)}</td><td className="number money-balance"><strong>{money(invoice.remaining_money)}</strong></td><td className="number wht-balance"><strong>{money(invoice.remaining_wht)}</strong></td><td><span className={`balance-status ${overdue ? "overdue" : moneyOpen ? "open" : whtPending ? "wht-pending" : "settled"}`}>{overdue ? "Overdue" : moneyOpen ? "Open" : whtPending ? "Paid · WHT Pending" : "Paid"}</span></td></tr>; })}{!filtered.length && <tr><td colSpan={11} className="collection-empty">No invoices match the selected filter.</td></tr>}</tbody><tfoot><tr><td colSpan={3}>Filtered Total</td><td className="number">{money(filtered.reduce((sum, item) => sum + Number(item.total_sales), 0))}</td><td className="number">{money(filtered.reduce((sum, item) => sum + item.customer_payments, 0))}</td><td className="number">{money(filtered.reduce((sum, item) => sum + item.cash_fraction, 0))}</td><td className="number">{money(filtered.reduce((sum, item) => sum + item.expected_wht, 0))}</td><td className="number">{money(filtered.reduce((sum, item) => sum + item.collected_wht, 0))}</td><td className="number money-balance">{money(filtered.reduce((sum, item) => sum + item.remaining_money, 0))}</td><td className="number wht-balance">{money(filtered.reduce((sum, item) => sum + item.remaining_wht, 0))}</td><td /></tr></tfoot></table></div>
      </section>
    </main><Footer lang={lang} />
  </div>;
}
