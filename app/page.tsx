import { createClient } from "@supabase/supabase-js";
import HomeClient from "./HomeClient";

const supabaseServer = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function HomePage() {
  const [
    { data: sales, error: salesError },
    { count: customerCount, error: customersError },
  ] = await Promise.all([
    supabaseServer
      .from("sales_view")
      .select(
        "id, invoice_no, sales_date, customer_code, customer_name, sales_item_total, tax, total_sales"
      )
      .order("sales_date", { ascending: false }),
    supabaseServer
      .from("customers")
      .select("*", { count: "exact", head: true }),
  ]);

  const error = salesError || customersError;

  if (error) {
    return (
      <main style={{ padding: 32 }}>
        <h1>Error Loading Dashboard</h1>
        <p style={{ color: "red" }}>{error.message}</p>
      </main>
    );
  }

  return (
    <HomeClient
      sales={sales ?? []}
      customerCount={customerCount ?? 0}
    />
  );
}
