export const expenseScopes = ["personal", "shared", "paid_for_spouse"] as const;

export type ExpenseScope = (typeof expenseScopes)[number];
export type StoredExpenseScope = ExpenseScope | "family";
export type ExpenseScopeFilter = ExpenseScope | "all";

export const expenseScopeLabels: Record<ExpenseScope, string> = {
  personal: "個人",
  shared: "雙人",
  paid_for_spouse: "我代付",
};

export function isExpenseScope(value: unknown): value is ExpenseScope {
  return typeof value === "string" && expenseScopes.includes(value as ExpenseScope);
}
