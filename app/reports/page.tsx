import { createClient } from "@supabase/supabase-js";
import ReportsClient from "./ReportsClient";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function ReportsPage() {
  const { data, error } = await supabase
    .from("sales_view")
    .select(
      "id, invoice_no, sales_date, month, customer_name, sales_rep, sales_item_total, tax, total_sales, document_type, original_invoice_no, note_reason"
    )
    .order("sales_date", { ascending: true });

  if (error) {
    return (
      <main style={{ padding: 32 }}>
        <h1>Report Error</h1>
        <p style={{ color: "#dc2626" }}>{error.message}</p>
      </main>
    );
  }

  return <ReportsClient sales={data ?? []} />;
}
