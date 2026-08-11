"use client";

import { useMemo, useState } from "react";

type Invoice = { invoice_no: string; customer_name: string; sales_date: string; sales_item_total: number; tax: number };
const money = (value: number) => Number(value || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function WhtBatchForm({ customers, invoices }: { customers: string[]; invoices: Invoice[] }) {
  const [customer, setCustomer] = useState("");
  const [certificateNo, setCertificateNo] = useState("");
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const customerInvoices = useMemo(() => invoices.filter((invoice) => invoice.customer_name === customer).sort((a, b) => a.sales_date.localeCompare(b.sales_date) || String(a.invoice_no).localeCompare(String(b.invoice_no), undefined, { numeric: true })), [customer, invoices]);
  const selectedInvoices = customerInvoices.filter((invoice) => selected[String(invoice.invoice_no)]);
  const totalWht = selectedInvoices.reduce((sum, invoice) => sum + Math.round(Number(invoice.sales_item_total || 0) * 0.01 * 100) / 100, 0);
  function toggle(invoiceNo: string) { setSelected((current) => ({ ...current, [invoiceNo]: !current[invoiceNo] })); }
  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/wht/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ customerName: customer, certificateNo, collectionDate, invoiceNumbers: selectedInvoices.map((invoice) => String(invoice.invoice_no)) }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return alert(result.error || "Unable to save grouped WHT.");
      alert(`WHT certificate saved for ${result.data?.length ?? 0} invoices.`);
      window.location.reload();
    } finally { setSaving(false); }
  }
  return <section className="wht-form-card wht-batch-card">
    <div className="wht-section-heading"><div><p>MULTI-INVOICE WHT</p><h2>Link One WHT Certificate to Many Invoices</h2></div><strong>{selectedInvoices.length} invoices · WHT {money(totalWht)} EGP</strong></div>
    <div className="wht-batch-controls"><label>Customer<select value={customer} onChange={(event) => { setCustomer(event.target.value); setSelected({}); }}><option value="">Select customer</option>{customers.map((name) => <option key={name}>{name}</option>)}</select></label><label>Certificate / Reference No.<input value={certificateNo} onChange={(event) => setCertificateNo(event.target.value)} /></label><label>Collection Date<input type="date" value={collectionDate} onChange={(event) => setCollectionDate(event.target.value)} /></label></div>
    {customer && <div className="wht-batch-list">{customerInvoices.map((invoice) => { const wht = Math.round(Number(invoice.sales_item_total || 0) * 0.01 * 100) / 100; return <label key={String(invoice.invoice_no)}><input type="checkbox" checked={Boolean(selected[String(invoice.invoice_no)])} onChange={() => toggle(String(invoice.invoice_no))} /><span><strong>Invoice {invoice.invoice_no}</strong><small>{invoice.sales_date} · Subtotal {money(invoice.sales_item_total)} EGP</small></span><b>WHT {money(wht)} EGP</b></label>; })}{!customerInvoices.length && <p className="empty-state">No invoices found for this customer.</p>}</div>}
    <div className="wht-form-actions"><button type="button" disabled={saving || !customer || !certificateNo.trim() || !collectionDate || !selectedInvoices.length} onClick={save}>{saving ? "Saving..." : "Save Multi-Invoice WHT"}</button></div>
  </section>;
}
