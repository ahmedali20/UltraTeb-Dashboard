import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseServer = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export async function POST(request: Request) {
  const body = await request.json();

  const { data: existingCustomers, error: codesError } = await supabaseServer
    .from("customers")
    .select("customer_code");

  if (codesError) {
    return NextResponse.json({ error: codesError.message }, { status: 400 });
  }

  const usedNumbers = new Set(
    (existingCustomers ?? [])
      .map((customer) => {
        const match = /^CUST(\d+)$/i.exec(customer.customer_code ?? "");
        return match ? Number(match[1]) : null;
      })
      .filter((value): value is number => value !== null)
  );

  let nextNumber = 1;
  while (usedNumbers.has(nextNumber)) nextNumber += 1;
  const customerCode = `CUST${String(nextNumber).padStart(3, "0")}`;

  const { data, error } = await supabaseServer
    .from("customers")
    .insert({
      customer_code: customerCode,
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
