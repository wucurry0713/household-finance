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
    if (!householdId) return;
    setLoading(true);
    try {
      let res: any[] = [];
      if (filter === 'custom') {
        res = await loadAnalyticsTransactions(supabase, householdId, '', customStartDate, customEndDate);
      } else if (filter === 'this_month') {
        const targetMonth = selectedMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        res = await loadAnalyticsTransactions(supabase, householdId, targetMonth);
      } else {
        res = await loadAnalyticsTransactions(supabase, householdId, filter);
      }
      setTransactions(res || []);
    } catch (err) {
      console.error("載入分析數據失敗:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase, householdId, filter, selectedMonth, customStartDate, customEndDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 計算總支出與總收入
  const totalExpense = transactions
    .filter((t) => t.kind === 'expense' || t.type === 'expense')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const totalIncome = transactions
    .filter((t) => t.kind === 'income' || t.type === 'income')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // 計算分類支出統計
  const categoryStats = transactions
    .filter((t) => t.kind === 'expense' || t.type === 'expense')
    .reduce((acc: Record<string, number>, t) => {
      const cat = t.category || t.category_name || '未分類';
      acc[cat] = (acc[cat] || 0) + (Number(t.amount) || 0);
      return acc;
    }, {});

  const sortedCategories = Object.entries(categoryStats).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      {/* 切換按鈕與日期選擇器 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-xl bg-[#F0ECE1] p-1">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                filter === opt.value
                  ? 'bg-white text-[#2C2623] shadow-sm'
                  : 'text-[#8C827A] hover:text-[#2C2623]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {filter === 'custom' && (
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-[#E5E0D8] text-sm text-[#2C2623]">
            <span className="text-[#8C827A]">開始：</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="bg-transparent focus:outline-none"
            />
            <span className="text-[#8C827A] ml-2">結束：</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-transparent focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* 數據內容卡片 */}
      {loading ? (
        <div className="py-12 text-center text-[#8C827A]">載入分析數據中...</div>
      ) : (
        <div className="space-y-6">
          {/* 總覽數字卡片 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#E5E0D8] bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-[#8C827A]">總支出</p>
              <p className="mt-2 text-3xl font-bold text-[#E54D42]">
                ${totalExpense.toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-[#E5E0D8] bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-[#8C827A]">總收入</p>
              <p className="mt-2 text-3xl font-bold text-[#2E7D32]">
                ${totalIncome.toLocaleString()}
              </p>
            </div>
          </div>

          {/* 支出分類統計排行榜 */}
          <div className="rounded-2xl border border-[#E5E0D8] bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold text-[#2C2623] mb-5">支出分類統計</h3>
            {sortedCategories.length > 0 ? (
              <div className="space-y-4">
                {sortedCategories.map(([cat, amount]) => {
                  const percentage = totalExpense > 0 ? ((amount / totalExpense) * 100).toFixed(1) : '0';
                  return (
                    <div key={cat} className="space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold text-[#2C2623]">{cat}</span>
                        <span className="text-[#8C827A] font-medium">${amount.toLocaleString()} ({percentage}%)</span>
                      </div>
                      <div className="h-2.5 w-full rounded-full bg-[#F5F2EC] overflow-hidden">
                        <div
                          className="h-full bg-[#2C2623] rounded-full transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-[#8C827A] py-8 text-center font-medium">該區間內尚無支出資料</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}