import { createClient } from "@supabase/supabase-js";
import { createSign } from "crypto";
import { NextResponse } from "next/server";

const SPREADSHEET_ID = "13L05U9X3f4cerrzSQu6qQxSTrqY-b8jo4SVYZ9Vrcc4";
const SHEETS = [
  { name: "Invoices Sales", documentType: "INVOICE", range: "B:I" },
  { name: "CR Notes", documentType: "CR_NOTE", range: "B:J" },
  { name: "DR Notes", documentType: "DR_NOTE", range: "B:J" },
] as const;

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

type SheetRow = Record<string, string>;

function base64Url(value: string | Buffer) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function isAmountLike(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  const normalized = raw
    .replace(/[\s,\u00a0]/g, "")
    .replace(/^\((.*)\)$/, "-$1");
  return (
    /[.,()]/.test(raw) &&
    normalized !== "" &&
    /^-?\d+(?:\.\d+)?$/.test(normalized)
  );
}

function getValue(row: SheetRow, aliases: string[]) {
  for (const alias of aliases) {
    const value = row[alias];
    if (value?.trim()) return value.trim();
  }
  return "";
}

function parseNumber(value: string) {
  const normalized = value.replace(/,/g, "").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDocumentType(value: string) {
  const raw = value.trim().toLowerCase();
  if (!raw) return "INVOICE" as const;
  if (raw.includes("دائن")) return "CR_NOTE" as const;
  if (raw.includes("مدين")) return "DR_NOTE" as const;
  if (raw.includes("فاتورة")) return "INVOICE" as const;
  const normalized = raw.replace(/[^a-z0-9]+/g, "_");
  if (["invoice", "sales_invoice", "inv"].includes(normalized)) {
    return "INVOICE" as const;
  }
  if (
    ["cr", "cr_note", "credit", "credit_note", "creditnote"].includes(normalized)
  ) {
    return "CR_NOTE" as const;
  }
  if (
    ["dr", "dr_note", "debit", "debit_note", "debitnote"].includes(normalized)
  ) {
    return "DR_NOTE" as const;
  }
  return null;
}

function parseDate(value: string) {
  const trimmed = value
    .trim()
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const spreadsheetSerial = Number(trimmed);
  if (
    Number.isFinite(spreadsheetSerial) &&
    spreadsheetSerial >= 1 &&
    spreadsheetSerial <= 2958465
  ) {
    const milliseconds =
      Date.UTC(1899, 11, 30) + Math.floor(spreadsheetSerial) * 86400000;
    return new Date(milliseconds).toISOString().slice(0, 10);
  }

  const dateOnly = trimmed.split(/[T\s]/)[0];
  const parts = dateOnly.split(/[\/.-]/).map((part) => Number(part));
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    const [first, second, third] = parts;
    const year =
      first > 999 ? first : third < 100 ? 2000 + third : third;
    const month = second;
    const day = first > 999 ? third : first;
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(
        2,
        "0"
      )}`;
    }
  }

  const parsedTimestamp = Date.parse(trimmed);
  if (Number.isFinite(parsedTimestamp)) {
    return new Date(parsedTimestamp).toISOString().slice(0, 10);
  }

  return "";
}

async function getGoogleAccessToken() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n"
  );

  if (!email || !privateKey) {
    throw new Error(
      "Google service-account environment variables are not configured."
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const unsignedToken = `${header}.${claim}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  signer.end();
  const assertion = `${unsignedToken}.${base64Url(signer.sign(privateKey))}`;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  const result = await response.json();

  if (!response.ok || !result.access_token) {
    throw new Error(result.error_description || "Google authentication failed.");
  }

  return result.access_token as string;
}

