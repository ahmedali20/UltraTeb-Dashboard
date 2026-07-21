import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseServer = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export async function POST(request: Request) {
  const body = await request.json();

  const { data, error } = await supabaseServer
    .from("customers")
    .insert({
      customer_name: body.customer_name,
      customer_official_name: body.customer_official_name || null,
      payment_terms_days: body.payment_terms_days
        ? Number(body.payment_terms_days)
        : null,
      customer_trn: body.customer_trn || null,
      sales_rep_name: body.sales_rep_name || null,
      credit_limit: body.credit_limit ? Number(body.credit_limit) : 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
