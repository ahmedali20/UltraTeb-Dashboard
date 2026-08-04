import { createClient } from "@supabase/supabase-js";
import AuthorizationClient from "./AuthorizationClient";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function AuthorizationPage() {
  const [{ data: customers, error: customersError }, { data: employees, error: employeesError }] =
    await Promise.all([
      supabase
        .from("customers")
        .select("customer_official_name")
        .not("customer_official_name", "is", null)
        .order("customer_official_name"),
      supabase.from("authorized_employees").select("id, employee_name, national_id").order("employee_name"),
    ]);
  const error = customersError || employeesError;
  if (error) return <main style={{ padding: 32, color: "#dc2626" }}>{error.message}</main>;
  return (
    <AuthorizationClient
      customers={Array.from(
        new Set(
          (customers ?? [])
            .map((item) => item.customer_official_name?.trim())
            .filter((name): name is string => Boolean(name))
        )
      )}
      initialEmployees={employees ?? []}
    />
  );
}
