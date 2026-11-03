"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import Header from "../Header";
import Footer from "../Footer";

type Transaction = {
  id: string;
  row: number;
  date: string;
  description: string;
  reference: string;
  amount: number;
  balance: number | null;
};

type ReconciliationMatch = {
  bank: Transaction;
  company: Transaction;
  confidence: "Reference" | "Date & Amount" | "Amount";
};

const headerAliases = {
  date: ["date", "transaction_date", "value_date", "posting_date", "تاريخ", "التاريخ"],
  description: ["description", "details", "narration", "memo", "particulars", "البيان", "الوصف"],
  reference: ["reference", "ref", "transaction_id", "cheque_no", "check_no", "document_no", "المرجع", "رقم_الشيك"],
  debit: ["debit", "withdrawal", "withdrawals", "مدين", "خصم"],
  credit: ["credit", "deposit", "deposits", "دائن", "إيداع"],
  amount: ["amount", "transaction_amount", "net_amount", "المبلغ"],
  balance: ["balance", "running_balance", "الرصيد"],
};

function normalizeHeader(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, "_").replace(/^_+|_+$/g, "");
}

function parseAmount(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const normalized = raw.replace(/[\s,\u00a0]/g, "").replace(/^\((.*)\)$/, "-$1").replace(/[^0-9.-]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function parseDate(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && value > 1) {
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000).toISOString().slice(0, 10);
  }
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parts = text.split(/[\/.-]/).map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    const [first, second, third] = parts;
    const year = first > 999 ? first : third < 100 ? 2000 + third : third;
    const month = second;
    const day = first > 999 ? third : first;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : "";
}

function findHeader(headers: string[], aliases: string[]) {
  return headers.find((header) => aliases.includes(normalizeHeader(header))) || "";
}

function rowsToTransactions(rows: Record<string, unknown>[], prefix: string) {
  const headers = Object.keys(rows[0] || {});
  const fields = Object.fromEntries(Object.entries(headerAliases).map(([key, aliases]) => [key, findHeader(headers, aliases)])) as Record<keyof typeof headerAliases, string>;
  if (!fields.date || (!fields.amount && !fields.debit && !fields.credit)) {
    throw new Error("Could not identify Date and Amount/ Debit/ Credit columns.");
  }
  return rows.map((row, index) => {
    const debit = fields.debit ? Math.abs(parseAmount(row[fields.debit])) : 0;
    const credit = fields.credit ? Math.abs(parseAmount(row[fields.credit])) : 0;
    const amount = fields.amount ? parseAmount(row[fields.amount]) : credit - debit;
    return {
      id: `${prefix}-${index + 2}`,
      row: index + 2,
      date: parseDate(row[fields.date]),
      description: fields.description ? String(row[fields.description] ?? "").trim() : "",
      reference: fields.reference ? String(row[fields.reference] ?? "").trim() : "",
      amount: Math.round(amount * 100) / 100,
      balance: fields.balance ? parseAmount(row[fields.balance]) : null,
    };
  }).filter((item) => item.date && item.amount !== 0);
}

function bankLinesToTransactions(lines: string[]) {
  const datePattern = /\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|\d{1,2}[A-Za-z]{3}\d{2,4})\b/i;
  const amountPattern = /\(?-?\d[\d,]*(?:\.\d{1,2})?\)?/g;
  return lines.flatMap((line, index) => {
    const dateMatch = line.match(datePattern);
    if (!dateMatch) return [];
    const withoutDate = line.replace(dateMatch[0], " ");
    const amountTokens = withoutDate.match(amountPattern) || [];
    if (!amountTokens.length) return [];
    const amounts = amountTokens.map(parseAmount).filter(Number.isFinite);
    if (!amounts.length) return [];
    let amount = amounts[amounts.length - 1];
    let balance: number | null = null;
    if (amounts.length >= 3) {
      const debit = Math.abs(amounts[amounts.length - 3]);
      const credit = Math.abs(amounts[amounts.length - 2]);
      amount = credit - debit;
      balance = amounts[amounts.length - 1];
    } else if (amounts.length === 2) {
      amount = amounts[0];
      balance = amounts[1];
    }
    const description = withoutDate.replace(amountPattern, " ").replace(/\s+/g, " ").trim();
    return [{
      id: `bank-pdf-${index + 1}`,
      row: index + 1,
      date: parseDate(dateMatch[0]),
      description,
      reference: description.match(/\b\d{5,}\b/)?.[0] || "",
      amount: Math.round(amount * 100) / 100,
      balance,
    }];
  }).filter((item) => item.date && item.amount !== 0);
}

