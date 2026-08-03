import { createClient } from "@supabase/supabase-js";
import ReportsClient from "./ReportsClient";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function ReportsPage() {
  const [
    { data, error },
    { data: bonusReps, error: bonusRepsError },
    { data: salaryDeductions, error: salaryDeductionsError },
  ] = await Promise.all([
    supabase
      .from("sales_view")
      .select(
        "id, invoice_no, sales_date, month, customer_name, sales_rep, sales_item_total, tax, total_sales, document_type, original_invoice_no, note_reason, due_date"
      )
      .order("sales_date", { ascending: true }),
    supabase
      .from("sales_reps")
      .select(
        "id, name, bonus_type, bonus_percentage, secondary_bonus_percentage, fixed_monthly_bonus, monthly_salary"
      ),
    supabase
      .from("sales_rep_salary_deductions")
      .select("id, sales_rep_id, month, amount, reason"),
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
