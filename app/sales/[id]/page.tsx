import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { getCurrentDashboardUser } from "../../../lib/current-dashboard-user";
import { hasDashboardPermission } from "../../../lib/dashboard-permissions";
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
  if (session?.salesRepName) invoiceQuery = invoiceQuery.eq("sales_rep", session.salesRepName);
  const { data: invoice, error } = await invoiceQuery.maybeSingle();
  if (error || !invoice) notFound();
  const canViewCollections = Boolean(session && hasDashboardPermission(session, "collections", "view"));

  const queries: any[] = [
    supabase.from("sales_view").select("id, invoice_no, sales_date, document_type, original_invoice_no, note_reason, sales_item_total, tax, total_sales").eq("original_invoice_no", invoice.invoice_no).in("document_type", ["CR_NOTE", "DR_NOTE"]).order("sales_date"),
    supabase.from("customers").select("customer_official_name, payment_terms_days").eq("customer_code", invoice.customer_code).maybeSingle(),
    supabase.from("wht_collections").select("id, wht_amount, collected_amount, collection_date").eq("invoice_no", invoice.invoice_no).order("collection_date", { ascending: false }),
    canViewCollections
      ? supabase.from("invoice_collections").select("id, collection_date, amount, payment_method, reference_no, notes").eq("invoice_id", String(invoice.id)).order("collection_date", { ascending: false }).order("id", { ascending: false })
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
      canViewCollections={canViewCollections}
      cogs={[...(invoiceCogsResult?.data ?? []), ...(noteCogsResult?.data ?? [])]}
      isAdmin={session?.role === "admin"}
    />
  );
}
