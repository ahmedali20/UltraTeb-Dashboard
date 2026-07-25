"use client";

import { useMemo, useState } from "react";
import Header from "../Header";
import Footer from "../Footer";

type ReportSale = {
  id: string;
  invoice_no: string;
  sales_date: string;
  month: string;
  customer_name: string;
  sales_rep: string | null;
  sales_item_total: number;
  tax: number;
  total_sales: number;
  document_type: "INVOICE" | "CR_NOTE" | "DR_NOTE";
  original_invoice_no: string | null;
  note_reason: string | null;
};

function normalizeRep(value: string | null) {
  return value?.trim() || "Unassigned";
}

function money(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function ReportsClient({ sales }: { sales: ReportSale[] }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [month, setMonth] = useState("All");
  const [customer, setCustomer] = useState("All");
  const [salesRep, setSalesRep] = useState("All");
  const [reportType, setReportType] = useState<
    "summary" | "details" | "both"
  >("both");
  const dir = lang === "ar" ? "rtl" : "ltr";
  const t = lang === "ar" ? {
    creditNotes: "الإشعارات الدائنة", debitNotes: "الإشعارات المدينة",
    title: "تقرير المبيعات", subtitle: "تصفية ومراجعة وطباعة أو تصدير أداء الفواتير.",
    export: "تصدير CSV", print: "طباعة / حفظ PDF", reportType: "نوع التقرير",
    summaryOnly: "الملخص فقط", detailsOnly: "التفاصيل فقط", both: "الملخص + التفاصيل",
    from: "من", to: "إلى", month: "الشهر", allMonths: "كل الشهور",
    customer: "العميل", allCustomers: "كل العملاء", salesRep: "مندوب المبيعات",
    allReps: "كل المندوبين", clear: "مسح الفلاتر", invoices: "الفواتير",
    itemTotal: "إجمالي البنود", totalTax: "إجمالي الضريبة", totalSales: "إجمالي المبيعات",
    selectedPeriod: "الفترة المحددة", customerSummary: "ملخص مبيعات العملاء",
    customers: "عملاء", customerName: "اسم العميل", grandTotal: "الإجمالي العام",
    repSummary: "ملخص مندوبي المبيعات", reps: "مندوبون", detailed: "السجلات التفصيلية",
    invoiceSales: "مبيعات الفواتير", records: "سجلات", invoiceNo: "رقم الفاتورة",
    date: "التاريخ", tax: "الضريبة", noRecords: "لا توجد سجلات تطابق هذه الفلاتر.",
  } : {
    creditNotes: "Credit Notes", debitNotes: "Debit Notes",
    title: "Sales Report", subtitle: "Filter, review, print, or export your invoice performance.",
    export: "Export CSV", print: "Download PDF", reportType: "Report Type",
    summaryOnly: "Summary Only", detailsOnly: "Details Only", both: "Summary + Details",
    from: "From", to: "To", month: "Month", allMonths: "All Months",
    customer: "Customer", allCustomers: "All Customers", salesRep: "Sales Rep",
    allReps: "All Sales Reps", clear: "Clear Filters", invoices: "Invoices",
    itemTotal: "Item Total", totalTax: "Total TAX", totalSales: "Total Sales",
    selectedPeriod: "SELECTED PERIOD", customerSummary: "Customer Sales Summary",
    customers: "customers", customerName: "Customer Name", grandTotal: "Grand Total",
    repSummary: "Sales Rep Summary", reps: "reps", detailed: "DETAILED RECORDS",
    invoiceSales: "Invoice Sales", records: "records", invoiceNo: "Invoice No",
    date: "Date", tax: "TAX", noRecords: "No records match these filters.",
  };

  const months = useMemo(
    () =>
      Array.from(new Set(sales.map((sale) => sale.month).filter(Boolean))).sort(
        (a, b) => b.localeCompare(a)
      ),
    [sales]
  );
  const customers = useMemo(
    () =>
      Array.from(
        new Set(sales.map((sale) => sale.customer_name).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b)),
    [sales]
  );
  const reps = useMemo(
    () =>
      Array.from(new Set(sales.map((sale) => normalizeRep(sale.sales_rep)))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [sales]
  );

  const filtered = useMemo(
    () =>
      sales
        .filter(
          (sale) =>
            (!startDate || sale.sales_date >= startDate) &&
            (!endDate || sale.sales_date <= endDate) &&
            (month === "All" || sale.month === month) &&
            (customer === "All" || sale.customer_name === customer) &&
            (salesRep === "All" || normalizeRep(sale.sales_rep) === salesRep)
        )
        .sort((a, b) => {
          const date = a.sales_date.localeCompare(b.sales_date);
          return (
            date ||
            a.invoice_no.localeCompare(b.invoice_no, undefined, {
              numeric: true,
              sensitivity: "base",
            })
          );
        }),
    [sales, startDate, endDate, month, customer, salesRep]
  );

  const totals = filtered.reduce(
    (result, sale) => ({
      item: result.item + Number(sale.sales_item_total || 0),
      tax: result.tax + Number(sale.tax || 0),
      total: result.total + Number(sale.total_sales || 0),
    }),
    { item: 0, tax: 0, total: 0 }
  );
  const documentTotals = filtered.reduce(
    (result, sale) => {
      const type = sale.document_type ?? "INVOICE";
      if (type === "CR_NOTE") {
        result.creditNotes += 1;
        result.creditTotal += Math.abs(Number(sale.total_sales || 0));
      } else if (type === "DR_NOTE") {
        result.debitNotes += 1;
        result.debitTotal += Math.abs(Number(sale.total_sales || 0));
      } else {
        result.invoices += 1;
      }
      return result;
    },
    {
      invoices: 0,
      creditNotes: 0,
      debitNotes: 0,
      creditTotal: 0,
      debitTotal: 0,
    }
  );

  const customerSummary = useMemo(() => {
    const summary = new Map<
      string,
      { invoices: number; creditNotes: number; debitNotes: number; total: number }
    >();
    filtered.forEach((sale) => {
      const name = sale.customer_name || "Unassigned Customer";
      const current = summary.get(name) ?? {
        invoices: 0,
        creditNotes: 0,
        debitNotes: 0,
        total: 0,
      };
      if (sale.document_type === "CR_NOTE") current.creditNotes += 1;
      else if (sale.document_type === "DR_NOTE") current.debitNotes += 1;
      else current.invoices += 1;
      current.total += Number(sale.total_sales || 0);
      summary.set(name, current);
    });
    return Array.from(summary.entries())
      .map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  const salesRepSummary = useMemo(() => {
    const summary = new Map<
      string,
      { invoices: number; creditNotes: number; debitNotes: number; total: number }
    >();
    filtered.forEach((sale) => {
      const name = normalizeRep(sale.sales_rep);
      const current = summary.get(name) ?? {
        invoices: 0,
        creditNotes: 0,
        debitNotes: 0,
        total: 0,
      };
      if (sale.document_type === "CR_NOTE") current.creditNotes += 1;
      else if (sale.document_type === "DR_NOTE") current.debitNotes += 1;
      else current.invoices += 1;
      current.total += Number(sale.total_sales || 0);
      summary.set(name, current);
    });
    return Array.from(summary.entries())
      .map(([name, values]) => ({ name, ...values }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  function clearFilters() {
    setStartDate("");
    setEndDate("");
    setMonth("All");
    setCustomer("All");
    setSalesRep("All");
  }

  function exportCsv() {
    const detailRows = [
      [
        "Invoice No",
        "Document Type",
        "Original Invoice",
        "Reason",
        "Sales Date",
        "Month",
        "Customer",
        "Sales Rep",
        "Sales Item Total",
        "TAX",
        "Total Sales",
      ],
      ...filtered.map((sale) => [
        sale.invoice_no,
        sale.document_type ?? "INVOICE",
        sale.original_invoice_no ?? "",
        sale.note_reason ?? "",
        sale.sales_date,
        sale.month,
        sale.customer_name,
        normalizeRep(sale.sales_rep),
        sale.sales_item_total,
        sale.tax,
        sale.total_sales,
      ]),
    ];
    const summaryRows = [
      ["Customer Sales Summary"],
      ["Customer Name", "Invoices", "Credit Notes", "Debit Notes", "Total Sales"],
      ...customerSummary.map((item) => [
        item.name,
        item.invoices,
        item.creditNotes,
        item.debitNotes,
        item.total,
      ]),
      [
        "Customer Grand Total",
        documentTotals.invoices,
        documentTotals.creditNotes,
        documentTotals.debitNotes,
        totals.total,
      ],
      [],
      ["Sales Rep Summary"],
      ["Sales Rep", "Invoices", "Credit Notes", "Debit Notes", "Total Sales"],
      ...salesRepSummary.map((item) => [
        item.name,
        item.invoices,
        item.creditNotes,
        item.debitNotes,
        item.total,
      ]),
      [
        "Sales Rep Grand Total",
        documentTotals.invoices,
        documentTotals.creditNotes,
        documentTotals.debitNotes,
        totals.total,
      ],
    ];
    const rows =
      reportType === "summary"
        ? summaryRows
        : reportType === "details"
          ? detailRows
          : [...summaryRows, [], ["Detailed Invoice Records"], ...detailRows];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `ultra-teb-sales-report-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPdf() {
    const [{ jsPDF }, { autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const purple: [number, number, number] = [80, 35, 155];
    const teal: [number, number, number] = [103, 157, 166];
    const palePurple: [number, number, number] = [239, 234, 247];
    const alternate: [number, number, number] = [248, 246, 251];
    const logo = await fetch("/brand/ultra-teb-logo.png")
      .then((response) => response.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          })
      )
      .catch(() => "");

    const period =
      startDate || endDate
        ? `${startDate || "Beginning"} - ${endDate || "Present"}`
        : month !== "All"
          ? month
          : "Beginning - Present";
    const subject =
      customer !== "All"
        ? customer
        : salesRep !== "All"
          ? salesRep
          : "All Customers and Sales Representatives";

    function drawPageBrand() {
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      if (logo) {
        doc.addImage(logo, "PNG", 15, 10, 27, 39, undefined, "FAST");
        doc.saveGraphicsState();
        doc.setGState(new (doc as any).GState({ opacity: 0.035 }));
        doc.addImage(logo, "PNG", 66, 94, 78, 112, undefined, "FAST");
        doc.restoreGraphicsState();
      }
      doc.setTextColor(...purple);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("ULTRA TEB", pageWidth - 15, 17, { align: "right" });
      doc.setFontSize(7);
      doc.setTextColor(90, 105, 120);
      doc.text("Sales Intelligence Report", pageWidth - 15, 22, {
        align: "right",
      });
      doc.setDrawColor(205, 210, 218);
      doc.line(15, 52, pageWidth - 15, 52);

      doc.setDrawColor(...teal);
      doc.line(15, pageHeight - 20, pageWidth - 15, pageHeight - 20);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...purple);
      doc.text("19 Sayed Zakaria St., Sq. 1166, Sheraton", 15, pageHeight - 13);
      doc.text("www.ultrateb.com", pageWidth / 2, pageHeight - 13, {
        align: "center",
      });
      doc.text("Info@ultrateb.com", pageWidth - 15, pageHeight - 13, {
        align: "right",
      });
    }

    function sectionTitle(title: string, y: number) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...purple);
      doc.text(title, 15, y);
      return y + 4;
    }

    drawPageBrand();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(25, 35, 50);
    doc.text("Sales Report", 15, 64);
    doc.setFontSize(9);
    doc.setTextColor(...purple);
    doc.text(subject, 15, 71);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(85, 95, 110);
    doc.text(`Period: ${period}`, 15, 77);

    autoTable(doc, {
      startY: 83,
      margin: { left: 15, right: 15, top: 58, bottom: 25 },
      head: [["Invoices", "Credit Notes", "Debit Notes", "Item Total", "TAX", "Total Sales"]],
      body: [[
        documentTotals.invoices,
        money(documentTotals.creditTotal),
        money(documentTotals.debitTotal),
        money(totals.item),
        money(totals.tax),
        money(totals.total),
      ]],
      theme: "grid",
      styles: { halign: "center", fontSize: 7, cellPadding: 2.2 },
      headStyles: { fillColor: purple, textColor: 255, fontStyle: "bold" },
      bodyStyles: { fillColor: palePurple, fontStyle: "bold" },
      didDrawPage: drawPageBrand,
    });

    let nextY = ((doc as any).lastAutoTable?.finalY ?? 100) + 10;

    if (reportType === "summary" || reportType === "both") {
      nextY = sectionTitle("Customer Sales Summary", nextY);
      autoTable(doc, {
        startY: nextY,
        margin: { left: 15, right: 15, top: 58, bottom: 25 },
        head: [["Customer", "Invoices", "CR Notes", "DR Notes", "Total Sales"]],
        body: customerSummary.map((item) => [
          item.name,
          item.invoices,
          item.creditNotes,
          item.debitNotes,
          money(item.total),
        ]),
        foot: [[
          "Grand Total",
          documentTotals.invoices,
          documentTotals.creditNotes,
          documentTotals.debitNotes,
          money(totals.total),
        ]],
        theme: "grid",
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: purple, textColor: 255 },
        alternateRowStyles: { fillColor: alternate },
        footStyles: { fillColor: palePurple, textColor: 30, fontStyle: "bold" },
        columnStyles: { 0: { cellWidth: 70 }, 4: { halign: "right" } },
        didDrawPage: drawPageBrand,
      });

      nextY = ((doc as any).lastAutoTable?.finalY ?? nextY) + 10;
      if (nextY > 225) {
        doc.addPage();
        drawPageBrand();
        nextY = 64;
      }
      nextY = sectionTitle("Sales Rep Summary", nextY);
      autoTable(doc, {
        startY: nextY,
        margin: { left: 15, right: 15, top: 58, bottom: 25 },
        head: [["Sales Rep", "Invoices", "CR Notes", "DR Notes", "Total Sales"]],
        body: salesRepSummary.map((item) => [
          item.name,
          item.invoices,
          item.creditNotes,
          item.debitNotes,
          money(item.total),
        ]),
        foot: [[
          "Grand Total",
          documentTotals.invoices,
          documentTotals.creditNotes,
          documentTotals.debitNotes,
          money(totals.total),
        ]],
        theme: "grid",
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: purple, textColor: 255 },
        alternateRowStyles: { fillColor: alternate },
        footStyles: { fillColor: palePurple, textColor: 30, fontStyle: "bold" },
        columnStyles: { 0: { cellWidth: 70 }, 4: { halign: "right" } },
        didDrawPage: drawPageBrand,
      });
    }

    if (reportType === "details" || reportType === "both") {
      doc.addPage();
      drawPageBrand();
      sectionTitle("Detailed Records", 64);
      autoTable(doc, {
        startY: 69,
        margin: { left: 10, right: 10, top: 58, bottom: 25 },
        head: [[
          "Document",
          "No.",
          "Date",
          "Customer",
          "Sales Rep",
          "Item Total",
          "TAX",
          "Total",
        ]],
        body: filtered.map((sale) => [
          sale.document_type === "CR_NOTE"
            ? "CR Note"
            : sale.document_type === "DR_NOTE"
              ? "DR Note"
              : "Invoice",
          sale.invoice_no,
          sale.sales_date,
          sale.customer_name || "-",
          normalizeRep(sale.sales_rep),
          money(Number(sale.sales_item_total || 0)),
          money(Number(sale.tax || 0)),
          money(Number(sale.total_sales || 0)),
        ]),
        theme: "grid",
        styles: { fontSize: 5.8, cellPadding: 1.55, overflow: "linebreak" },
        headStyles: { fillColor: purple, textColor: 255, fontSize: 5.7 },
        alternateRowStyles: { fillColor: alternate },
        columnStyles: {
          0: { cellWidth: 16 },
          1: { cellWidth: 13 },
          2: { cellWidth: 19 },
          3: { cellWidth: 34 },
          4: { cellWidth: 25 },
          5: { cellWidth: 24, halign: "right" },
          6: { cellWidth: 20, halign: "right" },
          7: { cellWidth: 26, halign: "right", fontStyle: "bold" },
        },
        didDrawPage: drawPageBrand,
      });
    }

    const pageCount = doc.getNumberOfPages();
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
      doc.setPage(pageNumber);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(110, 115, 125);
      doc.text(
        `${pageNumber} / ${pageCount}`,
        doc.internal.pageSize.getWidth() - 15,
        doc.internal.pageSize.getHeight() - 7,
        { align: "right" }
      );
    }

    doc.save(`ultra-teb-sales-report-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <div dir={dir} className="report-page">
      <Header
        active="reports"
        lang={lang}
        onToggleLang={() => setLang(lang === "en" ? "ar" : "en")}
      />
      <div className="report-print-header" aria-hidden="true">
        <div className="report-print-brand">
          <img src="/brand/ultra-teb-logo.png" alt="" />
          <div>
            <strong>ULTRA TEB</strong>
            <span>Sales Intelligence Report</span>
          </div>
        </div>
        <div className="report-print-header__meta">
          <strong>{t.title}</strong>
          <span>
            {new Date().toLocaleDateString(lang === "ar" ? "ar-EG" : "en-GB")}
          </span>
        </div>
      </div>
      <div className="report-print-watermark" aria-hidden="true">
        <img src="/brand/ultra-teb-logo.png" alt="" />
      </div>
      <div className="report-print-footer" aria-hidden="true">
        <span>19 Sayed Zakaria St., Sq. 1166, Sheraton</span>
        <span>www.ultrateb.com</span>
        <span>Info@ultrateb.com</span>
      </div>
      <main className="report-layout">
        <section className="report-heading">
          <div className="report-heading-brand">
            <img src="/brand/ultra-teb-logo.png" alt="Ultra Teb" />
            <div>
              <p>ULTRA TEB</p>
              <h1>{t.title}</h1>
              <span>{t.subtitle}</span>
              <div className="report-print-meta">
              <strong>
                {lang === "ar" ? "الفترة" : "Period"}:
              </strong>{" "}
              {startDate || (lang === "ar" ? "البداية" : "Beginning")}
              {" — "}
              {endDate || (lang === "ar" ? "الآن" : "Present")}
              </div>
            </div>
          </div>
          <div className="report-actions">
            <button type="button" onClick={exportCsv}>{t.export}</button>
            <button type="button" onClick={downloadPdf}>
              {t.print}
            </button>
          </div>
        </section>

        <section className="report-filters">
          <label>
            {t.reportType}
            <select
              value={reportType}
              onChange={(event) =>
                setReportType(
                  event.target.value as "summary" | "details" | "both"
                )
              }
            >
              <option value="summary">{t.summaryOnly}</option>
              <option value="details">{t.detailsOnly}</option>
              <option value="both">{t.both}</option>
            </select>
          </label>
          <label>
            {t.from}
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label>
            {t.to}
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          <label>
            {t.month}
            <select value={month} onChange={(event) => setMonth(event.target.value)}>
              <option value="All">{t.allMonths}</option>
              {months.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>
            {t.customer}
            <select value={customer} onChange={(event) => setCustomer(event.target.value)}>
              <option value="All">{t.allCustomers}</option>
              {customers.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <label>
            {t.salesRep}
            <select value={salesRep} onChange={(event) => setSalesRep(event.target.value)}>
              <option value="All">{t.allReps}</option>
              {reps.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </label>
          <button type="button" onClick={clearFilters}>{t.clear}</button>
        </section>

        <section className="report-kpis">
          <article><span>{t.invoices}</span><strong>{documentTotals.invoices}</strong></article>
          <article>
            <span>{t.creditNotes}</span>
            <strong>{money(documentTotals.creditTotal)}</strong>
            <small>{documentTotals.creditNotes} {t.records}</small>
          </article>
          <article>
            <span>{t.debitNotes}</span>
            <strong>{money(documentTotals.debitTotal)}</strong>
            <small>{documentTotals.debitNotes} {t.records}</small>
          </article>
          <article><span>{t.itemTotal}</span><strong>{money(totals.item)}</strong></article>
          <article><span>{t.totalTax}</span><strong>{money(totals.tax)}</strong></article>
          <article className="report-kpi-primary"><span>{t.totalSales}</span><strong>{money(totals.total)}</strong></article>
        </section>

        {(reportType === "summary" || reportType === "both") && (
        <section className="report-summary-grid">
          <article className="report-summary-card">
            <div className="report-summary-card__heading">
              <div>
                <p>{t.selectedPeriod}</p>
                <h2>{t.customerSummary}</h2>
              </div>
              <strong>{customerSummary.length} {t.customers}</strong>
            </div>
            <div className="report-summary-table">
              <table>
                <thead>
                  <tr>
                    <th>{t.customerName}</th>
                    <th>{t.invoices}</th>
                    <th>{t.creditNotes}</th>
                    <th>{t.debitNotes}</th>
                    <th>{t.totalSales}</th>
                  </tr>
                </thead>
                <tbody>
                  {customerSummary.map((item) => (
                    <tr key={item.name}>
                      <td>{item.name}</td>
                      <td>{item.invoices}</td>
                      <td>{item.creditNotes}</td>
                      <td>{item.debitNotes}</td>
                      <td><strong>{money(item.total)}</strong></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>{t.grandTotal}</td>
                    <td>{documentTotals.invoices}</td>
                    <td>{documentTotals.creditNotes}</td>
                    <td>{documentTotals.debitNotes}</td>
                    <td>{money(totals.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </article>

          <article className="report-summary-card">
            <div className="report-summary-card__heading">
              <div>
                <p>{t.selectedPeriod}</p>
                <h2>{t.repSummary}</h2>
              </div>
              <strong>{salesRepSummary.length} {t.reps}</strong>
            </div>
            <div className="report-summary-table">
              <table>
                <thead>
                  <tr>
                    <th>{t.salesRep}</th>
                    <th>{t.invoices}</th>
                    <th>{t.creditNotes}</th>
                    <th>{t.debitNotes}</th>
                    <th>{t.totalSales}</th>
                  </tr>
                </thead>
                <tbody>
                  {salesRepSummary.map((item) => (
                    <tr key={item.name}>
                      <td>{item.name}</td>
                      <td>{item.invoices}</td>
                      <td>{item.creditNotes}</td>
                      <td>{item.debitNotes}</td>
                      <td><strong>{money(item.total)}</strong></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>{t.grandTotal}</td>
                    <td>{documentTotals.invoices}</td>
                    <td>{documentTotals.creditNotes}</td>
                    <td>{documentTotals.debitNotes}</td>
                    <td>{money(totals.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </article>
        </section>
        )}

        {(reportType === "details" || reportType === "both") && (
        <section className="report-table-card">
          <div className="report-table-title">
            <div><p>{t.detailed}</p><h2>{t.invoiceSales}</h2></div>
            <strong>{filtered.length} {t.records}</strong>
          </div>
          <div className="report-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{lang === "ar" ? "المستند" : "Document"}</th><th>{t.invoiceNo}</th><th>{t.date}</th><th>{t.month}</th><th>{t.customer}</th>
                  <th>{t.salesRep}</th><th>{t.itemTotal}</th><th>{t.tax}</th><th>{t.totalSales}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sale) => (
                  <tr key={sale.id}>
                    <td>
                      <span className={`document-type-badge document-type-badge--${(sale.document_type ?? "INVOICE").toLowerCase()}`}>
                        {sale.document_type === "CR_NOTE" ? "CR Note" : sale.document_type === "DR_NOTE" ? "DR Note" : lang === "ar" ? "فاتورة" : "Invoice"}
                      </span>
                    </td>
                    <td><strong>{sale.invoice_no}</strong></td>
                    <td>{sale.sales_date}</td><td>{sale.month}</td>
                    <td>{sale.customer_name || "-"}</td><td>{normalizeRep(sale.sales_rep)}</td>
                    <td>{money(Number(sale.sales_item_total || 0))}</td>
                    <td>{money(Number(sale.tax || 0))}</td>
                    <td><strong>{money(Number(sale.total_sales || 0))}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filtered.length && <div className="report-empty">{t.noRecords}</div>}
        </section>
        )}
      </main>
      <Footer lang={lang} />
    </div>
  );
}
