import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseServer = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

function isAmountLike(value: unknown) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/,/g, "")
    .replace(/^\((.*)\)$/, "-$1");
  return normalized !== "" && /^-?\d+(?:\.\d+)?$/.test(normalized);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
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

  const { data, error } = await supabaseServer
    .from("customers")
    .update({
      customer_name: body.customer_name,
      customer_official_name: body.customer_official_name || null,
      payment_terms_days: body.payment_terms_days
        ? Number(body.payment_terms_days)
        : null,
      customer_trn: body.customer_trn || null,
      sales_rep_name: body.sales_rep_name || null,
      credit_limit: body.credit_limit ? Number(body.credit_limit) : 0,
    })
    .eq("id", params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { error } = await supabaseServer
    .from("customers")
    .delete()
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