async function readStatement(file: File, prefix: string) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "pdf") {
    if (prefix !== "bank") throw new Error("The company statement must be an Excel file.");
    const loadModule = new Function("url", "return import(url)") as (url: string) => Promise<any>;
    const pdfjs = await loadModule("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
    const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const lines: string[] = [];
    const positionedTransactions: Transaction[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const contentItems = content.items as Array<{ str?: string; transform?: number[] }>;
      const positioned = contentItems
        .filter((item): item is { str: string; transform: number[] } => typeof item.str === "string" && Array.isArray(item.transform))
        .map((item) => ({ text: item.str.trim(), x: item.transform[4], y: item.transform[5] }))
        .filter((item) => item.text);
      const rows = new Map<number, typeof positioned>();
      positioned.forEach((item) => {
        const key = Math.round(item.y / 3) * 3;
        rows.set(key, [...(rows.get(key) || []), item]);
      });
      [...rows.entries()].sort((a, b) => b[0] - a[0]).forEach(([, items]) => {
        const sorted = items.sort((a, b) => a.x - b.x);
        lines.push(sorted.map((item) => item.text).join(" "));
        const transactionDate = sorted.find((item) => item.x < 100 && /^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(item.text));
        const balanceItem = sorted.find((item) => item.x >= 650 && /^\(?[\d,]+\.\d{2}\)?$/.test(item.text));
        if (!transactionDate || !balanceItem) return;
        const debitItem = sorted.find((item) => item.x >= 475 && item.x < 560 && /^\(?[\d,]+\.\d{2}\)?$/.test(item.text));
        const creditItem = sorted.find((item) => item.x >= 560 && item.x < 650 && /^\(?[\d,]+\.\d{2}\)?$/.test(item.text));
        const amount = (creditItem ? Math.abs(parseAmount(creditItem.text)) : 0) - (debitItem ? Math.abs(parseAmount(debitItem.text)) : 0);
        if (!amount) return;
        const detailItems = sorted.filter((item) => item.x >= 88 && item.x < 405);
        const description = detailItems.map((item) => item.text).join(" ").trim();
        positionedTransactions.push({
          id: `bank-pdf-${pageNumber}-${positionedTransactions.length + 1}`,
          row: positionedTransactions.length + 1,
          date: parseDate(transactionDate.text),
          description,
          reference: detailItems.map((item) => item.text).find((text) => /^\d{5,}$/.test(text)) || "",
          amount: Math.round(amount * 100) / 100,
          balance: parseAmount(balanceItem.text),
        });
      });
    }
    let transactions = positionedTransactions.length ? positionedTransactions : bankLinesToTransactions(lines);
    if (!transactions.length) {
      const tesseract = await loadModule("https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.esm.min.js");
      const worker = await tesseract.createWorker(["eng", "ara"]);
      const ocrLines: string[] = [];
      try {
        for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
          const page = await document.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = window.document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext("2d", { willReadFrequently: true });
          if (!context) continue;
          await page.render({ canvasContext: context, viewport }).promise;
          const result = await worker.recognize(canvas);
          ocrLines.push(...String(result.data.text || "").split(/\r?\n/));
        }
      } finally {
        await worker.terminate();
      }
      transactions = bankLinesToTransactions(ocrLines);
    }
    if (!transactions.length) {
      throw new Error("The scanned PDF was read, but its transaction rows could not be identified. Please upload a clearer PDF.");
    }
    return transactions;
  }
  if (extension === "csv") {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: "greedy" });
    if (parsed.errors.length && !parsed.data.length) throw new Error(parsed.errors[0].message);
    return rowsToTransactions(parsed.data, prefix);
  }
  if (extension === "xlsx") {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error("Workbook has no worksheet.");
    const matrix: unknown[][] = [];
    sheet.eachRow((row) => matrix.push((row.values as unknown[]).slice(1)));
    const headerIndex = matrix.findIndex((row) => row.filter((value) => String(value ?? "").trim()).length >= 2);
    if (headerIndex < 0) throw new Error("Could not find a header row.");
    const headers = matrix[headerIndex].map((value, index) => String(value ?? `Column ${index + 1}`).trim());
    const rows = matrix.slice(headerIndex + 1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]])));
    return rowsToTransactions(rows, prefix);
  }
  throw new Error(prefix === "bank" ? "Use a PDF, CSV, or XLSX bank statement." : "Use an XLSX company statement.");
}

