alter table public.sales
  add column if not exists sent_to_hospital boolean not null default false;

create index if not exists sales_sent_to_hospital_idx
  on public.sales (sent_to_hospital)
  where document_type = 'INVOICE';

