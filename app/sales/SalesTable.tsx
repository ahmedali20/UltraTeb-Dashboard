"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";

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

export default function SalesTable({ sales }: { sales: SaleRow[] }) {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "ar">("en");
  const t = translations[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";
  const align = lang === "ar" ? "right" : "left";

  const [form, setForm] = useState(emptyForm);
  const [adding, setAdding] = useState(false);

  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const inputStyle: React.CSSProperties = {
    padding: "6px 8px",
    fontSize: 13,
    border: "1px solid #d1d5db",
    borderRadius: 4,
    width: "100%",
  };

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
    <main
      dir={dir}
      style={{
        padding: 32,
        maxWidth: 1300,
        margin: "0 auto",
        fontFamily: "Arial, 'Segoe UI', Tahoma, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <h1 style={{ margin: 0 }}>{t.title}</h1>
          <a href="/" style={{ fontSize: 14, color: "#2563eb", textDecoration: "none" }}>
            {t.backToCustomers}
          </a>
        </div>
        <button
          onClick={() => setLang(lang === "en" ? "ar" : "en")}
          style={{
            padding: "8px 16px",
            borderRadius: 6,
            border: "1px solid #ccc",
            background: "#2d3748",
            color: "#fff",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          {t.switchTo}
        </button>
      </div>

      <p style={{ color: "#666", marginBottom: 20 }}>
        {t.total} {sales.length}
      </p>

      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          padding: 16,
          marginBottom: 16,
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 15 }}>
          {t.addTitle}
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
          }}
        >
          <input
            style={inputStyle}
            placeholder={t.invoiceNo}
            value={form.invoice_no}
            onChange={(e) => setForm({ ...form, invoice_no: e.target.value })}
          />
          <input
            style={inputStyle}
            type="date"
            value={form.sales_date}
            onChange={(e) => setForm({ ...form, sales_date: e.target.value })}
          />
          <input
            style={inputStyle}
            placeholder={t.customer + " Code"}
            value={form.customer_code}
            onChange={(e) =>
              setForm({ ...form, customer_code: e.target.value })
            }
          />
          <input
            style={inputStyle}
            type="number"
            placeholder={t.itemTotal}
            value={form.sales_item_total}
            onChange={(e) =>
              setForm({ ...form, sales_item_total: e.target.value })
            }
          />
          <input
            style={inputStyle}
            type="number"
            placeholder={t.tax}
            value={form.tax}
            onChange={(e) => setForm({ ...form, tax: e.target.value })}
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={
            adding || !form.invoice_no || !form.sales_date || !form.customer_code
          }
          style={{
            marginTop: 12,
            padding: "8px 18px",
            borderRadius: 6,
            border: "none",
            background: adding ? "#94a3b8" : "#16a34a",
            color: "#fff",
            cursor: adding ? "default" : "pointer",
            fontSize: 14,
          }}
        >
          {adding ? "..." : t.add}
        </button>
      </div>

      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          padding: 16,
          marginBottom: 24,
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: 6, fontSize: 15 }}>
          {t.bulkTitle}
        </h3>
        <p style={{ fontSize: 12, color: "#666", marginTop: 0 }}>
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
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
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
                  background: i % 2 === 0 ? "#fff" : "#f9fafb",
                  borderBottom: "1px solid #e5e7eb",
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
