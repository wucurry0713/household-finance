import type { Database } from "@/types/database";

export type CategoryKind = Database["public"]["Tables"]["categories"]["Row"]["kind"];

export const defaultCategoryOptions: Record<CategoryKind, readonly string[]> = {
  expense: ["餐飲", "交通", "購物", "生活用品"],
  income: ["薪資", "獎金", "其他收入"],
};

export function isDefaultCategoryOption(
  kind: CategoryKind,
  value: string,
): boolean {
  return defaultCategoryOptions[kind].includes(value);
}
