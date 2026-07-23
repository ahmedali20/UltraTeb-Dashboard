import { createClient } from "@supabase/supabase-js";
import SalesRepsClient from "./SalesRepsClient";

const supabaseServer = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function SalesRepsPage() {
  const { data, error } = await supabaseServer
    .from("sales_view")
    .select(
      "id, invoice_no, sales_date, month, sales_rep, customer_name, sales_item_total, tax, total_sales"
    )
    .order("sales_date", { ascending: false });

  if (error) {
    return <main style={{ padding: 32, color: "red" }}>{error.message}</main>;
  }

  return <SalesRepsClient sales={data ?? []} />;
}
