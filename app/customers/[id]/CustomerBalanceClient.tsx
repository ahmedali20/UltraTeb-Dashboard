"use client";

import { useMemo, useState } from "react";
import Header from "../../Header";
import Footer from "../../Footer";

type Customer = { customer_name: string; customer_official_name: string | null; sales_rep_name: string | null; payment_terms_days: number | null };
type Invoice = { id: string | number; invoice_no: string; original_invoice_no?: string | null; sales_date: string; due_date: string | null; document_type: "INVOICE" | "CR_NOTE" | "DR_NOTE"; total_sales: number; expected_wht: number; collected_wht: number; customer_payments: number; cash_fraction: number; remaining_wht: number; remaining_money: number };
type UnallocatedCheque = { id: number; cheque_no: string; bank_name: string | null; cheque_date: string | null; amount: number; unallocated_amount: number };
type BalanceFilter = "ALL" | "OPEN" | "PAID" | "WHT_PENDING" | "OVERDUE";
type DocumentFilter = "ALL" | "INVOICE" | "CR_NOTE" | "DR_NOTE";

const money = (value: number) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLabel = (value: string | null) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).replaceAll(" ", "-") : "—";

export default function CustomerBalanceClient({ customer, invoices, customerCreditBalance, unallocatedChequeBalance, unallocatedCheques }: { customer: Customer; invoices: Invoice[]; customerCreditBalance: number; unallocatedChequeBalance: number; unallocatedCheques: UnallocatedCheque[] }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<BalanceFilter>("ALL");
  const [documentFilter, setDocumentFilter] = useState<DocumentFilter>("ALL");
  const [showWht, setShowWht] = useState(true);
  const [showAllocator, setShowAllocator] = useState(false);
  const [allocationForm, setAllocationForm] = useState<{ invoiceIds: string[]; amounts: Record<string, string> }>({ invoiceIds: [], amounts: {} });
  const [allocationSaving, setAllocationSaving] = useState(false);
  const [allocationMessage, setAllocationMessage] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const totals = useMemo(() => invoices.reduce((sum, item) => ({ total: sum.total + Number(item.total_sales), payments: sum.payments + item.customer_payments, fractions: sum.fractions + item.cash_fraction, expectedWht: sum.expectedWht + item.expected_wht, collectedWht: sum.collectedWht + item.collected_wht, remainingMoney: sum.remainingMoney + item.remaining_money, remainingWht: sum.remainingWht + item.remaining_wht }), { total: 0, payments: 0, fractions: 0, expectedWht: 0, collectedWht: 0, remainingMoney: 0, remainingWht: 0 }), [invoices]);
  const netCustomerBalance = Math.max(0, totals.remainingMoney - customerCreditBalance - unallocatedChequeBalance);
  const filtered = useMemo(() => invoices.filter((invoice) => {
    const moneyOpen = invoice.remaining_money > 0.005;
    const whtPending = !moneyOpen && invoice.remaining_wht > 0.005;
    const isOverdue = moneyOpen && Boolean(invoice.due_date && invoice.due_date < today);
    const matchesFilter = filter === "ALL" || (filter === "OPEN" && moneyOpen) || (filter === "PAID" && !moneyOpen) || (filter === "WHT_PENDING" && whtPending) || (filter === "OVERDUE" && isOverdue);
    const matchesDocument = documentFilter === "ALL" || invoice.document_type === documentFilter;
    return matchesDocument && matchesFilter && (!search.trim() || String(invoice.invoice_no).toLowerCase().includes(search.trim().toLowerCase()));
  }), [invoices, documentFilter, filter, search, today]);
  const allocationInvoices = useMemo(() => invoices.filter((item) => item.document_type === "INVOICE").map((invoice) => {
    const linkedNotes = invoices.filter((item) => item.document_type !== "INVOICE" && String(item.original_invoice_no || "") === String(invoice.invoice_no));
    return linkedNotes.reduce((result, note) => ({ ...result, remaining_money: result.remaining_money + note.remaining_money }), { ...invoice });
  }).filter((invoice) => invoice.remaining_money > 0.005), [invoices]);
  const selectedAllocationInvoices = allocationInvoices.filter((invoice) => allocationForm.invoiceIds.includes(String(invoice.id)));
  const selectedAllocationTotal = selectedAllocationInvoices.reduce((sum, invoice) => sum + Number(allocationForm.amounts[String(invoice.id)] || 0), 0);
  const invalidAllocation = selectedAllocationInvoices.some((invoice) => Number(allocationForm.amounts[String(invoice.id)] || 0) <= 0 || Number(allocationForm.amounts[String(invoice.id)] || 0) > invoice.remaining_money + .01);

  function toggleAllocationInvoice(invoice: Invoice) {
    const id = String(invoice.id);
    setAllocationForm((current) => {
      if (current.invoiceIds.includes(id)) {
        const amounts = { ...current.amounts };
        delete amounts[id];
        return { invoiceIds: current.invoiceIds.filter((item) => item !== id), amounts };
      }
      const alreadySelected = current.invoiceIds.reduce((sum, item) => sum + Number(current.amounts[item] || 0), 0);
      const amount = Math.min(invoice.remaining_money, Math.max(0, unallocatedChequeBalance - alreadySelected));
      return { invoiceIds: [...current.invoiceIds, id], amounts: { ...current.amounts, [id]: amount.toFixed(2) } };
    });
  }

  async function allocateUnallocatedCheque() {
    setAllocationMessage("");
    setAllocationSaving(true);
    try {
      for (const invoice of selectedAllocationInvoices) {
        const response = await fetch("/api/cheques/allocate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invoiceId: String(invoice.id), amount: Number(allocationForm.amounts[String(invoice.id)]) }) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) return setAllocationMessage(`Invoice ${invoice.invoice_no}: ${result.error || "Unable to allocate cheque balance."}`);
      }
      window.location.reload();
    } finally { setAllocationSaving(false); }
  }

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
    doc.text(`${filtered.length} document${filtered.length === 1 ? "" : "s"} shown`, 195, 57, { align: "right" });
    const cards = [["INVOICE TOTAL", reportTotals.total], ["PAYMENTS", reportTotals.payments], ["FRACTIONS", reportTotals.fractions], ["WHT DEDUCTED", reportTotals.wht], ["MONEY DUE", reportTotals.moneyDue], ["WHT DUE", reportTotals.whtDue]] as const;
    cards.forEach(([label, value], index) => {
      const x = 15 + (index % 3) * 61; const y = 64 + Math.floor(index / 3) * 16; const emphasized = index >= 4;
      doc.setFillColor(emphasized ? 245 : 249, emphasized ? 240 : 249, emphasized ? 252 : 251); doc.setDrawColor(emphasized ? 190 : 224, emphasized ? 168 : 224, emphasized ? 225 : 230); doc.roundedRect(x, y, 57, 12.5, 1.5, 1.5, "FD");
      doc.setFont("helvetica", "normal"); doc.setFontSize(6.2); doc.setTextColor(100, 104, 116); doc.text(label, x + 3, y + 4.2);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(emphasized ? purple[0] : 35, emphasized ? purple[1] : 40, emphasized ? purple[2] : 52); doc.text(`EGP ${money(value)}`, x + 3, y + 9.5);
    });
    autoTable(doc, {
      startY: 100,
      head: [["Document", "Date / Due Date", "Document Total", "Payments / Fraction", "WHT Deducted / Collected", "Money Due", "WHT Due", "Status"]],
      body: filtered.map((invoice) => { const moneyOpen = invoice.remaining_money > 0.005; const whtPending = !moneyOpen && invoice.remaining_wht > 0.005; const overdue = moneyOpen && Boolean(invoice.due_date && invoice.due_date < today); const prefix = invoice.document_type === "DR_NOTE" ? "DR" : invoice.document_type === "CR_NOTE" ? "CR" : "INV"; return [`${prefix} ${invoice.invoice_no}`, `${dateLabel(invoice.sales_date)}\n${dateLabel(invoice.due_date)}`, money(invoice.total_sales), `${money(invoice.customer_payments)}\n${money(invoice.cash_fraction)}`, `${money(invoice.expected_wht)}\n${money(invoice.collected_wht)}`, money(invoice.remaining_money), money(invoice.remaining_wht), overdue ? "OVERDUE" : moneyOpen ? "OPEN" : whtPending ? "WHT PENDING" : "PAID"]; }),
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
        <div className="customer-balance-hero-total"><span>Net Customer Balance</span><strong>EGP {money(netCustomerBalance)}</strong><small>Cash balance only · WHT shown separately below</small></div>
      </section>

      <section className={`customer-balance-groups ${showWht ? "" : "wht-hidden"}`}>
        <div className="customer-balance-group"><div className="customer-balance-group-title"><span>Customer Payments</span><small>Cash, transfer and collected cheques</small></div><div className="customer-balance-cards"><article><span>Invoice Total</span><strong>EGP {money(totals.total)}</strong></article><article><span>Payments Received</span><strong>EGP {money(totals.payments)}</strong></article><article><span>Cash Fraction Write-offs</span><strong>EGP {money(totals.fractions)}</strong></article><article className={customerCreditBalance > 0 ? "is-positive" : ""}><span>Customer Credit Balance</span><strong>EGP {money(customerCreditBalance)}</strong><small>Excess linked credit notes</small></article><article className={`${unallocatedChequeBalance > 0 ? "is-positive" : unallocatedChequeBalance < 0 ? "is-negative" : ""} unallocated-balance-card`} role="button" tabIndex={0} onClick={() => setShowAllocator((value) => !value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setShowAllocator((value) => !value); }}><span>Unallocated Cheque Balance</span><strong>EGP {money(unallocatedChequeBalance)}</strong><small>Click to allocate</small></article><article className="is-outstanding"><span>Net Remaining Money</span><strong>EGP {money(netCustomerBalance)}</strong></article></div></div>
        {showWht && <div className="customer-balance-group"><div className="customer-balance-group-title"><span>Withholding Tax</span><small>Expected and collected certificates</small></div><div className="customer-balance-cards"><article><span>Expected WHT</span><strong>EGP {money(totals.expectedWht)}</strong></article><article><span>Collected WHT</span><strong>EGP {money(totals.collectedWht)}</strong></article><article className="is-wht"><span>Remaining WHT</span><strong>EGP {money(totals.remainingWht)}</strong></article></div></div>}
      </section>

      {showAllocator && <section className="unallocated-allocation-panel">
        <div className="unallocated-allocation-heading"><div><p>CHEQUE ALLOCATION</p><h2>Allocate Unallocated Balance</h2><span>Select one or more unpaid invoices. The system automatically uses the oldest available collected cheque balance.</span></div><button type="button" onClick={() => setShowAllocator(false)}>Close</button></div>
        {!unallocatedCheques.length ? <p className="collection-empty">There is no unallocated cheque balance.</p> : <div className="unallocated-allocation-grid">
          <div className="unallocated-auto-source"><span>Available collected cheque balance</span><strong>EGP {money(unallocatedChequeBalance)}</strong><small>The oldest available cheque is used first.</small></div>
          <div className="unallocated-batch-summary"><span>Selected invoices</span><strong>{selectedAllocationInvoices.length}</strong><small>Allocation total: EGP {money(selectedAllocationTotal)}</small></div>
          <div className="unallocated-invoice-picker">
            <div className="unallocated-invoice-picker-head"><strong>Open invoices</strong><button type="button" onClick={() => { if (allocationForm.invoiceIds.length === allocationInvoices.length) return setAllocationForm({ invoiceIds: [], amounts: {} }); let available = unallocatedChequeBalance; const amounts: Record<string, string> = {}; const invoiceIds: string[] = []; allocationInvoices.forEach((invoice) => { if (available <= .005) return; const id = String(invoice.id); const amount = Math.min(invoice.remaining_money, available); invoiceIds.push(id); amounts[id] = amount.toFixed(2); available -= amount; }); setAllocationForm({ invoiceIds, amounts }); }}>{allocationForm.invoiceIds.length ? "Clear selection" : "Select invoices"}</button></div>
            {allocationInvoices.map((invoice) => { const id = String(invoice.id); const checked = allocationForm.invoiceIds.includes(id); return <label className={`unallocated-invoice-option ${checked ? "is-selected" : ""}`} key={id}><input type="checkbox" checked={checked} onChange={() => toggleAllocationInvoice(invoice)} /><span><strong>Invoice {invoice.invoice_no}</strong><small>{dateLabel(invoice.sales_date)} · Remaining EGP {money(invoice.remaining_money)}</small></span><input aria-label={`Allocation for invoice ${invoice.invoice_no}`} type="number" min="0.01" step="0.01" max={invoice.remaining_money} disabled={!checked} value={allocationForm.amounts[id] || ""} onChange={(event) => setAllocationForm((current) => ({ ...current, amounts: { ...current.amounts, [id]: event.target.value } }))} /></label>; })}
          </div>
          <button className="primary unallocated-batch-submit" type="button" disabled={allocationSaving || !selectedAllocationInvoices.length || invalidAllocation || selectedAllocationTotal <= 0 || selectedAllocationTotal > unallocatedChequeBalance + .01} onClick={allocateUnallocatedCheque}>{allocationSaving ? "Allocating…" : `Allocate ${selectedAllocationInvoices.length} Invoice${selectedAllocationInvoices.length === 1 ? "" : "s"}`}</button>
        </div>}
        {allocationMessage && <p className="collection-form-error">{allocationMessage}</p>}
      </section>}

      <section className="customer-balance-table-card">
        <div className="customer-balance-toolbar"><div><h2>Invoice Balance Statement</h2><span>{filtered.length} of {invoices.length} documents</span></div><div className="customer-balance-actions"><div className="customer-balance-filters"><select aria-label="Document type" value={documentFilter} onChange={(event) => setDocumentFilter(event.target.value as DocumentFilter)}><option value="ALL">All Documents</option><option value="INVOICE">Invoices</option><option value="CR_NOTE">Credit Notes</option><option value="DR_NOTE">Debit Notes</option></select><select aria-label="Balance status" value={filter} onChange={(event) => setFilter(event.target.value as BalanceFilter)}><option value="ALL">All Balances</option><option value="OPEN">Open Money Balances</option><option value="OVERDUE">Overdue Money</option><option value="PAID">Paid Documents</option><option value="WHT_PENDING">Paid – WHT Pending</option></select><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search document number" /></div><button className={`secondary customer-balance-wht-toggle ${showWht ? "is-active" : ""}`} type="button" onClick={() => setShowWht((value) => !value)} aria-pressed={showWht}>{showWht ? "Hide WHT" : "Show WHT"}</button><button className="primary customer-balance-pdf" type="button" onClick={downloadPdf}>Download PDF</button></div></div>
        <div className="table-scroll"><table className="customer-balance-table"><thead><tr><th>Invoice No.</th><th>Invoice Date</th><th>Due Date</th><th className="number">Invoice Total</th><th className="number">Payments</th><th className="number">Cash Fraction</th>{showWht && <><th className="number">Expected WHT</th><th className="number">Collected WHT</th></>}<th className="number money-balance">Remaining Money</th>{showWht && <th className="number wht-balance">Remaining WHT</th>}<th>Status</th></tr></thead><tbody>{filtered.map((invoice) => { const moneyOpen = invoice.remaining_money > 0.005; const whtPending = !moneyOpen && invoice.remaining_wht > 0.005; const overdue = moneyOpen && Boolean(invoice.due_date && invoice.due_date < today); return <tr key={String(invoice.id)}><td><a className="invoice-number-link" href={`/sales/${invoice.id}`}>{invoice.invoice_no}</a></td><td>{dateLabel(invoice.sales_date)}</td><td className={overdue ? "date-overdue" : ""}>{dateLabel(invoice.due_date)}</td><td className="number">{money(invoice.total_sales)}</td><td className="number">{money(invoice.customer_payments)}</td><td className="number">{money(invoice.cash_fraction)}</td>{showWht && <><td className="number">{money(invoice.expected_wht)}</td><td className="number">{money(invoice.collected_wht)}</td></>}<td className="number money-balance"><strong>{money(invoice.remaining_money)}</strong></td>{showWht && <td className="number wht-balance"><strong>{money(invoice.remaining_wht)}</strong></td>}<td><span className={`balance-status ${overdue ? "overdue" : moneyOpen ? "open" : whtPending ? "wht-pending" : "settled"}`}>{overdue ? "Overdue" : moneyOpen ? "Open" : whtPending ? "Paid · WHT Pending" : "Paid"}</span></td></tr>; })}{!filtered.length && <tr><td colSpan={showWht ? 11 : 8} className="collection-empty">No invoices match the selected filter.</td></tr>}</tbody><tfoot><tr><td colSpan={3}>Filtered Total</td><td className="number">{money(filtered.reduce((sum, item) => sum + Number(item.total_sales), 0))}</td><td className="number">{money(filtered.reduce((sum, item) => sum + item.customer_payments, 0))}</td><td className="number">{money(filtered.reduce((sum, item) => sum + item.cash_fraction, 0))}</td>{showWht && <><td className="number">{money(filtered.reduce((sum, item) => sum + item.expected_wht, 0))}</td><td className="number">{money(filtered.reduce((sum, item) => sum + item.collected_wht, 0))}</td></>}<td className="number money-balance">{money(filtered.reduce((sum, item) => sum + item.remaining_money, 0))}</td>{showWht && <td className="number wht-balance">{money(filtered.reduce((sum, item) => sum + item.remaining_wht, 0))}</td>}<td /></tr></tfoot></table></div>
      </section>
    </main><Footer lang={lang} />
  </div>;
}
