import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { readDashboardSession } from "../../../lib/dashboard-auth";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

async function requireAdmin(request: NextRequest) {
  const session = await readDashboardSession(
    request.cookies.get("ultra_teb_session")?.value
  );
  return session?.role === "admin";
}

function parseRepIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((id) => Number(id))
        .filter((id) => Number.isSafeInteger(id) && id > 0)
    )
  );
}

async function assignMembers(teamId: number, memberIds: number[]) {
  const { error: clearError } = await supabase
    .from("sales_reps")
    .update({ team_id: null })
    .eq("team_id", teamId);
  if (clearError) return clearError;

  if (!memberIds.length) return null;
  const { error } = await supabase
    .from("sales_reps")
    .update({ team_id: teamId })
    .in("id", memberIds);
  return error;
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json();
  const name = String(body.name ?? "").trim();
  const leaderRepId = Number(body.leaderRepId);
  const memberIds = parseRepIds(body.memberIds);

  if (!name) {
    return NextResponse.json({ error: "Team name is required." }, { status: 400 });
  }
  if (!Number.isSafeInteger(leaderRepId) || leaderRepId <= 0) {
    return NextResponse.json({ error: "Team leader is required." }, { status: 400 });
  }
  if (!memberIds.includes(leaderRepId)) memberIds.push(leaderRepId);

  const { data: team, error } = await supabase
    .from("sales_teams")
    .insert({ name, leader_rep_id: leaderRepId })
    .select("id, name, leader_rep_id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const assignmentError = await assignMembers(Number(team.id), memberIds);
  if (assignmentError) {
    await supabase.from("sales_teams").delete().eq("id", team.id);
    return NextResponse.json({ error: assignmentError.message }, { status: 400 });
  }

  return NextResponse.json({ data: team });
}

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await request.json();
  const id = Number(body.id);
  const name = String(body.name ?? "").trim();
  const leaderRepId = Number(body.leaderRepId);
  const memberIds = parseRepIds(body.memberIds);

  if (!Number.isSafeInteger(id) || id <= 0 || !name) {
    return NextResponse.json({ error: "Team ID and name are required." }, { status: 400 });
  }
  if (!Number.isSafeInteger(leaderRepId) || leaderRepId <= 0) {
    return NextResponse.json({ error: "Team leader is required." }, { status: 400 });
  }
  if (!memberIds.includes(leaderRepId)) memberIds.push(leaderRepId);

  const { error } = await supabase
    .from("sales_teams")
    .update({
      name,
      leader_rep_id: leaderRepId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const assignmentError = await assignMembers(id, memberIds);
  if (assignmentError) {
    return NextResponse.json({ error: assignmentError.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  if (!(await requireAdmin(request))) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Missing team ID." }, { status: 400 });
  }

  const { error } = await supabase.from("sales_teams").delete().eq("id", id);
  return error
    ? NextResponse.json({ error: error.message }, { status: 400 })
    : NextResponse.json({ success: true });
}

