"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import Header from "../Header";
import Footer from "../Footer";

type SaleRow = {
  id: string;
  invoice_no: string;
  sales_date: string;
  month: string;
  customer_code: string;
  customer_name: string;
  sales_rep: string | null;
  sales_item_total: number;
  tax: number;
  total_sales: number;
};

type CustomerOption = {
  customer_code: string;
  customer_name: string;
};

const translations = {
  en: {
    title: "Sales Invoices",
    total: "Total invoices:",
    invoiceNo: "Invoice No",
    date: "Sales Date",
    month: "Month",
    customer: "Customer",
    itemTotal: "Sales Item Total",
    tax: "TAX",
    totalSales: "Total Sales",
    rep: "Sales Rep",
    actions: "Actions",
    delete: "Delete",
    confirmDelete: "Delete this invoice? This cannot be undone.",
    addTitle: "Add Single Invoice",
    add: "Add Invoice",
    bulkTitle: "Bulk Upload (CSV)",
    bulkHint:
      "CSV columns required: invoice_no, sales_date, customer_code, sales_item_total, tax",
    chooseFile: "Choose CSV File",
    upload: "Upload",
    uploading: "Uploading...",
    switchTo: "العربية",
    backToCustomers: "← Customers",
  },
  ar: {
    title: "فواتير المبيعات",
    total: "إجمالي الفواتير:",
    invoiceNo: "رقم الفاتورة",
    date: "تاريخ البيع",
    month: "الشهر",
    customer: "العميل",
    itemTotal: "إجمالي الأصناف",
    tax: "الضريبة",
    totalSales: "إجمالي المبيعات",
    rep: "المندوب",
    actions: "إجراءات",
    delete: "حذف",
    confirmDelete: "هل تريد حذف هذه الفاتورة؟ لا يمكن التراجع عن هذا الإجراء.",
    addTitle: "إضافة فاتورة واحدة",
    add: "إضافة فاتورة",
    bulkTitle: "رفع جماعي (CSV)",
    bulkHint:
      "أعمدة الـ CSV المطلوبة: invoice_no, sales_date, customer_code, sales_item_total, tax",
    chooseFile: "اختر ملف CSV",
    upload: "رفع",
    uploading: "جاري الرفع...",
    switchTo: "English",
    backToCustomers: "→ العملاء",
  },
};

const emptyForm = {
  invoice_no: "",
  sales_date: "",
  customer_code: "",
  sales_item_total: "",
  tax: "",
};

