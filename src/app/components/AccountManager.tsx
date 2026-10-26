'use client';

import { useState } from 'react';

export function AccountManager({ accounts = [], ...props }: any) {
  // 控制「其他帳戶」的下拉狀態，預設為隱藏
  const [isExpanded, setIsExpanded] = useState(false);

  // 1. 自動辨識並分離「銀行帳戶」與「其他帳戶」，補上 (a: any) 解決 TS 報錯
  const bankAccounts = accounts.filter(
    (a: any) => a.type === 'bank' || a.account_type === 'bank' || a.name?.includes('銀行')
  );
  const otherAccounts = accounts.filter(
    (a: any) => a.type !== 'bank' && a.account_type !== 'bank' && !a.name?.includes('銀行')
  );

  // 補上 (sum: number, a: any) 解決 TS 報錯
  const totalBalance = accounts.reduce((sum: number, a: any) => sum + (parseFloat(a.balance) || 0), 0);

  return (
    <div className="bg-white rounded-[2rem] border border-[#E5E0D8] shadow-sm p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-lg font-extrabold text-[#2C2623]">家庭帳戶</h2>
          <p className="text-xs text-[#8C827A] mt-1">現金、銀行與信用卡帳戶</p>
          <div className="mt-3 text-[#2C2623] font-bold">
            合計 <span className="text-xl ml-2 tracking-tight">${totalBalance.toLocaleString()}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 bg-[#D2A782] text-white rounded-xl text-sm font-bold shadow-sm hover:bg-[#C18C6A] transition-colors">
            ↻ 更新所有證券股價
          </button>
          <button className="px-4 py-2 border border-[#E5E0D8] bg-[#FBF9F5] rounded-xl text-sm font-bold text-[#2C2623] hover:border-[#D1CCC5] transition-colors">
            + 新增帳戶
          </button>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-10 h-10 border border-[#E5E0D8] bg-white rounded-xl flex items-center justify-center text-[#8C827A] hover:text-[#2C2623] hover:bg-[#F5F2EC] transition-all"
          >
            {isExpanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* 💳 預設永遠顯示的「銀行帳戶」區塊 */}
      {bankAccounts.length > 0 && (
        <div className="space-y-3 mb-4">
          <p className="text-[10px] font-bold text-[#8C827A] tracking-widest uppercase">主要銀行帳戶</p>
          {bankAccounts.map((a: any) => (
            <div key={a.id} className="flex justify-between items-center p-4 bg-[#FBF9F5] rounded-2xl border border-[#E5E0D8] hover:border-[#D1CCC5] transition-colors">
              <span className="font-bold text-[#2C2623]">{a.name}</span>
              <span className="font-extrabold text-[#5E8B7E] tracking-tight">${parseFloat(a.balance || 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* 🗂️ 點擊箭頭才顯示的「其他帳戶」區塊 */}
      {isExpanded && otherAccounts.length > 0 && (
        <div className="space-y-3 pt-5 border-t border-[#F5F2EC] animate-in slide-in-from-top-2 duration-300">
          <p className="text-[10px] font-bold text-[#8C827A] tracking-widest uppercase">其他資產與信用卡</p>
          {otherAccounts.map((a: any) => (
            <div key={a.id} className="flex justify-between items-center p-4 bg-white rounded-2xl border border-[#E5E0D8] hover:border-[#D1CCC5] transition-colors">
              <span className="font-bold text-[#8C827A]">{a.name}</span>
              <span className="font-extrabold text-[#2C2623] tracking-tight">${parseFloat(a.balance || 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
