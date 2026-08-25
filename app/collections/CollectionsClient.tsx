"use client";

import { useEffect, useMemo, useState } from "react";
import Header from "../Header";
import Footer from "../Footer";

type Invoice = { id: string | number; invoice_no: string; customer_name: string; sales_date: string; due_date: string | null; sales_item_total: number; total_sales: number; base_sales_item_total?: number; base_total_sales?: number; note_wht_adjustment?: number; sales_rep: string | null };
type Collection = { id: number; invoice_id: string; invoice_no: string; customer_name: string; collection_date: string; amount: number; transfer_fees: number; cash_fraction: number; wht_deducted_amount: number; payment_method: string; reference_no: string | null; notes: string | null; updated_at?: string | null };
type WhtCollection = { invoice_no: string; wht_amount: number; collected_amount: number };
type ChequeAllocation = { id: number; cheque_id: number; invoice_id: string; invoice_no: string; allocated_amount: number; cash_fraction: number; wht_deducted_amount: number; cheque: { id: number; cheque_no: string; collection_date: string; cheque_date: string; cheque_status: string; cheque_status_date: string; customer_name: string; amount: number; notes: string | null } | null };
type CollectionOperation = { key: string; method: string; records: Collection[]; customer_name: string; collection_date: string; reference_no: string | null; notes: string | null; amount: number; transfer_fees: number; cash_fraction: number; wht_deducted_amount: number };
const today = new Date().toISOString().slice(0, 10);
const emptyForm = { customerName: "", invoiceId: "", collectionDate: today, chequeDate: today, bankName: "", amount: "", transferFees: "", cashFraction: "", paymentMethod: "CASH", referenceNo: "", notes: "" };
const money = (value: number) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLabel = (value: string | null) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).replaceAll(" ", "-") : "—";

