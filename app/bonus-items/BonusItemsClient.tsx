"use client";

import { useMemo, useState } from "react";
import Header from "../Header";
import Footer from "../Footer";

type Row = { id: number; received_date: string; supplier_name: string | null; item_code: string; product_name: string; quantity: number; estimated_unit_cost: number; reference_no: string | null; notes: string | null };
type Form = { receivedDate: string; supplierName: string; itemCode: string; productName: string; quantity: string; estimatedUnitCost: string; referenceNo: string; notes: string };
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const emptyForm = (): Form => ({ receivedDate: today(), supplierName: "", itemCode: "", productName: "", quantity: "", estimatedUnitCost: "", referenceNo: "", notes: "" });
const money = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateLabel = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }).replace(/ /g, "-");

export default function BonusItemsClient({ initialRows }: { initialRows: Row[] }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [rows, setRows] = useState(initialRows);
  const [form, setForm] = useState<Form>(emptyForm());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => rows.filter((row) => row.received_date.startsWith(month) && [row.item_code, row.product_name, row.supplier_name, row.reference_no].some((value) => (value ?? "").toLowerCase().includes(query.trim().toLowerCase()))), [rows, month, query]);
  const totals = useMemo(() => filtered.reduce((sum, row) => ({ quantity: sum.quantity + Number(row.quantity), value: sum.value + Number(row.quantity) * Number(row.estimated_unit_cost) }), { quantity: 0, value: 0 }), [filtered]);

  function reset() { setEditingId(null); setForm(emptyForm()); }
  function edit(row: Row) {
    setEditingId(row.id);
    setForm({ receivedDate: row.received_date, supplierName: row.supplier_name ?? "", itemCode: row.item_code, productName: row.product_name, quantity: String(row.quantity), estimatedUnitCost: String(row.estimated_unit_cost), referenceNo: row.reference_no ?? "", notes: row.notes ?? "" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function save() {
    if (!form.receivedDate || !form.itemCode.trim() || !form.productName.trim() || Number(form.quantity) <= 0) return alert("Date, item code, product name and a valid quantity are required.");
    setSaving(true);
    const response = await fetch("/api/bonus-items", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, id: editingId }) });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) return alert(result.error || "Unable to save the bonus item.");
    setRows((current) => editingId ? current.map((row) => row.id === editingId ? result.data : row) : [result.data, ...current]);
    setMonth(result.data.received_date.slice(0, 7));
    reset();
  }
  async function remove(row: Row) {
    if (!confirm(`Delete ${row.product_name}?`)) return;
    const response = await fetch(`/api/bonus-items?id=${row.id}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return alert(result.error || "Unable to delete the bonus item.");
    setRows((current) => current.filter((item) => item.id !== row.id));
    if (editingId === row.id) reset();
  }

  return <div className="dashboard-shell" dir={lang === "ar" ? "rtl" : "ltr"}>
    <Header active="bonusItems" lang={lang} onToggleLang={() => setLang((value) => value === "en" ? "ar" : "en")} />
    <main className="bonus-page">
      <section className="bonus-hero"><div><p>INVENTORY CONTROL</p><h1>Bonus Items</h1><span>Record goods received free of charge without a supplier invoice.</span></div><div className="bonus-hero__badge"><strong>{filtered.length}</strong><span>records this month</span></div></section>
      <section className="bonus-form-card">
        <div className="bonus-form-card__title"><div><h2>{editingId ? "Edit Bonus Item" : "Receive Bonus Item"}</h2><p>The estimated cost is for internal inventory valuation only.</p></div>{editingId && <button type="button" onClick={reset}>Cancel Edit</button>}</div>
        <div className="bonus-form-grid">
          <label>Received Date<input type="date" value={form.receivedDate} onChange={(event) => setForm({ ...form, receivedDate: event.target.value })} /></label>
          <label>Supplier<input value={form.supplierName} onChange={(event) => setForm({ ...form, supplierName: event.target.value })} placeholder="Optional supplier name" /></label>
          <label>Item Code<input value={form.itemCode} onChange={(event) => setForm({ ...form, itemCode: event.target.value })} placeholder="e.g. GS1 / internal code" /></label>
          <label className="bonus-wide">Product Name<input value={form.productName} onChange={(event) => setForm({ ...form, productName: event.target.value })} /></label>
          <label>Quantity<input type="number" min="0.001" step="0.001" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label>
          <label>Estimated Unit Cost (EGP)<input type="number" min="0" step="0.01" value={form.estimatedUnitCost} onChange={(event) => setForm({ ...form, estimatedUnitCost: event.target.value })} /></label>
          <label>Reference No.<input value={form.referenceNo} onChange={(event) => setForm({ ...form, referenceNo: event.target.value })} placeholder="Delivery note / batch / reference" /></label>
          <label className="bonus-wide">Notes<input value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional notes" /></label>
        </div>
        <div className="bonus-form-actions"><button type="button" className="bonus-primary" onClick={save} disabled={saving}>{saving ? "Saving..." : editingId ? "Save Changes" : "Add Bonus Item"}</button></div>
      </section>
      <section className="bonus-toolbar"><div><strong>Received Items</strong><span>Filter the inventory receipt history</span></div><label>Month<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} /></label><label>Search<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Item, product, supplier or reference" /></label></section>
      <section className="bonus-summary"><article><span>Total Quantity</span><strong>{totals.quantity.toLocaleString("en-US", { maximumFractionDigits: 3 })}</strong></article><article><span>Estimated Inventory Value</span><strong>{money(totals.value)} <small>EGP</small></strong></article><article><span>Bonus Lines</span><strong>{filtered.length}</strong></article></section>
      <section className="bonus-table-card"><div className="bonus-table-scroll"><table><thead><tr><th>Date</th><th>Supplier</th><th>Item Code</th><th>Product</th><th>Qty</th><th>Unit Cost</th><th>Total Value</th><th>Reference / Notes</th><th>Actions</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td>{dateLabel(row.received_date)}</td><td>{row.supplier_name || "—"}</td><td><code>{row.item_code}</code></td><td><strong>{row.product_name}</strong></td><td>{Number(row.quantity).toLocaleString("en-US", { maximumFractionDigits: 3 })}</td><td>{money(Number(row.estimated_unit_cost))}</td><td>{money(Number(row.quantity) * Number(row.estimated_unit_cost))}</td><td><span>{row.reference_no || "—"}</span>{row.notes && <small>{row.notes}</small>}</td><td><div className="bonus-row-actions"><button onClick={() => edit(row)}>Edit</button><button className="danger" onClick={() => remove(row)}>Delete</button></div></td></tr>)}</tbody></table></div>{!filtered.length && <div className="bonus-empty">No bonus items found for this month.</div>}</section>
    </main>
    <Footer lang={lang} />
  </div>;
}
