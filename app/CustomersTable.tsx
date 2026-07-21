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
