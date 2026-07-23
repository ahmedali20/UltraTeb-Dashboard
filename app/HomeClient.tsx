"use client";

import { useMemo, useState } from "react";
import Header from "./Header";
import Footer from "./Footer";

type DashboardSale = {
  id: string;
  invoice_no: string;
  sales_date: string;
  customer_code: string;
  customer_name: string;
  sales_rep: string | null;
  sales_item_total: number;
  tax: number;
  total_sales: number;
};

type HomeClientProps = {
  sales: DashboardSale[];
  customerCount: number;
};

const text = {
  en: {
    title: "Business Overview",
    subtitle: "A clear view of your sales performance and recent activity.",
    totalSales: "Total Sales",
    totalTax: "Total Tax",
    invoices: "Total Invoices",
    customers: "Total Customers",
    monthlySales: "Monthly Sales by Sales Rep",
    recentInvoices: "Recent Invoices",
    quickActions: "Quick Actions",
    addInvoice: "Add Invoice",
    addCustomer: "Add Customer",
    bulkUpload: "Bulk Upload",
    viewAll: "View all invoices",
    invoiceNo: "Invoice No",
    date: "Date",
    customer: "Customer",
    total: "Total",
    noInvoices: "No invoices have been added yet.",
    unassigned: "Unassigned",
  },
  ar: {
    title: "نظرة عامة على الأعمال",
    subtitle: "عرض واضح لأداء المبيعات وأحدث العمليات.",
    totalSales: "إجمالي المبيعات",
    totalTax: "إجمالي الضريبة",
    invoices: "إجمالي الفواتير",
    customers: "إجمالي العملاء",
    monthlySales: "المبيعات الشهرية حسب المندوب",
    recentInvoices: "أحدث الفواتير",
    quickActions: "إجراءات سريعة",
    addInvoice: "إضافة فاتورة",
    addCustomer: "إضافة عميل",
    bulkUpload: "رفع فواتير",
    viewAll: "عرض كل الفواتير",
    invoiceNo: "رقم الفاتورة",
    date: "التاريخ",
    customer: "العميل",
    total: "الإجمالي",
    noInvoices: "لم تتم إضافة فواتير بعد.",
    unassigned: "بدون مندوب",
  },
};

function formatMoney(value: number, lang: "en" | "ar") {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function normalizeSalesRep(value: string | null, fallback: string) {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;

  return trimmed
    .toLocaleLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toLocaleUpperCase());
}

