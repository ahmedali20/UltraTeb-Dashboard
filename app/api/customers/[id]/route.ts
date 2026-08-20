import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { writeAuditLog } from "../../../../lib/audit-log";

const supabaseServer = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

function isAmountLike(value: unknown) {
  const raw = String(value ?? "").trim();
  const normalized = raw
    .replace(/[\s,\u00a0]/g, "")
    .replace(/^\((.*)\)$/, "-$1");
  return /[.,()]/.test(raw) && /^-?\d+(?:\.\d+)?$/.test(normalized);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  if (isAmountLike(body.customer_name)) {
    return NextResponse.json(
      { error: "A customer name cannot be a numeric amount." },
      { status: 400 }
    );
  }
  if (body.sales_rep_name && isAmountLike(body.sales_rep_name)) {
    return NextResponse.json(
      { error: "A sales representative name cannot be a numeric amount." },
      { status: 400 }
    );
  }

  const { data: before } = await supabaseServer
    .from("customers")
    .select("customer_name, customer_official_name, payment_terms_days, customer_trn, customer_address, sales_rep_name, credit_limit")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabaseServer
    .from("customers")
    .update({
      customer_name: body.customer_name,
      customer_official_name: body.customer_official_name || null,
      payment_terms_days: body.payment_terms_days
        ? Number(body.payment_terms_days)
        : null,
      customer_trn: body.customer_trn || null,
      customer_address: body.customer_address || null,
      sales_rep_name: body.sales_rep_name || null,
      credit_limit: body.credit_limit ? Number(body.credit_limit) : 0,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeAuditLog(request, {
    action: "UPDATE_CUSTOMER",
    entityType: "CUSTOMER",
    entityId: id,
    description: `Updated customer ${data.customer_name}.`,
    metadata: {
      before,
      after: {
        customer_name: data.customer_name,
        customer_official_name: data.customer_official_name,
        payment_terms_days: data.payment_terms_days,
        customer_trn: data.customer_trn,
        customer_address: data.customer_address,
        sales_rep_name: data.sales_rep_name,
        credit_limit: data.credit_limit,
      },
    },
  });
  return NextResponse.json({ data });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data: deletedRecord } = await supabaseServer
    .from("customers")
    .select("customer_name, customer_official_name, payment_terms_days, customer_trn, customer_address, sales_rep_name, credit_limit")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabaseServer
    .from("customers")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await writeAuditLog(request, {
    action: "DELETE_CUSTOMER",
    entityType: "CUSTOMER",
    entityId: id,
    description: `Deleted customer ${deletedRecord?.customer_name ?? id}.`,
    metadata: { deletedRecord },
  });
  return NextResponse.json({ success: true });
}
