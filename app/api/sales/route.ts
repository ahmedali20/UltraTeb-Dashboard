import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { writeAuditLog } from "../../../lib/audit-log";

const supabaseServer = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export async function POST(request: Request) {
  const body = await request.json();
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
    .insert({
      invoice_no: body.invoice_no,
      sales_date: body.sales_date,
      customer_code: body.customer_code,
      sales_item_total:
        sign * Math.abs(Number(body.sales_item_total) || 0),
      tax: sign * Math.abs(Number(body.tax) || 0),
      document_type: documentType,
      original_invoice_no:
        documentType === "INVOICE"
          ? null
          : String(body.original_invoice_no).trim(),
      note_reason:
        documentType === "INVOICE" ? null : String(body.note_reason).trim(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeAuditLog(request, {
    action: "CREATE_SALES_RECORD",
    entityType: documentType,
    entityId: data.id,
    description: `Created ${documentType.toLowerCase().replace("_", " ")} ${data.invoice_no}.`,
  });
  return NextResponse.json({ data });
}

export async function DELETE(request: Request) {
  const { error } = await supabaseServer
    .from("sales")
    .delete()
    .not("id", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeAuditLog(request, {
    action: "DELETE_ALL_SALES",
    entityType: "SALES",
    description: "Deleted all sales records.",
  });
  return NextResponse.json({ success: true });
}
