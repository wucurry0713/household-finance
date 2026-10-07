do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.accounts'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%account_type%'
  loop
    execute format(
      'alter table public.accounts drop constraint %I',
      constraint_row.conname
    );
  end loop;
end;
$$;

alter table public.accounts
  add constraint accounts_account_type_check
  check (
    account_type in (
      'cash',
      'bank',
      'credit_card',
      'investment',
      'loan',
      'stock',
      'securities',
      'asset',
      'real_estate',
      'vehicle',
      'liability',
      'other'
    )
  );
