import { createClient } from "@supabase/supabase-js";
import WhtClient from "./WhtClient";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function WhtPage() {
  const [
    { data: customers, error: customersError },
    { data: records, error: recordsError },
    { data: invoices, error: invoicesError },
  ] =
    await Promise.all([
      supabase.from("customers").select("customer_name").order("customer_name"),
      supabase.from("wht_collections").select("*").order("invoice_date", { ascending: false }),
      supabase
        .from("sales_view")
        .select("invoice_no, customer_name, sales_date, sales_item_total, tax")
        .eq("document_type", "INVOICE")
        .order("sales_date", { ascending: false }),
    ]);

  const error = customersError || recordsError || invoicesError;
  if (error) {
    return <main style={{ padding: 32, color: "#dc2626" }}>{error.message}</main>;
  }

  return (
    <WhtClient
      customers={Array.from(new Set((customers ?? []).map((item) => item.customer_name).filter(Boolean)))}
      initialRecords={records ?? []}
      invoices={invoices ?? []}
    />
  );
}