function dateDifference(a: string, b: string) {
  return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000;
}

function normalizeReference(value: string) {
  return value.toLocaleLowerCase().replace(/[^a-z0-9\u0600-\u06ff]/g, "");
}

function reconcile(bank: Transaction[], company: Transaction[], tolerance: number) {
  const unusedCompany = new Set(company.map((item) => item.id));
  const matches: ReconciliationMatch[] = [];
  for (const bankItem of bank) {
    const candidates = company.filter((item) => unusedCompany.has(item.id) && Math.abs(Math.abs(item.amount) - Math.abs(bankItem.amount)) < 0.01);
    const bankRef = normalizeReference(bankItem.reference);
    const referenceMatch = bankRef ? candidates.find((item) => normalizeReference(item.reference) === bankRef) : undefined;
    const datedMatch = candidates.filter((item) => dateDifference(item.date, bankItem.date) <= tolerance).sort((a, b) => dateDifference(a.date, bankItem.date) - dateDifference(b.date, bankItem.date))[0];
    const selected = referenceMatch || datedMatch || (candidates.length === 1 ? candidates[0] : undefined);
    if (!selected) continue;
    unusedCompany.delete(selected.id);
    matches.push({ bank: bankItem, company: selected, confidence: referenceMatch ? "Reference" : datedMatch ? "Date & Amount" : "Amount" });
  }
  const matchedBank = new Set(matches.map((match) => match.bank.id));
  return {
    matches,
    bankOnly: bank.filter((item) => !matchedBank.has(item.id)),
    companyOnly: company.filter((item) => unusedCompany.has(item.id)),
  };
}

function money(value: number) {
  return new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", minimumFractionDigits: 2 }).format(value);
}

