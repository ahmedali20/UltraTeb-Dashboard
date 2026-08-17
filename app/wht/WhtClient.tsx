"use client";

import { useMemo, useState } from "react";
import Header from "../Header";
import Footer from "../Footer";
import WhtBatchForm from "./WhtBatchForm";

type WhtRecord = {
  id: number;
  customer_name: string;
  invoice_no: string;
  invoice_date: string;
  subtotal: number;
  tax: number;
  total: number;
  wht_rate: number;
  wht_amount: number;
  collected_amount: number;
  collection_date: string | null;
  document_type?: "INVOICE" | "DR_NOTE";
};

type InvoiceSuggestion = {
  id: string;
  invoice_no: string;
  customer_name: string;
  sales_date: string;
  sales_item_total: number;
  tax: number;
  document_type: "INVOICE" | "DR_NOTE";
};

type WhtCollectionGroup = {
  id: string;
  customer_name: string;
  collected_amount: number;
  allocated_amount: number;
  unallocated_amount: number;
  collection_date: string;
};

const emptyForm = {
  customerName: "",
  invoiceNo: "",
  invoiceDate: "",
  subtotal: "",
  tax: "",
  collectedAmount: "",
  collectionDate: "",
};

const money = (value: number) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const displayDate = (value: string | null) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).replaceAll(" ", "-") : "-";

