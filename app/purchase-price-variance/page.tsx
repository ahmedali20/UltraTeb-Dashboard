import { createClient } from "@supabase/supabase-js";
import PurchasePriceVarianceClient from "./PurchasePriceVarianceClient";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function PurchasePriceVariancePage() {
  const { data, error } = await supabase
    .from("purchase_price_variances")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return <main style={{ padding: 32, color: "red" }}>{error.message}<p>Run `supabase/purchase_price_variances.sql` in Supabase SQL Editor first.</p></main>;
  }

  const invoiceNumbers = Array.from(new Set(
    (data ?? []).flatMap((row) => (row.invoice_numbers ?? []).map((value: string) => String(value).trim())).filter(Boolean)
  ));
  const invoiceDates: Record<string, string> = {};

  for (let index = 0; index < invoiceNumbers.length; index += 200) {
    const { data: invoices, error: invoicesError } = await supabase
      .from("sales_view")
      .select("invoice_no, sales_date")
      .eq("document_type", "INVOICE")
      .in("invoice_no", invoiceNumbers.slice(index, index + 200));

    if (invoicesError) {
      return <main style={{ padding: 32, color: "red" }}>{invoicesError.message}</main>;
    }
    for (const invoice of invoices ?? []) {
      if (invoice.invoice_no && invoice.sales_date) invoiceDates[String(invoice.invoice_no).trim()] = invoice.sales_date;
    }
  }

  return <PurchasePriceVarianceClient initialRows={data ?? []} invoiceDates={invoiceDates} />;
}
