"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import Header from "../Header";
import Footer from "../Footer";

const currentRecordsMonth = `${new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", month: "short" }).format(new Date())}.${new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Cairo", year: "numeric" }).format(new Date())}`;

type SaleRow = {
  id: string;
  invoice_no: string;
  sales_date: string;
  due_date: string | null;
  month: string;
  customer_code: string;
  customer_name: string;
  sales_rep: string | null;
  sales_item_total: number;
  tax: number;
  vat_amount: number;
  table_tax_amount: number;
  tax_classification: "VAT" | "TABLE" | "VAT_TABLE" | "EXEMPT" | "UNKNOWN";
  total_sales: number;
  document_type: "INVOICE" | "CR_NOTE" | "DR_NOTE";
  original_invoice_no: string | null;
  note_reason: string | null;
};

type CustomerOption = {
  customer_code: string;
  customer_name: string;
  sales_rep_name: string | null;
  payment_terms_days: number | null;
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
  document_type: "INVOICE" as "INVOICE" | "CR_NOTE" | "DR_NOTE",
  invoice_no: "",
  original_invoice_no: "",
  note_reason: "",
  sales_date: "",
  due_date: "",
  due_days: "",
  customer_code: "",
  sales_item_total: "",
  tax: "",
  sales_rep_name: "",
};

type InvoiceForm = typeof emptyForm;

