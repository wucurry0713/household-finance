'use client';

import { useState } from 'react';
import { MonthSelector } from './MonthSelector';

interface AnalyticsWorkspaceProps {
  householdId: string;
  currentUserId: string;
  selectedMonth?: string;
  initialTransactions?: any[];
}

export default function AnalyticsWorkspace({
  householdId,
  currentUserId,
  selectedMonth = '',
  initialTransactions = [],
}: AnalyticsWorkspaceProps) {
  const [transactions] = useState<any[]>(initialTransactions);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [memberFilter, setMemberFilter] = useState<'all' | 'personal' | 'joint'>('all');

  const isExpense = (t: any) => t.kind === 'expense';
  const isIncome = (t: any) => t.kind === 'income';
  const getAmount = (t: any) => typeof t.amount === 'number' ? t.amount : parseFloat(t.amount) || 0;

  const filteredTransactions = transactions.filter((t) => {
    const isJointTransaction = t.scope === 'shared' || t.scope === 'paid_for_spouse';
    if (memberFilter === 'personal') return t.scope === 'personal' || !isJointTransaction;
    if (memberFilter === 'joint') return isJointTransaction;
    return true;
  });

  const totalExpense = filteredTransactions.filter(isExpense).reduce((sum, t) => sum + getAmount(t), 0);
  const totalIncome = filteredTransactions.filter(isIncome).reduce((sum, t) => sum + getAmount(t), 0);
  const balance = totalIncome - totalExpense;

  const categoryStats = filteredTransactions
    .filter(isExpense)
    .reduce((acc: Record<string, number>, t) => {
      const cat = t.categoryName || t.category_name || t.category || '未分類';
      acc[cat] = (acc[cat] || 0) + getAmount(t);
      return acc;
    }, {});

  const sortedCategories = Object.entries(categoryStats).sort((a, b) => b[1] - a[1]);

  const categoryTransactions = selectedCategory
    ? filteredTransactions.filter(
        (t) => isExpense(t) && (t.categoryName || t.category_name || t.category || '未分類') === selectedCategory
      )
    : [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto text-zinc-800">
      {/* 頂部控制列 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/80 backdrop-blur-xl p-3 sm:p-4 rounded-[2rem] border border-zinc-100 shadow-[0_2px_20px_rgb(0,0,0,0.02)]">
        <div>
          <MonthSelector month={selectedMonth} />
        </div>

        <div className="flex items-center bg-zinc-100/80 p-1 rounded-2xl">
          {(['all', 'personal', 'joint'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setMemberFilter(filter)}
              className={`flex-1 sm:flex-none px-5 py-2.5 text-xs font-semibold rounded-xl transition-all duration-300 ease-out ${
                memberFilter === filter
                  ? 'bg-white text-zinc-900 shadow-[0_2px_10px_rgb(0,0,0,0.06)]'
                  : 'text-zinc-400 hover:text-zinc-600'
              }`}
            >
              {filter === 'all' && '全部'}
              {filter === 'personal' && '👤 個人'}
              {filter === 'joint' && '🏠 家庭雙人'}
            </button>
          ))}
        </div>
      </div>

      {/* 總覽數據卡片 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左側：極簡圓環 */}
        <div className="rounded-[2rem] border border-zinc-100 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute top-5 left-6 text-xs font-semibold text-zinc-400 tracking-wider">支出佔比</div>
          <div className="my-8 relative flex items-center justify-center">
            <div className="w-44 h-44 rounded-full border-[12px] border-zinc-50 border-t-zinc-800 border-r-zinc-800 flex flex-col items-center justify-center shadow-inner bg-white transition-transform duration-700 group-hover:scale-105">
              <span className="text-[10px] text-zinc-400 font-medium tracking-widest mb-1">TOTAL</span>
              <span className="text-2xl font-black text-zinc-800 tracking-tight">
                ${totalExpense.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="flex justify-between w-full px-2 text-xs text-zinc-500 border-t border-zinc-50 pt-5">
            <span className="flex items-center gap-1">收入 <strong className="text-emerald-500 font-semibold">${totalIncome.toLocaleString()}</strong></span>
            <span className="flex items-center gap-1">結餘 <strong className="text-zinc-800 font-semibold">${balance.toLocaleString()}</strong></span>
          </div>
        </div>

        {/* 右側：金額大卡 */}
        <div className="lg:col-span-2 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-[2rem] border border-zinc-100 bg-white p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow duration-300">
            <div>
              <p className="text-xs font-semibold text-zinc-400 tracking-wider">本期總支出</p>
              <p className="mt-4 text-4xl font-extrabold text-rose-500 tracking-tight">
                ${totalExpense.toLocaleString()}
              </p>
            </div>
            <div className="mt-8 text-xs text-zinc-400 bg-zinc-50 inline-flex px-3 py-1.5 rounded-lg w-fit">
              佔總流水 {totalIncome + totalExpense > 0 ? ((totalExpense / (totalIncome + totalExpense)) * 100).toFixed(1) : '100'}%
            </div>
          </div>

          <div className="rounded-[2rem] border border-zinc-100 bg-white p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow duration-300">
            <div>
              <p className="text-xs font-semibold text-zinc-400 tracking-wider">本期總收入</p>
              <p className="mt-4 text-4xl font-extrabold text-emerald-500 tracking-tight">
                ${totalIncome.toLocaleString()}
              </p>
            </div>
            <div className="mt-8 text-xs text-zinc-400 bg-zinc-50 inline-flex px-3 py-1.5 rounded-lg w-fit">
              淨結餘 <span className={`ml-1 font-semibold ${balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>${balance.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 分類統計清單 */}
      <div className="rounded-[2rem] border border-zinc-100 bg-white p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-lg font-bold text-zinc-800">分類統計</h3>
          <span className="text-[10px] text-zinc-500 font-medium tracking-wider bg-zinc-50 px-3 py-1.5 rounded-xl border border-zinc-100">
            點擊查看明細
          </span>
        </div>

        {sortedCategories.length > 0 ? (
          <div className="space-y-5">
            {sortedCategories.map(([cat, amount]) => {
              const percentage = totalExpense > 0 ? ((amount / totalExpense) * 100).toFixed(1) : '0';
              return (
                <div
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className="group cursor-pointer"
                >
                  <div className="flex justify-between text-sm mb-2.5">
                    <span className="font-semibold text-zinc-600 group-hover:text-zinc-900 transition-colors">
                      {cat}
                    </span>
                    <div className="text-zinc-800 font-semibold tracking-wide">
                      {percentage}% <span className="text-zinc-400 font-normal ml-2 text-xs">${amount.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className="h-full bg-zinc-800 rounded-full transition-all duration-700 ease-out group-hover:bg-zinc-600"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-zinc-400 py-16 text-center text-sm font-medium">該條件下尚無支出資料</div>
        )}
      </div>

      {/* 彈出交易明細 Modal */}
      {selectedCategory && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-zinc-900/20 backdrop-blur-sm p-4 sm:p-6 transition-opacity"
          onClick={() => setSelectedCategory(null)}
        >
          <div 
            className="bg-white rounded-[2rem] max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 ease-out"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-white/50 backdrop-blur-md">
              <h3 className="text-lg font-bold text-zinc-800">{selectedCategory}</h3>
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3 bg-zinc-50/50">
              {categoryTransactions.map((t, idx) => (
                <div key={t.id || idx} className="p-4 rounded-2xl bg-white border border-zinc-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                  <div>
                    <p className="font-semibold text-zinc-800 text-sm">{t.note || t.description || '一般支出'}</p>
                    <p className="text-[11px] text-zinc-400 mt-1 font-medium tracking-wide">
                      {t.scope === 'shared' || t.scope === 'paid_for_spouse' ? '🏠 雙人共用' : '👤 個人支出'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-rose-500 tracking-tight">${getAmount(t).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-5 sm:p-6 border-t border-zinc-100 bg-white flex justify-between items-center">
              <span className="text-xs text-zinc-500 font-medium">
                總計 <strong className="text-zinc-900 text-lg ml-2 tracking-tight">${(categoryStats[selectedCategory] || 0).toLocaleString()}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="px-6 py-2.5 bg-zinc-900 text-white text-sm rounded-xl font-medium hover:bg-zinc-800 transition-colors shadow-md"
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
