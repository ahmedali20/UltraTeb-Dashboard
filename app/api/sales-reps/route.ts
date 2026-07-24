import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseServer = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export async function POST(request: Request) {
  const body = await request.json();
  const name = String(body.name ?? "").trim();

  if (!name) {
    return NextResponse.json(
      { error: "Sales representative name is required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseServer
    .from("sales_reps")
    .insert({ name })
    .select("id, name")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing representative ID." }, { status: 400 });
  }

  const { data: rep, error: repError } = await supabaseServer
    .from("sales_reps")
    .select("name")
    .eq("id", id)
    .single();

  if (repError) {
    return NextResponse.json({ error: repError.message }, { status: 400 });
  }

  const { count, error: countError } = await supabaseServer
    .from("customers")
    .select("*", { count: "exact", head: true })
    .ilike("sales_rep_name", rep.name.trim());

  if (countError) {
    return NextResponse.json({ error: countError.message }, { status: 400 });
  }

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        error: `This representative is assigned to ${count} customer(s). Reassign them before deleting.`,
      },
      { status: 409 }
    );
  }

  const { error } = await supabaseServer
    .from("sales_reps")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
