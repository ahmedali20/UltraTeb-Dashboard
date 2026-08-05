"use client";

import { useMemo, useState } from "react";
import Header from "../Header";
import Footer from "../Footer";

type Section = "SELLING_EXPENSE" | "GENERAL_ADMIN_EXPENSE" | "OTHER_OPERATING_EXPENSE" | "OTHER_INCOME" | "FINANCE_COST" | "INCOME_TAX";
type Entry = { id: number; entry_month: string; statement_section: Section; category: string; description: string | null; amount: number };
type Form = { entryMonth: string; statementSection: Section; category: string; description: string; amount: string };

const sectionLabels: Record<Section, string> = {
  SELLING_EXPENSE: "Selling Expenses",
  GENERAL_ADMIN_EXPENSE: "General & Administrative Expenses",
  OTHER_OPERATING_EXPENSE: "Other Operating Expenses",
  OTHER_INCOME: "Other Income",
  FINANCE_COST: "Finance Costs",
  INCOME_TAX: "Income Tax Expense",
};

const categorySuggestions: Record<Section, string[]> = {
  SELLING_EXPENSE: ["Sales Salaries", "Sales Bonuses", "Transportation", "Marketing", "Delivery"],
  GENERAL_ADMIN_EXPENSE: ["Administrative Salaries", "Rent", "Utilities", "Professional Fees", "Office Expenses", "Maintenance", "Depreciation"],
  OTHER_OPERATING_EXPENSE: ["Bad Debts", "Inventory Adjustment", "Other Operating Expense"],
  OTHER_INCOME: ["Other Income"],
  FINANCE_COST: ["Bank Charges", "Loan Interest", "Finance Cost"],
  INCOME_TAX: ["Current Income Tax", "Deferred Income Tax"],
};

function currentMonth() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit" }).format(new Date());
}

const emptyForm: Form = { entryMonth: currentMonth(), statementSection: "GENERAL_ADMIN_EXPENSE", category: "", description: "", amount: "" };
const money = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function IncomeStatementDataClient({ initialEntries }: { initialEntries: Entry[] }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [entries, setEntries] = useState(initialEntries);
  const [month, setMonth] = useState(currentMonth());
  const [form, setForm] = useState<Form>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => entries.filter((entry) => entry.entry_month === month), [entries, month]);
  const totals = useMemo(() => filtered.reduce((result, entry) => ({ ...result, [entry.statement_section]: (result[entry.statement_section] || 0) + Number(entry.amount || 0) }), {} as Partial<Record<Section, number>>), [filtered]);

  function startEdit(entry: Entry) {
    setEditingId(entry.id);
    setForm({ entryMonth: entry.entry_month, statementSection: entry.statement_section, category: entry.category, description: entry.description ?? "", amount: String(entry.amount) });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...emptyForm, entryMonth: month });
  }

  async function save() {
    if (!form.entryMonth || !form.category.trim() || !form.amount) return alert("Month, category and amount are required.");
    setSaving(true);
    const response = await fetch("/api/income-statement-data", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, id: editingId }) });
    const result = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) return alert(result.error || "Unable to save record.");
    setEntries((current) => editingId ? current.map((entry) => entry.id === editingId ? result.data : entry) : [result.data, ...current]);
    setMonth(result.data.entry_month);
    setEditingId(null);
    setForm({ ...emptyForm, entryMonth: result.data.entry_month });
  }

  async function remove(id: number) {
    if (!confirm("Delete this Income Statement entry?")) return;
    const response = await fetch(`/api/income-statement-data?id=${id}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return alert(result.error || "Unable to delete record.");
    setEntries((current) => current.filter((entry) => entry.id !== id));
    if (editingId === id) resetForm();
  }

  return <div className="dashboard-shell" dir={lang === "ar" ? "rtl" : "ltr"}>
    <Header active="incomeStatement" lang={lang} onToggleLang={() => setLang((value) => value === "en" ? "ar" : "en")} />
    <main className="is-data-page">
      <section className="page-hero"><div><p>FINANCIAL CONTROL</p><h1>Income Statement Data</h1><span>Enter monthly expenses, other income, finance costs and income tax.</span></div></section>

      <section className="is-entry-form">
        <label>Month<input type="month" value={form.entryMonth} onChange={(event) => setForm({ ...form, entryMonth: event.target.value })} /></label>
        <label>Statement Section<select value={form.statementSection} onChange={(event) => setForm({ ...form, statementSection: event.target.value as Section, category: "" })}>{Object.entries(sectionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Category<input list="is-categories" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Select or write a category" /><datalist id="is-categories">{categorySuggestions[form.statementSection].map((category) => <option key={category} value={category} />)}</datalist></label>
        <label>Amount (EGP)<input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
        <label className="is-description">Description<input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Optional reference or explanation" /></label>
        <div className="is-form-actions"><button className="primary" onClick={save} disabled={saving}>{saving ? "Saving..." : editingId ? "Save Changes" : "Add Monthly Entry"}</button>{editingId && <button onClick={resetForm}>Cancel</button>}</div>
      </section>

      <section className="is-month-toolbar"><div><strong>Monthly Records</strong><span>{filtered.length} entries</span></div><label>View Month<input type="month" value={month} onChange={(event) => { setMonth(event.target.value); setForm((current) => ({ ...current, entryMonth: event.target.value })); }} /></label></section>
      <section className="is-summary-grid">{(Object.keys(sectionLabels) as Section[]).map((section) => <article key={section}><span>{sectionLabels[section]}</span><strong>{money(totals[section] || 0)}</strong><small>EGP</small></article>)}</section>
      <section className="professional-data-table"><div className="table-scroll"><table><thead><tr><th>Section</th><th>Category</th><th>Description</th><th>Amount</th><th>Actions</th></tr></thead><tbody>{filtered.map((entry) => <tr key={entry.id}><td>{sectionLabels[entry.statement_section]}</td><td>{entry.category}</td><td>{entry.description || "-"}</td><td>{money(Number(entry.amount))}</td><td><div className="is-row-actions"><button onClick={() => startEdit(entry)}>Edit</button><button className="danger" onClick={() => remove(entry.id)}>Delete</button></div></td></tr>)}</tbody></table></div>{!filtered.length && <div className="data-table-empty">No entries for this month.</div>}</section>
    </main>
    <Footer lang={lang} />
  </div>;
}
