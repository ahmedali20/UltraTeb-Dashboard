"use client";

import { useMemo, useState } from "react";
import Header from "../Header";
import Footer from "../Footer";

type RepSale = {
  id: string;
  invoice_no: string;
  sales_date: string;
  month: string;
  sales_rep: string | null;
  customer_name: string;
  sales_item_total: number;
  tax: number;
  total_sales: number;
};

function normalizeSalesRep(value: string | null, fallback: string) {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;

  return trimmed
    .toLocaleLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toLocaleUpperCase());
}

export default function SalesRepsClient({ sales }: { sales: RepSale[] }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [selectedRep, setSelectedRep] = useState<string | null>(null);
  const [hospitalFilter, setHospitalFilter] = useState("All");
  const [monthFilter, setMonthFilter] = useState("All");
  const dir = lang === "ar" ? "rtl" : "ltr";

  const reps = useMemo(() => {
    const totals = new Map<
      string,
      { invoices: number; total: number; customers: Set<string> }
    >();

    sales.forEach((sale) => {
      const name = normalizeSalesRep(
        sale.sales_rep,
        lang === "ar" ? "بدون مندوب" : "Unassigned"
      );
      const current = totals.get(name) ?? {
        invoices: 0,
        total: 0,
        customers: new Set<string>(),
      };
      current.invoices += 1;
      current.total += Number(sale.total_sales || 0);
      if (sale.customer_name) current.customers.add(sale.customer_name);
      totals.set(name, current);
    });

    return Array.from(totals.entries())
      .map(([name, values]) => ({
        name,
        invoices: values.invoices,
        total: values.total,
        customers: values.customers.size,
      }))
      .sort((a, b) => b.total - a.total);
  }, [sales, lang]);

  const maximum = Math.max(...reps.map((rep) => rep.total), 1);
  const allCustomers = new Set(
    sales.map((sale) => sale.customer_name).filter(Boolean)
  ).size;
  const allSalesTotal = sales.reduce(
    (sum, sale) => sum + Number(sale.total_sales || 0),
    0
  );
  const repSales = selectedRep
    ? selectedRep === "All"
      ? sales
      : sales.filter(
        (sale) =>
          normalizeSalesRep(
            sale.sales_rep,
            lang === "ar" ? "بدون مندوب" : "Unassigned"
          ) === selectedRep
      )
    : [];
  const hospitals = Array.from(
    new Set(repSales.map((sale) => sale.customer_name).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const months = Array.from(
    new Set(repSales.map((sale) => sale.month).filter(Boolean))
  ).sort((a, b) => b.localeCompare(a));
  const visibleSales = repSales.filter(
    (sale) =>
      (hospitalFilter === "All" || sale.customer_name === hospitalFilter) &&
      (monthFilter === "All" || sale.month === monthFilter)
  );
  const visibleTotal = visibleSales.reduce(
    (sum, sale) => sum + Number(sale.total_sales || 0),
    0
  );

  function chooseRep(name: string) {
    setSelectedRep(name);
    setHospitalFilter("All");
    setMonthFilter("All");
    requestAnimationFrame(() =>
      document
        .getElementById("rep-sales-details")
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  }

  return (
    <div
      dir={dir}
      className="records-page"
      style={{
        minHeight: "100vh",
        background: "var(--page-bg)",
        color: "var(--text-primary)",
      }}
    >
      <Header
        active="reps"
        lang={lang}
        onToggleLang={() => setLang(lang === "en" ? "ar" : "en")}
      />
      <main className="records-layout">
        <div className="records-heading">
          <div>
            <p>ULTRA TEB</p>
            <h1>{lang === "ar" ? "أداء مندوبي المبيعات" : "Sales Rep Performance"}</h1>
            <span>
              {lang === "ar"
                ? "ملخص مباشر من بيانات الفواتير"
                : "Live summary calculated from invoice data"}
            </span>
          </div>
          <strong>{reps.length} {lang === "ar" ? "مندوب" : "reps"}</strong>
        </div>

        <section className="rep-summary-grid">
          <button
            type="button"
            className={`rep-summary-card rep-summary-card--all ${
              selectedRep === "All" ? "rep-summary-card--active" : ""
            }`}
            onClick={() => chooseRep("All")}
          >
            <div className="rep-summary-card__top">
              <span>ALL</span>
              <div>
                <h2>{lang === "ar" ? "كل المندوبين" : "All Sales Reps"}</h2>
                <p>
                  {reps.length} {lang === "ar" ? "مندوب" : "representatives"} ·{" "}
                  {allCustomers} {lang === "ar" ? "عميل" : "customers"}
                </p>
              </div>
            </div>
            <div className="rep-summary-card__numbers">
              <div>
                <small>{lang === "ar" ? "الفواتير" : "Invoices"}</small>
                <strong>{sales.length}</strong>
              </div>
              <div>
                <small>{lang === "ar" ? "المبيعات" : "Net Sales"}</small>
                <strong>
                  {allSalesTotal.toLocaleString(
                    lang === "ar" ? "ar-EG" : "en-US",
                    { maximumFractionDigits: 2 }
                  )}
                </strong>
              </div>
            </div>
            <div className="rep-summary-card__bar">
              <i style={{ width: "100%", background: "#4a90d9" }} />
            </div>
          </button>

          {reps.map((rep, index) => (
            <button
              type="button"
              className={`rep-summary-card ${
                selectedRep === rep.name ? "rep-summary-card--active" : ""
              }`}
              key={rep.name}
              onClick={() => chooseRep(rep.name)}
            >
              <div className="rep-summary-card__top">
                <span>{rep.name.slice(0, 2).toUpperCase()}</span>
                <div>
                  <h2>{rep.name}</h2>
                  <p>{rep.customers} {lang === "ar" ? "عميل" : "customers"}</p>
                </div>
              </div>
              <div className="rep-summary-card__numbers">
                <div>
                  <small>{lang === "ar" ? "الفواتير" : "Invoices"}</small>
                  <strong>{rep.invoices}</strong>
                </div>
                <div>
                  <small>{lang === "ar" ? "المبيعات" : "Net Sales"}</small>
                  <strong>
                    {rep.total.toLocaleString(lang === "ar" ? "ar-EG" : "en-US", {
                      maximumFractionDigits: 2,
                    })}
                  </strong>
                </div>
              </div>
              <div className="rep-summary-card__bar">
                <i
                  style={{
                    width: `${(rep.total / maximum) * 100}%`,
                    background: ["#4a90d9", "#4ade80", "#fbb040", "#a78bfa", "#f87171"][index % 5],
                  }}
                />
              </div>
            </button>
          ))}
        </section>

        {selectedRep && (
          <section className="rep-sales-details" id="rep-sales-details">
            <div className="rep-sales-details__header">
              <div>
                <p>{lang === "ar" ? "سجل المبيعات" : "Sales Records"}</p>
                <h2>
                  {selectedRep === "All"
                    ? lang === "ar"
                      ? "كل المندوبين"
                      : "All Sales Reps"
                    : selectedRep}
                </h2>
              </div>
              <strong>
                {visibleSales.length} {lang === "ar" ? "فاتورة" : "invoices"} ·{" "}
                {visibleTotal.toLocaleString(lang === "ar" ? "ar-EG" : "en-US", {
                  maximumFractionDigits: 2,
                })}
              </strong>
            </div>

            <div className="rep-sales-filters">
              <label>
                {lang === "ar" ? "المستشفى / العميل" : "Hospital / Customer"}
                <select
                  value={hospitalFilter}
                  onChange={(event) => setHospitalFilter(event.target.value)}
                >
                  <option value="All">
                    {lang === "ar" ? "كل المستشفيات" : "All Hospitals"}
                  </option>
                  {hospitals.map((hospital) => (
                    <option key={hospital} value={hospital}>{hospital}</option>
                  ))}
                </select>
              </label>
              <label>
                {lang === "ar" ? "الشهر" : "Month"}
                <select
                  value={monthFilter}
                  onChange={(event) => setMonthFilter(event.target.value)}
                >
                  <option value="All">
                    {lang === "ar" ? "كل الشهور" : "All Months"}
                  </option>
                  {months.map((month) => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => {
                  setHospitalFilter("All");
                  setMonthFilter("All");
                }}
              >
                {lang === "ar" ? "مسح الفلاتر" : "Clear Filters"}
              </button>
            </div>

            <div className="rep-sales-table-wrap">
              <table className="rep-sales-table">
                <thead>
                  <tr>
                    <th>{lang === "ar" ? "رقم الفاتورة" : "Invoice No"}</th>
                    <th>{lang === "ar" ? "التاريخ" : "Date"}</th>
                    <th>{lang === "ar" ? "المستشفى / العميل" : "Hospital / Customer"}</th>
                    <th>{lang === "ar" ? "قبل الضريبة" : "Item Total"}</th>
                    <th>{lang === "ar" ? "الضريبة" : "Tax"}</th>
                    <th>{lang === "ar" ? "الإجمالي" : "Total Sales"}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSales.map((sale) => (
                    <tr key={sale.id}>
                      <td><strong>{sale.invoice_no}</strong></td>
                      <td>{sale.sales_date}</td>
                      <td>{sale.customer_name || "-"}</td>
                      <td>{Number(sale.sales_item_total || 0).toLocaleString()}</td>
                      <td>{Number(sale.tax || 0).toLocaleString()}</td>
                      <td><strong>{Number(sale.total_sales || 0).toLocaleString()}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!visibleSales.length && (
                <div className="dashboard-empty">
                  {lang === "ar" ? "لا توجد نتائج" : "No matching invoices"}
                </div>
              )}
            </div>
          </section>
        )}
      </main>
      <Footer lang={lang} />
    </div>
  );
}
