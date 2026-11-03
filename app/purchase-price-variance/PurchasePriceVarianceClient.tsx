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

export default function PurchasePriceVarianceClient({ initialRows }: { initialRows: VarianceRow[] }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [rows, setRows] = useState(initialRows);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [invoiceDraft, setInvoiceDraft] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

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

  return <div className="dashboard-shell" dir={lang === "ar" ? "rtl" : "ltr"}>
    <Header active="purchaseVariance" lang={lang} onToggleLang={() => setLang((value) => value === "en" ? "ar" : "en")} />
    <main className="purchase-variance-page">
      <section className="purchase-variance-hero">
        <div><p>PROCUREMENT CONTROL</p><h1>Purchase Price Variance</h1><span>Compare invoiced purchase prices with actual prices and connect each item to multiple invoices.</span></div>
        <button className="primary" onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}>+ Add New Line</button>
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
        <div className="table-scroll"><table><thead><tr><th>Item Code</th><th>Product</th><th>Invoices</th><th>Qty</th><th>Invoice Price</th><th>Actual Price</th><th>Unit Variance</th><th>Total Variance</th><th>Actions</th></tr></thead><tbody>
          {filtered.map((row) => { const unit = Number(row.actual_price) - Number(row.invoice_price); const total = Number(row.quantity) * unit; return <tr key={row.id}><td><strong>{row.item_code}</strong></td><td><span>{row.product_name}</span>{row.notes && <small>{row.notes}</small>}</td><td><div className="table-invoice-tags">{(row.invoice_numbers || []).map((invoice) => <span key={invoice}>{invoice}</span>)}</div></td><td className="number">{Number(row.quantity).toLocaleString("en-US", { maximumFractionDigits: 3 })}</td><td className="number">{money(Number(row.invoice_price))}</td><td className="number">{money(Number(row.actual_price))}</td><td className={`number ${unit > 0 ? "variance-bad" : "variance-good"}`}>{money(unit)}</td><td className={`number ${total > 0 ? "variance-bad" : "variance-good"}`}><strong>{money(total)}</strong></td><td><div className="purchase-variance-row-actions"><button onClick={() => startEdit(row)}>Edit</button><button className="danger" onClick={() => remove(row)}>Delete</button></div></td></tr>; })}
        </tbody></table></div>
        {!filtered.length && <div className="data-table-empty">No purchase price differences found.</div>}
      </section>
    </main>
    <Footer lang={lang} />
  </div>;
}
