create table if not exists public.household_preferences (
  household_id uuid not null,
  user_id uuid not null,
  default_account_id uuid,
  updated_at timestamptz not null default now(),
  primary key (household_id, user_id),
  foreign key (household_id, user_id)
    references public.household_members(household_id, user_id)
    on delete cascade,
  foreign key (default_account_id, household_id)
    references public.accounts(id, household_id)
    on delete cascade
);

alter table public.household_preferences enable row level security;

drop policy if exists household_preferences_select_own
  on public.household_preferences;
create policy household_preferences_select_own
  on public.household_preferences for select to authenticated
  using (user_id = auth.uid() and public.is_household_member(household_id));

drop policy if exists household_preferences_insert_own
  on public.household_preferences;
create policy household_preferences_insert_own
  on public.household_preferences for insert to authenticated
  with check (user_id = auth.uid() and public.is_household_member(household_id));

drop policy if exists household_preferences_update_own
  on public.household_preferences;
create policy household_preferences_update_own
  on public.household_preferences for update to authenticated
  using (user_id = auth.uid() and public.is_household_member(household_id))
  with check (user_id = auth.uid() and public.is_household_member(household_id));

drop policy if exists household_preferences_delete_own
  on public.household_preferences;
create policy household_preferences_delete_own
  on public.household_preferences for delete to authenticated
  using (user_id = auth.uid() and public.is_household_member(household_id));

grant select, insert, update, delete
  on public.household_preferences to authenticated;