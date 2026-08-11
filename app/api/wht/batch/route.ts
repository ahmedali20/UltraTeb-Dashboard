import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readDashboardSession } from "../../../../lib/dashboard-auth";
import { hasDashboardPermission } from "../../../../lib/dashboard-permissions";
import { writeAuditLog } from "../../../../lib/audit-log";
import { NON_ADMIN_SALES_START_DATE } from "../../../../lib/sales-visibility";

const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } });

export async function POST(request: NextRequest) {
  const session = await readDashboardSession(request.cookies.get("ultra_teb_session")?.value);
  if (!session || !hasDashboardPermission(session, "wht", "edit")) return NextResponse.json({ error: "WHT edit permission required." }, { status: 403 });
  const body = await request.json();
  const customerName = String(body.customerName ?? "").trim();
  const certificateNo = String(body.certificateNo ?? "").trim();
  const collectionDate = String(body.collectionDate ?? "").trim();
  const invoiceNumbers: string[] = Array.from(new Set((Array.isArray(body.invoiceNumbers) ? body.invoiceNumbers : []).map((value: unknown) => String(value).trim()).filter(Boolean)));
  if (!customerName || !certificateNo || !/^\d{4}-\d{2}-\d{2}$/.test(collectionDate) || !invoiceNumbers.length) return NextResponse.json({ error: "Customer, certificate number, collection date, and at least one invoice are required." }, { status: 400 });

  let query = supabase.from("sales_view").select("invoice_no, customer_name, sales_date, sales_item_total, tax, sales_rep").eq("document_type", "INVOICE").eq("customer_name", customerName).in("invoice_no", invoiceNumbers);
  if (session.salesRepName) query = query.eq("sales_rep", session.salesRepName);
  if (session.role !== "admin") query = query.gte("sales_date", NON_ADMIN_SALES_START_DATE);
  const { data: invoices, error: invoiceError } = await query;
  if (invoiceError) return NextResponse.json({ error: invoiceError.message }, { status: 400 });
  if ((invoices ?? []).length !== invoiceNumbers.length) return NextResponse.json({ error: "One or more invoices are unavailable, duplicated, or belong to another customer." }, { status: 400 });

  const { data: existing } = await supabase.from("wht_collections").select("invoice_no").in("invoice_no", invoiceNumbers);
  if (existing?.length) return NextResponse.json({ error: `WHT already exists for invoice(s): ${existing.map((item) => item.invoice_no).join(", ")}.` }, { status: 400 });
  const groupId = crypto.randomUUID();
  const rows = (invoices ?? []).map((invoice) => {
    const subtotal = Number(invoice.sales_item_total || 0);
    return { customer_name: customerName, invoice_no: String(invoice.invoice_no), invoice_date: invoice.sales_date, subtotal, tax: Number(invoice.tax || 0), wht_rate: 1, collected_amount: Math.round(subtotal * 0.01 * 100) / 100, collection_date: collectionDate, wht_group_id: groupId, certificate_no: certificateNo };
  });
  const { data: created, error } = await supabase.from("wht_collections").insert(rows).select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAuditLog(request, { action: "CREATE_WHT_GROUP", entityType: "WHT", entityId: groupId, description: `Added WHT certificate ${certificateNo} for ${rows.length} invoices.`, metadata: { customerName, certificateNo, collectionDate, invoiceNumbers, records: created } });
  return NextResponse.json({ data: created, groupId });
}
