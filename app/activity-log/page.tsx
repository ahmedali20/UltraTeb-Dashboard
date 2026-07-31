import { createClient } from "@supabase/supabase-js";
import ActivityLogClient from "./ActivityLogClient";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function ActivityLogPage() {
  const { data, error } = await supabase
    .from("dashboard_audit_logs")
    .select(
      "id, username, user_role, action, entity_type, entity_id, description, metadata, success, ip_address, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    return (
      <main style={{ padding: 32 }}>
        <h1>Activity Log Error</h1>
        <p style={{ color: "#dc2626" }}>{error.message}</p>
        <p>Run `supabase/dashboard_audit_logs.sql` first.</p>
      </main>
    );
  }

  return <ActivityLogClient logs={data ?? []} />;
}
