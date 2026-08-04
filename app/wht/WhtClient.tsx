"use client";

import { useMemo, useState } from "react";
import Header from "../Header";
import Footer from "../Footer";

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
};

type InvoiceSuggestion = {
  invoice_no: string;
  customer_name: string;
  sales_date: string;
  sales_item_total: number;
  tax: number;
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

export default function WhtClient({ customers, initialRecords, invoices }: { customers: string[]; initialRecords: WhtRecord[]; invoices: InvoiceSuggestion[] }) {
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
    const match = invoiceSuggestions.find((item) => String(item.invoice_no) === value.trim());
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

  return (
    <div className="dashboard-shell" dir={lang === "ar" ? "rtl" : "ltr"}>
      <Header active="wht" lang={lang} onToggleLang={() => setLang((value) => value === "en" ? "ar" : "en")} />
      <main className="wht-page">
        <section className="page-hero">
          <div><p>WITHHOLDING TAX</p><h1>Collected WHT</h1><span>Record and track collected withholding tax at 1% of invoice subtotal.</span></div>
        </section>

        <section className="wht-form-card">
          <div className="wht-section-heading"><div><p>{editingId ? "EDIT RECORD" : "NEW RECORD"}</p><h2>{editingId ? "Edit WHT Collection" : "Add WHT Collection"}</h2></div><strong>WHT Rate: 1%</strong></div>
          <div className="wht-form-grid">
            <label>Customer Name<select value={form.customerName} onChange={(e) => update("customerName", e.target.value)}><option value="">Select customer</option>{customers.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
            <label>Invoice No.<input list="wht-invoice-suggestions" value={form.invoiceNo} onChange={(e) => updateInvoiceNumber(e.target.value)} placeholder="Type an old invoice or select an existing one" /><datalist id="wht-invoice-suggestions">{invoiceSuggestions.map((item, index) => <option key={`${item.invoice_no}-${item.customer_name}-${index}`} value={item.invoice_no}>{item.customer_name} · {displayDate(item.sales_date)}</option>)}</datalist><small>Manual invoice numbers are allowed.</small></label>
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
          <article><span>Remaining WHT</span><strong>{money(totals.wht - totals.collected)}</strong></article>
        </section>

        <section className="wht-table-card">
          <div className="wht-toolbar"><h2>WHT Records</h2><select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)}><option value="All">All Customers</option>{customers.map((name) => <option key={name}>{name}</option>)}</select><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice number" /></div>
          <div className="table-scroll"><table><thead><tr><th>Customer</th><th>Invoice No.</th><th>Date</th><th>Subtotal</th><th>TAX</th><th>Total</th><th>WHT</th><th>Collected</th><th>Remaining</th><th>Collection Date</th><th>Actions</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td>{item.customer_name}</td><td>{item.invoice_no}</td><td>{displayDate(item.invoice_date)}</td><td>{money(item.subtotal)}</td><td>{money(item.tax)}</td><td>{money(item.total)}</td><td>{money(item.wht_amount)}</td><td>{money(item.collected_amount)}</td><td>{money(item.wht_amount - item.collected_amount)}</td><td>{displayDate(item.collection_date)}</td><td><div className="wht-row-actions"><button onClick={() => edit(item)}>Edit</button><button className="danger" onClick={() => remove(item.id)}>Delete</button></div></td></tr>)}</tbody></table>{filtered.length === 0 && <p className="empty-state">No WHT records found.</p>}</div>
        </section>
      </main>
      <Footer lang={lang} />
    </div>
  );
}