function addDaysToDate(date: string, days: string) {
  if (!date || days === "") return "";
  const value = Number(days);
  if (!Number.isFinite(value) || value < 0) return "";
  const result = new Date(`${date}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + Math.floor(value));
  return result.toISOString().slice(0, 10);
}

function daysBetweenDates(start: string, end: string | null) {
  if (!start || !end) return "";
  const startTime = Date.parse(`${start}T00:00:00Z`);
  const endTime = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return "";
  return String(Math.max(0, Math.round((endTime - startTime) / 86400000)));
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return "-";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const months = [
    "jan", "feb", "mar", "apr", "may", "jun",
    "jul", "aug", "sep", "oct", "nov", "dec",
  ];
  return `${match[3]}-${months[Number(match[2]) - 1]}-${match[1].slice(-2)}`;
}

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
  salesReps,
  lastSuccessfulSync,
}: {
  sales: SaleRow[];
  customers: CustomerOption[];
  salesReps: string[];
  lastSuccessfulSync: string | null;
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
  const [recordYearFilter, setRecordYearFilter] = useState("All");
  const [recordMonthFilter, setRecordMonthFilter] = useState(currentRecordsMonth);
  const [recordCustomerFilter, setRecordCustomerFilter] = useState("All");
  const [recordPage, setRecordPage] = useState(1);
  const [recordSort, setRecordSort] = useState<
    "invoice" | "date" | "customer" | "total"
  >("date");
  const [recordSortDirection, setRecordSortDirection] =
    useState<"asc" | "desc">("asc");
  const recordsPerPage = 25;
  const [activeSalesView] = useState<"add" | "records">("records");
  const salesRepOptions = Array.from(
    new Set(
      customerOptions
        .map((customer) => customer.sales_rep_name?.trim())
        .filter((name): name is string => Boolean(name))
        .concat(salesReps)
        .map((name) => normalizeSalesRep(name))
    )
  ).sort((a, b) => a.localeCompare(b));

  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkRows, setBulkRows] = useState<BulkInvoiceRow[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [syncingSheet, setSyncingSheet] = useState(false);
  const [sheetSyncStatus, setSheetSyncStatus] = useState("");
  const [lastSheetSync, setLastSheetSync] = useState(lastSuccessfulSync);
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

  const sortedSales = [...sales].sort((a, b) => {
    let comparison = 0;
    if (recordSort === "invoice") {
      comparison = a.invoice_no.localeCompare(b.invoice_no, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    } else if (recordSort === "customer") {
      comparison = (a.customer_name || "").localeCompare(b.customer_name || "");
    } else if (recordSort === "total") {
      comparison = Number(a.total_sales || 0) - Number(b.total_sales || 0);
    } else {
      comparison =
        a.sales_date.localeCompare(b.sales_date) ||
        a.invoice_no.localeCompare(b.invoice_no, undefined, {
          numeric: true,
          sensitivity: "base",
        });
    }
    return recordSortDirection === "asc" ? comparison : -comparison;
  });
  const recordReps = Array.from(
    new Set(sales.map((sale) => normalizeSalesRep(sale.sales_rep)))
  ).sort();
  const recordMonths = Array.from(
    new Set([currentRecordsMonth, ...sales.map((sale) => sale.month).filter(Boolean)])
  ).sort((a, b) => b.localeCompare(a));
  const recordYears = Array.from(
    new Set(sales.map((sale) => String(sale.sales_date || "").slice(0, 4)).filter(Boolean))
  ).sort((a, b) => b.localeCompare(a));
  const recordCustomers = Array.from(
    new Set(sales.map((sale) => sale.customer_name).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const displayedSales = sortedSales.filter(
    (sale) =>
      (recordRepFilter === "All" ||
        normalizeSalesRep(sale.sales_rep) === recordRepFilter) &&
      (recordYearFilter === "All" || String(sale.sales_date || "").startsWith(`${recordYearFilter}-`)) &&
      (recordMonthFilter === "All" || sale.month === recordMonthFilter) &&
      (recordCustomerFilter === "All" ||
        sale.customer_name === recordCustomerFilter)
  );
  const displayedSalesTotal = displayedSales.reduce(
    (total, sale) => total + Number(sale.total_sales || 0),
    0
  );
  const displayedSalesItemTotal = displayedSales.reduce(
    (total, sale) => total + Number(sale.sales_item_total || 0),
    0
  );
  const recordPageCount = Math.max(
    1,
    Math.ceil(displayedSales.length / recordsPerPage)
  );
  const paginatedSales = displayedSales.slice(
    (recordPage - 1) * recordsPerPage,
    recordPage * recordsPerPage
  );

  useEffect(() => {
    setRecordPage(1);
  }, [
    recordRepFilter,
    recordYearFilter,
    recordMonthFilter,
    recordCustomerFilter,
    recordSort,
    recordSortDirection,
  ]);

  function toggleRecordSort(
    key: "invoice" | "date" | "customer" | "total"
  ) {
    if (recordSort === key) {
      setRecordSortDirection((direction) =>
        direction === "asc" ? "desc" : "asc"
      );
    } else {
      setRecordSort(key);
      setRecordSortDirection("asc");
    }
  }

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
    if (
      !form.invoice_no ||
      !form.sales_date ||
      !form.customer_code ||
      !form.sales_rep_name ||
      (form.document_type !== "INVOICE" &&
        (!form.original_invoice_no.trim() || !form.note_reason.trim()))
    ) return;
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

  async function syncGoogleSheet() {
    setSyncingSheet(true);
    setSheetSyncStatus("");

    try {
      const response = await fetch("/api/google-sheets-sync", {
        method: "POST",
      });
      const result = await response.json();

      if (!response.ok) {
        setSheetSyncStatus(result.error || "Google Sheet sync failed.");
        return;
      }

      setSheetSyncStatus(
        `Sync complete: ${result.inserted} added, ${result.updated} updated, ` +
          `${result.createdCustomers} customers created, ` +
          `${result.creditNotes ?? 0} credit notes, ` +
          `${result.debitNotes ?? 0} debit notes, ` +
          `${result.cogs?.upserted ?? 0} COGS records synced (` +
          `${result.cogs?.invoices ?? 0} invoices, ${result.cogs?.creditNotes ?? 0} credit notes, ${result.cogs?.debitNotes ?? 0} debit notes), ` +
          `${result.cogs?.deleted ?? 0} old COGS records deleted, ` +
          `${result.deleted ?? 0} old 2026 records deleted, ` +
          `${result.protectedOutside2026 ?? 0} records outside 2026 protected, ` +
          `${result.cleanedCustomers ?? 0} invalid customers removed, ` +
          `${result.cleanedSalesReps ?? 0} invalid reps removed, ` +
          `${result.cleanedCustomerReps ?? 0} invalid assignments cleared` +
          (result.failed?.length
            ? `, ${result.failed.length} rows failed. First error: row ${
                result.failed[0].row
              } — ${result.failed[0].error}`
            : ".") +
          (result.deletionSkipped ? ` ${result.deletionSkipReason}` : "") +
          (result.cogs?.failed?.length
            ? ` ${result.cogs.failed.length} COGS rows failed. First COGS error: row ${result.cogs.failed[0].row} — ${result.cogs.failed[0].error}`
            : "")
      );
      if (result.lastSuccessfulSync) {
        setLastSheetSync(result.lastSuccessfulSync);
      }
      router.refresh();
    } catch {
      setSheetSyncStatus("Google Sheet sync failed. Please try again.");
    } finally {
      setSyncingSheet(false);
    }
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
      sales_rep_name: json.data.sales_rep_name ?? null,
      payment_terms_days: json.data.payment_terms_days ?? null,
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
    const customer = customerOptions.find(
      (item) => item.customer_code === sale.customer_code
    );
    setEditingId(sale.id);
    setEditForm({
      document_type: sale.document_type ?? "INVOICE",
      invoice_no: sale.invoice_no,
      original_invoice_no: sale.original_invoice_no ?? "",
      note_reason: sale.note_reason ?? "",
      sales_date: sale.sales_date,
      due_date: sale.due_date ?? "",
      due_days: customer
        ? String(customer.payment_terms_days ?? 0)
        : daysBetweenDates(sale.sales_date, sale.due_date),
      customer_code: sale.customer_code,
      sales_item_total: String(Math.abs(sale.sales_item_total)),
      tax: String(Math.abs(sale.tax)),
      sales_rep_name: sale.sales_rep ?? "",
    });
  }

  async function handleSaveEdit(id: string) {
    if (
      !editForm.invoice_no ||
      !editForm.sales_date ||
      !editForm.customer_code ||
      !editForm.sales_rep_name ||
      (editForm.document_type !== "INVOICE" &&
        (!editForm.original_invoice_no.trim() || !editForm.note_reason.trim()))
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

      <section className="sheet-sync-panel">
        <div>
          <div className="sheet-sync-panel__title">
            <strong>{lang === "ar" ? "مزامنة Google Sheet" : "Google Sheet Sync"}</strong>
            <small>
              {lang === "ar" ? "آخر مزامنة ناجحة: " : "Last successful sync: "}
              {lastSheetSync
                ? new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-EG", {
                    timeZone: "Africa/Cairo",
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(lastSheetSync))
                : lang === "ar" ? "لم تتم المزامنة بعد" : "Not synced yet"}
            </small>
          </div>
          <span>
            {lang === "ar"
              ? "مبيعات الفواتير · مزامنة تلقائية يومياً الساعة 11:59 مساءً بتوقيت القاهرة"
              : "Invoice Sales · Automatic daily sync at 11:59 PM Cairo"}
          </span>
          {sheetSyncStatus && <p>{sheetSyncStatus}</p>}
        </div>
        <button
          type="button"
          onClick={syncGoogleSheet}
          disabled={syncingSheet}
        >
          {syncingSheet
            ? lang === "ar" ? "جارٍ المزامنة..." : "Syncing..."
            : lang === "ar" ? "مزامنة الآن" : "Sync Now"}
        </button>
      </section>

      <section
        className="entry-form"
        id="add-record"
        style={{ display: activeSalesView === "add" ? undefined : "none" }}
      >
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
            <div className="entry-form__field entry-form__field--wide">
              <span className="entry-form__label">
                {lang === "ar" ? "نوع المستند" : "Document Type"}
                <span className="entry-form__required">*</span>
              </span>
              <div className="document-type-options">
                {([
                  ["INVOICE", lang === "ar" ? "فاتورة مبيعات" : "Sales Invoice"],
                  ["CR_NOTE", lang === "ar" ? "إشعار دائن (CR)" : "Credit Note (CR)"],
                  ["DR_NOTE", lang === "ar" ? "إشعار مدين (DR)" : "Debit Note (DR)"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`document-type-options__button ${
                      form.document_type === value
                        ? `document-type-options__button--active document-type-options__button--${value.toLowerCase()}`
                        : ""
                    }`}
                    onClick={() =>
                      setForm({
                        ...form,
                        document_type: value,
                        original_invoice_no:
                          value === "INVOICE" ? "" : form.original_invoice_no,
                        note_reason:
                          value === "INVOICE" ? "" : form.note_reason,
                      })
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <label className="entry-form__field">
              <span className="entry-form__label">
                {form.document_type === "INVOICE"
                  ? t.invoiceNo
                  : form.document_type === "CR_NOTE"
                    ? lang === "ar" ? "رقم الإشعار الدائن" : "Credit Note Number"
                    : lang === "ar" ? "رقم الإشعار المدين" : "Debit Note Number"}
                <span className="entry-form__required">*</span>
              </span>
              <input
                className="entry-form__input"
                placeholder={
                  form.document_type === "INVOICE"
                    ? t.invoiceNo
                    : form.document_type === "CR_NOTE"
                      ? lang === "ar" ? "رقم الإشعار الدائن" : "Credit Note Number"
                      : lang === "ar" ? "رقم الإشعار المدين" : "Debit Note Number"
                }
                value={form.invoice_no}
                onChange={(e) => setForm({ ...form, invoice_no: e.target.value })}
              />
            </label>

            {form.document_type !== "INVOICE" && (
              <>
                <label className="entry-form__field">
                  <span className="entry-form__label">
                    {lang === "ar"
                      ? "رقم الفاتورة الأصلية"
                      : "Original Invoice No"}
                    <span className="entry-form__required">*</span>
                  </span>
                  <input
                    className="entry-form__input"
                    value={form.original_invoice_no}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        original_invoice_no: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="entry-form__field entry-form__field--wide">
                  <span className="entry-form__label">
                    {lang === "ar" ? "سبب الإشعار" : "Note Reason"}
                    <span className="entry-form__required">*</span>
                  </span>
                  <input
                    className="entry-form__input"
                    value={form.note_reason}
                    onChange={(event) =>
                      setForm({ ...form, note_reason: event.target.value })
                    }
                    placeholder={
                      lang === "ar"
                        ? "مثال: مرتجع أو تعديل سعر"
                        : "Example: return or price correction"
                    }
                  />
                </label>
              </>
            )}

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
                onChange={(e) => {
                  const customer = customerOptions.find(
                    (item) => item.customer_code === e.target.value
                  );
                  setForm({
                    ...form,
                    customer_code: e.target.value,
                    sales_rep_name: customer?.sales_rep_name?.trim() ?? "",
                  });
                }}
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

            <label className="entry-form__field">
              <span className="entry-form__label">
                {t.rep}<span className="entry-form__required">*</span>
              </span>
              <select
                className="entry-form__input"
                value={form.sales_rep_name}
                onChange={(event) =>
                  setForm({ ...form, sales_rep_name: event.target.value })
                }
              >
                <option value="">
                  {lang === "ar" ? "اختر مندوب المبيعات" : "Select sales rep"}
                </option>
                {salesRepOptions.map((rep) => (
                  <option key={rep} value={rep}>{rep}</option>
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
                adding ||
                !form.invoice_no ||
                !form.sales_date ||
                !form.customer_code ||
                !form.sales_rep_name ||
                (form.document_type !== "INVOICE" &&
                  (!form.original_invoice_no.trim() ||
                    !form.note_reason.trim()))
              }
            >
              {adding
                ? "..."
                : form.document_type === "CR_NOTE"
                  ? lang === "ar" ? "إضافة إشعار دائن" : "Add Credit Note"
                  : form.document_type === "DR_NOTE"
                    ? lang === "ar" ? "إضافة إشعار مدين" : "Add Debit Note"
                    : t.add}
            </button>
          </div>
        </div>
      </section>

      <div
        id="bulk-upload"
        style={{
          display: undefined,
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

      <div
        className="records-toolbar"
        id="all-records"
        style={{ display: activeSalesView === "records" ? undefined : "none" }}
      >
        <div>
          <strong>{lang === "ar" ? "الفواتير" : "Invoices"}</strong>
          <span>
            {lang === "ar" ? "إجمالي الفواتير" : "Total Invoices"}:{" "}
            {displayedSales.length}
            {" · "}
            {lang === "ar"
              ? "إجمالي الأصناف بدون الضريبة"
              : "Sales Item Total Without Tax"}:{" "}
            {displayedSalesItemTotal.toLocaleString(
              lang === "ar" ? "ar-EG" : "en-US",
              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )}
            {" · "}
            {lang === "ar" ? "إجمالي الأصناف شامل الضريبة" : "Sales Item Total With Tax"}:{" "}
            {displayedSalesTotal.toLocaleString(
              lang === "ar" ? "ar-EG" : "en-US",
              { minimumFractionDigits: 2, maximumFractionDigits: 2 }
            )}
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
        <label>
          {lang === "ar" ? "اسم العميل" : "Customer Name"}
          <select
            value={recordCustomerFilter}
            onChange={(event) => setRecordCustomerFilter(event.target.value)}
          >
            <option value="All">{lang === "ar" ? "كل العملاء" : "All Customers"}</option>
            {recordCustomers.map((customerName) => (
              <option key={customerName} value={customerName}>{customerName}</option>
            ))}
          </select>
        </label>
        <label>
          {lang === "ar" ? "السنة" : "Year"}
          <select value={recordYearFilter} onChange={(event) => setRecordYearFilter(event.target.value)}>
            <option value="All">{lang === "ar" ? "كل السنوات" : "All Years"}</option>
            {recordYears.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
      </div>

      <div
        className="professional-data-table"
        style={{
          display: activeSalesView === "records" ? undefined : "none",
          overflowX: "auto",
          background: "var(--surface-bg)",
          borderRadius: 8,
          boxShadow: "var(--surface-shadow)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#2d3748", color: "#fff" }}>
              <Th align={align}>
                {lang === "ar" ? "نوع المستند" : "Document"}
              </Th>
              <Th align={align}>
                <SortButton active={recordSort === "invoice"} direction={recordSortDirection} onClick={() => toggleRecordSort("invoice")}>{t.invoiceNo}</SortButton>
              </Th>
              <Th align={align}>
                <SortButton active={recordSort === "date"} direction={recordSortDirection} onClick={() => toggleRecordSort("date")}>{t.date}</SortButton>
              </Th>
              <Th align={align}>{lang === "ar" ? "تاريخ الاستحقاق" : "Due Date"}</Th>
              <Th align={align}>{t.month}</Th>
              <Th align={align}>
                <SortButton active={recordSort === "customer"} direction={recordSortDirection} onClick={() => toggleRecordSort("customer")}>{t.customer}</SortButton>
              </Th>
              <Th align={align}>{t.itemTotal}</Th>
              <Th align={align}>{t.tax}</Th>
              <Th align={align}>{lang === "ar" ? "ضريبة القيمة المضافة" : "VAT"}</Th>
              <Th align={align}>{lang === "ar" ? "ضريبة الجدول" : "Table Tax"}</Th>
              <Th align={align}>{lang === "ar" ? "نوع الضريبة" : "Tax Type"}</Th>
              <Th align={align}>
                <SortButton active={recordSort === "total"} direction={recordSortDirection} onClick={() => toggleRecordSort("total")}>{t.totalSales}</SortButton>
              </Th>
              <Th align={align}>{t.rep}</Th>
              <Th align={align}>{t.actions}</Th>
            </tr>
          </thead>
          <tbody>
            {paginatedSales.map((s, i) => {
              const isEditing = editingId === s.id;
              const editedTotal =
                (editForm.document_type === "CR_NOTE" ? -1 : 1) *
                (Number(editForm.sales_item_total || 0) +
                  Number(editForm.tax || 0));

              return (
              <tr
                key={s.id}
                style={{
                  background: i % 2 === 0 ? "var(--surface-bg)" : "var(--surface-muted)",
                  borderBottom: "1px solid var(--border-color)",
                }}
              >
                <Td align={align}>
                  <span
                    className={`document-type-badge document-type-badge--${
                      (s.document_type ?? "INVOICE").toLowerCase()
                    }`}
                    title={
                      s.document_type === "INVOICE"
                        ? undefined
                        : `${s.original_invoice_no ?? ""} · ${
                            s.note_reason ?? ""
                          }`
                    }
                  >
                    {s.document_type === "CR_NOTE"
                      ? "CR Note"
                      : s.document_type === "DR_NOTE"
                        ? "DR Note"
                        : lang === "ar" ? "فاتورة" : "Invoice"}
                  </span>
                  {s.document_type !== "INVOICE" && (
                    <small className="document-note-reference">
                      {lang === "ar" ? "فاتورة" : "Invoice"}:{" "}
                      {s.original_invoice_no || "-"}
                    </small>
                  )}
                </Td>
                <Td align={align}>
                  {isEditing ? (
                    <input
                      style={inputStyle}
                      value={editForm.invoice_no}
                      onChange={(event) =>
                        setEditForm({ ...editForm, invoice_no: event.target.value })
                      }
                    />
                  ) : s.document_type === "INVOICE" ? (
                    <a className="invoice-number-link" href={`/sales/${s.id}`}>{s.invoice_no}</a>
                  ) : s.invoice_no}
                </Td>
                <Td align={align}>
                  {isEditing ? (
                    <input
                      style={inputStyle}
                      type="date"
                      value={editForm.sales_date}
                      onChange={(event) => {
                        const salesDate = event.target.value;
                        setEditForm({
                          ...editForm,
                          sales_date: salesDate,
                          due_date: addDaysToDate(salesDate, editForm.due_days),
                        });
                      }}
                    />
                  ) : formatShortDate(s.sales_date)}
                </Td>
                <Td align={align}>
                  {isEditing ? (
                    <div style={{ display: "grid", gap: 5, minWidth: 125 }}>
                      <small>{lang === "ar" ? "عدد أيام الاستحقاق" : "Due After (Days)"}</small>
                      <input
                        style={inputStyle}
                        type="number"
                        min="0"
                        step="1"
                        placeholder="30"
                        value={editForm.due_days}
                        readOnly
                      />
                      {editForm.due_date && <small>{lang === "ar" ? "تاريخ الاستحقاق" : "Due Date"}: {formatShortDate(editForm.due_date)}</small>}
                    </div>
                  ) : formatShortDate(s.due_date)}
                </Td>
                <Td align={align}>{s.month}</Td>
                <Td align={align}>
                  {isEditing ? (
                    <select
                      style={{ ...inputStyle, minWidth: 190 }}
                      value={editForm.customer_code}
                      onChange={(event) => {
                        const customer = customerOptions.find(
                          (item) => item.customer_code === event.target.value
                        );
                        setEditForm({
                          ...editForm,
                          customer_code: event.target.value,
                          sales_rep_name:
                            customer?.sales_rep_name?.trim() ??
                            editForm.sales_rep_name,
                          due_days: String(customer?.payment_terms_days ?? 0),
                          due_date: addDaysToDate(
                            editForm.sales_date,
                            String(customer?.payment_terms_days ?? 0)
                          ),
                        });
                      }}
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
                <Td align={align}>{Number(s.vat_amount || 0).toFixed(2)}</Td>
                <Td align={align}>{Number(s.table_tax_amount || 0).toFixed(2)}</Td>
                <Td align={align}>{s.tax_classification === "VAT_TABLE" ? "VAT + Table" : s.tax_classification || "UNKNOWN"}</Td>
                <Td align={align}>
                  {isEditing ? editedTotal.toFixed(2) : s.total_sales}
                </Td>
                <Td align={align}>
                  {isEditing ? (
                    <select
                      style={{ ...inputStyle, minWidth: 140 }}
                      value={editForm.sales_rep_name}
                      onChange={(event) =>
                        setEditForm({
                          ...editForm,
                          sales_rep_name: event.target.value,
                        })
                      }
                    >
                      <option value="">{lang === "ar" ? "اختر المندوب" : "Select rep"}</option>
                      {salesRepOptions.map((rep) => (
                        <option key={rep} value={rep}>{rep}</option>
                      ))}
                    </select>
                  ) : s.sales_rep ? normalizeSalesRep(s.sales_rep) : "-"}
                </Td>
                <Td align={align}>
                  <div style={{ display: "flex", gap: 6, minWidth: 130 }}>
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => handleSaveEdit(s.id)}
                          disabled={savingEdit || !editForm.sales_rep_name}
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
        <div className="data-pagination">
          <span>
            {lang === "ar" ? "عرض" : "Showing"}{" "}
            {displayedSales.length
              ? (recordPage - 1) * recordsPerPage + 1
              : 0}
            –{Math.min(recordPage * recordsPerPage, displayedSales.length)}{" "}
            {lang === "ar" ? "من" : "of"} {displayedSales.length}
          </span>
          <div>
            <button
              type="button"
              disabled={recordPage === 1}
              onClick={() => setRecordPage((page) => Math.max(1, page - 1))}
            >
              {lang === "ar" ? "السابق" : "Previous"}
            </button>
            <strong>{recordPage} / {recordPageCount}</strong>
            <button
              type="button"
              disabled={recordPage === recordPageCount}
              onClick={() =>
                setRecordPage((page) => Math.min(recordPageCount, page + 1))
              }
            >
              {lang === "ar" ? "التالي" : "Next"}
            </button>
          </div>
        </div>
      </div>
      </main>
      <Footer lang={lang} />
    </div>
  );
}

function SortButton({
  children,
  active,
  direction,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  direction: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button type="button" className="table-sort-button" onClick={onClick}>
      <span>{children}</span>
      <i>{active ? (direction === "asc" ? "↑" : "↓") : "↕"}</i>
    </button>
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
