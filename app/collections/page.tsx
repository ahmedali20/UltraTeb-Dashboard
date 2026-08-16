import { createClient } from "@supabase/supabase-js";
import { getCurrentDashboardUser } from "../../lib/current-dashboard-user";
import { hasDashboardPermission } from "../../lib/dashboard-permissions";
import { canViewPre2026Sales, NON_ADMIN_SALES_START_DATE } from "../../lib/sales-visibility";
import CollectionsClient from "./CollectionsClient";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

const DATA_PAGE_SIZE = 1000;
const FILTER_BATCH_SIZE = 150;

async function fetchAllInvoices(
  canViewHistoricalSales: boolean,
  salesRepName: string | null
) {
  const rows: any[] = [];

  for (let from = 0; ; from += DATA_PAGE_SIZE) {
    let query = supabase
      .from("sales_view")
      .select("id, invoice_no, customer_code, customer_name, sales_date, due_date, sales_item_total, total_sales, sales_rep")
      .eq("document_type", "INVOICE")
      .order("sales_date", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + DATA_PAGE_SIZE - 1);

    if (salesRepName) query = query.eq("sales_rep", salesRepName);
    if (!canViewHistoricalSales) {
      query = query.gte("sales_date", NON_ADMIN_SALES_START_DATE);
    }

    const { data, error } = await query;
    if (error) return { data: null, error };

    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < DATA_PAGE_SIZE) break;
  }

  return { data: rows, error: null };
}

async function fetchInBatches(
  values: string[],
  fetchBatch: (batch: string[]) => PromiseLike<{ data: any[] | null; error: any }>
) {
  const rows: any[] = [];

  for (let index = 0; index < values.length; index += FILTER_BATCH_SIZE) {
    const result = await fetchBatch(values.slice(index, index + FILTER_BATCH_SIZE));
    if (result.error) return { data: null, error: result.error };
    rows.push(...(result.data ?? []));
  }

  return { data: rows, error: null };
}

export default async function CollectionsPage() {
  const session = await getCurrentDashboardUser();
  const { data: invoices, error: invoicesError } = await fetchAllInvoices(
    canViewPre2026Sales(session),
    session?.salesRepName ?? null
  );
  const invoiceIds = (invoices ?? []).map((invoice) => String(invoice.id));
  const collectionsResult = invoiceIds.length
    ? await fetchInBatches(invoiceIds, (batch) =>
        supabase
          .from("invoice_collections")
          .select("*")
          .in("invoice_id", batch)
          .neq("payment_method", "CHEQUE")
      )
    : { data: [], error: null };
  const allocationResult = invoiceIds.length
    ? await fetchInBatches(invoiceIds, (batch) =>
        supabase
          .from("cheque_allocations")
          .select("id, cheque_id, invoice_id, invoice_no, allocated_amount, wht_deducted_amount")
          .in("invoice_id", batch)
      )
    : { data: [], error: null };
  const chequeIds = Array.from(new Set((allocationResult.data ?? []).map((item) => String(item.cheque_id))));
  const chequesResult = chequeIds.length
    ? await fetchInBatches(chequeIds, (batch) =>
        supabase
          .from("customer_cheques")
          .select("id, cheque_no, collection_date, cheque_date, cheque_status, cheque_status_date, customer_name, amount, notes")
          .in("id", batch)
      )
    : { data: [], error: null };
  const chequeMap = new Map((chequesResult.data ?? []).map((cheque) => [String(cheque.id), cheque]));
  const chequeAllocations = (allocationResult.data ?? []).map((allocation) => ({ ...allocation, cheque: chequeMap.get(String(allocation.cheque_id)) ?? null }));
  const invoiceNumbers = (invoices ?? []).map((invoice) => String(invoice.invoice_no));
  const whtResult = invoiceNumbers.length
    ? await fetchInBatches(invoiceNumbers, (batch) => {
        let query = supabase
          .from("wht_collections")
          .select("invoice_no, wht_amount, collected_amount")
          .in("invoice_no", batch);
        if (!canViewPre2026Sales(session)) {
          query = query.gte("invoice_date", NON_ADMIN_SALES_START_DATE);
        }
        return query;
      })
    : { data: [], error: null };
  const error = invoicesError || collectionsResult.error || allocationResult.error || chequesResult.error || whtResult.error;
  if (error) return <main style={{ padding: 32, color: "#dc2626" }}>{error.message}</main>;
  const collections = [...(collectionsResult.data ?? [])].sort((a, b) =>
    String(b.collection_date ?? "").localeCompare(String(a.collection_date ?? "")) || Number(b.id ?? 0) - Number(a.id ?? 0)
  );
  return <CollectionsClient invoices={invoices ?? []} initialCollections={collections} initialChequeAllocations={chequeAllocations} initialWht={whtResult.data ?? []} canEdit={Boolean(session && hasDashboardPermission(session, "collections", "edit"))} />;
}
