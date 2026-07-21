import { createClient } from "@supabase/supabase-js";
import SalesTable from "./SalesTable";

const supabaseServer = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function SalesPage() {
  const { data: sales, error } = await supabaseServer
    .from("sales_view")
    .select("*")
    .order("sales_date", { ascending: false });

  if (error) {
    return (
      <main style={{ padding: 32 }}>
        <h1>Error Loading Data</h1>
        <p style={{ color: "red" }}>{error.message}</p>
      </main>
    );
  }

  return <SalesTable sales={sales ?? []} />;
}
