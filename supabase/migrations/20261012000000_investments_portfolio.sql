create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  symbol text not null,
  name text not null,
  shares numeric(20, 6) not null check (shares > 0),
  cost_price numeric(20, 6) not null check (cost_price > 0),
  current_price numeric(20, 6) not null check (current_price >= 0),
  currency text not null check (currency in ('TWD', 'USD')),
  exchange_rate numeric(20, 8) not null default 1 check (exchange_rate > 0),
  updated_at timestamptz not null default now(),
  unique (account_id, symbol)
);

create index if not exists investments_account_id_idx
  on public.investments(account_id);

alter table public.investments enable row level security;

drop policy if exists investments_household_member_access
  on public.investments;
create policy investments_household_member_access
  on public.investments for all to authenticated
  using (
    exists (
      select 1
      from public.accounts as account_row
      where account_row.id = investments.account_id
        and public.is_household_member(account_row.household_id)
    )
  )
  with check (
    exists (
      select 1
      from public.accounts as account_row
      where account_row.id = investments.account_id
        and public.is_household_member(account_row.household_id)
    )
  );

grant select, insert, update, delete on public.investments to authenticated;
grant all on public.investments to service_role;
