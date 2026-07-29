import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readDashboardSession } from "../../../../lib/dashboard-auth";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export async function PATCH(request: NextRequest) {
  const session = await readDashboardSession(
    request.cookies.get("ultra_teb_session")?.value
  );
  if (session?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json();
  const id = Number(body.id);
  const bonusType =
    body.bonusType === "FIXED_MONTHLY" ? "FIXED_MONTHLY" : "PERCENTAGE";
  const bonusPercentage = Number(body.bonusPercentage ?? 0);
  const fixedMonthlyBonus = Number(body.fixedMonthlyBonus ?? 0);

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
  if (!Number.isFinite(fixedMonthlyBonus) || fixedMonthlyBonus < 0) {
    return NextResponse.json(
      { error: "Fixed monthly bonus cannot be negative." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("sales_reps")
    .update({
      bonus_type: bonusType,
      bonus_percentage: bonusPercentage,
      fixed_monthly_bonus: fixedMonthlyBonus,
    })
    .eq("id", id)
    .select(
      "id, name, bonus_type, bonus_percentage, fixed_monthly_bonus"
    )
    .single();

  return error
    ? NextResponse.json({ error: error.message }, { status: 400 })
    : NextResponse.json({ data });
}

