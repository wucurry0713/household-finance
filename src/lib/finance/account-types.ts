import type { Database } from "@/types/database";

export const accountTypes = [
  "cash",
  "bank",
  "credit_card",
  "investment",
  "loan",
  "stock",
  "securities",
  "asset",
  "real_estate",
  "vehicle",
  "liability",
  "other",
] as const satisfies readonly Database["public"]["Tables"]["accounts"]["Row"]["account_type"][];

export type AccountType = (typeof accountTypes)[number];

const accountTypeSet: ReadonlySet<string> = new Set(accountTypes);

export function isAccountType(value: unknown): value is AccountType {
  return typeof value === "string" && accountTypeSet.has(value);
}
