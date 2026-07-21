"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Customer = {
  id: string;
  customer_code: string;
  customer_name: string;
  customer_official_name: string | null;
  payment_terms_days: number | null;
  customer_trn: string | null;
  sales_rep_name: string | null;
  credit_limit: number | null;
};

type FormFields = {
  customer_name: string;
  customer_official_name: string;
  payment_terms_days: string;
  customer_trn: string;
  sales_rep_name: string;
  credit_limit: string;
};

const emptyForm: FormFields = {
  customer_name: "",
  customer_official_name: "",
  payment_terms_days: "",
  customer_trn: "",
  sales_rep_name: "",
  credit_limit: "",
};

const translations = {
  en: {
    title: "Customers",
    total: "Total customers:",
    code: "Customer Code",
    name: "Customer Name",
    officialName: "Official Name",
    terms: "Payment Terms (days)",
    trn: "TRN / National ID",
    rep: "Sales Rep",
    credit: "Credit Limit",
    switchTo: "العربية",
    addTitle: "Add New Customer",
    add: "Add Customer",
    edit: "Edit",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    confirmDelete: "Delete this customer? This cannot be undone.",
    actions: "Actions",
    namePlaceholder: "Customer name (required)",
  },
  ar: {
    title: "جدول العملاء",
    total: "إجمالي العملاء:",
    code: "كود العميل",
    name: "اسم العميل",
    officialName: "الاسم الرسمي",
    terms: "مدة السداد (يوم)",
    trn: "الرقم الضريبي/القومي",
    rep: "المندوب",
    credit: "حد الائتمان",
    switchTo: "English",
    addTitle: "إضافة عميل جديد",
    add: "إضافة عميل",
    edit: "تعديل",
    save: "حفظ",
    cancel: "إلغاء",
    delete: "حذف",
    confirmDelete: "هل تريد حذف هذا العميل؟ لا يمكن التراجع عن هذا الإجراء.",
    actions: "إجراءات",
    namePlaceholder: "اسم العميل (إجباري)",
  },
};

