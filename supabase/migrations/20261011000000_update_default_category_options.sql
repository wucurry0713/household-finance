with default_categories(kind, name) as (
  values
    ('expense', '早餐'),
    ('expense', '午餐'),
    ('expense', '晚餐'),
    ('expense', '交通'),
    ('expense', '家人'),
    ('expense', '出國旅費'),
    ('expense', '房貸'),
    ('expense', '社交'),
    ('expense', '電話費'),
    ('expense', '保險'),
    ('expense', '治裝費'),
    ('expense', '日用品'),
    ('expense', '醫療'),
    ('expense', '稅務'),
    ('expense', '其他'),
    ('income', '薪水'),
    ('income', '股息'),
    ('income', '油資補貼'),
    ('income', '股票贖回')
)
insert into public.categories (
  household_id,
  parent_category_id,
  name,
  kind,
  is_system
)
select null, null, defaults.name, defaults.kind, true
from default_categories as defaults
where not exists (
  select 1
  from public.categories as existing
  where existing.household_id is null
    and existing.name = defaults.name
    and existing.kind = defaults.kind
);
