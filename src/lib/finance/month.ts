const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export function currentMonthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function normalizeMonthKey(value: string | string[] | undefined, now = new Date()) {
  return typeof value === "string" && monthPattern.test(value)
    ? value
    : currentMonthKey(now);
}

export function shiftMonthKey(month: string, offset: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return currentMonthKey(shifted);
}

export function monthDateRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return {
    start: `${month}-01`,
    end: new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10),
  };
}

export function monthLabel(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${year} 年 ${monthNumber} 月`;
}