export default function CustomersTable({
  customers,
}: {
  customers: Customer[];
}) {
  const router = useRouter();
  const [lang, setLang] = useState<"en" | "ar">("en");
  const t = translations[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";
  const align = lang === "ar" ? "right" : "left";

  const [newCustomer, setNewCustomer] = useState<FormFields>(emptyForm);
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormFields>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!newCustomer.customer_name.trim()) return;
    setAdding(true);
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCustomer),
    });
    setAdding(false);
    if (res.ok) {
      setNewCustomer(emptyForm);
      router.refresh();
    } else {
      const { error } = await res.json();
      alert(error || "Error adding customer");
    }
  }

  function startEdit(c: Customer) {
    setEditingId(c.id);
    setEditForm({
      customer_name: c.customer_name ?? "",
      customer_official_name: c.customer_official_name ?? "",
      payment_terms_days: c.payment_terms_days?.toString() ?? "",
      customer_trn: c.customer_trn ?? "",
      sales_rep_name: c.sales_rep_name ?? "",
      credit_limit: c.credit_limit?.toString() ?? "",
    });
  }

  async function handleSaveEdit(id: string) {
    setSaving(true);
    const res = await fetch(`/api/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setSaving(false);
    if (res.ok) {
      setEditingId(null);
      router.refresh();
    } else {
      const { error } = await res.json();
      alert(error || "Error updating customer");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm(t.confirmDelete)) return;
    const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.refresh();
    } else {
      const { error } = await res.json();
      alert(error || "Error deleting customer");
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: "6px 8px",
    fontSize: 13,
    border: "1px solid #d1d5db",
    borderRadius: 4,
    width: "100%",
  };

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
          
            href="/sales"
            style={{ fontSize: 14, color: "#2563eb", textDecoration: "none" }}
          >
            {lang === "ar" ? "→ المبيعات" : "Sales →"}
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
        {t.total} {customers.length}
      </p>

      <div
        style={{
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          padding: 16,
          marginBottom: 24,
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
            placeholder={t.namePlaceholder}
            value={newCustomer.customer_name}
            onChange={(e) =>
              setNewCustomer({ ...newCustomer, customer_name: e.target.value })
            }
          />
          <input
            style={inputStyle}
            placeholder={t.officialName}
            value={newCustomer.customer_official_name}
            onChange={(e) =>
              setNewCustomer({
                ...newCustomer,
                customer_official_name: e.target.value,
              })
            }
          />
          <input
            style={inputStyle}
            placeholder={t.terms}
            type="number"
            value={newCustomer.payment_terms_days}
            onChange={(e) =>
              setNewCustomer({
                ...newCustomer,
                payment_terms_days: e.target.value,
              })
            }
          />
          <input
            style={inputStyle}
            placeholder={t.trn}
            value={newCustomer.customer_trn}
            onChange={(e) =>
              setNewCustomer({ ...newCustomer, customer_trn: e.target.value })
            }
          />
          <input
            style={inputStyle}
            placeholder={t.rep}
            value={newCustomer.sales_rep_name}
            onChange={(e) =>
              setNewCustomer({
                ...newCustomer,
                sales_rep_name: e.target.value,
              })
            }
          />
          <input
            style={inputStyle}
            placeholder={t.credit}
            type="number"
            value={newCustomer.credit_limit}
            onChange={(e) =>
              setNewCustomer({ ...newCustomer, credit_limit: e.target.value })
            }
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={adding || !newCustomer.customer_name.trim()}
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
          overflowX: "auto",
          background: "#fff",
          borderRadius: 8,
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#2d3748", color: "#fff" }}>
              <Th align={align}>{t.code}</Th>
              <Th align={align}>{t.name}</Th>
              <Th align={align}>{t.officialName}</Th>
              <Th align={align}>{t.terms}</Th>
              <Th align={align}>{t.trn}</Th>
              <Th align={align}>{t.rep}</Th>
              <Th align={align}>{t.credit}</Th>
              <Th align={align}>{t.actions}</Th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c, i) => {
              const isEditing = editingId === c.id;
              return (
                <tr
                  key={c.id}
                  style={{
                    background: i % 2 === 0 ? "#fff" : "#f9fafb",
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  <Td align={align}>{c.customer_code}</Td>
                  {isEditing ? (
                    <>
                      <Td align={align}>
                        <input
                          style={inputStyle}
                          value={editForm.customer_name}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              customer_name: e.target.value,
                            })
                          }
                        />
                      </Td>
                      <Td align={align}>
                        <input
                          style={inputStyle}
                          value={editForm.customer_official_name}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              customer_official_name: e.target.value,
                            })
                          }
                        />
                      </Td>
                      <Td align={align}>
                        <input
                          style={inputStyle}
                          type="number"
                          value={editForm.payment_terms_days}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              payment_terms_days: e.target.value,
                            })
                          }
                        />
                      </Td>
                      <Td align={align}>
                        <input
                          style={inputStyle}
                          value={editForm.customer_trn}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              customer_trn: e.target.value,
                            })
                          }
                        />
                      </Td>
                      <Td align={align}>
                        <input
                          style={inputStyle}
                          value={editForm.sales_rep_name}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              sales_rep_name: e.target.value,
                            })
                          }
                        />
                      </Td>
                      <Td align={align}>
                        <input
                          style={inputStyle}
                          type="number"
                          value={editForm.credit_limit}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              credit_limit: e.target.value,
                            })
                          }
                        />
                      </Td>
                      <Td align={align}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <ActionButton
                            onClick={() => handleSaveEdit(c.id)}
                            color="#16a34a"
                            disabled={saving}
                          >
                            {t.save}
                          </ActionButton>
                          <ActionButton
                            onClick={() => setEditingId(null)}
                            color="#6b7280"
                          >
                            {t.cancel}
                          </ActionButton>
                        </div>
                      </Td>
                    </>
                  ) : (
                    <>
                      <Td align={align}>{c.customer_name}</Td>
                      <Td align={align}>{c.customer_official_name ?? "-"}</Td>
                      <Td align={align}>{c.payment_terms_days ?? "-"}</Td>
                      <Td align={align}>{c.customer_trn ?? "-"}</Td>
                      <Td align={align}>{c.sales_rep_name ?? "-"}</Td>
                      <Td align={align}>{c.credit_limit ?? 0}</Td>
                      <Td align={align}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <ActionButton
                            onClick={() => startEdit(c)}
                            color="#2563eb"
                          >
                            {t.edit}
                          </ActionButton>
                          <ActionButton
                            onClick={() => handleDelete(c.id)}
                            color="#dc2626"
                          >
                            {t.delete}
                          </ActionButton>
                        </div>
                      </Td>
                    </>
                  )}
                </tr>
              );
            })}
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
    <th style={{ padding: "10px 14px", textAlign: align as any, fontSize: 14 }}>
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

function ActionButton({
  children,
  onClick,
  color,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  color: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "4px 10px",
        borderRadius: 4,
        border: "none",
        background: color,
        color: "#fff",
        cursor: disabled ? "default" : "pointer",
        fontSize: 12,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {children}
    </button>
  );
}
