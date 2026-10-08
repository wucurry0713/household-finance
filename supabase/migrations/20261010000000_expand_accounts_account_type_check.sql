alter table public.accounts
  drop constraint if exists accounts_account_type_check;

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
