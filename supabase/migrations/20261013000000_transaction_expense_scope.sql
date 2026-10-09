alter table public.transactions
  add column if not exists scope text;

update public.transactions
set scope = case
  when is_joint then 'family'
  else 'personal'
end
where scope is null;

alter table public.transactions
  alter column scope set default 'personal',
  alter column scope set not null;

alter table public.transactions
  drop constraint if exists transactions_scope_check;

alter table public.transactions
  add constraint transactions_scope_check
  check (scope in ('personal', 'shared', 'family'));

create index if not exists transactions_household_scope_date_idx
  on public.transactions(household_id, scope, transaction_date desc);