export default function HomeClient({ sales, customerCount }: HomeClientProps) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [selectedRep, setSelectedRep] = useState("All");
  const t = text[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";

  const allSalesReps = useMemo(
    () =>
      Array.from(
        new Set(
          sales.map((sale) => normalizeSalesRep(sale.sales_rep, t.unassigned))
        )
      ).sort((a, b) => a.localeCompare(b)),
    [sales, t.unassigned]
  );
  const filteredSales =
    selectedRep === "All"
      ? sales
      : sales.filter(
          (sale) =>
            normalizeSalesRep(sale.sales_rep, t.unassigned) === selectedRep
        );

  const totalSales = filteredSales.reduce(
    (total, sale) => total + Number(sale.total_sales || 0),
    0
  );
  const totalTax = filteredSales.reduce(
    (total, sale) => total + Number(sale.tax || 0),
    0
  );

  const { monthlyData, salesReps } = useMemo(() => {
    const totals = new Map<string, Map<string, number>>();
    const reps = new Set<string>();

    filteredSales.forEach((sale) => {
      if (!sale.sales_date) return;
      const date = new Date(`${sale.sales_date}T00:00:00`);
      if (Number.isNaN(date.getTime())) return;

      const key = sale.sales_date.slice(0, 7);
      const rep = normalizeSalesRep(sale.sales_rep, t.unassigned);
      reps.add(rep);

      const month = totals.get(key) ?? new Map<string, number>();
      month.set(rep, (month.get(rep) ?? 0) + Number(sale.total_sales || 0));
      totals.set(key, month);
    });

    const data = Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, repTotals]) => {
        const values = Object.fromEntries(repTotals.entries());
        return {
          key,
          values,
          total: Object.values(values).reduce((sum, value) => sum + value, 0),
          label: new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
            month: "short",
            year: "2-digit",
          }).format(new Date(`${key}-01T00:00:00`)),
        };
      });

    return {
      monthlyData: data,
      salesReps: Array.from(reps).sort((a, b) => a.localeCompare(b)),
    };
  }, [filteredSales, lang, t.unassigned]);

  const chartMaximum = Math.max(...monthlyData.map((month) => month.total), 1);
  const chartColors = ["#0f766e", "#2563eb", "#f59e0b", "#7c3aed", "#e11d48", "#0891b2"];
  const recentInvoices = filteredSales.slice(0, 5);
  const uniqueCustomers = new Set(
    filteredSales.map((sale) => sale.customer_name).filter(Boolean)
  ).size;

  const repTotals = allSalesReps
    .map((rep) => ({
      rep,
      value: sales
        .filter(
          (sale) => normalizeSalesRep(sale.sales_rep, t.unassigned) === rep
        )
        .reduce((sum, sale) => sum + Number(sale.total_sales || 0), 0),
    }))
    .sort((a, b) => b.value - a.value);
  const repGrandTotal = Math.max(
    repTotals.reduce((sum, rep) => sum + rep.value, 0),
    1
  );
  let donutStart = 0;
  const donutGradient = repTotals
    .map((rep, index) => {
      const start = donutStart;
      donutStart += (rep.value / repGrandTotal) * 100;
      return `${chartColors[index % chartColors.length]} ${start}% ${donutStart}%`;
    })
    .join(", ");

  const customerTotals = Array.from(
    filteredSales.reduce((totals, sale) => {
      const name = sale.customer_name || "-";
      const current = totals.get(name) ?? {
        name,
        rep: normalizeSalesRep(sale.sales_rep, t.unassigned),
        value: 0,
      };
      current.value += Number(sale.total_sales || 0);
      totals.set(name, current);
      return totals;
    }, new Map<string, { name: string; rep: string; value: number }>())
  )
    .map(([, value]) => value)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return (
    <div
      dir={dir}
      className="dashboard-page"
      style={{
        fontFamily: "Arial, 'Segoe UI', Tahoma, sans-serif",
        background: "var(--page-bg)",
        color: "var(--text-primary)",
      }}
    >
      <Header
        active="home"
        lang={lang}
        onToggleLang={() => setLang(lang === "en" ? "ar" : "en")}
      />

      <main className="dashboard-home dashboard-home--reference">
        <div className="dashboard-home__intro">
          <div>
            <p className="dashboard-home__eyebrow">ULTRA TEB</p>
            <h1>{t.title}</h1>
            <p>{t.subtitle}</p>
          </div>
          <a className="dashboard-home__view-all" href="/sales">
            {t.viewAll} <span aria-hidden="true">{dir === "rtl" ? "←" : "→"}</span>
          </a>
        </div>

        <div className="dashboard-filterbar">
          <span>
            {selectedRep === "All"
              ? lang === "ar"
                ? "عرض جميع مندوبي المبيعات"
                : "Showing all sales representatives"
              : `${lang === "ar" ? "المندوب" : "Sales Rep"}: ${selectedRep}`}
          </span>
          <label>
            {lang === "ar" ? "تصفية بالمندوب" : "Filter Rep"}
            <select
              value={selectedRep}
              onChange={(event) => setSelectedRep(event.target.value)}
            >
              <option value="All">
                {lang === "ar" ? "كل المندوبين" : "All Reps"}
              </option>
              {allSalesReps.map((rep) => (
                <option key={rep} value={rep}>{rep}</option>
              ))}
            </select>
          </label>
        </div>

        <section className="dashboard-stats" aria-label={t.title}>
          <StatCard label={t.totalSales} value={formatMoney(totalSales, lang)} icon="↗" tone="teal" />
          <StatCard label={t.totalTax} value={formatMoney(totalTax, lang)} icon="%" tone="blue" />
          <StatCard label={t.invoices} value={filteredSales.length.toLocaleString(lang === "ar" ? "ar-EG" : "en-US")} icon="#" tone="amber" />
          <StatCard label={t.customers} value={(selectedRep === "All" ? customerCount : uniqueCustomers).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")} icon="◎" tone="purple" />
        </section>

        <section className="dashboard-grid">
          <div className="dashboard-panel dashboard-chart">
            <div className="dashboard-panel__header">
              <h2>{t.monthlySales}</h2>
              <span>{monthlyData.length ? `${monthlyData.length} months` : "—"}</span>
            </div>

            {monthlyData.length ? (
              <>
                <div className="dashboard-chart__legend">
                  {salesReps.map((rep, index) => (
                    <span key={rep}>
                      <i style={{ background: chartColors[index % chartColors.length] }} />
                      {rep}
                    </span>
                  ))}
                </div>
                <div className="dashboard-chart__area">
                  {monthlyData.map((month) => (
                    <div className="dashboard-chart__column" key={month.key}>
                      <span className="dashboard-chart__value">
                        {formatMoney(month.total, lang)}
                      </span>
                      <div
                        className="dashboard-chart__track"
                        style={{
                          height: `${Math.max((month.total / chartMaximum) * 180, 8)}px`,
                        }}
                      >
                        {salesReps.map((rep, index) => {
                          const repValue = month.values[rep] ?? 0;
                          if (!repValue) return null;

                          return (
                            <div
                              key={rep}
                              className="dashboard-chart__segment"
                              title={`${rep}: ${formatMoney(repValue, lang)}`}
                              style={{
                                height: `${(repValue / month.total) * 100}%`,
                                background: chartColors[index % chartColors.length],
                              }}
                            />
                          );
                        })}
                      </div>
                      <span className="dashboard-chart__label">{month.label}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="dashboard-empty">{t.noInvoices}</div>
            )}
          </div>

          <div className="dashboard-panel dashboard-donut-panel">
            <div className="dashboard-panel__header">
              <h2>{lang === "ar" ? "المبيعات حسب المندوب" : "Sales by Rep"}</h2>
            </div>
            <div className="dashboard-donut-wrap">
              <div
                className="dashboard-donut"
                style={{
                  background: repTotals.length
                    ? `conic-gradient(${donutGradient})`
                    : "var(--surface-muted)",
                }}
              >
                <span>{formatMoney(repGrandTotal === 1 ? 0 : repGrandTotal, lang)}</span>
              </div>
              <div className="dashboard-donut-legend">
                {repTotals.map((rep, index) => (
                  <button
                    type="button"
                    key={rep.rep}
                    onClick={() => setSelectedRep(rep.rep)}
                  >
                    <i style={{ background: chartColors[index % chartColors.length] }} />
                    <span>{rep.rep}</span>
                    <strong>{((rep.value / repGrandTotal) * 100).toFixed(1)}%</strong>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard-grid">
          <div className="dashboard-panel">
            <div className="dashboard-panel__header">
              <h2>{lang === "ar" ? "المبيعات حسب العميل" : "Sales by Customer"}</h2>
            </div>
            <div className="dashboard-table-wrap">
              <table className="dashboard-table dashboard-ranking-table">
                <thead>
                  <tr>
                    <th>{t.customer}</th>
                    <th>{lang === "ar" ? "المندوب" : "Rep"}</th>
                    <th>{t.total}</th>
                    <th>{lang === "ar" ? "النسبة" : "Share"}</th>
                  </tr>
                </thead>
                <tbody>
                  {customerTotals.map((customer) => (
                    <tr key={customer.name}>
                      <td><strong>{customer.name}</strong></td>
                      <td>{customer.rep}</td>
                      <td>{formatMoney(customer.value, lang)}</td>
                      <td>{totalSales ? ((customer.value / totalSales) * 100).toFixed(1) : "0.0"}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="dashboard-panel">
            <div className="dashboard-panel__header">
              <h2>{lang === "ar" ? "أداء المندوبين" : "Rep Performance"}</h2>
            </div>
            <div className="dashboard-rep-bars">
              {repTotals.map((rep, index) => (
                <button
                  type="button"
                  key={rep.rep}
                  onClick={() => setSelectedRep(rep.rep)}
                >
                  <span>{rep.rep}</span>
                  <strong>{formatMoney(rep.value, lang)}</strong>
                  <i>
                    <b
                      style={{
                        width: `${(rep.value / Math.max(repTotals[0]?.value || 1, 1)) * 100}%`,
                        background: chartColors[index % chartColors.length],
                      }}
                    />
                  </i>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="dashboard-panel dashboard-recent">
          <div className="dashboard-panel__header">
            <h2>{t.recentInvoices}</h2>
            <a href="/sales">{t.viewAll}</a>
          </div>

          {recentInvoices.length ? (
            <div className="dashboard-table-wrap">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>{t.invoiceNo}</th>
                    <th>{t.date}</th>
                    <th>{t.customer}</th>
                    <th>{t.total}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((sale) => (
                    <tr key={sale.id}>
                      <td><strong>{sale.invoice_no}</strong></td>
                      <td>{sale.sales_date}</td>
                      <td>{sale.customer_name || "-"}</td>
                      <td><strong>{formatMoney(Number(sale.total_sales || 0), lang)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="dashboard-empty">{t.noInvoices}</div>
          )}
        </section>
      </main>

      <Footer lang={lang} />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: string;
  tone: "teal" | "blue" | "amber" | "purple";
}) {
  return (
    <article className="dashboard-stat">
      <span className={`dashboard-stat__icon dashboard-stat__icon--${tone}`}>
        {icon}
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