async function readSheet(
  token: string,
  sheetName: string,
  forcedDocumentType: "INVOICE" | "CR_NOTE" | "DR_NOTE",
  sheetRange: string
) {
  const range = encodeURIComponent(`'${sheetName}'!${sheetRange}`);
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error?.message || "Could not read Google Sheet.");
  }

  const values: string[][] = result.values ?? [];
  if (values.length < 2) return [];

  const headerRowIndex = values.slice(0, 20).findIndex((candidate) => {
    const normalized = candidate.map(normalizeHeader);
    return (
      normalized.some((header) =>
        [
          "invoice_no",
          "invoice_number",
          "invoice",
          "note_no",
          "note_number",
          "cr_note_no",
          "cr_note_number",
          "cr_no",
          "cr_number",
          "credit_note_no",
          "credit_note_number",
          "dr_note_no",
          "dr_note_number",
          "dr_no",
          "dr_number",
          "debit_note_no",
          "debit_note_number",
        ].includes(header)
      ) &&
      normalized.some((header) =>
        [
          "sales_date",
          "invoice_date",
          "note_date",
          "dr_date",
          "cr_date",
          "date",
        ].includes(header)
      )
    );
  });

  if (headerRowIndex < 0) {
    throw new Error(
      `Header row not found in "${sheetName}". Add a document number and Sales Date headers.`
    );
  }

  const headers = values[headerRowIndex].map(normalizeHeader);
  return values.slice(headerRowIndex + 1).map((valuesRow, rowIndex) => {
    const mapped = Object.fromEntries(
      headers.map((header, index) => [header, String(valuesRow[index] ?? "")])
    ) as SheetRow;
    const invoiceNumber = getValue(mapped, [
      "invoice_no",
      "invoice_number",
      "invoice",
    ]);
    const noteNumber = getValue(mapped, [
      "note_no",
      "note_number",
      "cr_note_no",
      "cr_note_number",
      "cr_no",
      "cr_number",
      "credit_note_no",
      "credit_note_number",
      "dr_note_no",
      "dr_note_number",
      "dr_no",
      "dr_number",
      "debit_note_no",
      "debit_note_number",
    ]);
    const isInvoiceSheet = forcedDocumentType === "INVOICE";

    return {
      ...mapped,
      invoice_no:
        isInvoiceSheet
          ? invoiceNumber || String(valuesRow[0] ?? "")
          : noteNumber || String(valuesRow[2] ?? ""),
      sales_date:
        getValue(mapped, [
          "sales_date",
          "invoice_date",
          "note_date",
          "dr_date",
          "cr_date",
          "date",
        ]) || String(valuesRow[isInvoiceSheet ? 1 : 3] ?? ""),
      customer_name:
        getValue(mapped, [
          "customer_name",
          "customer",
          "hospital",
          "hospital_name",
        ]) || String(valuesRow[isInvoiceSheet ? 3 : 0] ?? ""),
      sales_item_total:
        getValue(mapped, [
          "sales_item_total",
          "item_total",
          "net_sales",
          "sales_total",
          "amount_before_tax",
          "net_amount",
          "sub_total",
          "subtotal",
          "sales_sub_total",
          "sales_subtotal",
        ]) || String(valuesRow[isInvoiceSheet ? 4 : 5] ?? ""),
      tax:
        getValue(mapped, ["tax", "tax_value", "vat", "sales_tax"]) ||
        String(valuesRow[isInvoiceSheet ? 5 : 6] ?? ""),
      sales_rep:
        getValue(mapped, [
          "sales_rep",
          "sales_representative",
          "representative",
          "rep",
        ]) || String(valuesRow[isInvoiceSheet ? 7 : 8] ?? ""),
      document_type: forcedDocumentType,
      original_invoice_no:
        getValue(mapped, [
          "original_invoice_no",
          "original_invoice_number",
          "original_invoice",
          "related_invoice_no",
          "related_invoice_number",
          "reference_invoice",
          "invoice_reference",
          "invoice_ref",
        ]) ||
        (!isInvoiceSheet
          ? invoiceNumber || String(valuesRow[1] ?? "")
          : ""),
      note_reason:
        getValue(mapped, [
          "note_reason",
          "reason",
          "credit_debit_reason",
          "adjustment_reason",
        ]) ||
        (isInvoiceSheet ? "" : `Imported from ${sheetName}`),
      _sheet_name: sheetName,
      _sheet_row: String(headerRowIndex + rowIndex + 2),
    };
  });
}

