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
  document_type: "INVOICE" | "CR_NOTE" | "DR_NOTE" | null;
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
    invoiceSales: "Sales Invoices",
    creditNotes: "Credit Notes",
    debitNotes: "Debit Notes",
    netSales: "Net Sales",
    records: "records",
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
    vsPrevious: "vs previous month",
    newActivity: "New",
    noChange: "No change",
  },
  ar: {
    invoiceSales: "فواتير المبيعات",
    creditNotes: "الإشعارات الدائنة",
    debitNotes: "الإشعارات المدينة",
    netSales: "صافي المبيعات",
    records: "سجلات",
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
    vsPrevious: "مقارنة بالشهر السابق",
    newActivity: "جديد",
    noChange: "بدون تغيير",
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
  const invoiceRows = filteredSales.filter(
    (sale) => (sale.document_type ?? "INVOICE") === "INVOICE"
  );
  const creditNoteRows = filteredSales.filter(
    (sale) => sale.document_type === "CR_NOTE"
  );
  const debitNoteRows = filteredSales.filter(
    (sale) => sale.document_type === "DR_NOTE"
  );
  const invoiceSalesTotal = invoiceRows.reduce(
    (total, sale) => total + Number(sale.total_sales || 0),
    0
  );
  const creditNotesTotal = creditNoteRows.reduce(
    (total, sale) => total + Math.abs(Number(sale.total_sales || 0)),
    0
  );
  const debitNotesTotal = debitNoteRows.reduce(
    (total, sale) => total + Math.abs(Number(sale.total_sales || 0)),
    0
  );

  const periodComparison = useMemo(() => {
    const monthKeys = Array.from(
      new Set(
        filteredSales
          .map((sale) => sale.sales_date?.slice(0, 7))
          .filter(Boolean)
      )
    ).sort();
    const currentKey = monthKeys[monthKeys.length - 1];
    if (!currentKey) return null;

    const currentDate = new Date(`${currentKey}-01T00:00:00`);
    const previousDate = new Date(currentDate);
    previousDate.setMonth(previousDate.getMonth() - 1);
    const previousKey = `${previousDate.getFullYear()}-${String(
      previousDate.getMonth() + 1
    ).padStart(2, "0")}`;

    const summarize = (monthKey: string) => {
      const rows = filteredSales.filter(
        (sale) => sale.sales_date?.slice(0, 7) === monthKey
      );
      return {
        sales: rows.reduce(
          (sum, sale) => sum + Number(sale.total_sales || 0),
          0
        ),
        tax: rows.reduce((sum, sale) => sum + Number(sale.tax || 0), 0),
        invoices: rows.length,
        customers: new Set(
          rows.map((sale) => sale.customer_name).filter(Boolean)
        ).size,
      };
    };

    const formatPeriod = (key: string) =>
      new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
        month: "short",
        year: "numeric",
      }).format(new Date(`${key}-01T00:00:00`));

    return {
      current: summarize(currentKey),
      previous: summarize(previousKey),
      label: `${formatPeriod(currentKey)} · ${t.vsPrevious}`,
    };
  }, [filteredSales, lang, t.vsPrevious]);

  function trend(current: number, previous: number) {
    if (!previous) return current ? null : 0;
    return ((current - previous) / previous) * 100;
  }

  const { monthlyData, salesReps } = useMemo(() => {
    const totals = new Map<string, Map<string, number>>();
    const reps = new Set<string>();

    invoiceRows.forEach((sale) => {
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
  }, [invoiceRows, lang, t.unassigned]);

  const chartMaximum = Math.max(...monthlyData.map((month) => month.total), 1);
  const chartColors = [
    "#0f766e", "#2563eb", "#f59e0b", "#7c3aed",
    "#e11d48", "#0891b2", "#65a30d", "#ea580c",
    "#4f46e5", "#db2777", "#059669", "#9333ea",
  ];
  function repColor(rep: string) {
    const stableIndex = allSalesReps.indexOf(rep);
    if (stableIndex >= 0 && stableIndex < chartColors.length) {
      return chartColors[stableIndex];
    }

    let hash = 0;
    for (const character of rep) {
      hash = character.charCodeAt(0) + ((hash << 5) - hash);
    }
    return `hsl(${Math.abs(hash) % 360} 68% 46%)`;
  }
  const recentInvoices = invoiceRows.slice(0, 5);
  const uniqueCustomers = new Set(
    filteredSales.map((sale) => sale.customer_name).filter(Boolean)
  ).size;

  const repTotals = allSalesReps
    .map((rep) => ({
      rep,
      value: sales
        .filter(
          (sale) =>
            (sale.document_type ?? "INVOICE") === "INVOICE" &&
            normalizeSalesRep(sale.sales_rep, t.unassigned) === rep
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
    .map((rep) => {
      const start = donutStart;
      donutStart += (rep.value / repGrandTotal) * 100;
      return `${repColor(rep.rep)} ${start}% ${donutStart}%`;
    })
    .join(", ");

  const customerTotals = Array.from(
    invoiceRows.reduce((totals, sale) => {
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
          <StatCard
            label={t.invoiceSales}
            value={formatMoney(invoiceSalesTotal, lang)}
            icon="↗"
            tone="teal"
            meta={`${invoiceRows.length.toLocaleString(lang === "ar" ? "ar-EG" : "en-US")} ${t.records}`}
            newLabel={t.newActivity}
            noChangeLabel={t.noChange}
          />
          <StatCard
            label={t.creditNotes}
            value={formatMoney(creditNotesTotal, lang)}
            icon="CR"
            tone="blue"
            meta={`${creditNoteRows.length.toLocaleString(lang === "ar" ? "ar-EG" : "en-US")} ${t.records}`}
            newLabel={t.newActivity}
            noChangeLabel={t.noChange}
          />
          <StatCard
            label={t.debitNotes}
            value={formatMoney(debitNotesTotal, lang)}
            icon="DR"
            tone="amber"
            meta={`${debitNoteRows.length.toLocaleString(lang === "ar" ? "ar-EG" : "en-US")} ${t.records}`}
            newLabel={t.newActivity}
            noChangeLabel={t.noChange}
          />
          <StatCard
            label={t.netSales}
            value={formatMoney(totalSales, lang)}
            icon="◎"
            tone="purple"
            trend={periodComparison && trend(periodComparison.current.sales, periodComparison.previous.sales)}
            period={periodComparison?.label}
            newLabel={t.newActivity}
            noChangeLabel={t.noChange}
          />
          <StatCard
            label={t.totalTax}
            value={formatMoney(totalTax, lang)}
            icon="%"
            tone="blue"
            trend={periodComparison && trend(periodComparison.current.tax, periodComparison.previous.tax)}
            period={periodComparison?.label}
            newLabel={t.newActivity}
            noChangeLabel={t.noChange}
          />
          <StatCard
            label={t.customers}
            value={(selectedRep === "All" ? customerCount : uniqueCustomers).toLocaleString(lang === "ar" ? "ar-EG" : "en-US")}
            icon="◎"
            tone="teal"
            trend={periodComparison && trend(periodComparison.current.customers, periodComparison.previous.customers)}
            period={periodComparison?.label}
            newLabel={t.newActivity}
            noChangeLabel={t.noChange}
          />
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
                  {salesReps.map((rep) => (
                    <span key={rep}>
                      <i style={{ background: repColor(rep) }} />
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
                        {salesReps.map((rep) => {
                          const repValue = month.values[rep] ?? 0;
                          if (!repValue) return null;

                          return (
                            <div
                              key={rep}
                              className="dashboard-chart__segment"
                              title={`${rep}: ${formatMoney(repValue, lang)}`}
                              style={{
                                height: `${(repValue / month.total) * 100}%`,
                                background: repColor(rep),
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
                {repTotals.map((rep) => (
                  <button
                    type="button"
                    key={rep.rep}
                    onClick={() => setSelectedRep(rep.rep)}
                  >
                    <i style={{ background: repColor(rep.rep) }} />
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
              {repTotals.map((rep) => (
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
                        background: repColor(rep.rep),
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
  trend = null,
  period,
  meta,
  newLabel,
  noChangeLabel,
}: {
  label: string;
  value: string;
  icon: string;
  tone: "teal" | "blue" | "amber" | "purple";
  trend?: number | null;
  period?: string;
  meta?: string;
  newLabel: string;
  noChangeLabel: string;
}) {
  const trendDirection =
    trend === null ? "new" : trend > 0 ? "up" : trend < 0 ? "down" : "flat";
  const trendText =
    trend === null
      ? newLabel
      : trend === 0
        ? noChangeLabel
        : `${trend > 0 ? "↑" : "↓"} ${Math.abs(trend).toFixed(1)}%`;

  return (
    <article className={`dashboard-stat dashboard-stat--${tone}`}>
      <span className={`dashboard-stat__icon dashboard-stat__icon--${tone}`}>
        {icon}
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        {meta && <small className="dashboard-stat__meta">{meta}</small>}
        {period && (
          <div className="dashboard-stat__trend">
            <span className={`dashboard-stat__badge dashboard-stat__badge--${trendDirection}`}>
              {trendText}
            </span>
            <small>{period}</small>
          </div>
        )}
      </div>
    </article>
  );
}