export default function BankReconciliationClient() {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const [bank, setBank] = useState<Transaction[]>([]);
  const [company, setCompany] = useState<Transaction[]>([]);
  const [bankName, setBankName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [tolerance, setTolerance] = useState(3);
  const [error, setError] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingExcel, setGeneratingExcel] = useState(false);
  const result = useMemo(() => reconcile(bank, company, tolerance), [bank, company, tolerance]);
  const bankTotal = bank.reduce((sum, item) => sum + item.amount, 0);
  const companyTotal = company.reduce((sum, item) => sum + item.amount, 0);

  async function loadFile(file: File | undefined, type: "bank" | "company") {
    if (!file) return;
    setError("");
    try {
      const rows = await readStatement(file, type);
      if (type === "bank") { setBank(rows); setBankName(file.name); }
      else { setCompany(rows); setCompanyName(file.name); }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not read the statement.");
    }
  }

  async function downloadPdf() {
    if (!bank.length && !company.length) return;
    setGeneratingPdf(true);
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 14;
      const purple: [number, number, number] = [81, 35, 155];
      const dark: [number, number, number] = [31, 41, 55];
      const muted: [number, number, number] = [100, 116, 139];

      doc.setFillColor(...purple);
      doc.rect(0, 0, pageWidth, 25, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("ULTRA TEB - BANK RECONCILIATION", margin, 11);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`Generated: ${new Date().toLocaleDateString("en-GB")}`, margin, 18);
      doc.text(`Date tolerance: ${tolerance} day${tolerance === 1 ? "" : "s"}`, pageWidth - margin, 18, { align: "right" });

      doc.setTextColor(...dark);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("RECONCILIATION SUMMARY", margin, 34);
      autoTable(doc, {
        startY: 38,
        margin: { left: margin, right: margin },
        theme: "grid",
        head: [["Matched", "Bank Only", "Company Only", "Bank Total", "Company Total", "Difference"]],
        body: [[
          String(result.matches.length),
          String(result.bankOnly.length),
          String(result.companyOnly.length),
          money(bankTotal),
          money(companyTotal),
          money(bankTotal - companyTotal),
        ]],
        headStyles: { fillColor: purple, textColor: 255, fontSize: 7, halign: "center" },
        bodyStyles: { fontSize: 7, halign: "center", textColor: dark },
      });

      let nextY = (doc as any).lastAutoTable.finalY + 8;
      const addSection = (title: string, body: Array<Array<string>>) => {
        if (nextY > 265) {
          doc.addPage();
          nextY = 18;
        }
        doc.setTextColor(...dark);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(`${title} (${body.length})`, margin, nextY);
        autoTable(doc, {
          startY: nextY + 3,
          margin: { left: margin, right: margin, bottom: 16 },
          theme: "striped",
          head: [["Bank Date", "Company Date", "Reference", "Description", "Amount", "Status"]],
          body: body.length ? body : [["-", "-", "-", "No transactions", "-", "-"]],
          headStyles: { fillColor: dark, textColor: 255, fontSize: 7 },
          bodyStyles: { fontSize: 7, textColor: dark, cellPadding: 2 },
          columnStyles: {
            0: { cellWidth: 20 },
            1: { cellWidth: 20 },
            2: { cellWidth: 27 },
            3: { cellWidth: "auto" },
            4: { cellWidth: 27, halign: "right" },
            5: { cellWidth: 23 },
          },
          didDrawPage: () => {
            const pageHeight = doc.internal.pageSize.getHeight();
            doc.setDrawColor(220, 224, 230);
            doc.line(margin, pageHeight - 11, pageWidth - margin, pageHeight - 11);
            doc.setTextColor(...muted);
            doc.setFontSize(7);
            doc.text("UltraTeb Tegara - Internal Dashboard", margin, pageHeight - 6);
            doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - margin, pageHeight - 6, { align: "right" });
          },
        });
        nextY = (doc as any).lastAutoTable.finalY + 9;
      };

      addSection("MATCHED TRANSACTIONS", result.matches.map((item) => [
        item.bank.date,
        item.company.date,
        item.bank.reference || item.company.reference || "-",
        item.bank.description || item.company.description || "-",
        money(Math.abs(item.bank.amount)),
        item.confidence,
      ]));
      addSection("BANK-ONLY TRANSACTIONS", result.bankOnly.map((item) => [
        item.date, "-", item.reference || "-", item.description || "-", money(item.amount), "Outstanding",
      ]));
      addSection("COMPANY-ONLY TRANSACTIONS", result.companyOnly.map((item) => [
        "-", item.date, item.reference || "-", item.description || "-", money(item.amount), "Outstanding",
      ]));

      doc.save(`Bank-Reconciliation-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function downloadExcel() {
    if (!bank.length && !company.length) return;
    setGeneratingExcel(true);
    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Ultra Teb Dashboard";
      workbook.created = new Date();
      const purple = "FF51239B";
      const dark = "FF1F2937";
      const light = "FFF3F0FA";
      const currencyFormat = '#,##0.00 "EGP"';

      const summary = workbook.addWorksheet("Summary", { views: [{ showGridLines: false }] });
      summary.mergeCells("A1:F2");
      summary.getCell("A1").value = "ULTRA TEB - BANK RECONCILIATION";
      summary.getCell("A1").font = { bold: true, color: { argb: "FFFFFFFF" }, size: 16 };
      summary.getCell("A1").alignment = { vertical: "middle", horizontal: "left" };
      summary.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: purple } };
      summary.addRow([]);
      summary.addRow(["Generated", new Date().toLocaleDateString("en-GB")]);
      summary.addRow(["Date Tolerance", `${tolerance} day${tolerance === 1 ? "" : "s"}`]);
      summary.addRow([]);
      summary.addRow(["Metric", "Count", "Amount"]);
      summary.addRow(["Matched", result.matches.length, result.matches.reduce((sum, item) => sum + Math.abs(item.bank.amount), 0)]);
      summary.addRow(["Bank Only", result.bankOnly.length, result.bankOnly.reduce((sum, item) => sum + item.amount, 0)]);
      summary.addRow(["Company Only", result.companyOnly.length, result.companyOnly.reduce((sum, item) => sum + item.amount, 0)]);
      summary.addRow(["Bank Total", bank.length, bankTotal]);
      summary.addRow(["Company Total", company.length, companyTotal]);
      summary.addRow(["Statement Difference", "", bankTotal - companyTotal]);
      summary.getRow(7).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: dark } };
      });
      for (let row = 8; row <= 13; row += 1) summary.getCell(`C${row}`).numFmt = currencyFormat;
      summary.columns = [{ width: 26 }, { width: 16 }, { width: 22 }, { width: 14 }, { width: 14 }, { width: 14 }];

      const addWorksheet = (name: string, rows: Array<Array<string | number>>) => {
        const sheet = workbook.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
        sheet.addRow(["Bank Date", "Company Date", "Reference", "Description", "Amount (EGP)", "Status"]);
        rows.forEach((row) => sheet.addRow(row));
        sheet.getRow(1).height = 24;
        sheet.getRow(1).eachCell((cell) => {
          cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: purple } };
          cell.alignment = { vertical: "middle" };
        });
        sheet.columns = [{ width: 15 }, { width: 15 }, { width: 22 }, { width: 48 }, { width: 18 }, { width: 18 }];
        for (let index = 2; index <= sheet.rowCount; index += 1) {
          sheet.getCell(index, 5).numFmt = currencyFormat;
          if (index % 2 === 0) sheet.getRow(index).eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: light } };
          });
        }
        sheet.autoFilter = { from: "A1", to: "F1" };
      };

      addWorksheet("Matched", result.matches.map((item) => [
        item.bank.date, item.company.date,
        item.bank.reference || item.company.reference || "",
        item.bank.description || item.company.description || "",
        Math.abs(item.bank.amount), item.confidence,
      ]));
      addWorksheet("Bank Only", result.bankOnly.map((item) => [
        item.date, "", item.reference, item.description, item.amount, "Outstanding",
      ]));
      addWorksheet("Company Only", result.companyOnly.map((item) => [
        "", item.date, item.reference, item.description, item.amount, "Outstanding",
      ]));

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Bank-Reconciliation-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);
    } finally {
      setGeneratingExcel(false);
    }
  }

  return <div className="bank-rec-shell">
    <Header active="bankReconciliation" lang={lang} onToggleLang={() => setLang(lang === "en" ? "ar" : "en")} />
    <main className="bank-rec-page">
      <div className="bank-rec-heading"><div><span>FINANCE CONTROL</span><h1>Bank Reconciliation</h1><p>Upload the bank statement and company statement to identify matched and outstanding transactions.</p></div><div className="bank-rec-downloads"><button onClick={downloadPdf} disabled={generatingPdf || generatingExcel || (!bank.length && !company.length)}>{generatingPdf ? "Preparing PDF..." : "Download PDF"}</button><button onClick={downloadExcel} disabled={generatingPdf || generatingExcel || (!bank.length && !company.length)}>{generatingExcel ? "Preparing Excel..." : "Download Excel"}</button></div></div>
      <section className="bank-rec-upload-grid">
        <label><strong>Bank Statement</strong><small>{bankName || "PDF (text-based), CSV, or XLSX"}</small><input type="file" accept=".pdf,.csv,.xlsx,application/pdf" onChange={(event) => loadFile(event.target.files?.[0], "bank")} /><span>{bank.length ? `${bank.length} transactions loaded` : "Choose Bank Statement PDF"}</span></label>
        <label><strong>Company Statement</strong><small>{companyName || "Excel XLSX"}</small><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => loadFile(event.target.files?.[0], "company")} /><span>{company.length ? `${company.length} transactions loaded` : "Choose Company Excel"}</span></label>
        <label className="bank-rec-tolerance"><strong>Date Tolerance</strong><small>Maximum days between matching transactions</small><input type="number" min="0" max="31" value={tolerance} onChange={(event) => setTolerance(Math.max(0, Number(event.target.value) || 0))} /><span>{tolerance} days</span></label>
      </section>
      {error && <p className="bank-rec-error">{error}</p>}
      <section className="bank-rec-kpis">
        <article><span>Matched</span><strong>{result.matches.length}</strong><small>{money(result.matches.reduce((sum, item) => sum + Math.abs(item.bank.amount), 0))}</small></article>
        <article className="bank-rec-kpi--warning"><span>Bank Only</span><strong>{result.bankOnly.length}</strong><small>{money(result.bankOnly.reduce((sum, item) => sum + item.amount, 0))}</small></article>
        <article className="bank-rec-kpi--danger"><span>Company Only</span><strong>{result.companyOnly.length}</strong><small>{money(result.companyOnly.reduce((sum, item) => sum + item.amount, 0))}</small></article>
        <article className="bank-rec-kpi--difference"><span>Statement Difference</span><strong>{money(bankTotal - companyTotal)}</strong><small>Bank {money(bankTotal)} · Company {money(companyTotal)}</small></article>
      </section>
      <ReconciliationTable title="Matched Transactions" rows={result.matches.map((item) => ({ bankDate: item.bank.date, companyDate: item.company.date, description: item.bank.description || item.company.description, reference: item.bank.reference || item.company.reference, amount: Math.abs(item.bank.amount), status: item.confidence }))} />
      <div className="bank-rec-two-column">
        <ReconciliationTable title="Bank Only" rows={result.bankOnly.map((item) => ({ bankDate: item.date, companyDate: "-", description: item.description, reference: item.reference, amount: item.amount, status: "Outstanding" }))} />
        <ReconciliationTable title="Company Only" rows={result.companyOnly.map((item) => ({ bankDate: "-", companyDate: item.date, description: item.description, reference: item.reference, amount: item.amount, status: "Outstanding" }))} />
      </div>
    </main>
    <Footer lang={lang} />
  </div>;
}

function ReconciliationTable({ title, rows }: { title: string; rows: Array<{ bankDate: string; companyDate: string; description: string; reference: string; amount: number; status: string }> }) {
  return <section className="bank-rec-card"><div className="bank-rec-card__title"><h2>{title}</h2><span>{rows.length} records</span></div><div className="bank-rec-table-wrap"><table><thead><tr><th>Bank Date</th><th>Company Date</th><th>Description</th><th>Reference</th><th>Amount</th><th>Status</th></tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={`${title}-${index}`}><td>{row.bankDate}</td><td>{row.companyDate}</td><td>{row.description || "-"}</td><td>{row.reference || "-"}</td><td>{money(row.amount)}</td><td><span className="bank-rec-status">{row.status}</span></td></tr>) : <tr><td colSpan={6} className="bank-rec-empty">No transactions</td></tr>}</tbody></table></div></section>;
}
