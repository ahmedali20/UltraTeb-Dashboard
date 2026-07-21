import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseServer = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export async function POST(request: Request) {
  const body = await request.json();
  const rows: any[] = body.rows || [];

  let inserted = 0;
  const failed: { row: any; error: string }[] = [];

  for (const row of rows) {
    if (!row.invoice_no || !row.sales_date || !row.customer_code) {
      failed.push({ row, error: "Missing required field" });
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

  return NextResponse.json({ inserted, failed });
}
