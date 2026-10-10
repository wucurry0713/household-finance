'use client';

import { useState, useEffect, useCallback } from 'react';
import { loadAnalyticsTransactions } from "@/lib/finance/analytics";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export default function AnalyticsWorkspace({
  supabase,
  householdId,
}: {
  supabase: SupabaseClient<Database>;
  householdId: string;
}) {
  const [filter, setFilter] = useState('this_month');
  
  // 預設日期區間：本月 1 號 ~ 今天
  const todayStr = new Date().toISOString().split('T')[0];
  const firstDayStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const [customStartDate, setCustomStartDate] = useState(firstDayStr);
  const [customEndDate, setCustomEndDate] = useState(todayStr);
  const [data, setData] = useState<any>(null);
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
        // 自訂區間傳入 startDate 與 endDate
        res = await loadAnalyticsTransactions(supabase, householdId, '', customStartDate, customEndDate);
      } else {
        // 一般 Preset 模式
        res = await loadAnalyticsTransactions(supabase, householdId, filter);
      }
      setData(res);
    } catch (err) {
      console.error("載入分析數據失敗:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase, householdId, filter, customStartDate, customEndDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6 p-4">
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

      {/* 數據載入狀態 / 內容顯示區 */}
      {loading ? (
        <div className="py-12 text-center text-stone-400">載入數據中...</div>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-stone-800 mb-4">分析統計總覽</h3>
          {data ? (
            <pre className="text-xs bg-stone-50 p-4 rounded overflow-auto max-h-96">
              {JSON.stringify(data, null, 2)}
            </pre>
          ) : (
            <div className="text-stone-400">尚無資料</div>
          )}
        </div>
      )}
    </div>
  );
}