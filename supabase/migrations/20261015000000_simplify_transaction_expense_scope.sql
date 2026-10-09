alter table public.transactions
  drop constraint if exists transactions_scope_check;

update public.transactions
set scope = 'paid_for_spouse'
where scope = 'spouse';

alter table public.transactions
  add constraint transactions_scope_check
  check (scope in ('personal', 'shared', 'paid_for_spouse', 'family'));
