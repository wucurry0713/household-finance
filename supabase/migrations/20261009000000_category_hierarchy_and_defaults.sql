alter table public.categories
  add column if not exists parent_category_id uuid
  references public.categories(id) on delete set null;

create index if not exists categories_parent_category_id_idx
  on public.categories(parent_category_id);

with default_categories(kind, name) as (
  values
    ('expense', '餐飲飲食'),
    ('expense', '居住房屋'),
    ('expense', '家庭社交'),
    ('expense', '日常服飾'),
    ('expense', '數位訂閱'),
    ('expense', '休閒娛樂'),
    ('income', '工作收入')
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
    and existing.parent_category_id is null
    and existing.name = defaults.name
    and existing.kind = defaults.kind
);

with default_subcategories(parent_name, name, kind) as (
  values
    ('餐飲飲食', '早餐', 'expense'),
    ('餐飲飲食', '午餐', 'expense'),
    ('餐飲飲食', '晚餐', 'expense'),
    ('餐飲飲食', '飲品', 'expense'),
    ('居住房屋', '房貸利息', 'expense'),
    ('居住房屋', '管理費', 'expense'),
    ('居住房屋', '住宅險', 'expense'),
    ('家庭社交', '孝親費', 'expense'),
    ('家庭社交', '節慶禮金', 'expense'),
    ('家庭社交', '社交聚會', 'expense'),
    ('日常服飾', '衣物購物', 'expense'),
    ('數位訂閱', 'iCloud', 'expense'),
    ('數位訂閱', '電話費', 'expense'),
    ('數位訂閱', '娛樂訂閱', 'expense'),
    ('休閒娛樂', '運動打球', 'expense'),
    ('休閒娛樂', '旅遊支出', 'expense'),
    ('工作收入', '薪水', 'income'),
    ('工作收入', '獎金', 'income')
)
insert into public.categories (
  household_id,
  parent_category_id,
  name,
  kind,
  is_system
)
select null, parent.id, defaults.name, defaults.kind, true
from default_subcategories as defaults
join public.categories as parent
  on parent.household_id is null
 and parent.parent_category_id is null
 and parent.name = defaults.parent_name
 and parent.kind = defaults.kind
where not exists (
  select 1
  from public.categories as existing
  where existing.household_id is null
    and existing.parent_category_id = parent.id
    and existing.name = defaults.name
    and existing.kind = defaults.kind
);