export default function CollectionsClient({ invoices, initialCollections, initialChequeAllocations, initialWht, canEdit }: { invoices: Invoice[]; initialCollections: Collection[]; initialChequeAllocations: ChequeAllocation[]; initialWht: WhtCollection[]; canEdit: boolean }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [records, setRecords] = useState(initialCollections);
  const [form, setForm] = useState(emptyForm);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [whtDeductions, setWhtDeductions] = useState<Record<string, boolean>>({});
  const [applyWht, setApplyWht] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingIds, setEditingIds] = useState<number[]>([]);
  const [activeCategory, setActiveCategory] = useState<"CASH" | "CHEQUE" | "BANK_TRANSFER">("CASH");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("All");
  const invoiceMap = useMemo(() => new Map(invoices.map((invoice) => [String(invoice.id), invoice])), [invoices]);
  const customers = useMemo(() => Array.from(new Set(invoices.map((invoice) => invoice.customer_name))).sort(), [invoices]);
  const historyCustomers = useMemo(() => Array.from(new Set(records.map((record) => record.customer_name))).sort(), [records]);
  const customerInvoices = useMemo(() => invoices.filter((invoice) => invoice.customer_name === form.customerName), [invoices, form.customerName]);
  const recordedWhtByInvoice = useMemo(() => initialWht.reduce((result, item) => {
      const invoiceNo = String(item.invoice_no ?? "").trim();
      return result.set(invoiceNo, (result.get(invoiceNo) ?? 0) + Number(item.wht_amount || 0));
    }, new Map<string, number>()), [initialWht]);
  const whtByInvoice = useMemo(() => {
    const map = new Map<string, number>();
    invoices.forEach((invoice) => {
      const invoiceNo = String(invoice.invoice_no ?? "").trim();
      const recorded = recordedWhtByInvoice.get(invoiceNo);
      const calculated = Math.round(Number(invoice.sales_item_total || 0)) / 100;
      map.set(invoiceNo, recorded == null ? calculated : Math.max(0, recorded + Number(invoice.note_wht_adjustment || 0)));
    });
    return map;
  }, [recordedWhtByInvoice, invoices]);
  const deductedWhtByInvoice = useMemo(() => {
    const map = new Map<string, number>();
    records.forEach((record) => map.set(String(record.invoice_id), (map.get(String(record.invoice_id)) ?? 0) + Number(record.wht_deducted_amount || 0)));
    initialChequeAllocations.forEach((allocation) => map.set(String(allocation.invoice_id), (map.get(String(allocation.invoice_id)) ?? 0) + Number(allocation.wht_deducted_amount || 0)));
    return map;
  }, [records, initialChequeAllocations]);
  const settledByInvoice = useMemo(() => {
    const payments = new Map<string, number>();
    const deductions = new Map<string, number>();
    records.forEach((record) => {
      payments.set(record.invoice_id, (payments.get(record.invoice_id) ?? 0) + Number(record.amount || 0) + Number(record.cash_fraction || 0));
      deductions.set(record.invoice_id, (deductions.get(record.invoice_id) ?? 0) + Number(record.wht_deducted_amount || 0));
    });
    initialChequeAllocations.forEach((allocation) => {
      if (allocation.cheque?.cheque_status === "COLLECTED") {
        payments.set(allocation.invoice_id, (payments.get(allocation.invoice_id) ?? 0) + Number(allocation.allocated_amount || 0) + Number(allocation.cash_fraction || 0));
        deductions.set(allocation.invoice_id, (deductions.get(allocation.invoice_id) ?? 0) + Number(allocation.wht_deducted_amount || 0));
      }
    });
    const map = new Map<string, number>();
    invoices.forEach((invoice) => {
      const invoiceId = String(invoice.id);
      const recordedWht = recordedWhtByInvoice.get(String(invoice.invoice_no)) ?? 0;
      map.set(invoiceId, (payments.get(invoiceId) ?? 0) + Math.max(deductions.get(invoiceId) ?? 0, recordedWht));
    });
    return map;
  }, [records, initialChequeAllocations, invoices, recordedWhtByInvoice]);
  const reservedByPendingCheque = useMemo(() => {
    const map = new Map<string, number>();
    initialChequeAllocations.forEach((allocation) => {
      if (!allocation.cheque || allocation.cheque.cheque_status === "COLLECTED" || ["REFUSED", "RETURNED_TO_CUSTOMER"].includes(allocation.cheque.cheque_status)) return;
      const invoiceId = String(allocation.invoice_id);
      const reserved = Number(allocation.allocated_amount || 0) + Number(allocation.cash_fraction || 0) + Number(allocation.wht_deducted_amount || 0);
      map.set(invoiceId, (map.get(invoiceId) ?? 0) + reserved);
    });
    return map;
  }, [initialChequeAllocations]);
  const editingOwnSettlement = useMemo(() => records.filter((record) => editingIds.includes(record.id)).reduce((map, record) => {
    const id = String(record.invoice_id);
    map.set(id, (map.get(id) ?? 0) + Number(record.amount || 0) + Number(record.cash_fraction || 0) + Number(record.wht_deducted_amount || 0));
    return map;
  }, new Map<string, number>()), [records, editingIds]);
  const editingOwnWht = useMemo(() => records.filter((record) => editingIds.includes(record.id)).reduce((map, record) => {
    const id = String(record.invoice_id);
    map.set(id, (map.get(id) ?? 0) + Number(record.wht_deducted_amount || 0));
    return map;
  }, new Map<string, number>()), [records, editingIds]);
  const availableInvoiceBalance = (invoice: Invoice) => Math.max(0,
    Number(invoice.total_sales) -
    (settledByInvoice.get(String(invoice.id)) ?? 0) -
    (reservedByPendingCheque.get(String(invoice.id)) ?? 0) +
    (editingOwnSettlement.get(String(invoice.id)) ?? 0)
  );
  const allocatableCustomerInvoices = customerInvoices.filter((invoice) => {
    return availableInvoiceBalance(invoice) > 0.005;
  });
  const selectableCustomerInvoices = useMemo(() => editingId
    ? customerInvoices.filter((invoice) => String(invoice.id) === form.invoiceId)
    : allocatableCustomerInvoices,
  [editingId, customerInvoices, form.invoiceId, allocatableCustomerInvoices]);
  const operations = useMemo(() => {
    const grouped = new Map<string, Collection[]>();
    records.filter((record) => record.payment_method === activeCategory).forEach((record) => {
      const key = record.payment_method === "BANK_TRANSFER"
        ? [record.payment_method, record.customer_name, record.updated_at || record.collection_date, record.reference_no ?? "", record.notes ?? ""].join("|")
        : `${record.payment_method}|${record.id}`;
      grouped.set(key, [...(grouped.get(key) ?? []), record]);
    });
    return Array.from(grouped.entries()).map(([key, rows]): CollectionOperation => ({ key, method: rows[0].payment_method, records: rows, customer_name: rows[0].customer_name, collection_date: rows[0].collection_date, reference_no: rows[0].reference_no, notes: rows[0].notes, amount: rows.reduce((sum, row) => sum + Number(row.amount || 0), 0), transfer_fees: rows.reduce((sum, row) => sum + Number(row.transfer_fees || 0), 0), cash_fraction: rows.reduce((sum, row) => sum + Number(row.cash_fraction || 0), 0), wht_deducted_amount: rows.reduce((sum, row) => sum + Number(row.wht_deducted_amount || 0), 0) }));
  }, [records, activeCategory]);
  const filteredOperations = useMemo(() => operations.filter((operation) => (customerFilter === "All" || operation.customer_name === customerFilter) && (!search.trim() || `${operation.records.map((record) => record.invoice_no).join(" ")} ${operation.customer_name} ${operation.reference_no ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()))), [operations, customerFilter, search]);
  const chequeOperations = useMemo(() => Array.from(initialChequeAllocations.reduce((map, allocation) => {
    if (!allocation.cheque) return map;
    const key = String(allocation.cheque.id);
    const current = map.get(key) ?? { cheque: allocation.cheque, allocations: [] as ChequeAllocation[] };
    current.allocations.push(allocation);
    map.set(key, current);
    return map;
  }, new Map<string, { cheque: NonNullable<ChequeAllocation["cheque"]>; allocations: ChequeAllocation[] }>()).values()), [initialChequeAllocations]);
  const allocatedTotal = Object.values(allocations).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const selectedInvoice = invoiceMap.get(form.invoiceId);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("invoice");
    const invoice = id ? invoiceMap.get(id) : null;
    if (invoice) setForm((current) => ({ ...current, customerName: invoice.customer_name, invoiceId: String(invoice.id) }));
  }, [invoiceMap]);

  function update(name: keyof typeof emptyForm, value: string) { setForm((current) => ({ ...current, [name]: value })); }
  function reset() { setForm({ ...emptyForm, paymentMethod: activeCategory }); setAllocations({}); setWhtDeductions({}); setApplyWht(false); setEditingId(null); setEditingIds([]); }
  function editOperation(operation: CollectionOperation) { const record = operation.records[0]; setActiveCategory(operation.method as "CASH" | "BANK_TRANSFER"); setEditingId(record.id); setEditingIds(operation.records.map((item) => item.id)); setApplyWht(Number(record.wht_deducted_amount || 0) > 0); setAllocations(operation.records.reduce((result, item) => ({ ...result, [item.invoice_id]: String(item.amount) }), {})); setWhtDeductions(operation.records.reduce((result, item) => ({ ...result, [item.invoice_id]: Number(item.wht_deducted_amount || 0) > 0 }), {})); setForm({ customerName: operation.customer_name, invoiceId: operation.records.length === 1 ? record.invoice_id : "", collectionDate: operation.collection_date, chequeDate: operation.collection_date, bankName: "", amount: String(Math.max(0, operation.amount - operation.transfer_fees)), transferFees: operation.transfer_fees ? String(operation.transfer_fees) : "", cashFraction: operation.cash_fraction ? String(operation.cash_fraction) : "", paymentMethod: operation.method, referenceNo: operation.reference_no ?? "", notes: operation.notes ?? "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function save() {
    setSaving(true);
    try {
      const allocatedInvoices = Object.entries(allocations).filter(([, value]) => Number(value) > 0).map(([invoiceId, amount]) => ({ invoiceId, amount: Number(amount), whtDeductedAmount: whtDeductions[invoiceId] && (deductedWhtByInvoice.get(invoiceId) ?? 0) - (editingOwnWht.get(invoiceId) ?? 0) <= 0.005 ? (whtByInvoice.get(String(invoiceMap.get(invoiceId)?.invoice_no)) ?? 0) : 0 }));
      const selectedOwnsWht = editingId ? Number(records.find((record) => record.id === editingId)?.wht_deducted_amount || 0) > 0 : false;
      const selectedHasWht = selectedInvoice ? (deductedWhtByInvoice.get(String(selectedInvoice.id)) ?? 0) > 0.005 : false;
      const selectedWht = selectedInvoice && applyWht && (!selectedHasWht || selectedOwnsWht) ? (whtByInvoice.get(String(selectedInvoice.invoice_no)) ?? 0) : 0;
      const response = await fetch("/api/collections", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingId, ids: editingIds, ...form, whtDeductedAmount: selectedWht, allocations: allocatedInvoices }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return alert(result.error || "Unable to save collection.");
      if (form.paymentMethod === "CHEQUE") { window.location.reload(); return; }
      const savedRecords: Collection[] = Array.isArray(result.data) ? result.data : [result.data];
      setRecords((current) => editingId ? [...savedRecords, ...current.filter((record) => !(editingIds.length ? editingIds : [editingId]).includes(record.id))] : [...savedRecords, ...current]);
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

  async function removeOperation(operation: CollectionOperation) {
    if (!confirm(`Delete this complete ${operation.method === "BANK_TRANSFER" ? "bank-transfer" : "cash"} operation and all its invoice allocations?`)) return;
    const ids = operation.records.map((record) => record.id);
    const response = await fetch(`/api/collections?ids=${ids.join(",")}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return alert(result.error || "Unable to delete collection operation.");
    setRecords((current) => current.filter((record) => !ids.includes(record.id)));
  }

  function autoAllocatePayment() {
    let paymentRemaining = form.paymentMethod === "BANK_TRANSFER"
      ? Math.max(0, (Number(form.amount) || 0) + (Number(form.transferFees) || 0))
      : Math.max(0, Number(form.amount) || 0);
    const next: Record<string, string> = {};
    const invoicesByDueDate = [...allocatableCustomerInvoices].sort((a, b) => {
      if (!a.due_date && !b.due_date) return String(a.invoice_no).localeCompare(String(b.invoice_no), undefined, { numeric: true });
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date) || String(a.invoice_no).localeCompare(String(b.invoice_no), undefined, { numeric: true });
    });
    for (const invoice of invoicesByDueDate) {
      if (paymentRemaining <= 0) break;
      const invoiceId = String(invoice.id);
      const wht = whtDeductions[invoiceId] ? (whtByInvoice.get(String(invoice.invoice_no)) ?? 0) : 0;
      const invoiceRemaining = Math.max(0, availableInvoiceBalance(invoice) - wht);
      const allocation = Math.min(invoiceRemaining, paymentRemaining);
      if (allocation > 0) {
        next[invoiceId] = allocation.toFixed(2);
        paymentRemaining = Math.round((paymentRemaining - allocation) * 100) / 100;
      }
    }
    setAllocations(next);
  }

  const chequeValid = form.paymentMethod === "CHEQUE" && Boolean(form.customerName && form.referenceNo && form.bankName.trim() && form.collectionDate && form.chequeDate && Number(form.amount) > 0 && allocatedTotal > 0 && allocatedTotal <= Number(form.amount) + .01);
  const transferFees = form.paymentMethod === "BANK_TRANSFER" ? Math.max(0, Number(form.transferFees) || 0) : 0;
  const transferAllocationTotal = (Number(form.amount) || 0) + transferFees;
  const multiTransfer = form.paymentMethod === "BANK_TRANSFER" && (!editingId || editingIds.length > 1);
  const transferValid = multiTransfer && Boolean(form.customerName && form.collectionDate && Number(form.amount) > 0 && allocatedTotal > 0 && Math.abs(allocatedTotal - transferAllocationTotal) <= .01);
  const cashFraction = form.paymentMethod === "CASH" ? Math.max(0, Number(form.cashFraction) || 0) : 0;
  const editingRecord = editingId ? records.find((record) => record.id === editingId) : null;
  const selectedWhtAlreadyApplied = selectedInvoice && (deductedWhtByInvoice.get(String(selectedInvoice.id)) ?? 0) > 0.005 && Number(editingRecord?.wht_deducted_amount || 0) <= 0;
  const selectedWhtAmount = selectedInvoice && applyWht && !selectedWhtAlreadyApplied ? (whtByInvoice.get(String(selectedInvoice.invoice_no)) ?? 0) : 0;
  const collectedTotal = (Number(form.amount) || 0) + transferFees + cashFraction;
  const remainingBeforeAutoFraction = selectedInvoice
    ? Math.max(0, Number(selectedInvoice.total_sales) - (settledByInvoice.get(String(selectedInvoice.id)) ?? 0) - collectedTotal - selectedWhtAmount)
    : 0;
  const automaticFraction = remainingBeforeAutoFraction > 0 && remainingBeforeAutoFraction < 1
    ? Math.round(remainingBeforeAutoFraction * 100) / 100
    : 0;
  return <div className="dashboard-shell" dir={lang === "ar" ? "rtl" : "ltr"}>
    <Header active="collections" lang={lang} onToggleLang={() => setLang((value) => value === "en" ? "ar" : "en")} />
    <main className="collections-page">
      <section className="collections-hero"><div><p>ACCOUNTS RECEIVABLE</p><h1>Invoice Collections</h1><span>Record customer payments and allocate one cheque across multiple invoices.</span></div></section>
      <section className="collection-category-tabs" aria-label="Collection categories">
        {(["CASH", "CHEQUE", "BANK_TRANSFER"] as const).map((category) => <button key={category} className={activeCategory === category ? "active" : ""} onClick={() => { setActiveCategory(category); setForm({ ...emptyForm, paymentMethod: category }); setAllocations({}); setWhtDeductions({}); setEditingId(null); setEditingIds([]); }}>{category === "BANK_TRANSFER" ? "Bank Transfers" : category === "CHEQUE" ? "Cheques" : "Cash"}<small>{category === "CASH" ? "Cash receipts" : category === "CHEQUE" ? "Cheque workflow" : "Multi-invoice transfers"}</small></button>)}
      </section>
      {canEdit && <section className="collection-form-card">
        <div className="collections-heading"><div><p>{editingId ? "EDIT PAYMENT" : "NEW PAYMENT"}</p><h2>{editingId ? "Update collection" : "Record a collection"}</h2></div>{editingId && <button onClick={reset}>Cancel Edit</button>}</div>
        <div className="collection-form-grid">
          <label><span>Customer *</span><select value={form.customerName} disabled={Boolean(editingId)} onChange={(event) => { setForm((current) => ({ ...current, customerName: event.target.value, invoiceId: "" })); setAllocations({}); }}><option value="">Select customer</option>{customers.map((customer) => <option key={customer}>{customer}</option>)}</select></label>
          {form.paymentMethod !== "CHEQUE" && !multiTransfer && <label><span>Invoice No. *</span><select value={form.invoiceId} disabled={!form.customerName || Boolean(editingId)} onChange={(event) => update("invoiceId", event.target.value)}><option value="">{form.customerName ? (selectableCustomerInvoices.length ? "Select invoice" : "No unpaid invoices") : "Choose customer first"}</option>{selectableCustomerInvoices.map((invoice) => { const remaining = Math.max(0, Number(invoice.total_sales) - (settledByInvoice.get(String(invoice.id)) ?? 0)); return <option key={String(invoice.id)} value={String(invoice.id)}>Invoice {invoice.invoice_no} — Remaining EGP {money(remaining)}</option>; })}</select></label>}
          <label><span>Collection Date *</span><input type="date" value={form.collectionDate} onChange={(event) => update("collectionDate", event.target.value)} /></label>
          {form.paymentMethod === "CHEQUE" && <label><span>Cheque Date *</span><input type="date" value={form.chequeDate} onChange={(event) => update("chequeDate", event.target.value)} /></label>}
          {form.paymentMethod === "CHEQUE" && <label><span>Bank Name *</span><input value={form.bankName} placeholder="Enter bank name" onChange={(event) => update("bankName", event.target.value)} /></label>}
          <label><span>{form.paymentMethod === "CHEQUE" ? "Cheque Amount *" : "Collected Amount *"}</span><input type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => update("amount", event.target.value)} /></label>
          <label><span>Payment Category</span><select value={form.paymentMethod} disabled><option value="BANK_TRANSFER">Bank Transfer</option><option value="CHEQUE">Cheque</option><option value="CASH">Cash</option></select></label>
          {form.paymentMethod === "BANK_TRANSFER" && <label><span>Transfer Fees</span><input type="number" min="0" step="0.01" value={form.transferFees} placeholder="0.00" onChange={(event) => update("transferFees", event.target.value)} /></label>}
          {form.paymentMethod === "CASH" && <label><span>Unpayable Cash Fraction</span><input type="number" min="0" step="0.01" value={form.cashFraction} placeholder="0.00" onChange={(event) => update("cashFraction", event.target.value)} /></label>}
          <label><span>{form.paymentMethod === "CHEQUE" ? "Cheque No. *" : "Reference No."}</span><input value={form.referenceNo} onChange={(event) => update("referenceNo", event.target.value)} /></label>
          <label className="collection-notes-field"><span>Notes</span><input value={form.notes} onChange={(event) => update("notes", event.target.value)} /></label>
        </div>
        {form.paymentMethod === "BANK_TRANSFER" && <div className="collection-transfer-summary"><span>Bank Amount <strong>EGP {money(Number(form.amount))}</strong></span><span>Transfer Fees <strong>EGP {money(transferFees)}</strong></span><span>Total Collected <strong>EGP {money(collectedTotal)}</strong></span></div>}
        {form.paymentMethod === "CASH" && <div className="collection-transfer-summary"><span>Cash Received <strong>EGP {money(Number(form.amount))}</strong></span><span>Unpayable Fraction <strong>EGP {money(cashFraction)}</strong></span><span>Total Settled <strong>EGP {money(collectedTotal)}</strong></span></div>}
        {form.paymentMethod === "CHEQUE" && form.customerName && <div className="cheque-allocation-panel">
          <div className="cheque-allocation-summary"><span>Cheque Amount <strong>EGP {money(Number(form.amount))}</strong></span><span>Allocated <strong>EGP {money(allocatedTotal)}</strong></span><span className={Math.abs(allocatedTotal - Number(form.amount)) <= .01 ? "balanced" : "unbalanced"}>Unallocated <strong>EGP {money(Number(form.amount) - allocatedTotal)}</strong></span></div>
          <div className="cheque-allocation-tools"><button type="button" disabled={!Number(form.amount)} onClick={autoAllocatePayment}>Auto Allocate Cheque</button><span>Allocate all or part of the cheque. Any unused amount stays as an unallocated customer balance.</span></div>
          <div className="cheque-allocation-list">{allocatableCustomerInvoices.map((invoice) => { const invoiceId = String(invoice.id); const wht = whtByInvoice.get(String(invoice.invoice_no)) ?? 0; const whtAlreadyApplied = (deductedWhtByInvoice.get(invoiceId) ?? 0) - (editingOwnWht.get(invoiceId) ?? 0) > 0.005; const remaining = availableInvoiceBalance(invoice); const cashRemaining = Math.max(0, remaining - (whtDeductions[invoiceId] && !whtAlreadyApplied ? wht : 0)); return <div className="cheque-allocation-row" key={invoiceId}><span><strong>Invoice {invoice.invoice_no} · {dateLabel(invoice.sales_date)}</strong><small><b>Invoice Total:</b> EGP {money(invoice.total_sales)} <b>Possible WHT:</b> EGP {money(wht)} <b>Remaining:</b> EGP {money(remaining)}</small><label className="collection-wht-option"><input type="checkbox" disabled={whtAlreadyApplied} checked={!whtAlreadyApplied && Boolean(whtDeductions[invoiceId])} onChange={(event) => setWhtDeductions((current) => ({ ...current, [invoiceId]: event.target.checked }))} /> {whtAlreadyApplied ? "WHT already deducted" : "Customer deducted WHT"}</label></span><div><input type="number" min="0" max={cashRemaining} step="0.01" placeholder="Write amount" value={allocations[invoiceId] ?? ""} onChange={(event) => setAllocations((current) => ({ ...current, [invoiceId]: event.target.value }))} /><button type="button" onClick={() => setAllocations((current) => ({ ...current, [invoiceId]: cashRemaining.toFixed(2) }))}>Use Full Remaining</button></div></div>; })}{!allocatableCustomerInvoices.length && <p className="collection-empty">This customer has no invoices with a remaining money balance.</p>}</div>
        </div>}
        {multiTransfer && form.customerName && <div className="cheque-allocation-panel">
          <div className="cheque-allocation-summary"><span>Total Transfer <strong>EGP {money(transferAllocationTotal)}</strong></span><span>Allocated <strong>EGP {money(allocatedTotal)}</strong></span><span className={Math.abs(allocatedTotal - transferAllocationTotal) <= .01 ? "balanced" : "unbalanced"}>Unallocated <strong>EGP {money(transferAllocationTotal - allocatedTotal)}</strong></span></div>
          <div className="cheque-allocation-tools"><button type="button" disabled={!Number(form.amount)} onClick={autoAllocatePayment}>Auto Allocate Transfer</button><span>The full bank amount and transfer fees must be allocated across one or more invoices.</span></div>
          <div className="cheque-allocation-list">{allocatableCustomerInvoices.map((invoice) => { const invoiceId = String(invoice.id); const wht = whtByInvoice.get(String(invoice.invoice_no)) ?? 0; const whtAlreadyApplied = (deductedWhtByInvoice.get(invoiceId) ?? 0) - (editingOwnWht.get(invoiceId) ?? 0) > 0.005; const remaining = availableInvoiceBalance(invoice); const cashRemaining = Math.max(0, remaining - (whtDeductions[invoiceId] && !whtAlreadyApplied ? wht : 0)); return <div className="cheque-allocation-row" key={invoiceId}><span><strong>Invoice {invoice.invoice_no} · {dateLabel(invoice.sales_date)}</strong><small><b>Invoice Total:</b> EGP {money(invoice.total_sales)} <b>Possible WHT:</b> EGP {money(wht)} <b>Remaining:</b> EGP {money(remaining)}</small><label className="collection-wht-option"><input type="checkbox" disabled={whtAlreadyApplied} checked={!whtAlreadyApplied && Boolean(whtDeductions[invoiceId])} onChange={(event) => setWhtDeductions((current) => ({ ...current, [invoiceId]: event.target.checked }))} /> {whtAlreadyApplied ? "WHT already deducted" : "Customer deducted WHT"}</label></span><div><input type="number" min="0" max={cashRemaining} step="0.01" placeholder="Write amount" value={allocations[invoiceId] ?? ""} onChange={(event) => setAllocations((current) => ({ ...current, [invoiceId]: event.target.value }))} /><button type="button" onClick={() => setAllocations((current) => ({ ...current, [invoiceId]: cashRemaining.toFixed(2) }))}>Use Full Remaining</button></div></div>; })}{!allocatableCustomerInvoices.length && <p className="collection-empty">This customer has no invoices with a remaining money balance.</p>}</div>
        </div>}
        {selectedInvoice && form.paymentMethod !== "CHEQUE" && !multiTransfer && <><label className="collection-wht-option collection-wht-option--single"><input type="checkbox" disabled={Boolean(selectedWhtAlreadyApplied)} checked={!selectedWhtAlreadyApplied && applyWht} onChange={(event) => setApplyWht(event.target.checked)} /> {selectedWhtAlreadyApplied ? "WHT already deducted for this invoice" : `Customer deducted WHT (EGP ${money(whtByInvoice.get(String(selectedInvoice.invoice_no)) ?? 0)})`}</label><div className="collection-invoice-preview"><span>Invoice Total <strong>EGP {money(selectedInvoice.total_sales)}</strong></span><span>Total Settled After Save <strong>EGP {money((settledByInvoice.get(String(selectedInvoice.id)) ?? 0) + collectedTotal + selectedWhtAmount + automaticFraction)}</strong></span>{automaticFraction > 0 && <span>Automatic Fraction <strong>EGP {money(automaticFraction)}</strong></span>}<span>Remaining After Save <strong>EGP {money(automaticFraction > 0 ? 0 : remainingBeforeAutoFraction)}</strong></span></div></>}
        <div className="collection-form-actions"><button className="primary" onClick={save} disabled={saving || (form.paymentMethod === "CHEQUE" ? !chequeValid : multiTransfer ? !transferValid : !form.invoiceId || !form.amount)}>{saving ? "Saving…" : editingId ? "Save Changes" : form.paymentMethod === "CHEQUE" ? "Add Cheque" : multiTransfer ? "Add Bank Transfer" : "Add Collection"}</button></div>
      </section>}
      {activeCategory === "CHEQUE" ? <section className="collection-table-card"><div className="collections-toolbar"><div><h2>Cheque Operations</h2><span>{chequeOperations.length} cheques</span></div><a className="collection-manage-link" href="/cheques">Open Cheque Control</a></div><div className="collection-operation-grid">{chequeOperations.map(({ cheque, allocations: rows }) => <a className="collection-operation-card" href={`/cheques/${cheque.id}`} key={cheque.id}><span>{dateLabel(cheque.collection_date)}</span><h3>Cheque {cheque.cheque_no}</h3><p>{cheque.customer_name}</p><strong>EGP {money(cheque.amount)}</strong><small>{rows.length} invoice allocation{rows.length === 1 ? "" : "s"} · {cheque.cheque_status.replaceAll("_", " ")}</small></a>)}</div></section> : <section className="collection-table-card"><div className="collections-toolbar"><div><h2>{activeCategory === "CASH" ? "Cash Operations" : "Bank-Transfer Operations"}</h2><span>{filteredOperations.length} complete operations</span></div><select value={customerFilter} onChange={(event) => setCustomerFilter(event.target.value)}><option value="All">All Customers</option>{historyCustomers.map((customer) => <option key={customer}>{customer}</option>)}</select><input placeholder="Search invoice, customer or reference" value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="table-scroll"><table><thead><tr><th>Date</th><th>Customer</th><th>Invoices</th><th>Reference</th><th>Payment</th><th>Fees</th><th>Fraction</th><th>WHT</th><th>Notes</th>{canEdit && <th>Operation</th>}</tr></thead><tbody>{filteredOperations.map((operation) => <tr key={operation.key}><td>{dateLabel(operation.collection_date)}</td><td>{operation.customer_name}</td><td><div className="operation-invoices">{operation.records.map((record) => <a key={record.id} href={`/sales/${record.invoice_id}`}>{record.invoice_no}</a>)}</div></td><td>{operation.reference_no || "—"}</td><td><strong>EGP {money(operation.amount - operation.transfer_fees)}</strong></td><td>{operation.transfer_fees ? `EGP ${money(operation.transfer_fees)}` : "—"}</td><td>{operation.cash_fraction ? `EGP ${money(operation.cash_fraction)}` : "—"}</td><td>{operation.wht_deducted_amount ? `EGP ${money(operation.wht_deducted_amount)}` : "—"}</td><td>{operation.notes || "—"}</td>{canEdit && <td><div className="collection-row-actions"><button onClick={() => editOperation(operation)}>Edit Full Operation</button><button className="danger" onClick={() => removeOperation(operation)}>Delete</button></div></td>}</tr>)}{!filteredOperations.length && <tr><td colSpan={canEdit ? 10 : 9} className="collection-empty">No {activeCategory === "CASH" ? "cash" : "bank-transfer"} operations found.</td></tr>}</tbody></table></div></section>}
    </main><Footer lang={lang} />
  </div>;
}
