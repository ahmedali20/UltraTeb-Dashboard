import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { readDashboardSession } from "../../../../lib/dashboard-auth";
import { loadVatSalesData } from "../../../../lib/vat-sales-data";
import { writeAuditLog } from "../../../../lib/audit-log";

const headers = ["رقم الفاتورة", "اسم العميل", "رقم التسجيل الضريبي للعميل", "العنوان", "تاريخ الفاتورة", "المبلغ الصافي", "قيمة الضريبة", "Table TAX", "WHT", "إجمالي", "ملاحظات"];

export async function GET(request: NextRequest) {
  const session = await readDashboardSession(request.cookies.get("ultra_teb_session")?.value);
  if (session?.role !== "admin") return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  const from = request.nextUrl.searchParams.get("from") ?? "";
  const to = request.nextUrl.searchParams.get("to") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return NextResponse.json({ error: "A valid date range is required." }, { status: 400 });

  const records = await loadVatSalesData(from, to);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Ultra Teb Dashboard";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Valid Invoices", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  sheet.properties.defaultRowHeight = 18;
  sheet.columns = [12, 34, 23, 48, 15, 17, 17, 14, 14, 18, 15].map((width) => ({ width }));

  const blue = "5B9BD5";
  const lightBlue = "DDEBF7";
  const lighterBlue = "EAF3F8";
  const border = { style: "thin" as const, color: { argb: "B4C6E7" } };
  const groups = [
    { type: "INVOICE", note: "" },
    { type: "CR_NOTE", note: "CR Note" },
    { type: "DR_NOTE", note: "DR Note" },
  ];
  let rowNumber = 1;
  for (const group of groups) {
    if (rowNumber > 1) rowNumber += 1;
    const headerRow = sheet.getRow(rowNumber);
    headerRow.values = headers;
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: blue } };
      cell.font = { bold: true, color: { argb: "FFFFFF" }, name: "Calibri", size: 11 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true, readingOrder: "rtl" };
      cell.border = { top: border, bottom: border, left: border, right: border };
    });
    const firstDataRow = rowNumber + 1;
    const groupRecords = records.filter((record) => record.document_type === group.type);
    groupRecords.forEach((record, index) => {
      rowNumber += 1;
      const row = sheet.getRow(rowNumber);
      const subtotal = Math.abs(Number(record.sales_item_total || 0));
      const vat = Math.abs(Number(record.vat_amount || 0));
      const tableTax = Math.abs(Number(record.table_tax_amount || 0));
      row.values = [record.invoice_no, record.vat_customer_name, record.customer_trn, record.customer_address, new Date(`${record.sales_date}T00:00:00`), subtotal, vat, tableTax, Number(record.wht || 0), null, group.note];
      row.getCell(10).value = { formula: `F${rowNumber}+G${rowNumber}+H${rowNumber}`, result: subtotal + vat + tableTax };
      row.eachCell((cell, column) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: index % 2 ? lighterBlue : lightBlue } };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: column <= 4, readingOrder: "rtl" };
        cell.border = { top: border, bottom: border, left: border, right: border };
      });
      row.getCell(3).numFmt = "@";
      row.getCell(5).numFmt = "dd/mm/yyyy";
      [6, 7, 8, 9, 10].forEach((column) => row.getCell(column).numFmt = "#,##0.00;[Red](#,##0.00);-");
    });
    const lastDataRow = rowNumber;
    rowNumber += 1;
    const totalRow = sheet.getRow(rowNumber);
    totalRow.getCell(2).value = "الإجمالي";
    [6, 7, 8, 9, 10].forEach((column) => {
      const letter = String.fromCharCode(64 + column);
      totalRow.getCell(column).value = groupRecords.length ? { formula: `SUM(${letter}${firstDataRow}:${letter}${lastDataRow})` } : 0;
      totalRow.getCell(column).numFmt = "#,##0.00;[Red](#,##0.00);-";
    });
    totalRow.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: blue } };
      cell.font = { bold: true, color: { argb: "FFFFFF" } };
      cell.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
      cell.border = { top: border, bottom: border, left: border, right: border };
    });
  }
  sheet.autoFilter = { from: "A1", to: "K1" };
  sheet.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.2, right: 0.2, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } };

  const buffer = await workbook.xlsx.writeBuffer();
  await writeAuditLog(request, { action: "EXPORT_VAT_SALES", entityType: "VAT_REPORT", description: `Exported VAT Sales report from ${from} to ${to}.`, metadata: { from, to, records: records.length } });
  return new NextResponse(buffer as ArrayBuffer, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="VAT-Sales-${from}-to-${to}.xlsx"` } });
}
