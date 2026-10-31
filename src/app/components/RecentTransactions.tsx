'use client';

import { useState, useMemo } from 'react';
import { Pencil, Trash2 } from 'lucide-react'; // 引入漂亮的圖示

export function RecentTransactions({ transactions = [], onEdit, onDelete, onEditTransaction, onDeleteTransaction }: any) {
  // 控制每天明細的展開狀態（預設隱藏）
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  // 控制是否顯示超過7天的歷史紀錄
  const [showOlder, setShowOlder] = useState(false);

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => ({ ...prev, [date]: !prev[date] }));
  };

  // 容錯處理：確保能抓到父層傳進來的事件
  const handleEdit = (t: any) => {
    if (onEdit) onEdit(t);
    else if (onEditTransaction) onEditTransaction(t);
  };

  const handleDelete = (id: string) => {
    if (onDelete) onDelete(id);
    else if (onDeleteTransaction) onDeleteTransaction(id);
  };

  // 1. 將所有交易按「日期」進行分組與加總
  const groupedTransactions = useMemo(() => {
    return transactions.reduce((acc: Record<string, any>, t: any) => {
      const date = t.transaction_date || t.date || t.created_at?.split('T')[0] || '未知日期';
      if (!acc[date]) {
        acc[date] = { date, items: [], dailyTotal: 0 };
      }
      acc[date].items.push(t);
      
      const amount = typeof t.amount === 'number' ? t.amount : parseFloat(t.amount) || 0;
      const isExpense = t.kind === 'expense' || t.scope === 'paid_for_spouse';
      // 支出扣除，收入增加
      acc[date].dailyTotal += isExpense ? -amount : amount;
      
      return acc;
    }, {});
  }, [transactions]);

  // 2. 將日期從新到舊排序
  const sortedDates = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));
  
  // 3. 切割出「最近 7 天」與「更早的紀錄」
  const recentDates = sortedDates.slice(0, 7);
  const olderDates = sortedDates.slice(7);

  // 渲染單個日期群組卡片的方法
  const renderDateGroup = (date: string, isOlderGroup: boolean = false) => {
    const group = groupedTransactions[date];
    const isExpanded = expandedDates[date];
    
    return (
      <div 
        key={date} 
        className={`overflow-hidden rounded-2xl border border-[#E5E0D8] transition-colors hover:border-[#D1CCC5] ${isOlderGroup ? 'bg-white opacity-85 hover:opacity-100' : 'bg-[#FBF9F5]'}`}
      >
        {/* 日期標題列 */}
        <div 
          onClick={() => toggleDate(date)}
          className="flex cursor-pointer items-center justify-between p-4"
        >
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-[#2C2623]">{date}</span>
            <span className={`rounded-lg border border-[#E5E0D8] px-2 py-0.5 text-[10px] font-bold text-[#8C827A] ${isOlderGroup ? 'bg-[#FBF9F5]' : 'bg-white'}`}>
              {group.items.length} 筆
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className={`font-black tracking-tight ${group.dailyTotal < 0 ? 'text-[#C15C54]' : 'text-[#5E8B7E]'}`}>
              {group.dailyTotal < 0 ? '-' : '+'}${Math.abs(Math.round(group.dailyTotal)).toLocaleString()}
            </span>
            <span className={`text-[#8C827A] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </div>
        </div>

        {/* 展開的單筆明細 */}
        {isExpanded && (
          <div className={`border-t border-[#E5E0D8] px-4 py-2 animate-in slide-in-from-top-2 duration-200 ${isOlderGroup ? 'bg-[#FBF9F5]' : 'bg-white'}`}>
            {group.items.map((t: any, idx: number) => {
               const amount = typeof t.amount === 'number' ? t.amount : parseFloat(t.amount) || 0;
               const isExpense = t.kind === 'expense' || t.scope === 'paid_for_spouse';
               
               return (
                 <div key={t.id || idx} className={`flex justify-between items-center py-3 border-b last:border-0 ${isOlderGroup ? 'border-[#E5E0D8]' : 'border-[#F5F2EC]'}`}>
                   <div className="min-w-0 flex-1 pr-2">
                     <p className="font-bold text-[#2C2623] text-sm truncate">{t.note || t.description || '一般交易'}</p>
                     <p className="text-[11px] font-bold text-[#8C827A] tracking-wide mt-0.5 truncate">
                       {t.categoryName || t.category_name || t.category || '未分類'} • {t.scope === 'shared' ? '🏠 家庭' : t.scope === 'paid_for_spouse' ? '💳 代付' : '👤 個人'}
                     </p>
                   </div>
                   <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                     <p className={`font-bold tracking-tight ${isExpense ? 'text-[#C15C54]' : 'text-[#5E8B7E]'}`}>
                       {isExpense ? '-' : '+'}${Math.abs(Math.round(amount)).toLocaleString()}
                     </p>
                     <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#E5E0D8]">
                       <button 
                         onClick={() => handleEdit(t)} 
                         className="p-1.5 text-[#8C827A] hover:bg-[#F5F2EC] hover:text-[#2C2623] rounded-lg transition-colors shadow-sm"
                       >
                         <Pencil size={14} />
                       </button>
                       <button 
                         onClick={() => handleDelete(t.id)} 
                         className="p-1.5 text-[#8C827A] hover:bg-[#FFF5F5] hover:text-[#C15C54] rounded-lg transition-colors shadow-sm"
                       >
                         <Trash2 size={14} />
                       </button>
                     </div>
                   </div>
                 </div>
               );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-[2rem] border border-[#E5E0D8] shadow-sm p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg font-extrabold text-[#2C2623]">交易明細</h2>
          <p className="text-xs text-[#8C827A] mt-1">按日期分組</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 bg-white border border-[#E5E0D8] text-[#2C2623] rounded-xl text-sm font-bold shadow-sm hover:bg-[#FBF9F5] transition-colors cursor-pointer">
            匯出 CSV
          </button>
          <button className="px-4 py-2 bg-[#D2A782] text-white rounded-xl text-sm font-bold shadow-sm hover:bg-[#C18C6A] transition-colors cursor-pointer">
            完整 Excel
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {recentDates.map((date) => renderDateGroup(date, false))}
        
        {olderDates.length > 0 && (
          <div className="pt-2">
            <button
              onClick={() => setShowOlder(!showOlder)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-[#E5E0D8] bg-[#FBF9F5] text-sm font-bold text-[#8C827A] hover:text-[#2C2623] hover:border-[#D1CCC5] transition-colors cursor-pointer"
            >
              {showOlder ? '收合歷史紀錄 ▲' : `展開更早的紀錄 (${olderDates.length} 天) ▼`}
            </button>
          </div>
        )}

        {showOlder && (
          <div className="space-y-3 animate-in slide-in-from-top-4 duration-300 pt-2">
            {olderDates.map((date) => renderDateGroup(date, true))}
          </div>
        )}
        
        {transactions.length === 0 && (
          <div className="py-12 text-center text-sm font-bold text-[#8C827A] border border-dashed border-[#E5E0D8] rounded-2xl bg-[#FBF9F5]">
            目前區間尚無交易明細
          </div>
        )}
      </div>
    </div>
  );
}
