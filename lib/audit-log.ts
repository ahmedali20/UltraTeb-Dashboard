import { createClient } from "@supabase/supabase-js";
import { readDashboardSession } from "./dashboard-auth";

type AuditInput = {
  action: string;
  entityType: string;
  entityId?: string | number | null;
  description: string;
  metadata?: Record<string, unknown>;
  username?: string;
  role?: "admin" | "user" | null;
  success?: boolean;
};

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  return cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export async function writeAuditLog(request: Request, input: AuditInput) {
  try {
    const session = input.username
      ? null
      : await readDashboardSession(
          cookieValue(request, "ultra_teb_session")
        );
    const forwarded = request.headers.get("x-forwarded-for");
    const supabase = createClient(
      process.env.SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
      { auth: { persistSession: false } }
    );
    await supabase.from("dashboard_audit_logs").insert({
      username: input.username ?? session?.username ?? "Unknown",
      user_role: input.role ?? session?.role ?? null,
      action: input.action,
      entity_type: input.entityType,
      entity_id:
        input.entityId === undefined || input.entityId === null
          ? null
          : String(input.entityId),
      description: input.description,
      metadata: input.metadata ?? {},
      success: input.success ?? true,
      ip_address: forwarded?.split(",")[0]?.trim() || null,
      user_agent: request.headers.get("user-agent"),
    });
  } catch {
    // Audit failures must not block the user's original action.
  }
}
