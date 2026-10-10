'use client';

import { useState, useEffect, useCallback } from 'react';
import { loadAnalyticsTransactions } from "@/lib/finance/analytics";
import { createClient } from "@/lib/supabase/client";

export default function AnalyticsWorkspace({
  householdId,
  selectedMonth,
}: {
  householdId: string;
  selectedMonth?: string;
}) {
  const supabase = createClient();
  const [filter, setFilter] = useState('this_month');

  // 預設自訂日期區間：本月 1 號 ~ 今天
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const firstDayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const [customStartDate, setCustomStartDate] = useState(firstDayStr);
  const [customEndDate, setCustomEndDate] = useState(todayStr);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const filterOptions = [
    { label: '本月', value: 'this_month' },
    { label: '近 6 個月', value: 'last_six_months' },
    { label: '今年', value: 'this_year' },
    { label: '自訂', value: 'custom' },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      if (filter === 'custom') {
        // 自訂模式：帶入開始與結束日期
        res = await loadAnalyticsTransactions(supabase, householdId, '', customStartDate, customEndDate);
      } else if (filter === 'this_month') {
        // 本月模式：帶入頁面頂部選擇的 selectedMonth (例如 2026-10)
        const targetMonth = selectedMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        res = await loadAnalyticsTransactions(supabase, householdId, targetMonth);
      } else {
        // 近 6 個月 或 今年 模式
        res = await loadAnalyticsTransactions(supabase, householdId, filter);
      }
      setTransactions(res || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [supabase, householdId, filter, selectedMonth, customStartDate, customEndDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 計算總支出、總收入與分類統計
  const totalExpense = transactions
    .filter((t) => t.kind === 'expense')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const totalIncome = transactions
    .filter((t) => t.kind === 'income')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // 分類統計 (僅統計支出)
  const categoryStats = transactions
    .filter((t) => t.kind === 'expense')
    .reduce((acc: Record<string, number>, t) => {
      const cat = t.category || '未分類';
      acc[cat] = (acc[cat] || 0) + (Number(t.amount) || 0);
      return acc;
    }, {});

  const sortedCategories = Object.entries(categoryStats).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      {/* 篩選切換區 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg bg-stone-100 p-1">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                filter === opt.value
                  ? 'bg-white text-stone-800 shadow-sm'
                  : 'text-stone-500 hover:text-stone-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 當選擇「自訂」時展開 Date Picker */}
        {filter === 'custom' && (
          <div className="flex items-center gap-2 bg-stone-50 p-2 rounded-lg border border-stone-200 text-sm">
            <label className="text-stone-600">開始：</label>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2 py-1 border border-stone-300 rounded bg-white text-stone-800"
            />
            <label className="text-stone-600 ml-2">結束：</label>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2 py-1 border border-stone-300 rounded bg-white text-stone-800"
            />
          </div>
        )}
      </div>

      {/* 數據卡片區域 */}
      {loading ? (
        <div className="py-12 text-center text-stone-400">載入數據中...</div>
      ) : (
        <div className="space-y-6">
          {/* 數據總覽小卡 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-stone-500">總支出</p>
              <p className="mt-2 text-2xl font-bold text-rose-600">
                ${totalExpense.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-stone-500">總收入</p>
              <p className="mt-2 text-2xl font-bold text-emerald-600">
                ${totalIncome.toLocaleString()}
              </p>
            </div>
          </div>

          {/* 分類支出排行榜 */}
          <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-stone-800 mb-4">支出分類統計</h3>
            {sortedCategories.length > 0 ? (
              <div className="space-y-3">
                {sortedCategories.map(([cat, amount]) => {
                  const percentage = totalExpense > 0 ? ((amount / totalExpense) * 100).toFixed(1) : '0';
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-stone-700">{cat}</span>
                        <span className="text-stone-600">${amount.toLocaleString()} ({percentage}%)</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
                        <div
                          className="h-full bg-stone-700 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-stone-400 py-4 text-center">該區間內尚無支出資料</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}