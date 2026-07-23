"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Header from "./Header";
import Footer from "./Footer";

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
  const salesRepOptions = Array.from(
    new Set(
      customers
        .map((customer) => customer.sales_rep_name?.trim())
        .filter((name): name is string => Boolean(name))
    )
  ).sort((a, b) => a.localeCompare(b));

  const [newCustomer, setNewCustomer] = useState<FormFields>(emptyForm);
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormFields>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (
      !newCustomer.customer_name.trim() ||
      !newCustomer.sales_rep_name.trim()
    ) return;
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
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--input-text)",
    borderRadius: 4,
    width: "100%",
  };

  return (
    <div dir={dir} style={{ fontFamily: "Arial, 'Segoe UI', Tahoma, sans-serif", minHeight: "100vh", background: "var(--page-bg)", color: "var(--text-primary)" }}>
      <Header active="customers" lang={lang} onToggleLang={() => setLang(lang === "en" ? "ar" : "en")} />
      <main style={{ padding: "0 32px", maxWidth: 1300, margin: "0 auto" }}>
        <h1 style={{ margin: 0 }}>{t.title}</h1>

      <p style={{ color: "var(--text-secondary)", marginBottom: 20 }}>
        {t.total} {customers.length}
      </p>

      <section className="entry-form">
        <div className="entry-form__header">
          <div>
            <h3 className="entry-form__title">{t.addTitle}</h3>
            <p className="entry-form__subtitle">
              {lang === "ar"
                ? "أدخل بيانات العميل الأساسية والتجارية."
                : "Enter the customer’s essential business details."}
            </p>
          </div>
          <span className="entry-form__badge" aria-hidden="true">+</span>
        </div>

        <div className="entry-form__body">
          <div className="entry-form__grid">
            <label className="entry-form__field entry-form__field--wide">
              <span className="entry-form__label">
                {t.name}<span className="entry-form__required">*</span>
              </span>
              <input
                className="entry-form__input"
                placeholder={t.namePlaceholder}
                value={newCustomer.customer_name}
                onChange={(e) =>
                  setNewCustomer({ ...newCustomer, customer_name: e.target.value })
                }
              />
            </label>

            <label className="entry-form__field entry-form__field--wide">
              <span className="entry-form__label">{t.officialName}</span>
              <input
                className="entry-form__input"
                placeholder={t.officialName}
                value={newCustomer.customer_official_name}
                onChange={(e) =>
                  setNewCustomer({
                    ...newCustomer,
                    customer_official_name: e.target.value,
                  })
                }
              />
            </label>

            <label className="entry-form__field">
              <span className="entry-form__label">{t.terms}</span>
              <input
                className="entry-form__input"
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
            </label>

            <label className="entry-form__field">
              <span className="entry-form__label">{t.trn}</span>
              <input
                className="entry-form__input"
                placeholder={t.trn}
                value={newCustomer.customer_trn}
                onChange={(e) =>
                  setNewCustomer({ ...newCustomer, customer_trn: e.target.value })
                }
              />
            </label>

            <label className="entry-form__field">
              <span className="entry-form__label">{t.rep}</span>
              <select
                className="entry-form__input"
                value={newCustomer.sales_rep_name}
                onChange={(e) =>
                  setNewCustomer({
                    ...newCustomer,
                    sales_rep_name: e.target.value,
                  })
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

            <label className="entry-form__field">
              <span className="entry-form__label">{t.credit}</span>
              <input
                className="entry-form__input"
                placeholder={t.credit}
                type="number"
                value={newCustomer.credit_limit}
                onChange={(e) =>
                  setNewCustomer({ ...newCustomer, credit_limit: e.target.value })
                }
              />
            </label>
          </div>

          <div className="entry-form__actions">
            <button
              className="entry-form__submit"
              onClick={handleAdd}
              disabled={
                adding ||
                !newCustomer.customer_name.trim() ||
                !newCustomer.sales_rep_name.trim()
              }
            >
              {adding ? "..." : t.add}
            </button>
          </div>
        </div>
      </section>

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
                    background: i % 2 === 0 ? "var(--surface-bg)" : "var(--surface-muted)",
                    borderBottom: "1px solid var(--border-color)",
                  }}
                >
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
                        <select
                          style={inputStyle}
                          value={editForm.sales_rep_name}
                          onChange={(e) =>
                            setEditForm({
                              ...editForm,
                              sales_rep_name: e.target.value,
                            })
                          }
                        >
                          <option value="">
                            {lang === "ar" ? "اختر المندوب" : "Select rep"}
                          </option>
                          {Array.from(
                            new Set(
                              [...salesRepOptions, editForm.sales_rep_name].filter(
                                Boolean
                              )
                            )
                          ).map((rep) => (
                            <option key={rep} value={rep}>{rep}</option>
                          ))}
                        </select>
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
                            disabled={saving || !editForm.sales_rep_name.trim()}
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
