begin;

-- Preserve the representative that belonged to each financial document.
-- Customer assignments can change later and must not rewrite history.
alter table public.sales
  add column if not exists sales_rep_name text,
  add column if not exists source_total_sales numeric(14,2);

-- Safe initial value for historical/manual records. The next Google Sheet sync
-- replaces 2026 source records with their exact document-level representative.
update public.sales s
set sales_rep_name = c.sales_rep_name
from public.customers c
where c.customer_code = s.customer_code
  and nullif(trim(s.sales_rep_name), '') is null;

update public.sales
set source_total_sales =
  (coalesce(sales_item_total, 0) + coalesce(tax, 0))::numeric(14,2)
where source_total_sales is null;

create or replace view public.sales_view
with (security_invoker = true)
as
select
  s.id,
  s.invoice_no,
  s.sales_date,
  to_char(s.sales_date::date, 'Mon.YYYY') as month,
  s.customer_code,
  c.customer_name,
  coalesce(nullif(trim(s.sales_rep_name), ''), c.sales_rep_name) as sales_rep,
  s.sales_item_total,
  s.tax,
  coalesce(
    s.source_total_sales,
    coalesce(s.sales_item_total, 0) + coalesce(s.tax, 0)
  )::numeric(14,2) as total_sales,
  s.document_type,
  s.original_invoice_no,
  s.note_reason,
  s.due_date,
  s.vat_amount,
  s.table_tax_amount,
  s.tax_classification
from public.sales s
left join public.customers c on c.customer_code = s.customer_code;

grant select on public.sales_view to anon, authenticated, service_role;

commit;
