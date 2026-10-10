'use client';

import { useState } from 'react';

interface AnalyticsWorkspaceProps {
  householdId: string;
  selectedMonth?: string;
  initialTransactions?: any[];
}

export default function AnalyticsWorkspace({
  householdId,
  selectedMonth,
  initialTransactions = [],
}: AnalyticsWorkspaceProps) {
  const [transactions] = useState<any[]>(initialTransactions);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // 相容判斷：支援 kind 或 type
  const isExpense = (t: any) => t.kind === 'expense' || t.type === 'expense';
  const isIncome = (t: any) => t.kind === 'income' || t.type === 'income';

  const getAmount = (t: any) => {
    const val = t.amount !== undefined ? t.amount : t.price;
    return typeof val === 'number' ? val : parseFloat(val) || 0;
  };

  const totalExpense = transactions
    .filter(isExpense)
    .reduce((sum, t) => sum + getAmount(t), 0);

  const totalIncome = transactions
    .filter(isIncome)
    .reduce((sum, t) => sum + getAmount(t), 0);

  const balance = totalIncome - totalExpense;

  // 分類統計
  const categoryStats = transactions
    .filter(isExpense)
    .reduce((acc: Record<string, number>, t) => {
      const cat = t.category || t.category_name || '未分類';
      acc[cat] = (acc[cat] || 0) + getAmount(t);
      return acc;
    }, {});

  const sortedCategories = Object.entries(categoryStats).sort((a, b) => b[1] - a[1]);

  const categoryTransactions = selectedCategory
    ? transactions.filter(
        (t) => isExpense(t) && (t.category || t.category_name || '未分類') === selectedCategory
      )
    : [];

  return (
    <div className="space-y-6 mt-6">
      {/* 頂部總覽區：高質感厚圓環甜甜圈圖與金額卡片 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左側：精美厚圓環甜甜圈圖 */}
        <div className="rounded-3xl border border-[#E5E0D8] bg-white p-6 shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-4 left-6 text-sm font-semibold text-[#8C827A]">總支出佔比概覽</div>
          <div className="my-6 relative flex items-center justify-center">
            <div className="w-40 h-40 rounded-full border-[18px] border-[#F5F2EC] border-t-[#C88A32] border-r-[#2C2623] flex flex-col items-center justify-center shadow-inner bg-white">
              <span className="text-xs text-[#8C827A] font-medium tracking-wide">總支出</span>
              <span className="text-2xl font-black text-[#2C2623] mt-0.5">
                ${totalExpense.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="flex justify-between w-full px-4 text-xs text-[#8C827A] border-t border-[#F5F2EC] pt-4">
            <span>總收入: <strong className="text-[#2E7D32] font-semibold">${totalIncome.toLocaleString()}</strong></span>
            <span>結餘: <strong className="text-[#2C2623] font-semibold">${balance.toLocaleString()}</strong></span>
          </div>
        </div>

        {/* 右側：總支出與總收入大卡 */}
        <div className="lg:col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-[#E5E0D8] bg-white p-6 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-sm font-medium text-[#8C827A]">本期總支出</p>
              <p className="mt-3 text-3xl font-extrabold text-[#E54D42]">
                ${totalExpense.toLocaleString()}
              </p>
            </div>
            <div className="mt-4 text-xs text-[#8C827A]">
              佔總流水比例：{totalIncome > 0 ? ((totalExpense / (totalIncome + totalExpense)) * 100).toFixed(1) : '100'}%
            </div>
          </div>

          <div className="rounded-3xl border border-[#E5E0D8] bg-white p-6 shadow-sm flex flex-col justify-between">
            <div>
              <p className="text-sm font-medium text-[#8C827A]">本期總收入</p>
              <p className="mt-3 text-3xl font-extrabold text-[#2E7D32]">
                ${totalIncome.toLocaleString()}
              </p>
            </div>
            <div className="mt-4 text-xs text-[#8C827A]">
              淨收支：<span className={balance >= 0 ? "text-[#2E7D32] font-bold" : "text-[#E54D42] font-bold"}>
                ${balance.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 分類百分比列表與質感進度條 */}
      <div className="rounded-3xl border border-[#E5E0D8] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-[#2C2623]">支出分類統計與佔比</h3>
          <span className="text-xs text-[#C88A32] font-semibold bg-[#F5F2EC] px-3 py-1.5 rounded-full">💡 點擊下方任意分類可彈出明細視窗</span>
        </div>

        {sortedCategories.length > 0 ? (
          <div className="space-y-4">
            {sortedCategories.map(([cat, amount]) => {
              const percentage = totalExpense > 0 ? ((amount / totalExpense) * 100).toFixed(1) : '0';
              return (
                <div
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className="group p-4 rounded-2xl transition-all hover:bg-[#FBF9F5] cursor-pointer border border-[#E5E0D8]/60 hover:border-[#C88A32] shadow-sm"
                >
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-bold text-[#2C2623] group-hover:text-[#C88A32] transition-colors flex items-center gap-2">
                      📂 {cat}
                    </span>
                    <span className="text-[#2C2623] font-bold">
                      {percentage}% <span className="text-[#8C827A] font-normal ml-1">(${amount.toLocaleString()})</span>
                    </span>
                  </div>
                  <div className="h-3.5 w-full rounded-full bg-[#F5F2EC] overflow-hidden p-0.5">
                    <div
                      className="h-full bg-[#2C2623] group-hover:bg-[#C88A32] rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-[#8C827A] py-12 text-center font-medium">該區間內尚無支出資料</div>
        )}
      </div>

      {/* 點擊分類彈出交易明細 Modal */}
      {selectedCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl border border-[#E5E0D8] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-[#E5E0D8] flex items-center justify-between bg-[#FBF9F5]">
              <div>
                <h3 className="text-lg font-bold text-[#2C2623]">📁 {selectedCategory} - 交易明細</h3>
                <p className="text-xs text-[#8C827A] mt-0.5">該分類下所有的花費紀錄與佔比</p>
              </div>
              <button
                onClick={() => setSelectedCategory(null)}
                className="w-9 h-9 rounded-full bg-white border border-[#E5E0D8] flex items-center justify-center text-[#8C827A] hover:text-[#2C2623] hover:bg-[#F5F2EC] transition-all font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              {categoryTransactions.length > 0 ? (
                categoryTransactions.map((t, idx) => {
                  const amt = getAmount(t);
                  const catTotal = categoryStats[selectedCategory] || 1;
                  const itemPct = ((amt / catTotal) * 100).toFixed(1);
                  return (
                    <div key={t.id || idx} className="p-4 rounded-2xl bg-[#FBF9F5] border border-[#E5E0D8] flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-[#2C2623] text-sm">{t.title || t.name || '未命名交易'}</p>
                        <p className="text-xs text-[#8C827A] mt-0.5">{t.date || t.created_at?.split('T')[0]}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-[#E54D42]">${amt.toLocaleString()}</p>
                        <p className="text-xs text-[#8C827A]">佔分類 {itemPct}%</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-[#8C827A]">此分類尚無明細資料</div>
              )}
            </div>

            <div className="p-4 border-t border-[#E5E0D8] bg-[#FBF9F5] flex justify-between items-center text-sm">
              <span className="text-[#8C827A]">分類總計：<strong className="text-[#2C2623]">${(categoryStats[selectedCategory] || 0).toLocaleString()}</strong></span>
              <button
                onClick={() => setSelectedCategory(null)}
                className="px-5 py-2 bg-[#2C2623] text-white rounded-xl font-medium hover:bg-black transition-all"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}