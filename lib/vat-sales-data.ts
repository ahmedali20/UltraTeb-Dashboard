import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } });

export async function loadVatSalesData(from?: string, to?: string, allowPre2026 = true) {
  let salesQuery = supabase.from("sales_view").select("id, invoice_no, sales_date, customer_code, customer_name, sales_item_total, tax, vat_amount, table_tax_amount, tax_classification, total_sales, document_type").order("sales_date").order("invoice_no");
  let whtQuery = supabase.from("wht_collections").select("invoice_no, wht_amount, invoice_date");
  if (from) salesQuery = salesQuery.gte("sales_date", from);
  if (to) salesQuery = salesQuery.lte("sales_date", to);
  if (!allowPre2026) {
    salesQuery = salesQuery.gte("sales_date", "2026-01-01");
    whtQuery = whtQuery.gte("invoice_date", "2026-01-01");
  }
  const [{ data: sales, error: salesError }, { data: customers, error: customersError }, { data: wht, error: whtError }] = await Promise.all([
    salesQuery,
    supabase.from("customers").select("customer_code, customer_name, customer_official_name, customer_trn, customer_address"),
    whtQuery,
  ]);
  const error = salesError || customersError || whtError;
  if (error) throw new Error(error.message);
  const customerMap = new Map((customers ?? []).map((customer) => [customer.customer_code, customer]));
  const whtMap = new Map<string, number>();
  (wht ?? []).forEach((item) => whtMap.set(String(item.invoice_no), (whtMap.get(String(item.invoice_no)) ?? 0) + Number(item.wht_amount || 0)));
  return (sales ?? []).map((sale) => {
    const customer = customerMap.get(sale.customer_code);
    return {
      ...sale,
      vat_customer_name: customer?.customer_official_name?.trim() || customer?.customer_name?.trim() || sale.customer_name,
      customer_trn: customer?.customer_trn?.trim() || "",
      customer_address: customer?.customer_address?.trim() || "",
      wht: whtMap.get(String(sale.invoice_no)) ?? 0,
    };
  });
}
