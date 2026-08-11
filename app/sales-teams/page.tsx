import { createClient } from "@supabase/supabase-js";
import SalesTeamsClient from "./SalesTeamsClient";
import { getCurrentDashboardUser } from "../../lib/current-dashboard-user";
import { canViewPre2026Sales, NON_ADMIN_SALES_START_DATE } from "../../lib/sales-visibility";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function SalesTeamsPage() {
  const session = await getCurrentDashboardUser();
  let salesQuery = supabase
    .from("sales_view")
    .select("id, month, sales_rep, total_sales, document_type");
  if (!canViewPre2026Sales(session)) salesQuery = salesQuery.gte("sales_date", NON_ADMIN_SALES_START_DATE);
  const [
    { data: teams, error: teamsError },
    { data: reps, error: repsError },
    { data: sales, error: salesError },
    { data: deductions, error: deductionsError },
  ] = await Promise.all([
    supabase
      .from("sales_teams")
      .select("id, name, leader_rep_id")
      .order("name"),
    supabase
      .from("sales_reps")
      .select(
        "id, name, team_id, bonus_type, bonus_percentage, secondary_bonus_percentage, fixed_monthly_bonus, monthly_salary"
      )
      .order("name"),
    salesQuery,
    supabase
      .from("sales_rep_salary_deductions")
      .select("id, sales_rep_id, month, amount, reason")
      .order("id", { ascending: true }),
  ]);

  const error = teamsError || repsError || salesError || deductionsError;
  if (error) {
    return (
      <main style={{ padding: 32, color: "red" }}>
        {error.message}
        {error.message.includes("sales_teams") && (
          <p>Run `supabase/sales_teams.sql` in Supabase SQL Editor first.</p>
        )}
      </main>
    );
  }

  return (
    <SalesTeamsClient
      teams={teams ?? []}
      reps={reps ?? []}
      sales={sales ?? []}
      deductions={deductions ?? []}
    />
  );
}
