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
  // 🚀 關鍵修復：拔掉 useState！直接使用外部傳入的資料，這樣切換月份時畫面才會跟著更新！
  const transactions = initialTransactions || [];

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [memberFilter, setMemberFilter] = useState<'all' | 'personal' | 'joint'>('all');
  
  // ✨ 新增：自訂日期區間狀態
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const getAmount = (t: any) => typeof t.amount === 'number' ? t.amount : parseFloat(t.amount) || 0;

  // 強制將代付也視為支出，避免在圖表中隱形
  const isExpense = (t: any) => t.kind === 'expense' || t.scope === 'paid_for_spouse';
  const isIncome = (t: any) => t.kind === 'income';

  const filteredTransactions = transactions.filter((t) => {
    // 1. 日期區間篩選
    const txDate = t.transaction_date || t.date || t.created_at?.split('T')[0];
    if (startDate && txDate && txDate < startDate) return false;
    if (endDate && txDate && txDate > endDate) return false;

    // 2. 成員身份篩選
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
      // 代付強制給予專屬分類名稱
      let cat = t.categoryName || t.category_name || t.category || '未分類';
      if (t.scope === 'paid_for_spouse') {
        cat = '💳 代墊款 (代付)';
      }
      acc[cat] = (acc[cat] || 0) + getAmount(t);
      return acc;
    }, {});

  const sortedCategories = Object.entries(categoryStats).sort((a, b) => b[1] - a[1]);

  const categoryTransactions = selectedCategory
    ? filteredTransactions.filter((t) => {
        if (!isExpense(t)) return false;
        if (selectedCategory === '💳 代墊款 (代付)') return t.scope === 'paid_for_spouse';
        const cat = t.categoryName || t.category_name || t.category || '未分類';
        return cat === selectedCategory && t.scope !== 'paid_for_spouse';
      })
    : [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto text-[#2C2623] font-sans">
      {/* 頂部控制列包含區間篩選 */}
      <div className="flex flex-col gap-4 bg-white p-4 sm:p-5 rounded-[2rem] border border-[#E5E0D8] shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <MonthSelector month={selectedMonth} />
          </div>

          <div className="flex items-center bg-[#FBF9F5] p-1 rounded-2xl border border-[#E5E0D8]">
            {(['all', 'personal', 'joint'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setMemberFilter(filter)}
                className={`flex-1 sm:flex-none px-5 py-2.5 text-xs font-bold rounded-xl transition-all duration-300 ease-out ${
                  memberFilter === filter
                    ? 'bg-[#2C2623] text-white shadow-md'
                    : 'text-[#8C827A] hover:text-[#2C2623]'
                }`}
              >
                {filter === 'all' && '全部'}
                {filter === 'personal' && '👤 個人'}
                {filter === 'joint' && '🏠 家庭雙人'}
              </button>
            ))}
          </div>
        </div>

        {/* 自訂區間篩選 UI */}
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-[#F5F2EC]">
          <span className="text-[10px] font-bold text-[#8C827A] uppercase tracking-widest">自訂日期區間</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs sm:text-sm px-3 py-1.5 rounded-xl border border-[#E5E0D8] bg-[#FBF9F5] text-[#2C2623] focus:outline-none focus:border-[#D2A782] transition-colors cursor-pointer"
            />
            <span className="text-[#8C827A] text-xs font-medium">至</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs sm:text-sm px-3 py-1.5 rounded-xl border border-[#E5E0D8] bg-[#FBF9F5] text-[#2C2623] focus:outline-none focus:border-[#D2A782] transition-colors cursor-pointer"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="ml-2 text-xs font-bold text-[#C15C54] hover:text-[#A04A43] transition-colors px-2 py-1 rounded-lg hover:bg-[#F5F2EC]"
              >
                清除
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 總覽數據卡片 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 左側：焦糖奶茶色極簡圓環 */}
        <div className="rounded-[2rem] border border-[#E5E0D8] bg-white p-6 shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute top-5 left-6 text-xs font-bold text-[#8C827A] tracking-widest uppercase">支出佔比</div>
          <div className="my-8 relative flex items-center justify-center">
            <div className="w-44 h-44 rounded-full border-[10px] border-[#F5F2EC] border-t-[#D2A782] border-r-[#D2A782] flex flex-col items-center justify-center bg-white transition-transform duration-700">
              <span className="text-[10px] text-[#8C827A] font-bold tracking-widest mb-1 uppercase">Total</span>
              <span className="text-2xl font-black text-[#2C2623] tracking-tight">
                ${totalExpense.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="flex justify-between w-full px-2 text-xs text-[#8C827A] border-t border-[#F5F2EC] pt-5 font-medium">
            <span className="flex items-center gap-1.5">收入 <strong className="text-[#5E8B7E] font-bold">${totalIncome.toLocaleString()}</strong></span>
            <span className="flex items-center gap-1.5">結餘 <strong className="text-[#2C2623] font-bold">${balance.toLocaleString()}</strong></span>
          </div>
        </div>

        {/* 右側：金額大卡 */}
        <div className="lg:col-span-2 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="rounded-[2rem] border border-[#E5E0D8] bg-white p-7 shadow-sm flex flex-col justify-between hover:border-[#D1CCC5] transition-colors duration-300">
            <div>
              <p className="text-xs font-bold text-[#8C827A] tracking-widest uppercase">本期總支出</p>
              <p className="mt-4 text-4xl font-extrabold text-[#C15C54] tracking-tight">
                ${totalExpense.toLocaleString()}
              </p>
            </div>
            <div className="mt-8 text-xs font-medium text-[#8C827A] bg-[#FBF9F5] border border-[#E5E0D8] inline-flex px-3 py-1.5 rounded-lg w-fit">
              篩選筆數：{filteredTransactions.length} 筆
            </div>
          </div>

          <div className="rounded-[2rem] border border-[#E5E0D8] bg-white p-7 shadow-sm flex flex-col justify-between hover:border-[#D1CCC5] transition-colors duration-300">
            <div>
              <p className="text-xs font-bold text-[#8C827A] tracking-widest uppercase">本期總收入</p>
              <p className="mt-4 text-4xl font-extrabold text-[#5E8B7E] tracking-tight">
                ${totalIncome.toLocaleString()}
              </p>
            </div>
            <div className="mt-8 text-xs font-medium text-[#8C827A] bg-[#FBF9F5] border border-[#E5E0D8] inline-flex px-3 py-1.5 rounded-lg w-fit">
              淨結餘 <span className={`ml-1.5 font-bold ${balance >= 0 ? 'text-[#5E8B7E]' : 'text-[#C15C54]'}`}>${balance.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 分類統計清單 */}
      <div className="rounded-[2rem] border border-[#E5E0D8] bg-white p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-lg font-extrabold text-[#2C2623]">分類統計</h3>
          <span className="text-[10px] text-[#8C827A] font-bold tracking-widest bg-[#FBF9F5] border border-[#E5E0D8] px-3 py-1.5 rounded-xl uppercase">
            點擊查看明細
          </span>
        </div>

        {sortedCategories.length > 0 ? (
          <div className="space-y-6">
            {sortedCategories.map(([cat, amount]) => {
              const percentage = totalExpense > 0 ? ((amount / totalExpense) * 100).toFixed(1) : '0';
              const isPaidForSpouse = cat === '💳 代墊款 (代付)';
              
              return (
                <div
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className="group cursor-pointer"
                >
                  <div className="flex justify-between items-end mb-2.5">
                    <span className={`font-bold transition-colors ${isPaidForSpouse ? 'text-[#C15C54]' : 'text-[#2C2623] group-hover:text-[#8C827A]'}`}>
                      {cat}
                    </span>
                    <div className="text-[#2C2623] font-bold text-sm tracking-wide">
                      {percentage}% <span className="text-[#8C827A] font-medium ml-2 text-xs">${amount.toLocaleString()}</span>
                    </div>
                  </div>
                  {/* 極幼細緻進度條 (焦糖色) */}
                  <div className="h-1.5 w-full rounded-full bg-[#F5F2EC] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${isPaidForSpouse ? 'bg-[#C15C54]' : 'bg-[#D2A782] group-hover:bg-[#C18C6A]'}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-[#8C827A] py-16 text-center text-sm font-bold">該條件下尚無支出資料</div>
        )}
      </div>

      {/* 彈出交易明細 Modal */}
      {selectedCategory && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#2C2623]/20 backdrop-blur-sm p-4 sm:p-6 transition-opacity"
          onClick={() => setSelectedCategory(null)}
        >
          <div 
            className="bg-white rounded-[2rem] max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 ease-out"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[#E5E0D8] flex items-center justify-between bg-[#FBF9F5]">
              <h3 className="text-lg font-bold text-[#2C2623]">{selectedCategory}</h3>
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="w-8 h-8 rounded-full bg-white border border-[#E5E0D8] flex items-center justify-center text-[#8C827A] hover:text-[#2C2623] hover:bg-[#F5F2EC] transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-3 bg-white">
              {categoryTransactions.map((t, idx) => (
                <div key={t.id || idx} className="p-4 rounded-2xl bg-[#FBF9F5] border border-[#E5E0D8] flex items-center justify-between hover:border-[#D1CCC5] transition-colors">
                  <div>
                    <p className="font-bold text-[#2C2623] text-sm">{t.note || t.description || '一般支出'}</p>
                    <p className="text-[11px] text-[#8C827A] mt-1 font-bold tracking-wide">
                      {t.transaction_date || t.date || t.created_at?.split('T')[0]} • {t.scope === 'shared' ? '🏠 雙人共用' : t.scope === 'paid_for_spouse' ? '💳 代付' : '👤 個人支出'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#C15C54] tracking-tight">${getAmount(t).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-5 sm:p-6 border-t border-[#E5E0D8] bg-[#FBF9F5] flex justify-between items-center">
              <span className="text-xs text-[#8C827A] font-bold">
                總計 <strong className="text-[#2C2623] text-lg ml-2 tracking-tight">${(categoryStats[selectedCategory] || 0).toLocaleString()}</strong>
              </span>
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="px-6 py-2.5 bg-[#2C2623] text-white text-sm rounded-xl font-bold hover:bg-black transition-colors shadow-sm"
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
