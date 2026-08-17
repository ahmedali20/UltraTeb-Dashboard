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
  const collectedAmount = Number(body.collectedAmount ?? 0);
  const rawAllocations: Record<string, unknown>[] = Array.isArray(body.allocations) ? body.allocations : [];
  const allocations = rawAllocations.map((item) => ({ documentId: String(item.documentId ?? "").trim(), amount: Number(item.amount ?? 0) })).filter((item) => item.documentId && Number.isFinite(item.amount) && item.amount > 0);
  const documentIds: string[] = Array.from(new Set(allocations.map((item) => item.documentId)));
  const allocatedTotal = allocations.reduce((sum, item) => sum + item.amount, 0);
  if (!customerName || !/^\d{4}-\d{2}-\d{2}$/.test(collectionDate) || !documentIds.length) return NextResponse.json({ error: "Customer, collection date, and at least one document allocation are required." }, { status: 400 });
  if (!Number.isFinite(collectedAmount) || collectedAmount <= 0 || allocatedTotal > collectedAmount + 0.01) return NextResponse.json({ error: "Invoice allocations cannot exceed the collected WHT amount." }, { status: 400 });

  let query = supabase.from("sales_view").select("id, invoice_no, customer_name, sales_date, sales_item_total, tax, sales_rep, document_type").in("document_type", ["INVOICE", "DR_NOTE"]).eq("customer_name", customerName).in("id", documentIds);
  if (session.salesRepName) query = query.eq("sales_rep", session.salesRepName);
  if (session.role !== "admin") query = query.gte("sales_date", NON_ADMIN_SALES_START_DATE);
  const { data: invoices, error: invoiceError } = await query;
  if (invoiceError) return NextResponse.json({ error: invoiceError.message }, { status: 400 });
  if ((invoices ?? []).length !== documentIds.length) return NextResponse.json({ error: "One or more documents are unavailable or belong to another customer." }, { status: 400 });

  const invoiceById = new Map((invoices ?? []).map((invoice) => [String(invoice.id), invoice]));
  const excessiveAllocation = allocations.find((allocation) => {
    const invoice = invoiceById.get(allocation.documentId);
    const expectedWht = Math.round(Number(invoice?.sales_item_total || 0) * 0.01 * 100) / 100;
    return allocation.amount > expectedWht + 0.01;
  });
  if (excessiveAllocation) return NextResponse.json({ error: "A document allocation exceeds its expected WHT." }, { status: 400 });

  const { data: existing } = await supabase.from("wht_collections").select("sales_id, invoice_no, document_type").in("sales_id", documentIds);
  if (existing?.length) return NextResponse.json({ error: `WHT already exists for: ${existing.map((item) => `${item.document_type === "DR_NOTE" ? "DR Note" : "Invoice"} ${item.invoice_no}`).join(", ")}.` }, { status: 400 });
  const groupId = crypto.randomUUID();
  const unallocatedAmount = Math.max(0, Math.round((collectedAmount - allocatedTotal) * 100) / 100);
  const { error: groupError } = await supabase.from("wht_collection_groups").insert({ id: groupId, customer_name: customerName, certificate_no: certificateNo || null, collection_date: collectionDate, collected_amount: collectedAmount, allocated_amount: allocatedTotal, unallocated_amount: unallocatedAmount });
  if (groupError) return NextResponse.json({ error: groupError.message }, { status: 400 });
  const allocationMap = new Map(allocations.map((item) => [item.documentId, item.amount]));
  const rows = (invoices ?? []).map((invoice) => {
    const subtotal = Number(invoice.sales_item_total || 0);
    const allocation = Number(allocationMap.get(String(invoice.id)) || 0);
    return { sales_id: String(invoice.id), document_type: invoice.document_type, customer_name: customerName, invoice_no: String(invoice.invoice_no), invoice_date: invoice.sales_date, subtotal, tax: Number(invoice.tax || 0), wht_rate: 1, collected_amount: allocation, collection_date: collectionDate, wht_group_id: groupId, certificate_no: certificateNo || null };
  });
  const { data: created, error } = await supabase.from("wht_collections").insert(rows).select("*");
  if (error) {
    await supabase.from("wht_collection_groups").delete().eq("id", groupId);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  await writeAuditLog(request, { action: "CREATE_WHT_GROUP", entityType: "WHT", entityId: groupId, description: `Added grouped WHT${certificateNo ? ` certificate ${certificateNo}` : ""} for ${rows.length} invoices.`, metadata: { customerName, certificateNo: certificateNo || null, collectionDate, collectedAmount, allocations, records: created } });
  return NextResponse.json({ data: created, groupId, unallocatedAmount });
}
