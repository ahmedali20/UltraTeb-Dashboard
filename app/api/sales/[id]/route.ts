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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json();
  const session = await readDashboardSession(request.cookies.get("ultra_teb_session")?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const documentType =
    body.document_type === "CR_NOTE" || body.document_type === "DR_NOTE"
      ? body.document_type
      : "INVOICE";

  if (!body.sales_rep_name) {
    return NextResponse.json(
      { error: "Sales representative is required." },
      { status: 400 }
    );
  }
  if (
    documentType !== "INVOICE" &&
    (!String(body.original_invoice_no ?? "").trim() ||
      !String(body.note_reason ?? "").trim())
  ) {
    return NextResponse.json(
      { error: "Original invoice number and reason are required for notes." },
      { status: 400 }
    );
  }

  const sign = documentType === "CR_NOTE" ? -1 : 1;
  const itemTotal = Math.abs(Number(body.sales_item_total) || 0);
  const tax = Math.abs(Number(body.tax) || 0);

  const { data: before } = await supabaseServer
    .from("sales")
    .select("invoice_no, sales_date, due_date, sales_item_total, tax, document_type, original_invoice_no, note_reason")
    .eq("id", params.id)
    .maybeSingle();
  if (session.role !== "admin" && (String(before?.sales_date ?? "") < NON_ADMIN_SALES_START_DATE || String(body.sales_date ?? "") < NON_ADMIN_SALES_START_DATE)) {
    return NextResponse.json({ error: "Only Admin can edit invoices dated before 2026." }, { status: 403 });
  }

  const { data: customerBefore } = await supabaseServer
    .from("customers")
    .select("sales_rep_name")
    .eq("customer_code", body.customer_code)
    .maybeSingle();

  const { error: customerError } = await supabaseServer
    .from("customers")
    .update({ sales_rep_name: body.sales_rep_name })
    .eq("customer_code", body.customer_code);

  if (customerError) {
    return NextResponse.json(
      { error: customerError.message },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseServer
    .from("sales")
    .update({
      invoice_no: body.invoice_no,
      sales_date: body.sales_date,
      due_date: body.due_date || null,
      customer_code: body.customer_code,
      sales_item_total: sign * itemTotal,
      tax: sign * tax,
      source_total_sales: sign * Math.round((itemTotal + tax) * 100) / 100,
      sales_rep_name: String(body.sales_rep_name).trim(),
      document_type: documentType,
      original_invoice_no:
        documentType === "INVOICE"
          ? null
          : String(body.original_invoice_no).trim(),
      note_reason:
        documentType === "INVOICE" ? null : String(body.note_reason).trim(),
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const after = {
    invoice_no: data.invoice_no,
    sales_date: data.sales_date,
    due_date: data.due_date,
    sales_item_total: data.sales_item_total,
    tax: data.tax,
    document_type: data.document_type,
    original_invoice_no: data.original_invoice_no,
    note_reason: data.note_reason,
  };
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const oldValues = (before ?? {}) as Record<string, unknown>;
  for (const [field, newValue] of Object.entries(after)) {
    const oldValue = oldValues[field];
    if (String(oldValue ?? "") !== String(newValue ?? "")) {
      changes[field] = { from: oldValue ?? null, to: newValue ?? null };
    }
  }
  if (
    String(customerBefore?.sales_rep_name ?? "") !==
    String(body.sales_rep_name ?? "")
  ) {
    changes.sales_rep_name = {
      from: customerBefore?.sales_rep_name ?? null,
      to: body.sales_rep_name,
    };
  }

  await writeAuditLog(request, {
    action: "UPDATE_SALES_RECORD",
    entityType: documentType,
    entityId: params.id,
    description: `Updated ${documentType.toLowerCase().replace("_", " ")} ${data.invoice_no}.`,
    metadata: { changes },
  });
  return NextResponse.json({ data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await readDashboardSession(request.cookies.get("ultra_teb_session")?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { data: deletedRecord } = await supabaseServer
    .from("sales")
    .select("invoice_no, sales_date, due_date, sales_item_total, tax, document_type, original_invoice_no, note_reason")
    .eq("id", params.id)
    .maybeSingle();
  if (session.role !== "admin" && String(deletedRecord?.sales_date ?? "") < NON_ADMIN_SALES_START_DATE) {
    return NextResponse.json({ error: "Only Admin can delete invoices dated before 2026." }, { status: 403 });
  }
  const { error } = await supabaseServer
    .from("sales")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeAuditLog(request, {
    action: "DELETE_SALES_RECORD",
    entityType: "SALES",
    entityId: params.id,
    description: `Deleted sales record ${deletedRecord?.invoice_no ?? params.id}.`,
    metadata: { deletedRecord },
  });
  return NextResponse.json({ success: true });
}
