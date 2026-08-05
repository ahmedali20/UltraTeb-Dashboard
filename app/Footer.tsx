import { createClient } from "@supabase/supabase-js";
import CustomersTable from "../CustomersTable";
import { getCurrentDashboardUser } from "../../lib/current-dashboard-user";

const supabaseServer = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function CustomersPage() {
  const session = await getCurrentDashboardUser();
  const repName = session?.salesRepName ?? null;
  let customersQuery = supabaseServer.from("customers").select("*").order("customer_code", { ascending: true });
  let repsQuery = supabaseServer.from("sales_reps").select("name").order("name", { ascending: true });
  let invoiceLinksQuery = supabaseServer.from("sales").select("customer_code, document_type");
  if (repName) {
    customersQuery = customersQuery.eq("sales_rep_name", repName);
    repsQuery = repsQuery.eq("name", repName);
    invoiceLinksQuery = invoiceLinksQuery.eq("sales_rep", repName);
  }
  const [
    { data: customers, error },
    { data: salesReps, error: repsError },
    { data: invoiceLinks, error: invoiceLinksError },
  ] = await Promise.all([
    customersQuery,
    repsQuery,
    invoiceLinksQuery,
  ]);

  if (error || repsError || invoiceLinksError) {
    return (
      <main style={{ padding: 32 }}>
        <h1>Error Loading Data</h1>
        <p style={{ color: "red" }}>{(error || repsError || invoiceLinksError)?.message}</p>
      </main>
    );
  }

  return (
    <CustomersTable
      customers={customers ?? []}
      salesReps={(salesReps ?? []).map((rep) => rep.name)}
      invoiceCustomerCodes={Array.from(
        new Set(
          (invoiceLinks ?? [])
            .filter((sale) => !sale.document_type || sale.document_type === "INVOICE")
            .map((sale) => sale.customer_code)
            .filter((code): code is string => Boolean(code))
        )
      )}
    />
  );
}
