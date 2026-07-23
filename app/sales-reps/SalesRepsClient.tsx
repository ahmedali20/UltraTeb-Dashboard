"use client";

import { useMemo, useState } from "react";
import Header from "../Header";
import Footer from "../Footer";

type RepSale = {
  id: string;
  sales_rep: string | null;
  customer_name: string;
  total_sales: number;
};

export default function SalesRepsClient({ sales }: { sales: RepSale[] }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const dir = lang === "ar" ? "rtl" : "ltr";

  const reps = useMemo(() => {
    const totals = new Map<
      string,
      { invoices: number; total: number; customers: Set<string> }
    >();

    sales.forEach((sale) => {
      const name =
        sale.sales_rep?.trim() ||
        (lang === "ar" ? "بدون مندوب" : "Unassigned");
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
          {reps.map((rep, index) => (
            <article className="rep-summary-card" key={rep.name}>
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
            </article>
          ))}
        </section>
      </main>
      <Footer lang={lang} />
    </div>
  );
}