export default function WhtClient({ customers, initialRecords, invoices, initialGroups }: { customers: string[]; initialRecords: WhtRecord[]; invoices: InvoiceSuggestion[]; initialGroups: WhtCollectionGroup[] }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [records, setRecords] = useState(initialRecords);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [customerFilter, setCustomerFilter] = useState("All");
  const [search, setSearch] = useState("");

  const subtotal = Number(form.subtotal || 0);
  const tax = Number(form.tax || 0);
  const calculatedWht = Math.round(subtotal * 0.01 * 100) / 100;
  const collected = Number(form.collectedAmount || 0);
  const invoiceSuggestions = useMemo(
    () => invoices.filter((item) => !form.customerName || item.customer_name === form.customerName),
    [invoices, form.customerName]
  );
  const filtered = useMemo(() => records.filter((item) =>
    (customerFilter === "All" || item.customer_name === customerFilter) &&
    (!search.trim() || item.invoice_no.toLowerCase().includes(search.trim().toLowerCase()))
  ), [records, customerFilter, search]);
  const recordCustomers = useMemo(() => Array.from(new Set([...records.map((item) => item.customer_name), ...initialGroups.map((item) => item.customer_name)].filter(Boolean))).sort((a, b) => a.localeCompare(b)), [records, initialGroups]);
  const customerUnallocatedWht = useMemo(() => initialGroups
    .filter((item) => customerFilter === "All" || item.customer_name === customerFilter)
    .reduce((sum, item) => sum + Number(item.unallocated_amount || 0), 0), [initialGroups, customerFilter]);
  const totals = useMemo(() => filtered.reduce((sum, item) => ({
    subtotal: sum.subtotal + Number(item.subtotal || 0),
    tax: sum.tax + Number(item.tax || 0),
    total: sum.total + Number(item.total || 0),
    wht: sum.wht + Number(item.wht_amount || 0),
    collected: sum.collected + Number(item.collected_amount || 0),
  }), { subtotal: 0, tax: 0, total: 0, wht: 0, collected: 0 }), [filtered]);

  function update(name: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateInvoiceNumber(value: string) {
    const match = invoiceSuggestions.find((item) => item.document_type === "INVOICE" && String(item.invoice_no) === value.trim());
    setForm((current) => ({
      ...current,
      invoiceNo: value,
      ...(match
        ? {
            customerName: match.customer_name,
            invoiceDate: match.sales_date,
            subtotal: String(match.sales_item_total ?? 0),
            tax: String(match.tax ?? 0),
          }
        : {}),
    }));
  }

  function edit(item: WhtRecord) {
    setEditingId(item.id);
    setForm({
      customerName: item.customer_name,
      invoiceNo: item.invoice_no,
      invoiceDate: item.invoice_date,
      subtotal: String(item.subtotal),
      tax: String(item.tax),
      collectedAmount: String(item.collected_amount),
      collectionDate: item.collection_date ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/wht", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, ...form }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return alert(result.error || "Unable to save WHT record.");
      setRecords((current) => editingId ? current.map((item) => item.id === editingId ? result.data : item) : [result.data, ...current]);
      setForm(emptyForm);
      setEditingId(null);
      alert(editingId ? "WHT record updated." : "WHT record added.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this WHT record?")) return;
    const response = await fetch(`/api/wht?id=${id}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return alert(result.error || "Unable to delete WHT record.");
    setRecords((current) => current.filter((item) => item.id !== id));
  }

  async function downloadPdf() {
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const purple: [number, number, number] = [80, 35, 155];
    const teal: [number, number, number] = [103, 157, 166];
    const loadImage = (path: string) =>
      fetch(path)
        .then((response) => response.blob())
        .then((blob) => new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }))
        .catch(() => "");
    const [logo, header, footer] = await Promise.all([
      loadImage("/brand/ultra-teb-logo.png"),
      loadImage("/brand/ultra-teb-header.png"),
      loadImage("/brand/ultra-teb-footer.png"),
    ]);
    const brandedPages = new Set<number>();

    function drawBrand() {
      const page = doc.getCurrentPageInfo().pageNumber;
      if (brandedPages.has(page)) return;
      brandedPages.add(page);
      const width = doc.internal.pageSize.getWidth();
      const height = doc.internal.pageSize.getHeight();
      if (header) doc.addImage(header, "PNG", 14, 9, 64, 19, undefined, "FAST");
      if (logo) {
        doc.saveGraphicsState();
        doc.setGState(new (doc as any).GState({ opacity: 0.045 }));
        doc.addImage(logo, "PNG", 72, 94, 78, 112, undefined, "FAST");
        doc.restoreGraphicsState();
      }
      doc.setDrawColor(76, 127, 184);
      doc.setLineWidth(0.8);
      doc.line(15, 37, width - 15, 37);
      if (footer) doc.addImage(footer, "PNG", 10, height - 49, 190, 46.4, undefined, "FAST");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(90, 90, 105);
      doc.text(`Page ${page}`, width / 2, height - 8, { align: "center" });
    }

    drawBrand();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(...purple);
    doc.text("WHT Collection Statement", 105, 50, { align: "center" });
    doc.setFontSize(10);
    doc.setTextColor(50, 55, 65);
    doc.text(customerFilter === "All" ? "All Customers" : customerFilter, 15, 60);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, 195, 60, { align: "right" });

    autoTable(doc, {
      startY: 68,
      head: [["Customer", "Invoice", "Invoice Date", "Subtotal", "TAX", "Total", "WHT 1%", "Collected", "Collection Date"]],
      body: filtered.map((item) => [
        item.customer_name,
        item.invoice_no,
        displayDate(item.invoice_date),
        money(item.subtotal),
        money(item.tax),
        money(item.total),
        money(item.wht_amount),
        money(item.collected_amount),
        displayDate(item.collection_date),
      ]),
      foot: [["TOTAL", "", "", money(totals.subtotal), money(totals.tax), money(totals.total), money(totals.wht), money(totals.collected), ""]],
      margin: { top: 42, right: 15, bottom: 53, left: 15 },
      styles: { font: "helvetica", fontSize: 6.5, cellPadding: 2, lineColor: [218, 221, 228], lineWidth: 0.15, textColor: [35, 40, 52], overflow: "linebreak" },
      headStyles: { fillColor: purple, textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
      footStyles: { fillColor: [239, 234, 247], textColor: purple, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 249, 251] },
      columnStyles: {
        0: { cellWidth: 25 }, 1: { cellWidth: 15 }, 2: { cellWidth: 18 },
        3: { cellWidth: 20, halign: "right" }, 4: { cellWidth: 17, halign: "right" },
        5: { cellWidth: 20, halign: "right" }, 6: { cellWidth: 17, halign: "right" },
        7: { cellWidth: 19, halign: "right" }, 8: { cellWidth: 20 },
      },
      didDrawPage: drawBrand,
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? 68;
    if (finalY < 225) {
      doc.setFillColor(245, 242, 250);
      doc.roundedRect(15, finalY + 7, 180, 20, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...teal);
      doc.text("Remaining WHT", 22, finalY + 19);
      doc.setFontSize(14);
      doc.setTextColor(...purple);
      doc.text(`${money(totals.wht - totals.collected)} EGP`, 188, finalY + 19, { align: "right" });
    }
    doc.save(`ultra-teb-wht-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <div className="dashboard-shell" dir={lang === "ar" ? "rtl" : "ltr"}>
      <Header active="wht" lang={lang} onToggleLang={() => setLang((value) => value === "en" ? "ar" : "en")} />
      <main className="wht-page">
        <section className="page-hero">
          <div><p>WITHHOLDING TAX</p><h1>Collected WHT</h1><span>Record and track collected withholding tax at 1% of invoice subtotal.</span></div>
        </section>

        <WhtBatchForm customers={customers} invoices={invoices} />

        <section className="wht-form-card">
          <div className="wht-section-heading"><div><p>{editingId ? "EDIT RECORD" : "NEW RECORD"}</p><h2>{editingId ? "Edit WHT Collection" : "Add WHT Collection"}</h2></div><strong>WHT Rate: 1%</strong></div>
          <div className="wht-form-grid">
            <label>Customer Name<select value={form.customerName} onChange={(e) => update("customerName", e.target.value)}><option value="">Select customer</option>{customers.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
            <label>Invoice No.<input list="wht-invoice-suggestions" value={form.invoiceNo} onChange={(e) => updateInvoiceNumber(e.target.value)} placeholder="Type an old invoice or select an existing one" /><datalist id="wht-invoice-suggestions">{invoiceSuggestions.filter((item) => item.document_type === "INVOICE").map((item, index) => <option key={`${item.invoice_no}-${item.customer_name}-${index}`} value={item.invoice_no}>{item.customer_name} · {displayDate(item.sales_date)}</option>)}</datalist><small>Manual invoice numbers are allowed. Use Multi-Invoice WHT for debit notes.</small></label>
            <label>Invoice Date<input type="date" value={form.invoiceDate} onChange={(e) => update("invoiceDate", e.target.value)} /></label>
            <label>Subtotal<input type="number" min="0" step="0.01" value={form.subtotal} onChange={(e) => update("subtotal", e.target.value)} /></label>
            <label>TAX<input type="number" min="0" step="0.01" value={form.tax} onChange={(e) => update("tax", e.target.value)} /></label>
            <label>Total<input readOnly value={money(subtotal + tax)} /></label>
            <label>Calculated WHT (1%)<input readOnly value={money(calculatedWht)} /></label>
            <label>Collected Amount<input type="number" min="0" step="0.01" value={form.collectedAmount} onChange={(e) => update("collectedAmount", e.target.value)} /></label>
            <label>Collection Date<input type="date" value={form.collectionDate} onChange={(e) => update("collectionDate", e.target.value)} /></label>
          </div>
          <div className="wht-form-summary"><span>Remaining WHT</span><strong>{money(calculatedWht - collected)}</strong></div>
          <div className="wht-form-actions">{editingId && <button type="button" className="secondary" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel</button>}<button type="button" disabled={saving} onClick={save}>{saving ? "Saving..." : editingId ? "Update Record" : "Add Record"}</button></div>
        </section>

        <section className="wht-kpis">
          <article><span>Invoice Total</span><strong>{money(totals.total)}</strong></article>
          <article><span>Calculated WHT</span><strong>{money(totals.wht)}</strong></article>
          <article><span>Collected WHT</span><strong>{money(totals.collected)}</strong></article>
          <article><span>Customer Unallocated WHT</span><strong>{money(customerUnallocatedWht)}</strong></article>
          <article><span>Remaining WHT</span><strong>{money(totals.wht - totals.collected)}</strong></article>
        </section>

        <section className="wht-table-card">
          <div className="wht-toolbar"><h2>WHT Records</h2><select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}><option value="All">All Customers</option>{recordCustomers.map((name) => <option key={name}>{name}</option>)}</select><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice number" /></div>
          <div className="table-scroll"><table><thead><tr><th>Document</th><th>Customer</th><th>Document No.</th><th>Date</th><th>Subtotal</th><th>TAX</th><th>Total</th><th>WHT</th><th>Collected</th><th>Remaining</th><th>Collection Date</th><th>Actions</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td>{item.document_type === "DR_NOTE" ? "DR Note" : "Invoice"}</td><td>{item.customer_name}</td><td>{item.invoice_no}</td><td>{displayDate(item.invoice_date)}</td><td>{money(item.subtotal)}</td><td>{money(item.tax)}</td><td>{money(item.total)}</td><td>{money(item.wht_amount)}</td><td>{money(item.collected_amount)}</td><td>{money(item.wht_amount - item.collected_amount)}</td><td>{displayDate(item.collection_date)}</td><td><div className="wht-row-actions"><button onClick={() => edit(item)}>Edit</button><button className="danger" onClick={() => remove(item.id)}>Delete</button></div></td></tr>)}</tbody></table>{filtered.length === 0 && <p className="empty-state">No WHT records found.</p>}</div>
        </section>
      </main>
      <Footer lang={lang} />
    </div>
  );
}
