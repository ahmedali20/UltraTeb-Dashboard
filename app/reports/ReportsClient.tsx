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
      {
        invoices: number;
        creditNotes: number;
        debitNotes: number;
        item: number;
        tax: number;
        total: number;
      }
    >();
    filtered.forEach((sale) => {
      const name = sale.customer_name || "Unassigned Customer";
      const current = summary.get(name) ?? {
        invoices: 0,
        creditNotes: 0,
        debitNotes: 0,
        item: 0,
        tax: 0,
        total: 0,
      };
      if (sale.document_type === "CR_NOTE") current.creditNotes += 1;
      else if (sale.document_type === "DR_NOTE") current.debitNotes += 1;
      else current.invoices += 1;
      current.item += Number(sale.sales_item_total || 0);
      current.tax += Number(sale.tax || 0);
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
    const overviewRows = [
      ["Report Overview"],
      ["Metric", "Value", "Records"],
      ["Invoices", documentTotals.invoices, documentTotals.invoices],
      [
        "Credit Notes",
        documentTotals.creditTotal,
        documentTotals.creditNotes,
      ],
      [
        "Debit Notes",
        documentTotals.debitTotal,
        documentTotals.debitNotes,
      ],
      ["Item Total", totals.item, ""],
      ["Total TAX", totals.tax, ""],
      ["Total Sales", totals.total, filtered.length],
      [],
    ];
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
        ? [...overviewRows, ...summaryRows]
        : reportType === "details"
          ? [...overviewRows, ...detailRows]
          : [
              ...overviewRows,
              ...summaryRows,
              [],
              ["Detailed Invoice Records"],
              ...detailRows,
            ];
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
    const [{ jsPDF }, { default: autoTable }] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const purple: [number, number, number] = [80, 35, 155];
    const teal: [number, number, number] = [103, 157, 166];
    const palePurple: [number, number, number] = [239, 234, 247];
    const alternate: [number, number, number] = [248, 246, 251];
    const brandedPages = new Set<number>();
    const loadBrandImage = (path: string) =>
      fetch(path)
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
    const [logo, headerLogo, footerImage] = await Promise.all([
      loadBrandImage("/brand/ultra-teb-logo.png"),
      loadBrandImage("/brand/ultra-teb-header.png"),
      loadBrandImage("/brand/ultra-teb-footer.png"),
    ]);

    const period =
      startDate || endDate
        ? `${startDate || "Beginning"} - ${endDate || "Present"}`
        : month !== "All"
          ? month
          : "Beginning - Present";
    const subject = (
      customer !== "All"
        ? customer
        : salesRep !== "All"
          ? salesRep
          : "All Customers and Sales Representatives"
    ).replace(/_/g, " ");

    function pdfDate(value: string) {
      if (!value) return "-";
      const parsed = new Date(`${value}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) return value;
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      })
        .format(parsed)
        .replace(/ /g, "-");
    }

    function drawPageBrand() {
      const currentPage = doc.getCurrentPageInfo().pageNumber;
      if (brandedPages.has(currentPage)) return;
      brandedPages.add(currentPage);
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      if (headerLogo) {
        doc.addImage(headerLogo, "PNG", 15, 8, 62, 18, undefined, "FAST");
      }
      if (logo) {
        doc.saveGraphicsState();
        doc.setGState(new (doc as any).GState({ opacity: 0.04 }));
        doc.addImage(logo, "PNG", 69, 91, 72, 104, undefined, "FAST");
        doc.restoreGraphicsState();
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(70, 78, 92);
      doc.text(new Date().toLocaleDateString("en-GB"), pageWidth - 15, 17, {
        align: "right",
      });
      doc.setDrawColor(76, 127, 184);
      doc.setLineWidth(0.7);
      doc.line(15, 35, pageWidth - 15, 35);

      if (footerImage) {
        doc.addImage(
          footerImage,
          "PNG",
          10,
          pageHeight - 49,
          190,
          46.4,
          undefined,
          "FAST"
        );
      }
    }

    function sectionTitle(title: string, y: number) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...purple);
      doc.text(title, 15, y);
      return y + 4;
    }

    function drawReportOverview(y: number) {
      const cards = [
        {
          label: "Invoices",
          value: String(documentTotals.invoices),
          detail: `${documentTotals.invoices} records`,
          primary: false,
        },
        {
          label: "Credit Notes",
          value: money(documentTotals.creditTotal),
          detail: `${documentTotals.creditNotes} records`,
          primary: false,
        },
        {
          label: "Debit Notes",
          value: money(documentTotals.debitTotal),
          detail: `${documentTotals.debitNotes} records`,
          primary: false,
        },
        {
          label: "Item Total",
          value: money(totals.item),
          detail: "",
          primary: false,
        },
        {
          label: "Total TAX",
          value: money(totals.tax),
          detail: "",
          primary: false,
        },
        {
          label: "Total Sales",
          value: money(totals.total),
          detail: `${filtered.length} records`,
          primary: true,
        },
      ];
      const cardWidth = 58;
      const cardHeight = 18;
      const gap = 3;

      cards.forEach((card, index) => {
        const column = index % 3;
        const row = Math.floor(index / 3);
        const x = 15 + column * (cardWidth + gap);
        const cardY = y + row * (cardHeight + gap);
        if (card.primary) {
          doc.setFillColor(...purple);
          doc.setDrawColor(...purple);
        } else {
          doc.setFillColor(245, 242, 250);
          doc.setDrawColor(...palePurple);
        }
        doc.roundedRect(x, cardY, cardWidth, cardHeight, 2, 2, "FD");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        if (card.primary) doc.setTextColor(235, 228, 248);
        else doc.setTextColor(85, 72, 105);
        doc.text(card.label, x + 3, cardY + 4.5);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        if (card.primary) doc.setTextColor(255, 255, 255);
        else doc.setTextColor(35, 28, 50);
        doc.text(card.value, x + 3, cardY + 10.5);
        if (card.detail) {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(5.5);
          if (card.primary) doc.setTextColor(230, 220, 245);
          else doc.setTextColor(105, 94, 120);
          doc.text(card.detail, x + 3, cardY + 15);
        }
      });

      return y + cardHeight * 2 + gap + 7;
    }

    drawPageBrand();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.setTextColor(25, 35, 50);
    doc.text("Sales Report", 15, 55);
    doc.setFontSize(9.5);
    doc.setTextColor(...purple);
    doc.text(subject, 15, 62);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(85, 95, 110);
    doc.text(`Period: ${period}`, 15, 68);

    let nextY = sectionTitle("Report Overview", 78);
    nextY = drawReportOverview(nextY);

    if (reportType === "summary" || reportType === "both") {
      nextY = sectionTitle("Customer Sales Summary", nextY);
      autoTable(doc, {
        startY: nextY,
        margin: { left: 10, right: 10, top: 48, bottom: 52 },
        tableWidth: 190,
        head: [[
          "Customer",
          "Invoices",
          "CR Notes",
          "DR Notes",
          "Item Total",
          "TAX",
          "Total Sales",
        ]],
        body: customerSummary.map((item) => [
          item.name,
          item.invoices,
          item.creditNotes,
          item.debitNotes,
          money(item.item),
          money(item.tax),
          money(item.total),
        ]),
        foot: [[
          "Grand Total",
          documentTotals.invoices,
          documentTotals.creditNotes,
          documentTotals.debitNotes,
          money(totals.item),
          money(totals.tax),
          money(totals.total),
        ]],
        theme: "grid",
        styles: { fontSize: 6.6, cellPadding: 2, overflow: "linebreak" },
        headStyles: { fillColor: purple, textColor: 255 },
        alternateRowStyles: { fillColor: alternate },
        footStyles: { fillColor: palePurple, textColor: 30, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 48 },
          1: { cellWidth: 19, halign: "center" },
          2: { cellWidth: 19, halign: "center" },
          3: { cellWidth: 19, halign: "center" },
          4: { cellWidth: 28, halign: "right" },
          5: { cellWidth: 24, halign: "right" },
          6: { cellWidth: 33, halign: "right", fontStyle: "bold" },
        },
        didDrawPage: drawPageBrand,
      });

      nextY = ((doc as any).lastAutoTable?.finalY ?? nextY) + 10;
      if (customerSummary.length > 1) {
        if (nextY > 225) {
          doc.addPage();
          nextY = 55;
        }
        nextY = sectionTitle("Sales Rep Summary", nextY);
        autoTable(doc, {
          startY: nextY,
          margin: { left: 10, right: 10, top: 48, bottom: 52 },
          tableWidth: 190,
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
          footStyles: {
            fillColor: palePurple,
            textColor: 30,
            fontStyle: "bold",
          },
          columnStyles: {
            0: { cellWidth: 66 },
            1: { cellWidth: 25, halign: "center" },
            2: { cellWidth: 25, halign: "center" },
            3: { cellWidth: 25, halign: "center" },
            4: { cellWidth: 49, halign: "right", fontStyle: "bold" },
          },
          didDrawPage: drawPageBrand,
        });
        nextY = ((doc as any).lastAutoTable?.finalY ?? nextY) + 5;
      }
    }

    if (reportType === "details" || reportType === "both") {
      const invoiceRows = filtered.filter(
        (sale) => (sale.document_type ?? "INVOICE") === "INVOICE"
      );
      const creditRows = filtered.filter(
        (sale) => sale.document_type === "CR_NOTE"
      );
      const debitRows = filtered.filter(
        (sale) => sale.document_type === "DR_NOTE"
      );

      const detailGroups = [
        { title: "Sales Invoices", rows: invoiceRows, noteType: false },
        { title: "Credit Notes", rows: creditRows, noteType: true },
        { title: "Debit Notes", rows: debitRows, noteType: true },
      ];
      detailGroups.forEach((group) => {
        if (!group.rows.length) return;
        if (reportType === "details" && nextY < 78) nextY = 78;
        if (nextY > 220) {
          doc.addPage();
          drawPageBrand();
          nextY = 55;
        }
        sectionTitle(group.title, nextY);
        const groupTotals = group.rows.reduce(
          (result, sale) => ({
            item: result.item + Number(sale.sales_item_total || 0),
            tax: result.tax + Number(sale.tax || 0),
            total: result.total + Number(sale.total_sales || 0),
          }),
          { item: 0, tax: 0, total: 0 }
        );

        autoTable(doc, {
          startY: nextY + 5,
          margin: { left: 10, right: 10, top: 48, bottom: 52 },
          tableWidth: 190,
          head: [
            group.noteType
              ? [
                  "Note No.",
                  "Invoice No.",
                  "Date",
                  "Customer",
                  "Sales Rep",
                  "Item Total",
                  "TAX",
                  "Total",
                ]
              : [
                  "Invoice No.",
                  "Date",
                  "Customer",
                  "Sales Rep",
                  "Item Total",
                  "TAX",
                  "Total",
                ],
          ],
          body: group.rows.map((sale) =>
            group.noteType
              ? [
                  sale.invoice_no,
                  sale.original_invoice_no || "-",
                  pdfDate(sale.sales_date),
                  sale.customer_name || "-",
                  normalizeRep(sale.sales_rep),
                  money(Number(sale.sales_item_total || 0)),
                  money(Number(sale.tax || 0)),
                  money(Number(sale.total_sales || 0)),
                ]
              : [
                  sale.invoice_no,
                  pdfDate(sale.sales_date),
                  sale.customer_name || "-",
                  normalizeRep(sale.sales_rep),
                  money(Number(sale.sales_item_total || 0)),
                  money(Number(sale.tax || 0)),
                  money(Number(sale.total_sales || 0)),
                ]
          ),
          foot: [
            group.noteType
              ? [
                  "Total",
                  "",
                  "",
                  "",
                  "",
                  money(groupTotals.item),
                  money(groupTotals.tax),
                  money(groupTotals.total),
                ]
              : [
                  "Total",
                  "",
                  "",
                  "",
                  money(groupTotals.item),
                  money(groupTotals.tax),
                  money(groupTotals.total),
                ],
          ],
          theme: "grid",
          styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
          headStyles: { fillColor: purple, textColor: 255, fontSize: 6.8 },
          bodyStyles: {
            textColor:
              group.title === "Credit Notes"
                ? [180, 38, 38]
                : [45, 50, 60],
          },
          alternateRowStyles: { fillColor: alternate },
          footStyles: {
            fillColor: palePurple,
            textColor:
              group.title === "Credit Notes"
                ? [180, 38, 38]
                : [30, 30, 30],
            fontStyle: "bold",
          },
          columnStyles: group.noteType
            ? {
                0: { cellWidth: 16 },
                1: { cellWidth: 18 },
                2: { cellWidth: 19 },
                3: { cellWidth: 38 },
                4: { cellWidth: 27 },
                5: { cellWidth: 23, halign: "right" },
                6: { cellWidth: 18, halign: "right" },
                7: { cellWidth: 31, halign: "right", fontStyle: "bold" },
              }
            : {
                0: { cellWidth: 20 },
                1: { cellWidth: 22 },
                2: { cellWidth: 48 },
                3: { cellWidth: 34 },
                4: { cellWidth: 23, halign: "right" },
                5: { cellWidth: 19, halign: "right" },
                6: { cellWidth: 24, halign: "right", fontStyle: "bold" },
              },
          didDrawPage: drawPageBrand,
        });
        nextY = ((doc as any).lastAutoTable?.finalY ?? nextY) + 5;
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
        doc.internal.pageSize.getHeight() - 4,
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
