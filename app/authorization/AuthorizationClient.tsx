"use client";

import { useState } from "react";
import Header from "../Header";
import Footer from "../Footer";

type Employee = { id: number; employee_name: string; national_id: string };

function cairoDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function printedDate(value: string) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return `${day}-${month}-${year}`;
}

export default function AuthorizationClient({ customers, initialEmployees }: { customers: string[]; initialEmployees: Employee[] }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [employees, setEmployees] = useState(initialEmployees);
  const [customer, setCustomer] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [employeeName, setEmployeeName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [authorizationDate, setAuthorizationDate] = useState(cairoDate());
  const [stampUrl, setStampUrl] = useState("");
  const [showStamp, setShowStamp] = useState(false);
  const [saving, setSaving] = useState(false);

  function chooseStamp(file?: File) {
    if (!file) {
      setStampUrl("");
      setShowStamp(false);
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Please select a PNG or JPG stamp image.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setStampUrl(String(reader.result));
      setShowStamp(true);
    };
    reader.readAsDataURL(file);
  }

  function chooseEmployee(id: string) {
    setEmployeeId(id);
    const employee = employees.find((item) => item.id === Number(id));
    if (employee) {
      setEmployeeName(employee.employee_name);
      setNationalId(employee.national_id);
    } else {
      setEmployeeName("");
      setNationalId("");
    }
  }

  async function saveEmployee() {
    setSaving(true);
    try {
      const response = await fetch("/api/authorized-employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeName, nationalId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return alert(result.error || "Unable to save employee.");
      setEmployees((current) => [...current, result.data].sort((a, b) => a.employee_name.localeCompare(b.employee_name)));
      setEmployeeId(String(result.data.id));
      alert("Employee saved for future authorization letters.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEmployee() {
    if (!employeeId || !confirm("Delete this saved employee?")) return;
    const response = await fetch(`/api/authorized-employees?id=${employeeId}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return alert(result.error || "Unable to delete employee.");
    setEmployees((current) => current.filter((item) => item.id !== Number(employeeId)));
    chooseEmployee("");
  }

  function printLetter() {
    if (!customer || !employeeName.trim() || !/^\d{14}$/.test(nationalId.replace(/\s+/g, "")) || !authorizationDate) {
      alert("Choose a customer and enter a valid employee, 14-digit National ID, and authorization date.");
      return;
    }
    window.print();
  }

  return (
    <div className="dashboard-shell authorization-shell" dir={lang === "ar" ? "rtl" : "ltr"}>
      <Header active="authorization" lang={lang} onToggleLang={() => setLang((value) => value === "en" ? "ar" : "en")} />
      <main className="authorization-page">
        <section className="page-hero authorization-screen-only">
          <div><p>DOCUMENT CENTER</p><h1>Authorization Letter</h1><span>Create the official Ultra Teb collection authorization letter.</span></div>
        </section>

        <section className="authorization-controls authorization-screen-only">
          <label>Customer Name<select value={customer} onChange={(event) => setCustomer(event.target.value)}><option value="">Select customer</option>{customers.map((name) => <option key={name}>{name}</option>)}</select></label>
          <label>Saved Employee<select value={employeeId} onChange={(event) => chooseEmployee(event.target.value)}><option value="">Add new employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employee_name} - {employee.national_id}</option>)}</select></label>
          <label>Authorized Employee Name<input value={employeeName} onChange={(event) => { setEmployeeName(event.target.value); setEmployeeId(""); }} /></label>
          <label>National ID Number<input inputMode="numeric" maxLength={14} value={nationalId} onChange={(event) => { setNationalId(event.target.value.replace(/\D/g, "")); setEmployeeId(""); }} /></label>
          <label>Authorization Date<input type="date" value={authorizationDate} onChange={(event) => setAuthorizationDate(event.target.value)} /></label>
          <label>Optional Stamp<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => chooseStamp(event.target.files?.[0])} /></label>
          <label className="authorization-stamp-toggle"><input type="checkbox" checked={showStamp} disabled={!stampUrl} onChange={(event) => setShowStamp(event.target.checked)} /><span>Include stamp in letter</span></label>
          <div className="authorization-control-actions"><button type="button" onClick={saveEmployee} disabled={saving || Boolean(employeeId)}>{saving ? "Saving..." : "Save Employee"}</button><button type="button" className="danger" onClick={deleteEmployee} disabled={!employeeId}>Delete Employee</button><button type="button" className="primary" onClick={printLetter}>Print / Save PDF</button></div>
        </section>

        <section className="authorization-paper" dir="rtl">
          <img className="authorization-paper__header" src="/brand/ultra-teb-header.png" alt="Ultra Teb" />
          <div className="authorization-paper__rule" />
          <img className="authorization-paper__watermark" src="/brand/ultra-teb-logo.png" alt="" />
          <div className="authorization-letter">
            <h2>تفويض</h2>
            <h3>السادة / {customer || "اسم العميل"}</h3>
            <p className="authorization-greeting">تحية طيبة وبعد،</p>
            <p><strong>فوضنا نحن شركة ألترا طب للتجارة</strong></p>
            <p>السيد / <strong>{employeeName || "اسم الموظف المفوض"}</strong></p>
            <p>بطاقة رقم قومي: <strong dir="ltr">{nationalId || "00000000000000"}</strong></p>
            <p>لاستلام المستحقات المالية (نقداً أو شيكات) وإشعارات الخصم والإضافة الخاصة بنا طرفكم.</p>
            <p>وهذا تفويض منا بذلك.</p>
            <p><strong>وتفضلوا بقبول وافر الاحترام،</strong></p>
            <div className="authorization-signature"><div><strong>مقدمه لسيادتكم</strong><span>الإدارة المالية (ألترا طب للتجارة)</span></div><strong dir="ltr">{printedDate(authorizationDate)}</strong></div>
            {showStamp && stampUrl && <img className="authorization-paper__stamp" src={stampUrl} alt="Company stamp" />}
          </div>
          <img className="authorization-paper__footer" src="/brand/ultra-teb-footer.png" alt="" />
        </section>
      </main>
      <Footer lang={lang} />
    </div>
  );
}
