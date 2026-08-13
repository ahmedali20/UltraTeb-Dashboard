import { createClient } from "@supabase/supabase-js";
import ReportsClient from "./ReportsClient";
import { getCurrentDashboardUser } from "../../lib/current-dashboard-user";
import { canViewPre2026Sales, NON_ADMIN_SALES_START_DATE } from "../../lib/sales-visibility";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

const REPORT_SALES_PAGE_SIZE = 1000;
const REPORT_SALES_COLUMNS =
  "id, invoice_no, sales_date, month, customer_name, sales_rep, sales_item_total, tax, total_sales, document_type, original_invoice_no, note_reason, due_date";

async function fetchAllReportSales(
  canViewHistoricalSales: boolean,
  repName: string | null
) {
  const rows: any[] = [];

  for (let from = 0; ; from += REPORT_SALES_PAGE_SIZE) {
    let query = supabase
      .from("sales_view")
      .select(REPORT_SALES_COLUMNS)
      .order("sales_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + REPORT_SALES_PAGE_SIZE - 1);

    if (!canViewHistoricalSales) {
      query = query.gte("sales_date", NON_ADMIN_SALES_START_DATE);
    }
    if (repName) query = query.eq("sales_rep", repName);

    const { data, error } = await query;
    if (error) return { data: null, error };

    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < REPORT_SALES_PAGE_SIZE) break;
  }

  return { data: rows, error: null };
}

export default async function ReportsPage() {
  const session = await getCurrentDashboardUser();
  const repName = session?.salesRepName ?? null;
  let repsQuery = supabase.from("sales_reps").select("id, name, bonus_type, bonus_percentage, secondary_bonus_percentage, fixed_monthly_bonus, monthly_salary");
  let deductionsQuery = supabase.from("sales_rep_salary_deductions").select("id, sales_rep_id, month, amount, reason");
  if (repName) {
    repsQuery = repsQuery.eq("name", repName);
    if (session?.salesRepId) deductionsQuery = deductionsQuery.eq("sales_rep_id", session.salesRepId);
  }
  const [
    { data, error },
    { data: bonusReps, error: bonusRepsError },
    { data: salaryDeductions, error: salaryDeductionsError },
  ] = await Promise.all([
    fetchAllReportSales(canViewPre2026Sales(session), repName),
    repsQuery,
    deductionsQuery,
  ]);

  if (error || bonusRepsError || salaryDeductionsError) {
    return (
      <main style={{ padding: 32 }}>
        <h1>Report Error</h1>
        <p style={{ color: "#dc2626" }}>
          {(error || bonusRepsError || salaryDeductionsError)?.message}
        </p>
      </main>
    );
  }

  return <ReportsClient sales={data ?? []} bonusReps={bonusReps ?? []} salaryDeductions={salaryDeductions ?? []} />;
}
