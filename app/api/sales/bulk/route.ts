import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { writeAuditLog } from "../../../../lib/audit-log";
import { readDashboardSession } from "../../../../lib/dashboard-auth";
import { NON_ADMIN_SALES_START_DATE } from "../../../../lib/sales-visibility";

const supabaseServer = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export async function POST(request: NextRequest) {
  const body = await request.json();
  const session = await readDashboardSession(request.cookies.get("ultra_teb_session")?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const rows: any[] = body.rows || [];

  let inserted = 0;
  const failed: { row: any; error: string }[] = [];

  for (const row of rows) {
    if (!row.invoice_no || !row.sales_date || !row.customer_code) {
      failed.push({ row, error: "Missing required field" });
      continue;
    }
    if (session.role !== "admin" && String(row.sales_date) < NON_ADMIN_SALES_START_DATE) {
      failed.push({ row, error: "Only Admin can upload invoices dated before 2026." });
      continue;
    }

    const { error } = await supabaseServer.from("sales").insert({
      invoice_no: String(row.invoice_no).trim(),
      sales_date: row.sales_date,
      customer_code: String(row.customer_code).trim(),
      sales_item_total: Number(row.sales_item_total) || 0,
      tax: Number(row.tax) || 0,
    });

    if (error) {
      failed.push({ row, error: error.message });
    } else {
      inserted++;
    }
  }

  await writeAuditLog(request, {
    action: "BULK_UPLOAD_SALES",
    entityType: "SALES",
    description: `Bulk upload completed: ${inserted} inserted, ${failed.length} failed.`,
    metadata: {
      inserted,
      failedCount: failed.length,
      failedRows: failed.map(({ row, error }) => ({
        invoiceNo: String(row?.invoice_no ?? "").trim() || null,
        salesDate: row?.sales_date ?? null,
        customerName: row?.customer_name ?? null,
        error,
      })),
    },
    success: failed.length === 0,
  });
  return NextResponse.json({ inserted, failed });
}
