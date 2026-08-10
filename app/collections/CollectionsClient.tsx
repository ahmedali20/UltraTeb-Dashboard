"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "../Header";
import Footer from "../Footer";

type Invoice = { id: string | number; invoice_no: string; customer_name: string; sales_date: string; due_date: string | null; total_sales: number; sales_rep: string | null };
type Collection = { id: number; invoice_id: string; invoice_no: string; customer_name: string; collection_date: string; amount: number; payment_method: string; cheque_status: string | null; cheque_status_date: string | null; reference_no: string | null; notes: string | null };
type WhtCollection = { invoice_no: string; collected_amount: number };
const emptyForm = { customerName: "", invoiceId: "", collectionDate: new Date().toISOString().slice(0, 10), amount: "", paymentMethod: "BANK_TRANSFER", referenceNo: "", notes: "" };
const money = (value: number) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLabel = (value: string | null) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).replaceAll(" ", "-") : "—";
const clearedAmount = (record: Collection) => record.payment_method !== "CHEQUE" || record.cheque_status === "COLLECTED" ? Number(record.amount || 0) : 0;

export default function CollectionsClient({ invoices, initialCollections, initialWht, canEdit }: { invoices: Invoice[]; initialCollections: Collection[]; initialWht: WhtCollection[]; canEdit: boolean }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [records, setRecords] = useState(initialCollections);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("All");
  const invoiceMap = useMemo(() => new Map(invoices.map((invoice) => [String(invoice.id), invoice])), [invoices]);
  const whtByInvoiceNo = useMemo(() => initialWht.reduce((map, item) => map.set(String(item.invoice_no), (map.get(String(item.invoice_no)) ?? 0) + Number(item.collected_amount || 0)), new Map<string, number>()), [initialWht]);
  const collectedByInvoice = useMemo(() => {
    const map = records.reduce((result, record) => result.set(record.invoice_id, (result.get(record.invoice_id) ?? 0) + clearedAmount(record)), new Map<string, number>());
    invoices.forEach((invoice) => map.set(String(invoice.id), (map.get(String(invoice.id)) ?? 0) + (whtByInvoiceNo.get(String(invoice.invoice_no)) ?? 0)));
    return map;
  }, [records, invoices, whtByInvoiceNo]);
  const customers = useMemo(() => Array.from(new Set(invoices.map((invoice) => invoice.customer_name))).sort(), [invoices]);
  const filtered = useMemo(() => records.filter((record) => (customerFilter === "All" || record.customer_name === customerFilter) && (!search.trim() || `${record.invoice_no} ${record.customer_name} ${record.reference_no ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()))), [records, customerFilter, search]);
  const filteredInvoices = useMemo(() => invoices.filter((invoice) => (customerFilter === "All" || invoice.customer_name === customerFilter) && (!search.trim() || `${invoice.invoice_no} ${invoice.customer_name}`.toLowerCase().includes(search.trim().toLowerCase()))), [invoices, customerFilter, search]);
  const totalCollected = filtered.reduce((sum, record) => sum + clearedAmount(record), 0) + filteredInvoices.reduce((sum, invoice) => sum + (whtByInvoiceNo.get(String(invoice.invoice_no)) ?? 0), 0);
  const selectedInvoice = invoiceMap.get(form.invoiceId);
  const customerInvoices = useMemo(() => invoices.filter((invoice) => invoice.customer_name === form.customerName), [invoices, form.customerName]);

  useEffect(() => {
    const invoiceId = new URLSearchParams(window.location.search).get("invoice");
    const invoice = invoiceId ? invoiceMap.get(invoiceId) : null;
    if (invoice) setForm((current) => ({ ...current, customerName: invoice.customer_name, invoiceId: String(invoice.id) }));
  }, [invoiceMap]);

  function update(name: keyof typeof emptyForm, value: string) { setForm((current) => ({ ...current, [name]: value })); }
  function reset() { setForm(emptyForm); setEditingId(null); }
  function edit(record: Collection) { setEditingId(record.id); setForm({ customerName: record.customer_name, invoiceId: record.invoice_id, collectionDate: record.collection_date, amount: String(record.amount), paymentMethod: record.payment_method, referenceNo: record.reference_no ?? "", notes: record.notes ?? "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/collections", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingId, ...form }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return alert(result.error || "Unable to save collection.");
      setRecords((current) => editingId ? current.map((record) => record.id === editingId ? result.data : record) : [result.data, ...current]);
      reset();
    } finally { setSaving(false); }
  }

  async function remove(id: number) {
    if (!confirm("Delete this collection record?")) return;
    const response = await fetch(`/api/collections?id=${id}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return alert(result.error || "Unable to delete collection.");
    setRecords((current) => current.filter((record) => record.id !== id));
  }

  return <div className="dashboard-shell" dir={lang === "ar" ? "rtl" : "ltr"}>
    <Header active="collections" lang={lang} onToggleLang={() => setLang((value) => value === "en" ? "ar" : "en")} />
    <main className="collections-page">
      <section className="collections-hero"><div><p>ACCOUNTS RECEIVABLE</p><h1>Invoice Collections</h1><span>Record partial or full customer payments and track outstanding balances.</span></div><article><span>Total Settled Including WHT</span><strong>EGP {money(totalCollected)}</strong></article></section>
      {canEdit && <section className="collection-form-card"><div className="collections-heading"><div><p>{editingId ? "EDIT PAYMENT" : "NEW PAYMENT"}</p><h2>{editingId ? "Update collection" : "Record a collection"}</h2></div>{editingId && <button onClick={reset}>Cancel Edit</button>}</div><div className="collection-form-grid">
        <label><span>Customer *</span><select value={form.customerName} onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value, invoiceId: "" }))} disabled={Boolean(editingId)}><option value="">Select customer</option>{customers.map((customer) => <option key={customer}>{customer}</option>)}</select></label>
        <label><span>Invoice No. *</span><select value={form.invoiceId} onChange={(event) => update("invoiceId", event.target.value)} disabled={Boolean(editingId) || !form.customerName}><option value="">{form.customerName ? "Select invoice" : "Choose customer first"}</option>{customerInvoices.map((invoice) => <option key={String(invoice.id)} value={String(invoice.id)}>Invoice {invoice.invoice_no} — {dateLabel(invoice.sales_date)} — EGP {money(invoice.total_sales)}</option>)}</select></label>
        <label><span>Collection Date *</span><input type="date" value={form.collectionDate} onChange={(event) => update("collectionDate", event.target.value)} /></label>
        <label><span>Collected Amount *</span><input type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => update("amount", event.target.value)} /></label>
        <label><span>Payment Method *</span><select value={form.paymentMethod} onChange={(event) => update("paymentMethod", event.target.value)}><option value="BANK_TRANSFER">Bank Transfer</option><option value="CHEQUE">Cheque</option><option value="CASH">Cash</option><option value="OTHER">Other</option></select></label>
        <label><span>{form.paymentMethod === "CHEQUE" ? "Cheque No. *" : "Reference No."}</span><input value={form.referenceNo} onChange={(event) => update("referenceNo", event.target.value)} /></label>
        <label className="collection-notes-field"><span>Notes</span><input value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label>
      </div>{selectedInvoice && <div className="collection-invoice-preview"><span>Invoice Total <strong>EGP {money(selectedInvoice.total_sales)}</strong></span><span>Customer Payments + WHT <strong>EGP {money(collectedByInvoice.get(String(selectedInvoice.id)) ?? 0)}</strong></span><span>Collected WHT <strong>EGP {money(whtByInvoiceNo.get(String(selectedInvoice.invoice_no)) ?? 0)}</strong></span><span>Current Remaining <strong>EGP {money(Number(selectedInvoice.total_sales) - (collectedByInvoice.get(String(selectedInvoice.id)) ?? 0))}</strong></span></div>}<div className="collection-form-actions"><button className="primary" onClick={save} disabled={saving || !form.invoiceId || !form.amount}>{saving ? "Saving…" : editingId ? "Save Changes" : "Add Collection"}</button></div></section>}
      <section className="collection-table-card"><div className="collections-toolbar"><div><h2>Collection History</h2><span>{filtered.length} records</span></div><select value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)}><option value="All">All Customers</option>{customers.map((customer) => <option key={customer}>{customer}</option>)}</select><input placeholder="Search invoice, customer or reference" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="table-scroll"><table><thead><tr><th>Date</th><th>Customer</th><th>Invoice</th><th>Method</th><th>Status</th><th>Reference</th><th>Amount</th><th>Invoice Balance</th><th>Notes</th>{canEdit && <th>Actions</th>}</tr></thead><tbody>{filtered.map((record) => { const invoice = invoiceMap.get(record.invoice_id); const balance = Number(invoice?.total_sales ?? 0) - (collectedByInvoice.get(record.invoice_id) ?? 0); return <tr key={record.id}><td>{dateLabel(record.collection_date)}</td><td>{record.customer_name}</td><td><a href={`/sales/${record.invoice_id}`}>{record.invoice_no}</a></td><td>{record.payment_method.replaceAll("_", " ")}</td><td>{record.cheque_status ? record.cheque_status.replaceAll("_", " ") : "Completed"}</td><td>{record.reference_no || "—"}</td><td><strong>EGP {money(record.amount)}</strong></td><td className={balance <= 0 ? "collection-paid" : ""}>EGP {money(balance)}</td><td>{record.notes || "—"}</td>{canEdit && <td><div className="collection-row-actions"><button onClick={() => edit(record)}>Edit</button><button className="danger" onClick={() => remove(record.id)}>Delete</button></div></td>}</tr>; })}{!filtered.length && <tr><td colSpan={canEdit ? 10 : 9} className="collection-empty">No collection records found.</td></tr>}</tbody></table></div></section>
    </main><Footer lang={lang} />
  </div>;
}
