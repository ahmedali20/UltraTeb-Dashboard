import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readDashboardSession } from "../../../../lib/dashboard-auth";
import { writeAuditLog } from "../../../../lib/audit-log";
import { hasDashboardPermission } from "../../../../lib/dashboard-permissions";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export async function PATCH(request: NextRequest) {
  const session = await readDashboardSession(
    request.cookies.get("ultra_teb_session")?.value
  );
  if (!session || !hasDashboardPermission(session, "teams", "edit")) {
    return NextResponse.json({ error: "Edit permission required." }, { status: 403 });
  }

  const body = await request.json();
  const id = Number(body.id);
  const allowedBonusTypes = [
    "PERCENTAGE",
    "FIXED_MONTHLY",
    "DUAL_PERCENTAGE",
    "TIERED_EXCESS",
  ];
  const bonusType = allowedBonusTypes.includes(body.bonusType)
    ? body.bonusType
    : "PERCENTAGE";
  const bonusPercentage = Number(body.bonusPercentage ?? 0);
  const secondaryBonusPercentage = Number(
    body.secondaryBonusPercentage ?? 0
  );
  const fixedMonthlyBonus = Number(body.fixedMonthlyBonus ?? 0);
  const monthlySalary = Number(body.monthlySalary ?? 0);
  const deductionMonth = String(body.deductionMonth ?? "").trim();
  const salaryDeduction = Number(body.salaryDeduction ?? 0);
  const deductionReason = String(body.deductionReason ?? "").trim();

  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "A valid sales representative is required." },
      { status: 400 }
    );
  }
  if (
    !Number.isFinite(bonusPercentage) ||
    bonusPercentage < 0 ||
    bonusPercentage > 100
  ) {
    return NextResponse.json(
      { error: "Bonus percentage must be between 0 and 100." },
      { status: 400 }
    );
  }
  if (
    !Number.isFinite(secondaryBonusPercentage) ||
    secondaryBonusPercentage < 0 ||
    secondaryBonusPercentage > 100
  ) {
    return NextResponse.json(
      { error: "Secondary bonus percentage must be between 0 and 100." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(fixedMonthlyBonus) || fixedMonthlyBonus < 0) {
    return NextResponse.json(
      { error: "Fixed monthly bonus cannot be negative." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(monthlySalary) || monthlySalary < 0) {
    return NextResponse.json(
      { error: "Monthly salary cannot be negative." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(salaryDeduction) || salaryDeduction < 0) {
    return NextResponse.json(
      { error: "Salary deduction cannot be negative." },
      { status: 400 }
    );
  }

  const { data: before } = await supabase
    .from("sales_reps")
    .select("bonus_type, bonus_percentage, secondary_bonus_percentage, fixed_monthly_bonus, monthly_salary")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("sales_reps")
    .update({
      bonus_type: bonusType,
      bonus_percentage: bonusPercentage,
      secondary_bonus_percentage: secondaryBonusPercentage,
      fixed_monthly_bonus: fixedMonthlyBonus,
      monthly_salary: monthlySalary,
    })
    .eq("id", id)
    .select(
      "id, name, bonus_type, bonus_percentage, secondary_bonus_percentage, fixed_monthly_bonus, monthly_salary"
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (deductionMonth && deductionMonth !== "All") {
    const { error: deductionError } = await supabase
      .from("sales_rep_salary_deductions")
      .upsert(
        {
          sales_rep_id: id,
          month: deductionMonth,
          amount: salaryDeduction,
          reason: deductionReason || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "sales_rep_id,month" }
      );
    if (deductionError) {
      return NextResponse.json({ error: deductionError.message }, { status: 400 });
    }
  }
  await writeAuditLog(request, {
    action: "UPDATE_BONUS",
    entityType: "SALES_REP",
    entityId: data.id,
    description: `Updated bonus structure for ${data.name}.`,
    metadata: {
      before,
      after: {
        bonus_type: data.bonus_type,
        bonus_percentage: data.bonus_percentage,
        secondary_bonus_percentage: data.secondary_bonus_percentage,
        fixed_monthly_bonus: data.fixed_monthly_bonus,
        monthly_salary: data.monthly_salary,
        salary_deduction_month: deductionMonth || null,
        salary_deduction: deductionMonth && deductionMonth !== "All" ? salaryDeduction : null,
        salary_deduction_reason: deductionMonth && deductionMonth !== "All" ? deductionReason || null : null,
      },
    },
  });
  return NextResponse.json({ data });
}
