import { createClient } from "@supabase/supabase-js";
import WhtClient from "./WhtClient";
import { getCurrentDashboardUser } from "../../lib/current-dashboard-user";
import { canViewPre2026Sales, NON_ADMIN_SALES_START_DATE } from "../../lib/sales-visibility";

const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } });
export const revalidate = 0;
const PAGE_SIZE = 1000;

async function fetchAllInvoices(canViewHistorical: boolean, salesRepName: string | null) {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from("sales_view").select("invoice_no, customer_name, sales_date, sales_item_total, tax").eq("document_type", "INVOICE").order("sales_date", { ascending: false }).order("id", { ascending: false }).range(from, from + PAGE_SIZE - 1);
    if (salesRepName) query = query.eq("sales_rep", salesRepName);
    if (!canViewHistorical) query = query.gte("sales_date", NON_ADMIN_SALES_START_DATE);
    const { data, error } = await query;
    if (error) return { data: null, error };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return { data: rows, error: null };
}

async function fetchAllWht(canViewHistorical: boolean) {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from("wht_collections").select("*").order("invoice_date", { ascending: false }).order("id", { ascending: false }).range(from, from + PAGE_SIZE - 1);
    if (!canViewHistorical) query = query.gte("invoice_date", NON_ADMIN_SALES_START_DATE);
    const { data, error } = await query;
    if (error) return { data: null, error };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return { data: rows, error: null };
}

export default async function WhtPage() {
  const session = await getCurrentDashboardUser();
  const canViewHistorical = canViewPre2026Sales(session);
  const [{ data: customers, error: customersError }, recordsResult, invoicesResult] = await Promise.all([
    supabase.from("customers").select("customer_name").order("customer_name"),
    fetchAllWht(canViewHistorical),
    fetchAllInvoices(canViewHistorical, session?.salesRepName ?? null),
  ]);
  const error = customersError || recordsResult.error || invoicesResult.error;
  if (error) return <main style={{ padding: 32, color: "#dc2626" }}>{error.message}</main>;

  const invoices = invoicesResult.data ?? [];
  const visibleRecords = session?.salesRepName
    ? (recordsResult.data ?? []).filter((record: any) => invoices.some((invoice: any) => String(invoice.invoice_no) === String(record.invoice_no) && String(invoice.sales_date).slice(0, 10) === String(record.invoice_date).slice(0, 10)))
    : recordsResult.data ?? [];
  const visibleCustomerNames = session?.salesRepName
    ? new Set(invoices.map((invoice: any) => invoice.customer_name))
    : null;

  return <WhtClient
    customers={Array.from(new Set((customers ?? []).map((item) => item.customer_name).filter((name) => Boolean(name) && (!visibleCustomerNames || visibleCustomerNames.has(name))))) as string[]}
    initialRecords={visibleRecords}
    invoices={invoices}
  />;
}
