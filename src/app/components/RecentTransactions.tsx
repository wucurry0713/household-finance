'use client';

import { useState } from 'react';

export  function RecentTransactions({ transactions = [], onEdit, onDelete }: any) {
  // 控制每天是否展開的狀態 (預設全關閉，若要預設展開今天可設為 { [today]: true })
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => ({ ...prev, [date]: !prev[date] }));
  };

  // 1. 將所有交易按「日期」進行分組與加總
  const groupedTransactions = transactions.reduce((acc: Record<string, any>, t: any) => {
    const date = t.transaction_date || t.date || t.created_at?.split('T')[0] || '未知日期';
    if (!acc[date]) {
      acc[date] = { date, items: [], dailyTotal: 0 };
    }
    
    acc[date].items.push(t);
    
    const amt = typeof t.amount === 'number' ? t.amount : parseFloat(t.amount) || 0;
    // 支出與代付扣除總額，收入增加總額
    if (t.kind === 'expense' || t.scope === 'paid_for_spouse') {
      acc[date].dailyTotal -= amt;
    } else {
      acc[date].dailyTotal += amt;
    }
    
    return acc;
  }, {});

  // 2. 確保日期由新到舊排序
  const sortedDates = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));

  const getScopeLabel = (scope: string) => {
    if (scope === 'shared') return '雙人';
    if (scope === 'paid_for_spouse') return '代付';
    return '個人';
  };

  return (
    <div className="bg-white rounded-[2rem] border border-[#E5E0D8] shadow-sm p-6 sm:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-extrabold text-[#2C2623]">交易明細</h2>
          <p className="text-xs text-[#8C827A] mt-1">按日期分組</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 border border-[#E5E0D8] bg-[#FBF9F5] rounded-xl text-xs font-bold text-[#2C2623]">匯出 CSV</button>
          <button className="px-4 py-2 bg-[#D2A782] text-white rounded-xl text-xs font-bold shadow-sm">完整 Excel</button>
        </div>
      </div>

      <div className="space-y-4">
        {sortedDates.map((date) => {
          const group = groupedTransactions[date];
          const isExpanded = expandedDates[date];
          const isPositive = group.dailyTotal >= 0;

          return (
            <div key={date} className="border border-[#E5E0D8] rounded-2xl bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              
              {/* 📅 日期標題列 (點擊展開/折疊) */}
              <div 
                onClick={() => toggleDate(date)}
                className="flex justify-between items-center p-4 bg-[#FBF9F5] cursor-pointer hover:bg-[#F5F2EC] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-extrabold text-[#2C2623]">{date}</span>
                  <span className="text-[10px] font-bold text-[#8C827A] bg-white border border-[#E5E0D8] px-2 py-0.5 rounded-lg">
                    {group.items.length} 筆
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-extrabold tracking-tight ${isPositive ? 'text-[#5E8B7E]' : 'text-[#C15C54]'}`}>
                    {isPositive ? '+' : '-'}${Math.abs(group.dailyTotal).toLocaleString()}
                  </span>
                  <span className="text-[#8C827A] font-bold text-xs w-4 flex justify-center">
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </div>
              </div>

              {/* 🧾 當天明細列表 (展開時顯示) */}
              {isExpanded && (
                <div className="divide-y divide-[#E5E0D8] bg-white animate-in slide-in-from-top-2 duration-200">
                  {group.items.map((t: any, i: number) => {
                    const amt = parseFloat(t.amount) || 0;
                    const isExp = t.kind === 'expense' || t.scope === 'paid_for_spouse';
                    
                    return (
                      <div key={t.id || i} className="p-4 flex justify-between items-center hover:bg-[#FBF9F5] transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-[#F5F2EC] flex items-center justify-center text-[#D2A782] font-bold text-lg">
                            {isExp ? '↗' : '↙'}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-[#2C2623]">{t.note || t.description || '一般交易'}</span>
                              <span className="text-[10px] font-bold text-[#8C827A] bg-[#E5E0D8]/40 px-1.5 py-0.5 rounded-md">
                                {getScopeLabel(t.scope)}
                              </span>
                            </div>
                            <p className="text-xs text-[#8C827A] mt-1">{t.accountName || t.account_name || '預設帳戶'}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <span className={`font-bold tracking-tight ${isExp ? 'text-[#C15C54]' : 'text-[#5E8B7E]'}`}>
                            {isExp ? '-' : '+'}${amt.toLocaleString()}
                          </span>
                          <div className="flex gap-2">
                            <button onClick={() => onEdit?.(t)} className="text-[#8C827A] hover:text-[#2C2623] p-1">✎</button>
                            <button onClick={() => onDelete?.(t)} className="text-[#8C827A] hover:text-[#C15C54] p-1">✕</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              
            </div>
          );
        })}
      </div>
    </div>
  );
}
