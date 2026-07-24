import { createClient } from "@supabase/supabase-js";
import { createSign } from "crypto";
import { NextResponse } from "next/server";

const SPREADSHEET_ID = "13L05U9X3f4cerrzSQu6qQxSTrqY-b8jo4SVYZ9Vrcc4";
const SHEET_NAME = "Invoices Sales";

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

async function readSheet() {
  const token = await getGoogleAccessToken();
  const range = encodeURIComponent(`'${SHEET_NAME}'!A:Z`);
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
        ["invoice_no", "invoice_number", "invoice"].includes(header)
      ) &&
      normalized.some((header) =>
        ["sales_date", "invoice_date", "date"].includes(header)
      )
    );
  });

  if (headerRowIndex < 0) {
    throw new Error(
      "Header row not found. Add Invoice No and Sales Date headers to the sheet."
    );
  }

  const headers = values[headerRowIndex].map(normalizeHeader);
  return values.slice(headerRowIndex + 1).map((valuesRow) => {
    const mapped = Object.fromEntries(
      headers.map((header, index) => [header, String(valuesRow[index] ?? "")])
    ) as SheetRow;

    // The Invoices Sales sheet uses columns A:E in this order. Keep this
    // positional fallback so renamed or formatted headers cannot block sync.
    return {
      ...mapped,
      invoice_no:
        getValue(mapped, ["invoice_no", "invoice_number", "invoice"]) ||
        String(valuesRow[0] ?? ""),
      sales_date:
        getValue(mapped, ["sales_date", "invoice_date", "date"]) ||
        String(valuesRow[1] ?? ""),
      customer_name:
        getValue(mapped, [
          "customer_name",
          "customer",
          "hospital",
          "hospital_name",
        ]) || String(valuesRow[2] ?? ""),
      sales_item_total:
        getValue(mapped, [
          "sales_item_total",
          "item_total",
          "net_sales",
          "sales_total",
        ]) || String(valuesRow[3] ?? ""),
      tax:
        getValue(mapped, ["tax", "tax_value", "vat"]) ||
        String(valuesRow[4] ?? ""),
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

async function syncInvoices() {
  const sheetRows = await readSheet();
  const [{ data: customers, error: customersError }, { data: priorSales, error: salesError }] =
    await Promise.all([
      supabase
        .from("customers")
        .select("customer_code, customer_name, sales_rep_name"),
      supabase.from("sales_view").select("invoice_no, customer_code, customer_name"),
    ]);

  if (customersError) throw new Error(customersError.message);
  if (salesError) throw new Error(salesError.message);

  const customerList = [...(customers ?? [])];
  let inserted = 0;
  let updated = 0;
  let createdCustomers = 0;
  const failed: { row: number; invoice?: string; error: string }[] = [];

  for (let index = 0; index < sheetRows.length; index += 1) {
    const row = sheetRows[index];
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

    if (!invoiceNo && !salesDate && !customerName && !sourceCode) continue;
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
        row: index + 2,
        invoice: invoiceNo,
        error:
          invalidDate ||
          `Missing ${missing.join(", ")}.`,
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
        failed.push({ row: index + 2, invoice: invoiceNo, error: error.message });
        continue;
      }

      customer = created;
      customerList.push(created);
      createdCustomers += 1;
    }

    if (!customer) {
      failed.push({
        row: index + 2,
        invoice: invoiceNo,
        error: "Customer could not be matched.",
      });
      continue;
    }

    const payload = {
      invoice_no: invoiceNo,
      sales_date: salesDate,
      customer_code: customer.customer_code,
      sales_item_total: salesItemTotal,
      tax,
    };
    const existing = (priorSales ?? []).find(
      (sale) => String(sale.invoice_no).trim() === invoiceNo
    );

    const query = existing
      ? supabase.from("sales").update(payload).eq("invoice_no", invoiceNo)
      : supabase.from("sales").insert(payload);
    const { error } = await query;

    if (error) {
      failed.push({ row: index + 2, invoice: invoiceNo, error: error.message });
    } else if (existing) {
      updated += 1;
    } else {
      inserted += 1;
      priorSales?.push({
        invoice_no: invoiceNo,
        customer_code: customer.customer_code,
        customer_name: customer.customer_name,
      });
    }
  }

  return {
    success: true,
    rowsRead: sheetRows.length,
    inserted,
    updated,
    createdCustomers,
    failed,
    syncedAt: new Date().toISOString(),
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
