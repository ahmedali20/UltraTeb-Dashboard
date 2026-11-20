import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readDashboardSession } from "../../../lib/dashboard-auth";
import { hasDashboardPermission } from "../../../lib/dashboard-permissions";
import { writeAuditLog } from "../../../lib/audit-log";

const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } });

async function canEdit(request: NextRequest) {
  const session = await readDashboardSession(request.cookies.get("ultra_teb_session")?.value);
  return Boolean(session && hasDashboardPermission(session, "bonusItems", "edit"));
}

function values(body: Record<string, unknown>) {
  return {
    received_date: String(body.receivedDate ?? "").trim(),
    supplier_name: String(body.supplierName ?? "").trim() || null,
    item_code: String(body.itemCode ?? "").trim(),
    product_name: String(body.productName ?? "").trim(),
    quantity: Number(body.quantity ?? 0),
    estimated_unit_cost: Number(body.estimatedUnitCost ?? 0),
    reference_no: String(body.referenceNo ?? "").trim() || null,
    notes: String(body.notes ?? "").trim() || null,
    updated_at: new Date().toISOString(),
  };
}

function validate(data: ReturnType<typeof values>) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.received_date)) return "Received date is required.";
  if (!data.item_code) return "Item code is required.";
  if (!data.product_name) return "Product name is required.";
  if (!Number.isFinite(data.quantity) || data.quantity <= 0) return "Quantity must be greater than zero.";
  if (!Number.isFinite(data.estimated_unit_cost) || data.estimated_unit_cost < 0) return "Estimated unit cost cannot be negative.";
  return null;
}

export async function POST(request: NextRequest) {
  if (!(await canEdit(request))) return NextResponse.json({ error: "Edit permission required." }, { status: 403 });
  const data = values(await request.json());
  const error = validate(data);
  if (error) return NextResponse.json({ error }, { status: 400 });
  const result = await supabase.from("bonus_items").insert(data).select("*").single();
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  await writeAuditLog(request, { action: "CREATE_BONUS_ITEM", entityType: "BONUS_ITEM", entityId: result.data.id, description: `Received ${result.data.quantity} free units of ${result.data.product_name}.`, metadata: { after: result.data } });
  return NextResponse.json({ data: result.data });
}

export async function PATCH(request: NextRequest) {
  if (!(await canEdit(request))) return NextResponse.json({ error: "Edit permission required." }, { status: 403 });
  const body = await request.json();
  const id = Number(body.id);
  const data = values(body);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid record." }, { status: 400 });
  const error = validate(data);
  if (error) return NextResponse.json({ error }, { status: 400 });
  const { data: before } = await supabase.from("bonus_items").select("*").eq("id", id).maybeSingle();
  const result = await supabase.from("bonus_items").update(data).eq("id", id).select("*").single();
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  await writeAuditLog(request, { action: "UPDATE_BONUS_ITEM", entityType: "BONUS_ITEM", entityId: id, description: `Updated free item ${result.data.product_name}.`, metadata: { before, after: result.data } });
  return NextResponse.json({ data: result.data });
}

export async function DELETE(request: NextRequest) {
  if (!(await canEdit(request))) return NextResponse.json({ error: "Edit permission required." }, { status: 403 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid record." }, { status: 400 });
  const { data: before } = await supabase.from("bonus_items").select("*").eq("id", id).maybeSingle();
  const { error } = await supabase.from("bonus_items").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await writeAuditLog(request, { action: "DELETE_BONUS_ITEM", entityType: "BONUS_ITEM", entityId: id, description: `Deleted free item ${before?.product_name ?? id}.`, metadata: { before } });
  return NextResponse.json({ success: true });
}
