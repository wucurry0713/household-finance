export const expenseScopes = ["personal", "shared", "family"] as const;

export type ExpenseScope = (typeof expenseScopes)[number];
export type ExpenseScopeFilter = ExpenseScope | "all";

export const expenseScopeLabels: Record<ExpenseScope, string> = {
  personal: "個人",
  shared: "雙人共同",
  family: "家庭",
};

export function isExpenseScope(value: unknown): value is ExpenseScope {
  return typeof value === "string" && expenseScopes.includes(value as ExpenseScope);
}
