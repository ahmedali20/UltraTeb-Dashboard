-- Internal receivables adjustment. This does not change invoice sales, VAT, or ETA data.
alter table public.sales
  add column if not exists balance_discount numeric(14,2) not null default 0
    check (balance_discount >= 0),
  add column if not exists balance_discount_reason text;
