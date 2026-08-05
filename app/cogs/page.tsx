import { createClient } from "@supabase/supabase-js";
import CogsClient from "./CogsClient";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function CogsPage() {
  const { data, error } = await supabase
    .from("invoice_cogs")
    .select("id, customer_name, invoice_no, document_type, original_invoice_no, sales_date, month, cogs_subtotal, cogs_vat, total, updated_at")
    .order("sales_date", { ascending: false })
    .order("invoice_no", { ascending: false });

  if (error) {
    return <main style={{ padding: 32, color: "#dc2626" }}>COGS Error: {error.message}</main>;
  }
  return <CogsClient records={data ?? []} />;
}