async function nextCustomerCode() {
  const { data, error } = await supabase.from("customers").select("customer_code");
  if (error) throw new Error(error.message);

  const used = new Set(
    (data ?? [])
      .map((customer) => /^CUST(\d+)$/i.exec(customer.customer_code ?? ""))
      .filter(Boolean)
      .map((match) => Number(match![1]))
  );

  let number = 1;
  while (used.has(number)) number += 1;
  return `CUST${String(number).padStart(3, "0")}`;
}

function combineRowsWithSameInvoice(sheetRows: SheetRow[]) {
  const combined = new Map<string, SheetRow>();
  const rowsWithoutInvoice: SheetRow[] = [];
  let duplicateRowsCombined = 0;

  sheetRows.forEach((row, index) => {
    const invoiceNo = getValue(row, [
      "invoice_no",
      "invoice_number",
      "invoice",
    ]);

    if (!invoiceNo) {
      rowsWithoutInvoice.push({
        ...row,
        _sheet_row: row._sheet_row || String(index + 2),
      });
      return;
    }

    const documentType =
      parseDocumentType(
        getValue(row, ["document_type", "document", "type", "invoice_type"])
      ) ?? "INVALID";
    const documentKey = `${documentType}:${invoiceNo}`;
    const existing = combined.get(documentKey);
    if (!existing) {
      combined.set(documentKey, {
        ...row,
        _sheet_row: row._sheet_row || String(index + 2),
      });
      return;
    }

    existing.sales_item_total = String(
      parseNumber(existing.sales_item_total || "") +
        parseNumber(row.sales_item_total || "")
    );
    existing.tax = String(
      parseNumber(existing.tax || "") + parseNumber(row.tax || "")
    );
    existing.customer_name ||= row.customer_name;
    existing.sales_date ||= row.sales_date;
    existing.sales_rep ||= row.sales_rep;
    existing.document_type ||= row.document_type;
    existing.original_invoice_no ||= row.original_invoice_no;
    existing.note_reason ||= row.note_reason;
    duplicateRowsCombined += 1;
  });

  return {
    rows: [...combined.values(), ...rowsWithoutInvoice],
    duplicateRowsCombined,
  };
}

