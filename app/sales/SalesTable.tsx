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

type BulkInvoiceRow = {
  invoice_no?: string;
  sales_date?: string;
  customer_code?: string;
  customer_name?: string;
  sales_item_total?: string;
  tax?: string;
  _sourceCustomer: string;
  _sourceCustomerName: string;
  _confirmed: boolean;
  _rowNumber: number;
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
      "CSV columns: invoice_no, sales_date, customer_name, sales_item_total, tax",
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
      "أعمدة ملف CSV: invoice_no, sales_date, customer_name, sales_item_total, tax",
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

type InvoiceForm = typeof emptyForm;

function normalizeSalesRep(value: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) return "Unassigned";

  return trimmed
    .toLocaleLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toLocaleUpperCase());
}

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<InvoiceForm>(emptyForm);
  const [savingEdit, setSavingEdit] = useState(false);
  const [customerOptions, setCustomerOptions] = useState(customers);
  const [creatingCustomerRow, setCreatingCustomerRow] = useState<number | null>(
    null
  );
  const [newCustomerName, setNewCustomerName] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [bulkCustomerSearches, setBulkCustomerSearches] = useState<
    Record<number, string>
  >({});
  const [recordRepFilter, setRecordRepFilter] = useState("All");
  const [recordMonthFilter, setRecordMonthFilter] = useState("All");

  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkRows, setBulkRows] = useState<BulkInvoiceRow[]>([]);
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

  const sortedSales = [...sales].sort((a, b) =>
    a.invoice_no.localeCompare(b.invoice_no, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
  const recordReps = Array.from(
    new Set(sales.map((sale) => normalizeSalesRep(sale.sales_rep)))
  ).sort();
  const recordMonths = Array.from(
    new Set(sales.map((sale) => sale.month).filter(Boolean))
  ).sort((a, b) => b.localeCompare(a));
  const displayedSales = sortedSales.filter(
    (sale) =>
      (recordRepFilter === "All" ||
        normalizeSalesRep(sale.sales_rep) === recordRepFilter) &&
      (recordMonthFilter === "All" || sale.month === recordMonthFilter)
  );

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

  function handleLegacyBulkUpload() {
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

  function normalizeCustomerValue(value: unknown) {
    return String(value ?? "").trim().toLocaleLowerCase();
  }

  function handleBulkFileChange(file: File | null) {
    setBulkFile(file);
    setBulkRows([]);
    setBulkStatus("");
    setBulkCustomerSearches({});
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) =>
        header
          .replace(/^\uFEFF/, "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, ""),
      complete: (results) => {
        const parsedRows = results.data as Record<string, unknown>[];

        setBulkRows(
          parsedRows
          .filter((row) =>
            [
              row.invoice_no,
              row.sales_date,
              row.customer_code,
              row.customer_name,
              row.sales_item_total,
              row.tax,
            ].some((value) => String(value ?? "").trim())
          )
          .map((row, index) => {
            const sourceCode = String(row.customer_code ?? "").trim();
            const sourceName = String(row.customer_name ?? "").trim();
            const normalizedName = normalizeCustomerValue(sourceName);
            const previousInvoiceCustomer = sales.find(
              (sale) =>
                normalizeCustomerValue(sale.customer_name) === normalizedName
            );
            const matchedFromPreviousInvoice = previousInvoiceCustomer
              ? customerOptions.find(
                  (customer) =>
                    customer.customer_code ===
                    previousInvoiceCustomer.customer_code
                )
              : undefined;
            const matchedCustomer =
              matchedFromPreviousInvoice ??
              customerOptions.find(
                (customer) => customer.customer_code === sourceCode
              ) ??
              customerOptions.find(
                (customer) =>
                  normalizeCustomerValue(customer.customer_name) ===
                  normalizedName
              );

            return {
              invoice_no: String(row.invoice_no ?? "").trim(),
              sales_date: String(row.sales_date ?? "").trim(),
              customer_code: matchedCustomer?.customer_code ?? "",
              customer_name: matchedCustomer?.customer_name ?? "",
              sales_item_total: String(row.sales_item_total ?? "").trim(),
              tax: String(row.tax ?? "").trim(),
              _sourceCustomer: sourceName || "-",
              _sourceCustomerName: sourceName,
              _confirmed: false,
              _rowNumber: index + 2,
            };
          })
        );
      },
      error: (err) => setBulkStatus(err.message),
    });
  }

  function updateBulkCustomer(rowIndex: number, customerCode: string) {
    const customer = customerOptions.find(
      (item) => item.customer_code === customerCode
    );

    setBulkRows((current) =>
      current.map((row, index) =>
        index === rowIndex
          ? {
              ...row,
              customer_code: customer?.customer_code ?? "",
              customer_name: customer?.customer_name ?? "",
              _confirmed: Boolean(customer),
            }
          : row
      )
    );
  }

  function customersForBulkRow(rowIndex: number, selectedCode?: string) {
    const search = normalizeCustomerValue(bulkCustomerSearches[rowIndex]);
    if (!search) return customerOptions;

    return customerOptions.filter(
      (customer) =>
        customer.customer_code === selectedCode ||
        normalizeCustomerValue(customer.customer_name).includes(search)
    );
  }

  function openCreateCustomer(rowIndex: number) {
    setCreatingCustomerRow(rowIndex);
    setNewCustomerName(
      bulkRows[rowIndex]._sourceCustomerName ||
        bulkRows[rowIndex].customer_name ||
        ""
    );
  }

  async function createCustomerForBulkRow() {
    if (creatingCustomerRow === null || !newCustomerName.trim()) return;

    setCreatingCustomer(true);
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_name: newCustomerName.trim() }),
    });
    const json = await res.json();
    setCreatingCustomer(false);

    if (!res.ok) {
      alert(json.error || "Error creating customer");
      return;
    }

    const createdCustomer: CustomerOption = {
      customer_code: json.data.customer_code,
      customer_name: json.data.customer_name,
    };

    setCustomerOptions((current) =>
      [...current, createdCustomer].sort((a, b) =>
        a.customer_code.localeCompare(b.customer_code, undefined, {
          numeric: true,
        })
      )
    );
    setBulkRows((current) =>
      current.map((row, index) =>
        index === creatingCustomerRow
          ? {
              ...row,
              customer_code: createdCustomer.customer_code,
              customer_name: createdCustomer.customer_name,
              _confirmed: true,
            }
          : row
      )
    );
    setCreatingCustomerRow(null);
    setNewCustomerName("");
  }

  function confirmBulkRow(rowIndex: number, confirmed: boolean) {
    setBulkRows((current) =>
      current.map((row, index) =>
        index === rowIndex && row.customer_code
          ? { ...row, _confirmed: confirmed }
          : row
      )
    );
  }

  function confirmAllMatchedRows() {
    setBulkRows((current) =>
      current.map((row) => ({
        ...row,
        _confirmed: Boolean(row.customer_code),
      }))
    );
  }

  async function handleBulkUpload() {
    if (!bulkFile || !bulkRows.length) return;
    if (bulkRows.some((row) => !row.customer_code || !row._confirmed)) {
      setBulkStatus(
        lang === "ar"
          ? "يرجى اختيار وتأكيد العميل لكل فاتورة."
          : "Please select and confirm a customer for every invoice."
      );
      return;
    }

    setUploading(true);
    setBulkStatus("");

    const rows = bulkRows.map(
      ({
        _confirmed,
        _rowNumber,
        _sourceCustomer,
        _sourceCustomerName,
        ...row
      }) => row
    );
    const res = await fetch("/api/sales/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const json = await res.json();
    setUploading(false);

    if (res.ok) {
      setBulkStatus(
        `Uploaded ${json.inserted} invoices successfully${
          json.failed?.length ? `, ${json.failed.length} failed` : ""
        }`
      );
      setBulkFile(null);
      setBulkRows([]);
      setBulkCustomerSearches({});
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } else {
      setBulkStatus(json.error || "Upload failed");
    }
  }

  function startEdit(sale: SaleRow) {
    setEditingId(sale.id);
    setEditForm({
      invoice_no: sale.invoice_no,
      sales_date: sale.sales_date,
      customer_code: sale.customer_code,
      sales_item_total: String(sale.sales_item_total),
      tax: String(sale.tax),
    });
  }

  async function handleSaveEdit(id: string) {
    if (
      !editForm.invoice_no ||
      !editForm.sales_date ||
      !editForm.customer_code
    ) {
      alert("Invoice number, date and customer are required.");
      return;
    }

    setSavingEdit(true);
    const res = await fetch(`/api/sales/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setSavingEdit(false);

    if (res.ok) {
      setEditingId(null);
      router.refresh();
    } else {
      const { error } = await res.json();
      alert(error || "Error updating invoice");
    }
  }

  return (
    <div dir={dir} style={{ fontFamily: "Arial, 'Segoe UI', Tahoma, sans-serif", minHeight: "100vh", background: "var(--page-bg)", color: "var(--text-primary)" }}>
      <Header active="sales" lang={lang} onToggleLang={() => setLang(lang === "en" ? "ar" : "en")} />
      <main style={{ padding: "0 32px", maxWidth: 1300, margin: "0 auto" }}>
        <h1 style={{ margin: 0 }}>{t.title}</h1>

      <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
        {t.total} {sales.length}
      </p>

      <section className="entry-form" id="add-record">
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
                {t.customer}<span className="entry-form__required">*</span>
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
                    : "Select customer"}
                </option>
                {customerOptions.map((customer) => (
                  <option
                    key={customer.customer_code}
                    value={customer.customer_code}
                  >
                    {customer.customer_name}
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
        id="bulk-upload"
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
            onChange={(e) =>
              handleBulkFileChange(e.target.files?.[0] ?? null)
            }
            style={{ fontSize: 13 }}
          />
          <button
            onClick={handleBulkUpload}
            disabled={
              !bulkRows.length ||
              uploading ||
              bulkRows.some(
                (row) => !row.customer_code || !row._confirmed
              )
            }
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
        {bulkRows.length > 0 && (
          <>
            <div className="bulk-review">
              <table className="bulk-review__table">
                <thead>
                  <tr>
                    <th>
                      {lang === "ar" ? "رقم الصف" : "CSV row"}
                    </th>
                    <th>{t.invoiceNo}</th>
                    <th>{t.date}</th>
                    <th>
                      {lang === "ar" ? "العميل في الملف" : "Customer in CSV"}
                    </th>
                    <th>
                      {lang === "ar" ? "مطابقة العميل" : "Customer match"}
                    </th>
                    <th>{t.itemTotal}</th>
                    <th>{t.tax}</th>
                    <th>{t.totalSales}</th>
                    <th>{lang === "ar" ? "تأكيد" : "Confirm"}</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkRows.map((row, index) => (
                    <tr key={`${row._rowNumber}-${row.invoice_no}`}>
                      <td>{row._rowNumber}</td>
                      <td>{row.invoice_no || `Row ${row._rowNumber}`}</td>
                      <td>{row.sales_date || "-"}</td>
                      <td>{row._sourceCustomer}</td>
                      <td>
                        <input
                          className="bulk-review__customer-search"
                          type="search"
                          placeholder={
                            lang === "ar"
                              ? "ابحث باسم العميل"
                              : "Search by customer name"
                          }
                          value={bulkCustomerSearches[index] ?? ""}
                          onChange={(event) =>
                            setBulkCustomerSearches((current) => ({
                              ...current,
                              [index]: event.target.value,
                            }))
                          }
                        />
                        <select
                          className="bulk-review__select"
                          value={row.customer_code}
                          onChange={(event) =>
                            updateBulkCustomer(index, event.target.value)
                          }
                        >
                          <option value="">
                            {lang === "ar"
                              ? "اختر العميل"
                              : "Select customer"}
                          </option>
                          {customersForBulkRow(index, row.customer_code).map((customer) => (
                            <option
                              key={customer.customer_code}
                              value={customer.customer_code}
                            >
                              {customer.customer_name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="bulk-review__new-customer"
                          onClick={() => openCreateCustomer(index)}
                        >
                          +{" "}
                          {lang === "ar"
                            ? "إنشاء عميل جديد"
                            : "Create new customer"}
                        </button>
                      </td>
                      <td>
                        {Number(row.sales_item_total || 0).toLocaleString(
                          lang === "ar" ? "ar-EG" : "en-US",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }
                        )}
                      </td>
                      <td>
                        {Number(row.tax || 0).toLocaleString(
                          lang === "ar" ? "ar-EG" : "en-US",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }
                        )}
                      </td>
                      <td>
                        {(
                          Number(row.sales_item_total || 0) +
                          Number(row.tax || 0)
                        ).toLocaleString(
                          lang === "ar" ? "ar-EG" : "en-US",
                          {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }
                        )}
                      </td>
                      <td>
                        <label className="bulk-review__confirm">
                          <input
                            type="checkbox"
                            checked={row._confirmed}
                            disabled={!row.customer_code}
                            onChange={(event) =>
                              confirmBulkRow(index, event.target.checked)
                            }
                          />
                          {row._confirmed
                            ? lang === "ar"
                              ? "تم"
                              : "Confirmed"
                            : lang === "ar"
                              ? "راجع"
                              : "Review"}
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bulk-review__summary">
              <span>
                {bulkRows.filter((row) => row._confirmed).length} /{" "}
                {bulkRows.length}{" "}
                {lang === "ar" ? "تم تأكيدهم" : "confirmed"}
              </span>
              <button
                type="button"
                className="bulk-review__confirm-all"
                onClick={confirmAllMatchedRows}
              >
                {lang === "ar"
                  ? "تأكيد كل المطابقات"
                  : "Confirm all matched"}
              </button>
            </div>
            {creatingCustomerRow !== null && (
              <div className="bulk-customer-modal" role="dialog" aria-modal="true">
                <div className="bulk-customer-modal__card">
                  <h3>
                    {lang === "ar"
                      ? "إنشاء عميل جديد"
                      : "Create New Customer"}
                  </h3>
                  <p>
                    {lang === "ar"
                      ? "سيتم إنشاء العميل واختياره لهذه الفاتورة."
                      : "The new customer will be created and selected for this invoice."}
                  </p>
                  <label>
                    <span>
                      {lang === "ar" ? "اسم العميل" : "Customer Name"}
                    </span>
                    <input
                      autoFocus
                      className="entry-form__input"
                      value={newCustomerName}
                      onChange={(event) =>
                        setNewCustomerName(event.target.value)
                      }
                    />
                  </label>
                  <div className="bulk-customer-modal__actions">
                    <button
                      type="button"
                      onClick={() => {
                        setCreatingCustomerRow(null);
                        setNewCustomerName("");
                      }}
                      disabled={creatingCustomer}
                    >
                      {lang === "ar" ? "إلغاء" : "Cancel"}
                    </button>
                    <button
                      type="button"
                      className="bulk-customer-modal__create"
                      onClick={createCustomerForBulkRow}
                      disabled={creatingCustomer || !newCustomerName.trim()}
                    >
                      {creatingCustomer
                        ? "..."
                        : lang === "ar"
                          ? "إنشاء واختيار"
                          : "Create and Select"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        {bulkStatus && (
          <p style={{ marginTop: 10, fontSize: 13 }}>{bulkStatus}</p>
        )}
      </div>

      <div className="records-toolbar" id="all-records">
        <div>
          <strong>{lang === "ar" ? "كل الفواتير" : "All Records"}</strong>
          <span>
            {displayedSales.length} {lang === "ar" ? "سجل" : "records"}
          </span>
        </div>
        <label>
          {lang === "ar" ? "الشهر" : "Month"}
          <select
            value={recordMonthFilter}
            onChange={(event) => setRecordMonthFilter(event.target.value)}
          >
            <option value="All">{lang === "ar" ? "كل الشهور" : "All Months"}</option>
            {recordMonths.map((month) => (
              <option key={month} value={month}>{month}</option>
            ))}
          </select>
        </label>
        <label>
          {lang === "ar" ? "المندوب" : "Sales Rep"}
          <select
            value={recordRepFilter}
            onChange={(event) => setRecordRepFilter(event.target.value)}
          >
            <option value="All">{lang === "ar" ? "كل المندوبين" : "All Reps"}</option>
            {recordReps.map((rep) => (
              <option key={rep} value={rep}>{rep}</option>
            ))}
          </select>
        </label>
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
            {displayedSales.map((s, i) => {
              const isEditing = editingId === s.id;
              const editedTotal =
                Number(editForm.sales_item_total || 0) +
                Number(editForm.tax || 0);

              return (
              <tr
                key={s.id}
                style={{
                  background: i % 2 === 0 ? "var(--surface-bg)" : "var(--surface-muted)",
                  borderBottom: "1px solid var(--border-color)",
                }}
              >
                <Td align={align}>
                  {isEditing ? (
                    <input
                      style={inputStyle}
                      value={editForm.invoice_no}
                      onChange={(event) =>
                        setEditForm({ ...editForm, invoice_no: event.target.value })
                      }
                    />
                  ) : s.invoice_no}
                </Td>
                <Td align={align}>
                  {isEditing ? (
                    <input
                      style={inputStyle}
                      type="date"
                      value={editForm.sales_date}
                      onChange={(event) =>
                        setEditForm({ ...editForm, sales_date: event.target.value })
                      }
                    />
                  ) : s.sales_date}
                </Td>
                <Td align={align}>{s.month}</Td>
                <Td align={align}>
                  {isEditing ? (
                    <select
                      style={{ ...inputStyle, minWidth: 190 }}
                      value={editForm.customer_code}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          customer_code: event.target.value,
                        })
                      }
                    >
                      {customerOptions.map((customer) => (
                        <option
                          key={customer.customer_code}
                          value={customer.customer_code}
                        >
                          {customer.customer_name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    s.customer_name || "-"
                  )}
                </Td>
                <Td align={align}>
                  {isEditing ? (
                    <input
                      style={inputStyle}
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.sales_item_total}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          sales_item_total: event.target.value,
                        })
                      }
                    />
                  ) : s.sales_item_total}
                </Td>
                <Td align={align}>
                  {isEditing ? (
                    <input
                      style={inputStyle}
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.tax}
                      onChange={(event) =>
                        setEditForm({ ...editForm, tax: event.target.value })
                      }
                    />
                  ) : s.tax}
                </Td>
                <Td align={align}>
                  {isEditing ? editedTotal.toFixed(2) : s.total_sales}
                </Td>
                <Td align={align}>
                  {s.sales_rep ? normalizeSalesRep(s.sales_rep) : "-"}
                </Td>
                <Td align={align}>
                  <div style={{ display: "flex", gap: 6, minWidth: 130 }}>
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => handleSaveEdit(s.id)}
                          disabled={savingEdit}
                          style={actionButtonStyle("#16a34a")}
                        >
                          {savingEdit ? "..." : lang === "ar" ? "حفظ" : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          disabled={savingEdit}
                          style={actionButtonStyle("#64748b")}
                        >
                          {lang === "ar" ? "إلغاء" : "Cancel"}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(s)}
                          style={actionButtonStyle("#2563eb")}
                        >
                          {lang === "ar" ? "تعديل" : "Edit"}
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          style={actionButtonStyle("#dc2626")}
                        >
                          {t.delete}
                        </button>
                      </>
                    )}
                  </div>
                </Td>
              </tr>
              );
            })}
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

function actionButtonStyle(background: string): React.CSSProperties {
  return {
    padding: "5px 9px",
    borderRadius: 4,
    border: "none",
    background,
    color: "#fff",
    cursor: "pointer",
    fontSize: 12,
  };
}
