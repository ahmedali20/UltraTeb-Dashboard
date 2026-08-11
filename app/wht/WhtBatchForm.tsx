"use client";

import { useMemo, useState } from "react";

type Invoice = { invoice_no: string; customer_name: string; sales_date: string; sales_item_total: number; tax: number };
const money = (value: number) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const invoiceWht = (invoice: Invoice) => Math.round(Number(invoice.sales_item_total || 0) * 0.01 * 100) / 100;

export default function WhtBatchForm({ customers, invoices }: { customers: string[]; invoices: Invoice[] }) {
  const [customer, setCustomer] = useState("");
  const [certificateNo, setCertificateNo] = useState("");
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [collectedAmount, setCollectedAmount] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const customerInvoices = useMemo(() => invoices.filter((invoice) => invoice.customer_name === customer).sort((a, b) => a.sales_date.localeCompare(b.sales_date) || String(a.invoice_no).localeCompare(String(b.invoice_no), undefined, { numeric: true })), [customer, invoices]);
  const selectedInvoices = customerInvoices.filter((invoice) => selected[String(invoice.invoice_no)]);
  const maximumWht = selectedInvoices.reduce((sum, invoice) => sum + invoiceWht(invoice), 0);
  const allocatedTotal = Object.values(allocations).reduce((sum, value) => sum + (Number(value) || 0), 0);
  const unallocated = Number(collectedAmount || 0) - allocatedTotal;
  const balanced = Number(collectedAmount) > 0 && Math.abs(unallocated) <= 0.01;

  function toggle(invoiceNo: string) {
    setSelected((current) => ({ ...current, [invoiceNo]: !current[invoiceNo] }));
    setAllocations((current) => { const next = { ...current }; delete next[invoiceNo]; return next; });
  }
  function autoAllocate() {
    let remaining = Math.max(0, Number(collectedAmount) || 0);
    const next: Record<string, string> = {};
    for (const invoice of selectedInvoices) {
      if (remaining <= 0) break;
      const amount = Math.min(invoiceWht(invoice), remaining);
      if (amount > 0) next[String(invoice.invoice_no)] = amount.toFixed(2);
      remaining = Math.round((remaining - amount) * 100) / 100;
    }
    setAllocations(next);
  }
  async function save() {
    const invoiceAllocations = selectedInvoices.map((invoice) => ({ invoiceNo: String(invoice.invoice_no), amount: Number(allocations[String(invoice.invoice_no)] || 0) })).filter((item) => item.amount > 0);
    setSaving(true);
    try {
      const response = await fetch("/api/wht/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerName: customer, certificateNo, collectionDate, collectedAmount: Number(collectedAmount), allocations: invoiceAllocations }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return alert(result.error || "Unable to save grouped WHT.");
      alert(`Grouped WHT saved for ${result.data?.length ?? 0} invoices.`);
      window.location.reload();
    } finally { setSaving(false); }
  }

  return <section className="wht-form-card wht-batch-card">
    <div className="wht-section-heading"><div><p>MULTI-INVOICE WHT</p><h2>Allocate One WHT Collection to Many Invoices</h2></div><strong>{selectedInvoices.length} selected · Maximum {money(maximumWht)} EGP</strong></div>
    <div className="wht-batch-controls"><label>Customer *<select value={customer} onChange={(event) => { setCustomer(event.target.value); setSelected({}); setAllocations({}); }}><option value="">Select customer</option>{customers.map((name) => <option key={name}>{name}</option>)}</select></label><label>Certificate / Reference No. (Optional)<input value={certificateNo} onChange={(event) => setCertificateNo(event.target.value)} /></label><label>Collection Date *<input type="date" value={collectionDate} onChange={(event) => setCollectionDate(event.target.value)} /></label><label>Collected WHT Amount *<input type="number" min="0.01" step="0.01" value={collectedAmount} onChange={(event) => setCollectedAmount(event.target.value)} /></label></div>
    {customer && <><div className="cheque-allocation-summary"><span>Collected WHT <strong>EGP {money(Number(collectedAmount))}</strong></span><span>Allocated <strong>EGP {money(allocatedTotal)}</strong></span><span className={balanced ? "balanced" : "unbalanced"}>Unallocated <strong>EGP {money(unallocated)}</strong></span></div><div className="cheque-allocation-tools"><button type="button" disabled={!selectedInvoices.length || !Number(collectedAmount)} onClick={autoAllocate}>Auto Allocate WHT</button><span>Allocation follows invoice date order; the last invoice receives the amount left.</span></div><div className="wht-batch-list">{customerInvoices.map((invoice) => { const invoiceNo = String(invoice.invoice_no); const wht = invoiceWht(invoice); return <div className="wht-batch-row" key={invoiceNo}><input type="checkbox" checked={Boolean(selected[invoiceNo])} onChange={() => toggle(invoiceNo)} /><span><strong>Invoice {invoiceNo}</strong><small>{invoice.sales_date} · Subtotal {money(invoice.sales_item_total)} EGP · Maximum WHT {money(wht)} EGP</small></span><input type="number" min="0" max={wht} step="0.01" disabled={!selected[invoiceNo]} placeholder="Allocation" value={allocations[invoiceNo] ?? ""} onChange={(event) => setAllocations((current) => ({ ...current, [invoiceNo]: event.target.value }))} /></div>; })}{!customerInvoices.length && <p className="empty-state">No invoices found for this customer.</p>}</div></>}
    <div className="wht-form-actions"><button type="button" disabled={saving || !customer || !collectionDate || !balanced || allocatedTotal > maximumWht + 0.01} onClick={save}>{saving ? "Saving..." : "Save Multi-Invoice WHT"}</button></div>
  </section>;
}
