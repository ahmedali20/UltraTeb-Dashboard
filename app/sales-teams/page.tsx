import { createClient } from "@supabase/supabase-js";
import SalesTeamsClient from "./SalesTeamsClient";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function SalesTeamsPage() {
  const [
    { data: teams, error: teamsError },
    { data: reps, error: repsError },
    { data: sales, error: salesError },
  ] = await Promise.all([
    supabase
      .from("sales_teams")
      .select("id, name, leader_rep_id")
      .order("name"),
    supabase
      .from("sales_reps")
      .select(
        "id, name, team_id, bonus_type, bonus_percentage, secondary_bonus_percentage, fixed_monthly_bonus"
      )
      .order("name"),
    supabase
      .from("sales_view")
      .select("id, month, sales_rep, total_sales, document_type"),
  ]);

  const error = teamsError || repsError || salesError;
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
    />
  );
}
