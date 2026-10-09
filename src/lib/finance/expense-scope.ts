export const expenseScopes = ["personal", "shared", "spouse", "family"] as const;

export type ExpenseScope = (typeof expenseScopes)[number];
export type ExpenseScopeFilter = ExpenseScope | "all";

export const expenseScopeLabels: Record<ExpenseScope, string> = {
  personal: "個人獨享",
  shared: "雙人共同支出",
  spouse: "幫老婆代付",
  family: "全家",
};

export function isExpenseScope(value: unknown): value is ExpenseScope {
  return typeof value === "string" && expenseScopes.includes(value as ExpenseScope);
}
