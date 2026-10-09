alter table public.transactions
  drop constraint if exists transactions_scope_check;

alter table public.transactions
  add constraint transactions_scope_check
  check (scope in ('personal', 'shared', 'spouse', 'family'));
