"use client";

import { useMemo, useState } from "react";
import Header from "../Header";
import Footer from "../Footer";
import "./PurchasePriceVariance.css";

type VarianceRow = {
  id: number;
  item_code: string;
  product_name: string;
  quantity: number;
  invoice_price: number;
  actual_price: number;
  invoice_numbers: string[];
  notes: string | null;
  created_at: string;
};

type FormState = {
  itemCode: string;
  productName: string;
  quantity: string;
  invoicePrice: string;
  actualPrice: string;
  invoiceNumbers: string[];
  notes: string;
};

const emptyForm: FormState = { itemCode: "", productName: "", quantity: "", invoicePrice: "", actualPrice: "", invoiceNumbers: [], notes: "" };
const money = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PurchasePriceVarianceClient({ initialRows, invoiceDates }: { initialRows: VarianceRow[]; invoiceDates: Record<string, string> }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [rows, setRows] = useState(initialRows);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [invoiceDraft, setInvoiceDraft] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const preview = useMemo(() => {
    const quantity = Number(form.quantity || 0);
    const unit = Number(form.actualPrice || 0) - Number(form.invoicePrice || 0);
    return { unit, total: quantity * unit };
  }, [form.quantity, form.invoicePrice, form.actualPrice]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => [row.item_code, row.product_name, ...(row.invoice_numbers || [])].some((value) => String(value).toLowerCase().includes(query)));
  }, [rows, search]);

  const monthGroups = useMemo(() => Array.from(filtered.reduce((groups, row) => {
    const relatedDates = (row.invoice_numbers ?? [])
      .map((invoiceNo) => invoiceDates[String(invoiceNo).trim()])
      .filter(Boolean)
      .map((value) => new Date(value))
      .filter((value) => !Number.isNaN(value.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    const date = relatedDates[0] ?? new Date(Number.NaN);
    const key = Number.isNaN(date.getTime()) ? "unknown" : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = Number.isNaN(date.getTime())
      ? "Orders Without Invoice Date"
      : `${new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date)} Orders`;
    const group = groups.get(key) ?? { key, label, rows: [] as VarianceRow[] };
    group.rows.push(row);
    groups.set(key, group);
    return groups;
  }, new Map<string, { key: string; label: string; rows: VarianceRow[] }>()).values())
    .sort((a, b) => b.key.localeCompare(a.key)), [filtered, invoiceDates]);

  const totals = useMemo(() => rows.reduce((result, row) => {
    const variance = Number(row.quantity) * (Number(row.actual_price) - Number(row.invoice_price));
    result.net += variance;
    if (variance > 0) result.unfavorable += variance;
    if (variance < 0) result.favorable += Math.abs(variance);
    return result;
  }, { net: 0, favorable: 0, unfavorable: 0 }), [rows]);

  function addInvoice() {
    const values = invoiceDraft.split(/[,\n]/).map((value) => value.trim()).filter(Boolean);
    if (!values.length) return;
    setForm((current) => ({ ...current, invoiceNumbers: Array.from(new Set([...current.invoiceNumbers, ...values])) }));
    setInvoiceDraft("");
  }

  function removeInvoice(invoice: string) {
    setForm((current) => ({ ...current, invoiceNumbers: current.invoiceNumbers.filter((value) => value !== invoice) }));
  }

  function reset() {
    setForm(emptyForm);
    setInvoiceDraft("");
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(row: VarianceRow) {
    setForm({ itemCode: row.item_code, productName: row.product_name, quantity: String(row.quantity), invoicePrice: String(row.invoice_price), actualPrice: String(row.actual_price), invoiceNumbers: row.invoice_numbers || [], notes: row.notes || "" });
    setEditingId(row.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    if (!form.itemCode.trim() || !form.productName.trim() || Number(form.quantity) <= 0 || !form.invoiceNumbers.length) {
      return alert("Item code, product name, quantity and at least one invoice number are required.");
    }
    setSaving(true);
    const response = await fetch("/api/purchase-price-variance", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, id: editingId }),
    });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) return alert(result.error || "Unable to save the line.");
    setRows((current) => editingId ? current.map((row) => row.id === editingId ? result.data : row) : [result.data, ...current]);
    reset();
  }

  async function remove(row: VarianceRow) {
    if (!confirm(`Delete variance line ${row.item_code}?`)) return;
    const response = await fetch(`/api/purchase-price-variance?id=${row.id}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return alert(result.error || "Unable to delete the line.");
    setRows((current) => current.filter((item) => item.id !== row.id));
    if (editingId === row.id) reset();
  }

  async function downloadPdf() {
    if (!filtered.length) return;
    setGeneratingPdf(true);
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = (autoTableModule.default as unknown as { default?: typeof autoTableModule.default }).default
        ?? autoTableModule.default;
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const fontResponse = await fetch("/fonts/Amiri-Regular.ttf");
      if (!fontResponse.ok) throw new Error("Unable to load the Arabic PDF font.");
      const fontBytes = new Uint8Array(await fontResponse.arrayBuffer());
      let fontBinary = "";
      const fontChunkSize = 0x8000;
      for (let offset = 0; offset < fontBytes.length; offset += fontChunkSize) {
        fontBinary += String.fromCharCode(...fontBytes.subarray(offset, offset + fontChunkSize));
      }
      doc.addFileToVFS("Amiri-Regular.ttf", btoa(fontBinary));
      doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
      doc.addFont("Amiri-Regular.ttf", "Amiri", "bold");
      const reportTotals = filtered.reduce((result, row) => {
        const variance = Number(row.quantity) * (Number(row.actual_price) - Number(row.invoice_price));
        result.net += variance;
        if (variance > 0) result.unfavorable += variance;
        if (variance < 0) result.favorable += Math.abs(variance);
        return result;
      }, { net: 0, favorable: 0, unfavorable: 0 });
      const generatedAt = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date());

      doc.setFillColor(76, 29, 149);
      doc.rect(0, 0, 210, 31, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
      doc.text("Purchase Price Variance Report", 14, 14);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`UltraTeb Tegara  |  Generated ${generatedAt}`, 14, 22);
      doc.setFont("Amiri", "normal");
      doc.text(`${filtered.length} line item${filtered.length === 1 ? "" : "s"}${search.trim() ? `  |  Filter: ${search.trim()}` : ""}`, 196, 22, { align: "right" });
      doc.setFont("helvetica", "normal");

      const summary = [
        { label: "Favorable Saving", value: reportTotals.favorable, color: [5, 150, 105] as [number, number, number] },
        { label: "Unfavorable Increase", value: reportTotals.unfavorable, color: [220, 38, 38] as [number, number, number] },
        { label: "Net Variance", value: reportTotals.net, color: (reportTotals.net > 0 ? [220, 38, 38] : [5, 150, 105]) as [number, number, number] },
      ];
      summary.forEach((item, index) => {
        const x = 14 + index * 61;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(x, 37, 56, 18, 2, 2, "FD");
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(7.5);
        doc.text(item.label, x + 4, 43);
        doc.setTextColor(...item.color);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(`EGP ${money(item.value)}`, x + 4, 50);
        doc.setFont("helvetica", "normal");
      });

      let tableStartY = 67;
      monthGroups.forEach((group) => {
        if (tableStartY > 258) {
          doc.addPage();
          tableStartY = 22;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(76, 29, 149);
        doc.text(group.label, 10, tableStartY - 4);

        autoTable(doc, {
        startY: tableStartY,
        margin: { left: 10, right: 10, bottom: 17 },
        head: [["Item Code", "Product", "Invoices", "Qty", "Invoice Price", "Actual Price", "Unit Var.", "Total Var."]],
        body: group.rows.map((row) => {
          const unit = Number(row.actual_price) - Number(row.invoice_price);
          return [row.item_code, `${row.product_name}${row.notes ? `\n${row.notes}` : ""}`, (row.invoice_numbers || []).join(", "), Number(row.quantity).toLocaleString("en-US", { maximumFractionDigits: 3 }), money(Number(row.invoice_price)), money(Number(row.actual_price)), money(unit), money(Number(row.quantity) * unit)];
        }),
        theme: "grid",
        styles: { font: "Amiri", fontSize: 7.4, cellPadding: 2, lineColor: [226, 232, 240], lineWidth: 0.2, textColor: [30, 41, 59], valign: "middle" },
        headStyles: { font: "helvetica", fillColor: [76, 29, 149], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: { 0: { cellWidth: 19 }, 1: { cellWidth: 39 }, 2: { cellWidth: 29 }, 3: { cellWidth: 13, halign: "right" }, 4: { cellWidth: 22, halign: "right" }, 5: { cellWidth: 22, halign: "right" }, 6: { cellWidth: 21, halign: "right" }, 7: { cellWidth: 25, halign: "right", fontStyle: "bold" } },
        didParseCell(data) {
          if (data.section === "body" && (data.column.index === 6 || data.column.index === 7)) {
            const row = group.rows[data.row.index];
            const value = data.column.index === 6 ? Number(row.actual_price) - Number(row.invoice_price) : Number(row.quantity) * (Number(row.actual_price) - Number(row.invoice_price));
            data.cell.styles.textColor = value > 0 ? [220, 38, 38] : [5, 150, 105];
          }
        },
        didDrawPage(data) {
          const page = doc.getNumberOfPages();
          doc.setDrawColor(226, 232, 240);
          doc.line(14, 282, 196, 282);
          doc.setFontSize(7.5);
          doc.setTextColor(100, 116, 139);
          doc.text("UltraTeb Tegara — Internal Dashboard", 14, 288);
          doc.text(`Page ${page}`, 196, 288, { align: "right" });
          if (page > 1) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(76, 29, 149);
            doc.text("Purchase Price Variance Report", data.settings.margin.left, 9);
          }
        },
        });
        tableStartY = ((doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? tableStartY) + 13;
      });

      const stamp = new Date().toISOString().slice(0, 10);
      doc.save(`Purchase-Price-Variance-Report-${stamp}.pdf`);
    } catch (error) {
      console.error("Unable to generate the purchase price variance PDF.", error);
      alert(error instanceof Error ? error.message : "Unable to generate the PDF report. Please try again.");
    } finally {
      setGeneratingPdf(false);
    }
  }

  return <div className="dashboard-shell" dir={lang === "ar" ? "rtl" : "ltr"}>
    <Header active="purchaseVariance" lang={lang} onToggleLang={() => setLang((value) => value === "en" ? "ar" : "en")} />
    <main className="purchase-variance-page">
      <section className="purchase-variance-hero">
        <div><p>PROCUREMENT CONTROL</p><h1>Purchase Price Variance</h1><span>Compare invoiced purchase prices with actual prices and connect each item to multiple invoices.</span></div>
        <div className="purchase-variance-hero-actions"><button className="purchase-variance-pdf" type="button" onClick={downloadPdf} disabled={!filtered.length || generatingPdf}>{generatingPdf ? "Preparing PDF..." : "Download PDF Report"}</button><button className="primary" onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}>+ Add New Line</button></div>
      </section>

      <section className="purchase-variance-kpis">
        <article><span>Line Items</span><strong>{rows.length}</strong><small>saved comparisons</small></article>
        <article className="favorable"><span>Favorable Saving</span><strong>EGP {money(totals.favorable)}</strong><small>actual price below invoice price</small></article>
        <article className="unfavorable"><span>Unfavorable Increase</span><strong>EGP {money(totals.unfavorable)}</strong><small>actual price above invoice price</small></article>
        <article className={totals.net > 0 ? "unfavorable" : "favorable"}><span>Net Variance</span><strong>EGP {money(totals.net)}</strong><small>{totals.net > 0 ? "net cost increase" : "net saving"}</small></article>
      </section>

      {showForm && <section className="purchase-variance-form-card">
        <div className="purchase-variance-form-heading"><div><p>{editingId ? "EDIT LINE" : "NEW LINE"}</p><h2>{editingId ? "Update Purchase Difference" : "Add Purchase Difference"}</h2></div><button onClick={reset}>Close</button></div>
        <div className="purchase-variance-form-grid">
          <label><span>Item Code</span><input value={form.itemCode} onChange={(event) => setForm({ ...form, itemCode: event.target.value })} placeholder="e.g. GS1-10025" /></label>
          <label className="wide"><span>Product Name</span><input value={form.productName} onChange={(event) => setForm({ ...form, productName: event.target.value })} placeholder="Product description" /></label>
          <label><span>Quantity</span><input type="number" min="0.001" step="0.001" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label>
          <label><span>Invoiced Unit Price</span><input type="number" min="0" step="0.0001" value={form.invoicePrice} onChange={(event) => setForm({ ...form, invoicePrice: event.target.value })} /></label>
          <label><span>Actual Unit Price</span><input type="number" min="0" step="0.0001" value={form.actualPrice} onChange={(event) => setForm({ ...form, actualPrice: event.target.value })} /></label>
          <div className="purchase-variance-preview"><span>Unit Variance</span><strong className={preview.unit > 0 ? "bad" : "good"}>EGP {money(preview.unit)}</strong><small>Total: EGP {money(preview.total)}</small></div>
          <label className="invoice-picker wide"><span>Invoice Numbers</span><div><input value={invoiceDraft} onChange={(event) => setInvoiceDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addInvoice(); } }} placeholder="Write one or more invoice numbers" /><button type="button" onClick={addInvoice}>Add Invoice</button></div><small>Separate multiple invoice numbers with commas, then click Add Invoice.</small></label>
          <div className="invoice-tags wide">{form.invoiceNumbers.map((invoice) => <span key={invoice}>Invoice {invoice}<button type="button" aria-label={`Remove invoice ${invoice}`} onClick={() => removeInvoice(invoice)}>×</button></span>)}{!form.invoiceNumbers.length && <em>No invoices selected.</em>}</div>
          <label className="wide"><span>Notes</span><input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional explanation" /></label>
        </div>
        <div className="purchase-variance-form-actions"><button onClick={reset}>Cancel</button><button className="primary" onClick={save} disabled={saving}>{saving ? "Saving..." : editingId ? "Save Changes" : "Add Line"}</button></div>
      </section>}

      <section className="purchase-variance-table-card">
        <div className="purchase-variance-toolbar"><div><h2>Recorded Differences</h2><span>{filtered.length} lines</span></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item, product or invoice..." /></div>
        {monthGroups.map((group) => <div className="purchase-variance-month" key={group.key}>
          <div className="purchase-variance-month-heading"><h3>{group.label}</h3><span>{group.rows.length} line{group.rows.length === 1 ? "" : "s"}</span></div>
          <div className="table-scroll"><table><thead><tr><th>Item Code</th><th>Product</th><th>Invoices</th><th>Qty</th><th>Invoice Price</th><th>Actual Price</th><th>Unit Variance</th><th>Total Variance</th><th>Actions</th></tr></thead><tbody>
            {group.rows.map((row) => { const unit = Number(row.actual_price) - Number(row.invoice_price); const total = Number(row.quantity) * unit; return <tr key={row.id}><td><strong>{row.item_code}</strong></td><td><span>{row.product_name}</span>{row.notes && <small>{row.notes}</small>}</td><td><div className="table-invoice-tags">{(row.invoice_numbers || []).map((invoice) => <span key={invoice}>{invoice}</span>)}</div></td><td className="number">{Number(row.quantity).toLocaleString("en-US", { maximumFractionDigits: 3 })}</td><td className="number">{money(Number(row.invoice_price))}</td><td className="number">{money(Number(row.actual_price))}</td><td className={`number ${unit > 0 ? "variance-bad" : "variance-good"}`}>{money(unit)}</td><td className={`number ${total > 0 ? "variance-bad" : "variance-good"}`}><strong>{money(total)}</strong></td><td><div className="purchase-variance-row-actions"><button onClick={() => startEdit(row)}>Edit</button><button className="danger" onClick={() => remove(row)}>Delete</button></div></td></tr>; })}
          </tbody></table></div>
        </div>)}
        {!filtered.length && <div className="data-table-empty">No purchase price differences found.</div>}
      </section>
    </main>
    <Footer lang={lang} />
  </div>;
}
