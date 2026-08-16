import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { getCurrentDashboardUser } from "../../../lib/current-dashboard-user";
import { hasDashboardPermission } from "../../../lib/dashboard-permissions";
import { canViewPre2026Sales, NON_ADMIN_SALES_START_DATE } from "../../../lib/sales-visibility";
import InvoiceDetailsClient from "./InvoiceDetailsClient";

const supabase = createClient(
  process.env.SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false } }
);

export const revalidate = 0;

export default async function InvoiceDetailsPage({ params }: { params: { id: string } }) {
  const session = await getCurrentDashboardUser();
  let invoiceQuery = supabase.from("sales_view").select("*").eq("id", params.id).eq("document_type", "INVOICE");
  if (!canViewPre2026Sales(session)) invoiceQuery = invoiceQuery.gte("sales_date", NON_ADMIN_SALES_START_DATE);
  if (session?.salesRepName) invoiceQuery = invoiceQuery.eq("sales_rep", session.salesRepName);
  const { data: invoice, error } = await invoiceQuery.maybeSingle();
  if (error || !invoice) notFound();
  const canViewCollections = Boolean(session && hasDashboardPermission(session, "collections", "view"));
  let notesQuery = supabase.from("sales_view").select("id, invoice_no, sales_date, document_type, original_invoice_no, note_reason, sales_item_total, tax, total_sales").eq("original_invoice_no", invoice.invoice_no).in("document_type", ["CR_NOTE", "DR_NOTE"]).order("sales_date");
  let whtQuery = supabase.from("wht_collections").select("id, wht_amount, collected_amount, collection_date").eq("invoice_no", invoice.invoice_no).order("collection_date", { ascending: false });
  if (!canViewPre2026Sales(session)) {
    notesQuery = notesQuery.gte("sales_date", NON_ADMIN_SALES_START_DATE);
    whtQuery = whtQuery.gte("invoice_date", NON_ADMIN_SALES_START_DATE);
  }
  const allocationResult = canViewCollections
    ? await supabase.from("cheque_allocations").select("id, cheque_id, invoice_id, invoice_no, allocated_amount, cash_fraction, wht_deducted_amount").eq("invoice_id", String(invoice.id))
    : { data: [], error: null };
  const chequeIds = Array.from(new Set((allocationResult.data ?? []).map((allocation) => allocation.cheque_id)));
  const linkedChequesResult = chequeIds.length
    ? await supabase.from("customer_cheques").select("id, cheque_no, collection_date, cheque_date, amount, cheque_status, cheque_status_date, notes").in("id", chequeIds)
    : { data: [], error: null };
  const linkedChequeMap = new Map((linkedChequesResult.data ?? []).map((cheque) => [cheque.id, cheque]));
  const chequeAllocations = (allocationResult.data ?? []).map((allocation) => ({ ...allocation, cheque: linkedChequeMap.get(allocation.cheque_id) ?? null }));

  const queries: any[] = [
    notesQuery,
    supabase.from("customers").select("customer_official_name, payment_terms_days").eq("customer_code", invoice.customer_code).maybeSingle(),
    whtQuery,
    canViewCollections
      ? supabase.from("invoice_collections").select("*").eq("invoice_id", String(invoice.id)).neq("payment_method", "CHEQUE").order("collection_date", { ascending: false }).order("id", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ];
  if (session?.role === "admin") {
    queries.push(
      supabase.from("invoice_cogs").select("id, invoice_no, document_type, original_invoice_no, cogs_subtotal, cogs_vat, total").eq("document_type", "INVOICE").eq("invoice_no", invoice.invoice_no),
      supabase.from("invoice_cogs").select("id, invoice_no, document_type, original_invoice_no, cogs_subtotal, cogs_vat, total").eq("original_invoice_no", invoice.invoice_no)
    );
  }
  const [notesResult, customerResult, whtResult, collectionsResult, invoiceCogsResult, noteCogsResult] = await Promise.all(queries);

  return (
    <InvoiceDetailsClient
      invoice={invoice}
      notes={notesResult.data ?? []}
      customer={customerResult.data ?? null}
      wht={whtResult.data ?? []}
      collections={collectionsResult.data ?? []}
      chequeAllocations={chequeAllocations}
      canViewCollections={canViewCollections}
      cogs={[...(invoiceCogsResult?.data ?? []), ...(noteCogsResult?.data ?? [])]}
      isAdmin={session?.role === "admin"}
    />
  );
}
