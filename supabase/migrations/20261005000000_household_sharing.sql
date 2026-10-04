alter table public.accounts
  add column if not exists owner_id uuid,
  add column if not exists is_joint boolean not null default true;

update public.accounts
set owner_id = owner_user_id,
  is_joint = is_shared
where owner_id is distinct from owner_user_id
   or is_joint is distinct from is_shared;

alter table public.transactions
  add column if not exists owner_id uuid,
  add column if not exists is_joint boolean not null default true;

update public.transactions as transaction_row
set owner_id = coalesce(transaction_row.owner_id, transaction_row.paid_by_user_id, transaction_row.created_by),
    is_joint = coalesce(
      (
        select bool_and(account_row.is_shared)
        from public.transaction_entries as entry_row
        join public.accounts as account_row
          on account_row.id = entry_row.account_id
         and account_row.household_id = entry_row.household_id
        where entry_row.transaction_id = transaction_row.id
          and entry_row.household_id = transaction_row.household_id
      ),
      false
      )
    where transaction_row.owner_id is null;

alter table public.assets
  add column if not exists owner_id uuid,
  add column if not exists is_joint boolean not null default true;

alter table public.liabilities
  add column if not exists owner_id uuid,
  add column if not exists is_joint boolean not null default true;

alter table public.holdings
  add column if not exists owner_id uuid,
  add column if not exists is_joint boolean not null default true;

update public.holdings as holding_row
set owner_id = account_row.owner_id,
    is_joint = account_row.is_joint
from public.accounts as account_row
where holding_row.account_id = account_row.id
  and holding_row.household_id = account_row.household_id
  and holding_row.owner_id is null
  and holding_row.is_joint;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'accounts_owner_household_member_fkey'
      and conrelid = 'public.accounts'::regclass
  ) then
    alter table public.accounts
      add constraint accounts_owner_household_member_fkey
      foreign key (household_id, owner_id)
      references public.household_members(household_id, user_id)
      on delete set null (owner_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'transactions_owner_household_member_fkey'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_owner_household_member_fkey
      foreign key (household_id, owner_id)
      references public.household_members(household_id, user_id)
      on delete set null (owner_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'assets_owner_household_member_fkey'
      and conrelid = 'public.assets'::regclass
  ) then
    alter table public.assets
      add constraint assets_owner_household_member_fkey
      foreign key (household_id, owner_id)
      references public.household_members(household_id, user_id)
      on delete set null (owner_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'liabilities_owner_household_member_fkey'
      and conrelid = 'public.liabilities'::regclass
  ) then
    alter table public.liabilities
      add constraint liabilities_owner_household_member_fkey
      foreign key (household_id, owner_id)
      references public.household_members(household_id, user_id)
      on delete set null (owner_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'holdings_owner_household_member_fkey'
      and conrelid = 'public.holdings'::regclass
  ) then
    alter table public.holdings
      add constraint holdings_owner_household_member_fkey
      foreign key (household_id, owner_id)
      references public.household_members(household_id, user_id)
      on delete set null (owner_id);
  end if;
end;
$$;

create index if not exists accounts_household_owner_idx
  on public.accounts(household_id, owner_id, is_joint);
create index if not exists transactions_household_owner_date_idx
  on public.transactions(household_id, owner_id, transaction_date desc);

create table if not exists public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null check (email = lower(trim(email))),
  invited_by uuid not null,
  accepted_user_id uuid references public.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, email),
  foreign key (household_id, invited_by)
    references public.household_members(household_id, user_id)
    on delete cascade
);

create index if not exists household_invitations_email_status_idx
  on public.household_invitations(email, status);

alter table public.household_invitations enable row level security;

drop policy if exists household_invitations_select_member
  on public.household_invitations;
create policy household_invitations_select_member
  on public.household_invitations for select to authenticated
  using (public.is_household_member(household_id));

drop policy if exists household_invitations_insert_member
  on public.household_invitations;
create policy household_invitations_insert_member
  on public.household_invitations for insert to authenticated
  with check (
    invited_by = auth.uid()
    and public.is_household_member(household_id)
  );

drop policy if exists household_invitations_update_member
  on public.household_invitations;
create policy household_invitations_update_member
  on public.household_invitations for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

drop policy if exists household_invitations_delete_member
  on public.household_invitations;
create policy household_invitations_delete_member
  on public.household_invitations for delete to authenticated
  using (public.is_household_member(household_id));

grant select, insert, update, delete
  on public.household_invitations to authenticated;

grant all
  on public.household_invitations to service_role;