async function syncInvoices() {
  const token = await getGoogleAccessToken();
  const sheetGroups = await Promise.all(
    SHEETS.map((sheet) =>
      readSheet(token, sheet.name, sheet.documentType, sheet.range)
    )
  );
  const sheetRows = sheetGroups.flat();
  const combinedRows = combineRowsWithSameInvoice(sheetRows);
  const [{ data: customers, error: customersError }, { data: priorSales, error: salesError }] =
    await Promise.all([
      supabase
        .from("customers")
        .select("customer_code, customer_name, sales_rep_name"),
      supabase
        .from("sales_view")
        .select("id, invoice_no, customer_code, customer_name, document_type"),
    ]);

  if (customersError) throw new Error(customersError.message);
  if (salesError) throw new Error(salesError.message);

  const customerList = [...(customers ?? [])];
  let inserted = 0;
  let updated = 0;
  let createdCustomers = 0;
  let skippedIncomplete = 0;
  let creditNotes = 0;
  let debitNotes = 0;
  let deleted = 0;
  let deletionSkipped = false;
  let deletionSkipReason = "";
  let invalidRepValuesIgnored = 0;
  let cleanedCustomers = 0;
  let cleanedCustomerReps = 0;
  let cleanedSalesReps = 0;
  const syncedDocumentKeys = new Set<string>();
  const failed: { row: number; invoice?: string; error: string }[] = [];

  for (let index = 0; index < combinedRows.rows.length; index += 1) {
    const row = combinedRows.rows[index];
    const sheetRowNumber = Number(row._sheet_row) || index + 2;
    const invoiceNo = getValue(row, ["invoice_no", "invoice_number", "invoice"]);
    const rawSalesDate = getValue(row, [
      "sales_date",
      "invoice_date",
      "date",
    ]);
    const salesDate = parseDate(rawSalesDate);
    const sourceCode = getValue(row, ["customer_code", "code"]);
    const customerName = getValue(row, [
      "customer_name",
      "customer",
      "hospital",
      "hospital_name",
    ]);
    const salesItemTotal = parseNumber(
      getValue(row, [
        "sales_item_total",
        "item_total",
        "net_sales",
        "sales_total",
      ])
    );
    const tax = parseNumber(getValue(row, ["tax", "tax_value", "vat"]));
    const rawSalesRep = getValue(row, [
      "sales_rep",
      "sales_representative",
      "representative",
      "rep",
    ]);
    const salesRep = isAmountLike(rawSalesRep) ? "" : rawSalesRep;
    if (rawSalesRep && !salesRep) invalidRepValuesIgnored += 1;
    const rawDocumentType = getValue(row, [
      "document_type",
      "document",
      "type",
      "invoice_type",
      "note_type",
    ]);
    const documentType = parseDocumentType(rawDocumentType);
    const originalInvoiceNo = getValue(row, [
      "original_invoice_no",
      "original_invoice",
      "related_invoice_no",
      "reference_invoice",
    ]);
    const noteReason = getValue(row, [
      "note_reason",
      "reason",
      "credit_debit_reason",
      "adjustment_reason",
    ]);

    // Ignore blank, title, subtotal, and footer rows. A real sales document
    // must contain at least its document number or document date.
    if (!invoiceNo && !rawSalesDate) continue;
    if (!rawSalesDate && !customerName && !sourceCode) {
      skippedIncomplete += 1;
      continue;
    }
    if (!invoiceNo || !salesDate || (!customerName && !sourceCode)) {
      const missing = [
        !invoiceNo ? "invoice number" : "",
        !rawSalesDate ? "sales date" : "",
        !customerName && !sourceCode ? "customer" : "",
      ].filter(Boolean);
      const invalidDate =
        rawSalesDate && !salesDate
          ? `Invalid sales date value "${rawSalesDate}".`
          : "";
      failed.push({
        row: sheetRowNumber,
        invoice: invoiceNo,
        error:
          invalidDate ||
          `Missing ${missing.join(", ")}.`,
      });
      continue;
    }
    if (customerName && isAmountLike(customerName)) {
      failed.push({
        row: sheetRowNumber,
        invoice: invoiceNo,
        error: `Invalid numeric customer name "${customerName}".`,
      });
      continue;
    }
    if (!documentType) {
      failed.push({
        row: sheetRowNumber,
        invoice: invoiceNo,
        error: `Unknown document type "${rawDocumentType}". Use Invoice, CR, Credit Note, DR, or Debit Note.`,
      });
      continue;
    }
    if (
      documentType !== "INVOICE" &&
      (!originalInvoiceNo || !noteReason)
    ) {
      failed.push({
        row: sheetRowNumber,
        invoice: invoiceNo,
        error:
          "Credit and debit notes require Original Invoice No and Note Reason.",
      });
      continue;
    }

    let customer =
      customerList.find((item) => item.customer_code === sourceCode) ??
      customerList.find(
        (item) => normalizeName(item.customer_name) === normalizeName(customerName)
      );

    if (!customer && customerName) {
      const previous = (priorSales ?? []).find(
        (sale) => normalizeName(sale.customer_name ?? "") === normalizeName(customerName)
      );
      customer = customerList.find(
        (item) => item.customer_code === previous?.customer_code
      );
    }

    if (!customer && customerName) {
      const customerCode = await nextCustomerCode();
      const { data: created, error } = await supabase
        .from("customers")
        .insert({
          customer_code: customerCode,
          customer_name: customerName,
          sales_rep_name: null,
          credit_limit: 0,
        })
        .select("customer_code, customer_name, sales_rep_name")
        .single();

      if (error) {
        failed.push({ row: sheetRowNumber, invoice: invoiceNo, error: error.message });
        continue;
      }

      customer = created;
      customerList.push(created);
      createdCustomers += 1;
    }

    if (!customer) {
      failed.push({
        row: sheetRowNumber,
        invoice: invoiceNo,
        error: "Customer could not be matched.",
      });
      continue;
    }

    if (salesRep && customer.sales_rep_name !== salesRep) {
      const { error: repError } = await supabase
        .from("customers")
        .update({ sales_rep_name: salesRep })
        .eq("customer_code", customer.customer_code);

      if (repError) {
        failed.push({
          row: sheetRowNumber,
          invoice: invoiceNo,
          error: repError.message,
        });
        continue;
      }
      customer.sales_rep_name = salesRep;
    }

    const sign = documentType === "CR_NOTE" ? -1 : 1;
    const payload = {
      invoice_no: invoiceNo,
      sales_date: salesDate,
      customer_code: customer.customer_code,
      sales_item_total: sign * Math.abs(salesItemTotal),
      tax: sign * Math.abs(tax),
      document_type: documentType,
      original_invoice_no:
        documentType === "INVOICE" ? null : originalInvoiceNo,
      note_reason: documentType === "INVOICE" ? null : noteReason,
    };
    const existingMatches = (priorSales ?? []).filter(
      (sale) =>
        String(sale.invoice_no).trim() === invoiceNo &&
        (sale.document_type ?? "INVOICE") === documentType
    );
    const existing = existingMatches[0];
    const query = existing
      ? supabase.from("sales").update(payload).eq("id", existing.id)
      : supabase.from("sales").insert(payload);
    const { error } = await query;

    if (error) {
      failed.push({ row: sheetRowNumber, invoice: invoiceNo, error: error.message });
    } else if (existing) {
      const duplicateIds = existingMatches
        .slice(1)
        .map((sale) => sale.id)
        .filter(Boolean);

      if (duplicateIds.length) {
        const { error: duplicateDeleteError } = await supabase
          .from("sales")
          .delete()
          .in("id", duplicateIds);

        if (duplicateDeleteError) {
          failed.push({
            row: sheetRowNumber,
            invoice: invoiceNo,
            error: duplicateDeleteError.message,
          });
          continue;
        }
      }
      updated += 1;
    } else {
      inserted += 1;
    }
    syncedDocumentKeys.add(`${documentType}:${invoiceNo}`);
    if (documentType === "CR_NOTE") creditNotes += 1;
    if (documentType === "DR_NOTE") debitNotes += 1;
  }

  /*
   * Google Sheets is the source of truth for sales records. Only remove records
   * that disappeared from the sheet after a completely valid sync.
   */
  if (failed.length > 0 || skippedIncomplete > 0) {
    deletionSkipped = true;
    deletionSkipReason =
      "Deletion skipped because one or more sheet rows failed or were incomplete.";
  } else if (syncedDocumentKeys.size === 0) {
    deletionSkipped = true;
    deletionSkipReason = "Deletion skipped because the sheets contain no valid records.";
  } else {
    const staleIds = (priorSales ?? [])
      .filter((sale) => {
        const existingType = sale.document_type ?? "INVOICE";
        const existingInvoiceNo = String(sale.invoice_no ?? "").trim();
        return !syncedDocumentKeys.has(`${existingType}:${existingInvoiceNo}`);
      })
      .map((sale) => sale.id)
      .filter(Boolean);

    for (let offset = 0; offset < staleIds.length; offset += 100) {
      const ids = staleIds.slice(offset, offset + 100);
      const { error: deleteError } = await supabase
        .from("sales")
        .delete()
        .in("id", ids);

      if (deleteError) {
        throw new Error(`Could not remove old sales records: ${deleteError.message}`);
      }
      deleted += ids.length;
    }
  }

  const syncedAt = new Date().toISOString();
  const fullSyncSucceeded =
    failed.length === 0 && skippedIncomplete === 0 && !deletionSkipped;

  if (fullSyncSucceeded) {
    const [
      { data: linkedSales, error: linkedSalesError },
      { data: currentCustomers, error: currentCustomersError },
    ] = await Promise.all([
      supabase.from("sales").select("customer_code"),
      supabase
        .from("customers")
        .select("customer_code, customer_name, sales_rep_name"),
    ]);
    if (linkedSalesError) throw new Error(linkedSalesError.message);
    if (currentCustomersError) throw new Error(currentCustomersError.message);

    const linkedCustomerCodes = new Set(
      (linkedSales ?? []).map((sale) => sale.customer_code).filter(Boolean)
    );
    const removableCustomerCodes = (currentCustomers ?? [])
      .filter(
        (customer) =>
          isAmountLike(customer.customer_name) &&
          !linkedCustomerCodes.has(customer.customer_code)
      )
      .map((customer) => customer.customer_code);

    for (let offset = 0; offset < removableCustomerCodes.length; offset += 100) {
      const codes = removableCustomerCodes.slice(offset, offset + 100);
      const { error } = await supabase
        .from("customers")
        .delete()
        .in("customer_code", codes);
      if (error) throw new Error(`Could not remove invalid customers: ${error.message}`);
      cleanedCustomers += codes.length;
    }

    const invalidRepCustomerCodes = (currentCustomers ?? [])
      .filter((customer) => isAmountLike(customer.sales_rep_name))
      .map((customer) => customer.customer_code);

    for (let offset = 0; offset < invalidRepCustomerCodes.length; offset += 100) {
      const codes = invalidRepCustomerCodes.slice(offset, offset + 100);
      const { error } = await supabase
        .from("customers")
        .update({ sales_rep_name: null })
        .in("customer_code", codes);
      if (error) throw new Error(`Could not clear invalid representatives: ${error.message}`);
      cleanedCustomerReps += codes.length;
    }

    const { data: repRows, error: repRowsError } = await supabase
      .from("sales_reps")
      .select("id, name");
    if (repRowsError) throw new Error(repRowsError.message);

    const invalidRepIds = (repRows ?? [])
      .filter((rep) => isAmountLike(rep.name))
      .map((rep) => rep.id);
    if (invalidRepIds.length) {
      const { error } = await supabase
        .from("sales_reps")
        .delete()
        .in("id", invalidRepIds);
      if (error) throw new Error(`Could not remove invalid representatives: ${error.message}`);
      cleanedSalesReps = invalidRepIds.length;
    }

    const { error: statusError } = await supabase
      .from("dashboard_settings")
      .upsert(
        {
          key: "google_sheet_last_success",
          value: syncedAt,
          updated_at: syncedAt,
        },
        { onConflict: "key" }
      );

    if (statusError) throw new Error(statusError.message);
  }

  return {
    success: true,
    rowsRead: sheetRows.length,
    invoicesProcessed: combinedRows.rows.length - skippedIncomplete,
    duplicateRowsCombined: combinedRows.duplicateRowsCombined,
    inserted,
    updated,
    createdCustomers,
    creditNotes,
    debitNotes,
    deleted,
    deletionSkipped,
    deletionSkipReason,
    invalidRepValuesIgnored,
    cleanedCustomers,
    cleanedCustomerReps,
    cleanedSalesReps,
    skippedIncomplete,
    failed,
    syncedAt,
    lastSuccessfulSync: fullSyncSucceeded ? syncedAt : null,
  };
}

async function runSync() {
  try {
    return NextResponse.json(await syncInvoices());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Synchronization failed." },
      { status: 500 }
    );
  }
}

export async function POST() {
  return runSync();
}

export async function GET(request: Request) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runSync();
}
