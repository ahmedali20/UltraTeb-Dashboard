import { createClient } from "@supabase/supabase-js";
import IncomeStatementDataClient from "./IncomeStatementDataClient";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function IncomeStatementDataPage() {
  const { data, error } = await supabase
    .from("income_statement_entries")
    .select("*")
    .order("entry_month", { ascending: false })
    .order("id", { ascending: false });

  if (error) {
    return <main style={{ padding: 32, color: "red" }}>{error.message}<p>Run `supabase/income_statement_entries.sql` in Supabase SQL Editor first.</p></main>;
  }

  return <IncomeStatementDataClient initialEntries={data ?? []} />;
}