export default function SalesTable({
  sales,
  customers,
}: {
  sales: SaleRow[];
  customers: CustomerOption[];
}) {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "ar">("en");
  const t = translations[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";
  const align = lang === "ar" ? "right" : "left";

  const [form, setForm] = useState(emptyForm);
  const [taxMode, setTaxMode] = useState<"14" | "5" | "manual">("14");
  const [adding, setAdding] = useState(false);

  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inputStyle: React.CSSProperties = {
    padding: "6px 8px",
    fontSize: 13,
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--input-text)",
    borderRadius: 4,
    width: "100%",
  };

  function calculateTax(itemTotal: string, mode: "14" | "5" | "manual") {
    if (mode === "manual") return form.tax;

    const amount = Number(itemTotal);
    if (!Number.isFinite(amount) || amount <= 0) return "";

    const rate = mode === "14" ? 0.14 : 0.05;
    return (amount * rate).toFixed(2);
  }

  function handleItemTotalChange(value: string) {
    setForm((current) => ({
      ...current,
      sales_item_total: value,
      tax:
        taxMode === "manual"
          ? current.tax
          : calculateTax(value, taxMode),
    }));
  }

  function handleTaxModeChange(mode: "14" | "5" | "manual") {
    setTaxMode(mode);
    setForm((current) => ({
      ...current,
      tax:
        mode === "manual"
          ? current.tax
          : calculateTax(current.sales_item_total, mode),
    }));
  }

  async function handleAdd() {
    if (!form.invoice_no || !form.sales_date || !form.customer_code) return;
    setAdding(true);
    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setAdding(false);
    if (res.ok) {
      setForm(emptyForm);
      router.refresh();
    } else {
      const { error } = await res.json();
      alert(error || "Error adding invoice");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t.confirmDelete)) return;
    const res = await fetch(`/api/sales/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      const { error } = await res.json();
      alert(error || "Error deleting invoice");
    }
  }

  function handleBulkUpload() {
    if (!bulkFile) return;
    setUploading(true);
    setBulkStatus("");

    Papa.parse(bulkFile, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as any[];
        const res = await fetch("/api/sales/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows }),
        });
        const json = await res.json();
        setUploading(false);
        if (res.ok) {
          setBulkStatus(
            lang === "ar"
              ? `تم رفع ${json.inserted} فاتورة بنجاح${
                  json.failed?.length ? `، وفشل ${json.failed.length}` : ""
                }`
              : `Uploaded ${json.inserted} invoices successfully${
                  json.failed?.length ? `, ${json.failed.length} failed` : ""
                }`
          );
          setBulkFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          router.refresh();
        } else {
          setBulkStatus(json.error || "Upload failed");
        }
      },
      error: (err) => {
        setUploading(false);
        setBulkStatus(err.message);
      },
    });
  }

  return (
    <div dir={dir} style={{ fontFamily: "Arial, 'Segoe UI', Tahoma, sans-serif", minHeight: "100vh", background: "var(--page-bg)", color: "var(--text-primary)" }}>
      <Header active="sales" lang={lang} onToggleLang={() => setLang(lang === "en" ? "ar" : "en")} />
      <main style={{ padding: "0 32px", maxWidth: 1300, margin: "0 auto" }}>
        <h1 style={{ margin: 0 }}>{t.title}</h1>

      <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
        {t.total} {sales.length}
      </p>

      <section className="entry-form">
        <div className="entry-form__header">
          <div>
            <h3 className="entry-form__title">{t.addTitle}</h3>
            <p className="entry-form__subtitle">
              {lang === "ar"
                ? "سجل بيانات الفاتورة وقيم المبيعات."
                : "Record the invoice details and sales values."}
            </p>
          </div>
          <span className="entry-form__badge" aria-hidden="true">+</span>
        </div>

        <div className="entry-form__body">
          <div className="entry-form__grid">
            <label className="entry-form__field">
              <span className="entry-form__label">
                {t.invoiceNo}<span className="entry-form__required">*</span>
              </span>
              <input
                className="entry-form__input"
                placeholder={t.invoiceNo}
                value={form.invoice_no}
                onChange={(e) => setForm({ ...form, invoice_no: e.target.value })}
              />
            </label>

            <label className="entry-form__field">
              <span className="entry-form__label">
                {t.date}<span className="entry-form__required">*</span>
              </span>
              <input
                className="entry-form__input"
                type="date"
                value={form.sales_date}
                onChange={(e) => setForm({ ...form, sales_date: e.target.value })}
              />
            </label>

            <label className="entry-form__field">
              <span className="entry-form__label">
                {t.customer} Code<span className="entry-form__required">*</span>
              </span>
              <select
                className="entry-form__input"
                value={form.customer_code}
                onChange={(e) =>
                  setForm({ ...form, customer_code: e.target.value })
                }
              >
                <option value="">
                  {lang === "ar"
                    ? "اختر كود واسم العميل"
                    : "Select customer code and name"}
                </option>
                {customers.map((customer) => (
                  <option
                    key={customer.customer_code}
                    value={customer.customer_code}
                  >
                    {customer.customer_code} — {customer.customer_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="entry-form__field entry-form__field--wide">
              <span className="entry-form__label">{t.itemTotal}</span>
              <input
                className="entry-form__input"
                type="number"
                min="0"
                step="0.01"
                placeholder={t.itemTotal}
                value={form.sales_item_total}
                onChange={(e) => handleItemTotalChange(e.target.value)}
              />
            </label>

            <label className="entry-form__field entry-form__field--wide">
              <span className="entry-form__label">{t.tax}</span>
              <div className="tax-field">
                <div
                  className="tax-options"
                  role="group"
                  aria-label={lang === "ar" ? "طريقة حساب الضريبة" : "Tax calculation method"}
                >
                  <button
                    type="button"
                    className={`tax-options__button ${
                      taxMode === "14" ? "tax-options__button--active" : ""
                    }`}
                    onClick={() => handleTaxModeChange("14")}
                  >
                    14%
                  </button>
                  <button
                    type="button"
                    className={`tax-options__button ${
                      taxMode === "5" ? "tax-options__button--active" : ""
                    }`}
                    onClick={() => handleTaxModeChange("5")}
                  >
                    5%
                  </button>
                  <button
                    type="button"
                    className={`tax-options__button ${
                      taxMode === "manual" ? "tax-options__button--active" : ""
                    }`}
                    onClick={() => handleTaxModeChange("manual")}
                  >
                    {lang === "ar" ? "يدوي" : "Manual"}
                  </button>
                </div>

                <input
                  className="entry-form__input"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={t.tax}
                  value={form.tax}
                  readOnly={taxMode !== "manual"}
                  onChange={(e) =>
                    setForm({ ...form, tax: e.target.value })
                  }
                />
              </div>
            </label>
          </div>

          <div className="entry-form__actions">
            <button
              className="entry-form__submit"
              onClick={handleAdd}
              disabled={
                adding || !form.invoice_no || !form.sales_date || !form.customer_code
              }
            >
              {adding ? "..." : t.add}
            </button>
          </div>
        </div>
      </section>

      <div
        style={{
          background: "var(--surface-bg)",
          borderRadius: 8,
          boxShadow: "var(--surface-shadow)",
          padding: 16,
          marginBottom: 24,
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 6, fontSize: 15 }}>
          {t.bulkTitle}
        </h3>
        <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 0 }}>
          {t.bulkHint}
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
            style={{ fontSize: 13 }}
          />
          <button
            onClick={handleBulkUpload}
            disabled={!bulkFile || uploading}
            style={{
              padding: "8px 18px",
              borderRadius: 6,
              border: "none",
              background: uploading ? "#94a3b8" : "#2563eb",
              color: "#fff",
              cursor: uploading ? "default" : "pointer",
              fontSize: 14,
            }}
          >
            {uploading ? t.uploading : t.upload}
          </button>
        </div>
        {bulkStatus && (
          <p style={{ marginTop: 10, fontSize: 13 }}>{bulkStatus}</p>
        )}
      </div>

      <div
        style={{
          overflowX: "auto",
          background: "var(--surface-bg)",
          borderRadius: 8,
          boxShadow: "var(--surface-shadow)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#2d3748", color: "#fff" }}>
              <Th align={align}>{t.invoiceNo}</Th>
              <Th align={align}>{t.date}</Th>
              <Th align={align}>{t.month}</Th>
              <Th align={align}>{t.customer}</Th>
              <Th align={align}>{t.itemTotal}</Th>
              <Th align={align}>{t.tax}</Th>
              <Th align={align}>{t.totalSales}</Th>
              <Th align={align}>{t.rep}</Th>
              <Th align={align}>{t.actions}</Th>
            </tr>
          </thead>
          <tbody>
            {sales.map((s, i) => (
              <tr
                key={s.id}
                style={{
                  background: i % 2 === 0 ? "var(--surface-bg)" : "var(--surface-muted)",
                  borderBottom: "1px solid var(--border-color)",
                }}
              >
                <Td align={align}>{s.invoice_no}</Td>
                <Td align={align}>{s.sales_date}</Td>
                <Td align={align}>{s.month}</Td>
                <Td align={align}>
                  {s.customer_name} ({s.customer_code})
                </Td>
                <Td align={align}>{s.sales_item_total}</Td>
                <Td align={align}>{s.tax}</Td>
                <Td align={align}>{s.total_sales}</Td>
                <Td align={align}>{s.sales_rep ?? "-"}</Td>
                <Td align={align}>
                  <button
                    onClick={() => handleDelete(s.id)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 4,
                      border: "none",
                      background: "#dc2626",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    {t.delete}
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </main>
      <Footer lang={lang} />
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align: string;
}) {
  return (
    <th style={{ padding: "10px 14px", textAlign: align as any, fontSize: 13 }}>
      {children}
    </th>
  );
}

function Td({
  children,
  align,
}: {
  children: React.ReactNode;
  align: string;
}) {
  return (
    <td style={{ padding: "8px 14px", fontSize: 13, textAlign: align as any }}>
      {children}
    </td>
  );
}
