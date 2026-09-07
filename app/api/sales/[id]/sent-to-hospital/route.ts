import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { readDashboardSession } from "../../../../../lib/dashboard-auth";
import { hasDashboardPermission } from "../../../../../lib/dashboard-permissions";
import { writeAuditLog } from "../../../../../lib/audit-log";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await readDashboardSession(request.cookies.get("ultra_teb_session")?.value);
  if (!session || !hasDashboardPermission(session, "sales", "edit")) {
    return NextResponse.json({ error: "Invoice edit permission required." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  if (typeof body.sentToHospital !== "boolean") {
    return NextResponse.json({ error: "Invalid sent status." }, { status: 400 });
  }

  const { data: before } = await supabase
    .from("sales")
    .select("id, invoice_no, document_type, sent_to_hospital")
    .eq("id", id)
    .maybeSingle();
  if (!before || before.document_type !== "INVOICE") {
    return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("sales")
    .update({ sent_to_hospital: body.sentToHospital })
    .eq("id", id)
    .eq("document_type", "INVOICE")
    .select("id, invoice_no, sent_to_hospital")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAuditLog(request, {
    action: "UPDATE_INVOICE_SENT_STATUS",
    entityType: "INVOICE",
    entityId: id,
    description: `${body.sentToHospital ? "Marked" : "Unmarked"} invoice ${data.invoice_no} as sent to hospital.`,
    metadata: {
      changes: {
        sent_to_hospital: {
          from: Boolean(before.sent_to_hospital),
          to: body.sentToHospital,
        },
      },
    },
  });

  return NextResponse.json({ data });
}

