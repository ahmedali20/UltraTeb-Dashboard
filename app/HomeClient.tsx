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
    monthlySales: "Monthly Sales",
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
  },
  ar: {
    title: "نظرة عامة على الأعمال",
    subtitle: "عرض واضح لأداء المبيعات وأحدث العمليات.",
    totalSales: "إجمالي المبيعات",
    totalTax: "إجمالي الضريبة",
    invoices: "إجمالي الفواتير",
    customers: "إجمالي العملاء",
    monthlySales: "المبيعات الشهرية",
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
  },
};

function formatMoney(value: number, lang: "en" | "ar") {
  return new Intl.NumberFormat(lang === "ar" ? "ar-EG" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function HomeClient({ sales, customerCount }: HomeClientProps) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const t = text[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";

  const totalSales = sales.reduce(
    (total, sale) => total + Number(sale.total_sales || 0),
    0
  );
  const totalTax = sales.reduce(
    (total, sale) => total + Number(sale.tax || 0),
    0
  );

  const monthlyData = useMemo(() => {
    const totals = new Map<string, number>();

    sales.forEach((sale) => {
      if (!sale.sales_date) return;
      const date = new Date(`${sale.sales_date}T00:00:00`);
      if (Number.isNaN(date.getTime())) return;

      const key = sale.sales_date.slice(0, 7);
      totals.set(key, (totals.get(key) ?? 0) + Number(sale.total_sales || 0));
    });

    return Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, value]) => ({
        key,
        value,
        label: new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
          month: "short",
          year: "2-digit",
        }).format(new Date(`${key}-01T00:00:00`)),
      }));
  }, [sales, lang]);

  const chartMaximum = Math.max(...monthlyData.map((month) => month.value), 1);
  const recentInvoices = sales.slice(0, 5);

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

      <main className="dashboard-home">
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

        <section className="dashboard-stats" aria-label={t.title}>
          <StatCard label={t.totalSales} value={formatMoney(totalSales, lang)} icon="↗" tone="teal" />
          <StatCard label={t.totalTax} value={formatMoney(totalTax, lang)} icon="%" tone="blue" />
          <StatCard label={t.invoices} value={sales.length.toLocaleString(lang === "ar" ? "ar-EG" : "en-US")} icon="#" tone="amber" />
          <StatCard label={t.customers} value={customerCount.toLocaleString(lang === "ar" ? "ar-EG" : "en-US")} icon="◎" tone="purple" />
        </section>

        <section className="dashboard-grid">
          <div className="dashboard-panel dashboard-chart">
            <div className="dashboard-panel__header">
              <h2>{t.monthlySales}</h2>
              <span>{monthlyData.length ? `${monthlyData.length} months` : "—"}</span>
            </div>

            {monthlyData.length ? (
              <div className="dashboard-chart__area">
                {monthlyData.map((month) => (
                  <div className="dashboard-chart__column" key={month.key}>
                    <span className="dashboard-chart__value">
                      {formatMoney(month.value, lang)}
                    </span>
                    <div className="dashboard-chart__track">
                      <div
                        className="dashboard-chart__bar"
                        style={{ height: `${Math.max((month.value / chartMaximum) * 100, 5)}%` }}
                      />
                    </div>
                    <span className="dashboard-chart__label">{month.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dashboard-empty">{t.noInvoices}</div>
            )}
          </div>

          <div className="dashboard-panel">
            <div className="dashboard-panel__header">
              <h2>{t.quickActions}</h2>
            </div>
            <div className="dashboard-actions">
              <QuickAction href="/sales" icon="+" label={t.addInvoice} />
              <QuickAction href="/customers" icon="+" label={t.addCustomer} />
              <QuickAction href="/sales" icon="⇧" label={t.bulkUpload} />
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
                      <td>{sale.customer_name || sale.customer_code}</td>
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

function QuickAction({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <a className="dashboard-action" href={href}>
      <span>{icon}</span>
      <strong>{label}</strong>
    </a>
  );
}
