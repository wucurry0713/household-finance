import type { Database } from "@/types/database";

export type CategoryKind = Database["public"]["Tables"]["categories"]["Row"]["kind"];

export const defaultCategoryOptions: Record<CategoryKind, readonly string[]> = {
  expense: [
    "早餐",
    "午餐",
    "晚餐",
    "交通",
    "家人",
    "出國旅費",
    "房貸",
    "社交",
    "電話費",
    "保險",
    "治裝費",
    "日用品",
    "醫療",
    "稅務",
    "其他",
    "水費 💧",
    "電費 ⚡",
    "天然氣費 🔥",
    "管理費 🏢",
  ],
  income: [
    "薪水",
    "股息",
    "油資補貼",
    "股票贖回",
    "中獎 / 發票 🎯",
    "紅包 / 禮金 🧧",
    "二手售出 📦",
    "其他收入 💰",
  ],
};

export function isDefaultCategoryOption(
  kind: CategoryKind,
  value: string,
): boolean {
  return defaultCategoryOptions[kind].includes(value);
}
