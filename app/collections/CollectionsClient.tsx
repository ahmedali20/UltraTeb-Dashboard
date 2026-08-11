"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "../Header";
import Footer from "../Footer";

type Invoice = { id: string | number; invoice_no: string; customer_name: string; sales_date: string; due_date: string | null; sales_item_total: number; total_sales: number; sales_rep: string | null };
type Collection = { id: number; invoice_id: string; invoice_no: string; customer_name: string; collection_date: string; amount: number; payment_method: string; reference_no: string | null; notes: string | null };
type WhtCollection = { invoice_no: string; wht_amount: number; collected_amount: number };
type ChequeAllocation = { id: number; cheque_id: number; invoice_id: string; invoice_no: string; allocated_amount: number; cheque: { id: number; cheque_no: string; collection_date: string; cheque_date: string; cheque_status: string; cheque_status_date: string; customer_name: string; amount: number; notes: string | null } | null };
const today = new Date().toISOString().slice(0, 10);
const emptyForm = { customerName: "", invoiceId: "", collectionDate: today, chequeDate: today, bankName: "", amount: "", paymentMethod: "BANK_TRANSFER", referenceNo: "", notes: "" };
const money = (value: number) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLabel = (value: string | null) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).replaceAll(" ", "-") : "—";

export default function CollectionsClient({ invoices, initialCollections, initialChequeAllocations, initialWht, canEdit }: { invoices: Invoice[]; initialCollections: Collection[]; initialChequeAllocations: ChequeAllocation[]; initialWht: WhtCollection[]; canEdit: boolean }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [records, setRecords] = useState(initialCollections);
  const [form, setForm] = useState(emptyForm);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("All");
  const invoiceMap = useMemo(() => new Map(invoices.map((invoice) => [String(invoice.id), invoice])), [invoices]);
  const customers = useMemo(() => Array.from(new Set(invoices.map((invoice) => invoice.customer_name))).sort(), [invoices]);
  const customerInvoices = useMemo(() => invoices.filter((invoice) => invoice.customer_name === form.customerName), [invoices, form.customerName]);
  const whtByInvoice = useMemo(() => {
    const map = initialWht.reduce((result, item) => {
      const invoiceNo = String(item.invoice_no ?? "").trim();
      return result.set(invoiceNo, (result.get(invoiceNo) ?? 0) + Number(item.wht_amount || 0));
    }, new Map<string, number>());
    invoices.forEach((invoice) => {
      const invoiceNo = String(invoice.invoice_no ?? "").trim();
      if (!map.has(invoiceNo)) map.set(invoiceNo, Math.round(Number(invoice.sales_item_total || 0) * 0.01 * 100) / 100);
    });
    return map;
  }, [initialWht, invoices]);
  const settledByInvoice = useMemo(() => {
    const map = records.reduce((result, record) => result.set(record.invoice_id, (result.get(record.invoice_id) ?? 0) + Number(record.amount || 0)), new Map<string, number>());
    initialChequeAllocations.forEach((allocation) => {
      if (allocation.cheque?.cheque_status === "COLLECTED") map.set(allocation.invoice_id, (map.get(allocation.invoice_id) ?? 0) + Number(allocation.allocated_amount || 0));
    });
    invoices.forEach((invoice) => map.set(String(invoice.id), (map.get(String(invoice.id)) ?? 0) + (whtByInvoice.get(String(invoice.invoice_no)) ?? 0)));
    return map;
  }, [records, initialChequeAllocations, invoices, whtByInvoice]);
  const filtered = useMemo(() => records.filter((record) => (customerFilter === "All" || record.customer_name === customerFilter) && (!search.trim() || `${record.invoice_no} ${record.customer_name} ${record.reference_no ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()))), [records, customerFilter, search]);
  const allocatedTotal = Object.values(allocations).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const selectedInvoice = invoiceMap.get(form.invoiceId);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("invoice");
    const invoice = id ? invoiceMap.get(id) : null;
    if (invoice) setForm((current) => ({ ...current, customerName: invoice.customer_name, invoiceId: String(invoice.id) }));
  }, [invoiceMap]);

  function update(name: keyof typeof emptyForm, value: string) { setForm((current) => ({ ...current, [name]: value })); }
  function reset() { setForm(emptyForm); setAllocations({}); setEditingId(null); }
  function edit(record: Collection) { setEditingId(record.id); setForm({ customerName: record.customer_name, invoiceId: record.invoice_id, collectionDate: record.collection_date, chequeDate: record.collection_date, bankName: "", amount: String(record.amount), paymentMethod: record.payment_method, referenceNo: record.reference_no ?? "", notes: record.notes ?? "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function save() {
    setSaving(true);
    try {
      const allocatedInvoices = Object.entries(allocations).filter(([, value]) => Number(value) > 0).map(([invoiceId, amount]) => ({ invoiceId, amount: Number(amount) }));
      const response = await fetch("/api/collections", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingId, ...form, allocations: allocatedInvoices }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return alert(result.error || "Unable to save collection.");
      if (form.paymentMethod === "CHEQUE") { window.location.reload(); return; }
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

  function autoAllocateCheque() {
    let chequeRemaining = Math.max(0, Number(form.amount) || 0);
    const next: Record<string, string> = {};
    const invoicesByDueDate = [...customerInvoices].sort((a, b) => {
      if (!a.due_date && !b.due_date) return String(a.invoice_no).localeCompare(String(b.invoice_no), undefined, { numeric: true });
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date) || String(a.invoice_no).localeCompare(String(b.invoice_no), undefined, { numeric: true });
    });
    for (const invoice of invoicesByDueDate) {
      if (chequeRemaining <= 0) break;
      const invoiceId = String(invoice.id);
      const invoiceRemaining = Math.max(0, Number(invoice.total_sales) - (settledByInvoice.get(invoiceId) ?? 0));
      const allocation = Math.min(invoiceRemaining, chequeRemaining);
      if (allocation > 0) {
        next[invoiceId] = allocation.toFixed(2);
        chequeRemaining = Math.round((chequeRemaining - allocation) * 100) / 100;
      }
    }
    setAllocations(next);
  }

  const chequeValid = form.paymentMethod === "CHEQUE" && Boolean(form.customerName && form.referenceNo && form.bankName.trim() && form.collectionDate && form.chequeDate && Number(form.amount) > 0 && allocatedTotal > 0 && Math.abs(allocatedTotal - Number(form.amount)) <= .01);
  return <div className="dashboard-shell" dir={lang === "ar" ? "rtl" : "ltr"}>
    <Header active="collections" lang={lang} onToggleLang={() => setLang((value) => value === "en" ? "ar" : "en")} />
    <main className="collections-page">
      <section className="collections-hero"><div><p>ACCOUNTS RECEIVABLE</p><h1>Invoice Collections</h1><span>Record customer payments and allocate one cheque across multiple invoices.</span></div></section>
      {canEdit && <section className="collection-form-card">
        <div className="collections-heading"><div><p>{editingId ? "EDIT PAYMENT" : "NEW PAYMENT"}</p><h2>{editingId ? "Update collection" : "Record a collection"}</h2></div>{editingId && <button onClick={reset}>Cancel Edit</button>}</div>
        <div className="collection-form-grid">
          <label><span>Customer *</span><select value={form.customerName} disabled={Boolean(editingId)} onChange={(event) => { setForm((current) => ({ ...current, customerName: event.target.value, invoiceId: "" })); setAllocations({}); }}><option value="">Select customer</option>{customers.map((customer) => <option key={customer}>{customer}</option>)}</select></label>
          {form.paymentMethod !== "CHEQUE" && <label><span>Invoice No. *</span><select value={form.invoiceId} disabled={!form.customerName || Boolean(editingId)} onChange={(event) => update("invoiceId", event.target.value)}><option value="">{form.customerName ? "Select invoice" : "Choose customer first"}</option>{customerInvoices.map((invoice) => <option key={String(invoice.id)} value={String(invoice.id)}>Invoice {invoice.invoice_no} — EGP {money(invoice.total_sales)}</option>)}</select></label>}
          <label><span>Collection Date *</span><input type="date" value={form.collectionDate} onChange={(event) => update("collectionDate", event.target.value)} /></label>
          {form.paymentMethod === "CHEQUE" && <label><span>Cheque Date *</span><input type="date" value={form.chequeDate} onChange={(event) => update("chequeDate", event.target.value)} /></label>}
          {form.paymentMethod === "CHEQUE" && <label><span>Bank Name *</span><input value={form.bankName} placeholder="Enter bank name" onChange={(event) => update("bankName", event.target.value)} /></label>}
          <label><span>{form.paymentMethod === "CHEQUE" ? "Cheque Amount *" : "Collected Amount *"}</span><input type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => update("amount", event.target.value)} /></label>
          <label><span>Payment Method *</span><select value={form.paymentMethod} disabled={Boolean(editingId)} onChange={(event) => { update("paymentMethod", event.target.value); setAllocations({}); }}><option value="BANK_TRANSFER">Bank Transfer</option><option value="CHEQUE">Cheque</option><option value="CASH">Cash</option><option value="OTHER">Other</option></select></label>
          <label><span>{form.paymentMethod === "CHEQUE" ? "Cheque No. *" : "Reference No."}</span><input value={form.referenceNo} onChange={(event) => update("referenceNo", event.target.value)} /></label>
          <label className="collection-notes-field"><span>Notes</span><input value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label>
        </div>
        {form.paymentMethod === "CHEQUE" && form.customerName && <div className="cheque-allocation-panel">
          <div className="cheque-allocation-summary"><span>Cheque Amount <strong>EGP {money(Number(form.amount))}</strong></span><span>Allocated <strong>EGP {money(allocatedTotal)}</strong></span><span className={Math.abs(allocatedTotal - Number(form.amount)) <= .01 ? "balanced" : "unbalanced"}>Unallocated <strong>EGP {money(Number(form.amount) - allocatedTotal)}</strong></span></div>
          <div className="cheque-allocation-tools"><button type="button" disabled={!Number(form.amount)} onClick={autoAllocateCheque}>Auto Allocate Cheque</button><span>Earliest due date is allocated first; the final invoice receives only the cheque balance left.</span></div>
          <div className="cheque-allocation-list">{customerInvoices.map((invoice) => { const invoiceId = String(invoice.id); const wht = whtByInvoice.get(String(invoice.invoice_no)) ?? 0; const remaining = Number(invoice.total_sales) - (settledByInvoice.get(invoiceId) ?? 0); return <div className="cheque-allocation-row" key={invoiceId}><span><strong>Invoice {invoice.invoice_no} · {dateLabel(invoice.sales_date)}</strong><small><b>Invoice Total:</b> EGP {money(invoice.total_sales)} <b>WHT:</b> EGP {money(wht)} <b>Remaining:</b> EGP {money(remaining)}</small></span><div><input type="number" min="0" max={Math.max(0, remaining)} step="0.01" placeholder="Write amount" value={allocations[invoiceId] ?? ""} onChange={(event) => setAllocations((current) => ({ ...current, [invoiceId]: event.target.value }))} /><button type="button" disabled={remaining <= 0} onClick={() => setAllocations((current) => ({ ...current, [invoiceId]: Math.max(0, remaining).toFixed(2) }))}>Use Full Remaining</button></div></div>; })}</div>
        </div>}
        {selectedInvoice && form.paymentMethod !== "CHEQUE" && <div className="collection-invoice-preview"><span>Invoice Total <strong>EGP {money(selectedInvoice.total_sales)}</strong></span><span>Total Settled <strong>EGP {money(settledByInvoice.get(String(selectedInvoice.id)) ?? 0)}</strong></span><span>Remaining <strong>EGP {money(Number(selectedInvoice.total_sales) - (settledByInvoice.get(String(selectedInvoice.id)) ?? 0))}</strong></span></div>}
        <div className="collection-form-actions"><button className="primary" onClick={save} disabled={saving || (form.paymentMethod === "CHEQUE" ? !chequeValid : !form.invoiceId || !form.amount)}>{saving ? "Saving…" : editingId ? "Save Changes" : form.paymentMethod === "CHEQUE" ? "Add Cheque" : "Add Collection"}</button></div>
      </section>}
      <section className="collection-table-card"><div className="collections-toolbar"><div><h2>Non-Cheque Collection History</h2><span>{filtered.length} records</span></div><select value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)}><option value="All">All Customers</option>{customers.map((customer) => <option key={customer}>{customer}</option>)}</select><input placeholder="Search invoice, customer or reference" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="table-scroll"><table><thead><tr><th>Date</th><th>Customer</th><th>Invoice</th><th>Method</th><th>Reference</th><th>Amount</th><th>Invoice Balance</th><th>Notes</th>{canEdit && <th>Actions</th>}</tr></thead><tbody>{filtered.map((record) => { const invoice = invoiceMap.get(record.invoice_id); const balance = Number(invoice?.total_sales ?? 0) - (settledByInvoice.get(record.invoice_id) ?? 0); return <tr key={record.id}><td>{dateLabel(record.collection_date)}</td><td>{record.customer_name}</td><td><a href={`/sales/${record.invoice_id}`}>{record.invoice_no}</a></td><td>{record.payment_method.replaceAll("_", " ")}</td><td>{record.reference_no || "—"}</td><td><strong>EGP {money(record.amount)}</strong></td><td className={balance <= 0 ? "collection-paid" : ""}>EGP {money(balance)}</td><td>{record.notes || "—"}</td>{canEdit && <td><div className="collection-row-actions"><button onClick={() => edit(record)}>Edit</button><button className="danger" onClick={() => remove(record.id)}>Delete</button></div></td>}</tr>; })}{!filtered.length && <tr><td colSpan={canEdit ? 9 : 8} className="collection-empty">No collection records found.</td></tr>}</tbody></table></div></section>
    </main><Footer lang={lang} />
  </div>;
}
