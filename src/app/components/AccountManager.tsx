'use client';

import { useState } from 'react';

export function AccountManager({ accounts = [], onUpdateStockPrices, onAddAccount, onSelectAccount, ...props }: any) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState<any>(null); // 控制點擊券商後的明細彈窗

  // 1. 分離銀行帳戶與其他資產/證券
  const bankAccounts = accounts.filter(
    (a: any) => a.type === 'bank' || a.account_type === 'bank' || a.name?.includes('銀行')
  );
  const otherAccounts = accounts.filter(
    (a: any) => a.type !== 'bank' && a.account_type !== 'bank' && !a.name?.includes('銀行')
  );

  const totalBalance = accounts.reduce((sum: number, a: any) => sum + (parseFloat(a.balance) || 0), 0);

  // 判斷是否為證券戶
  const isInvestmentAccount = (name: string) => {
    return name.includes('證券') || name.includes('台股') || name.includes('美股');
  };

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
          {/* 恢復更新股價按鈕事件 */}
          <button 
            onClick={() => onUpdateStockPrices?.()}
            className="px-4 py-2 bg-[#D2A782] text-white rounded-xl text-sm font-bold shadow-sm hover:bg-[#C18C6A] transition-colors cursor-pointer"
          >
            ↻ 更新所有證券股價
          </button>
          {/* 恢復新增帳戶按鈕事件 */}
          <button 
            onClick={() => onAddAccount?.()}
            className="px-4 py-2 border border-[#E5E0D8] bg-[#FBF9F5] rounded-xl text-sm font-bold text-[#2C2623] hover:border-[#D1CCC5] transition-colors cursor-pointer"
          >
            + 新增帳戶
          </button>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-10 h-10 border border-[#E5E0D8] bg-white rounded-xl flex items-center justify-center text-[#8C827A] hover:text-[#2C2623] hover:bg-[#F5F2EC] transition-all cursor-pointer"
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
            <div 
              key={a.id} 
              onClick={() => onSelectAccount?.(a)}
              className="flex justify-between items-center p-4 bg-[#FBF9F5] rounded-2xl border border-[#E5E0D8] hover:border-[#D1CCC5] transition-colors cursor-pointer"
            >
              <span className="font-bold text-[#2C2623]">{a.name}</span>
              <span className="font-extrabold text-[#5E8B7E] tracking-tight">${parseFloat(a.balance || 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* 🗂️ 點擊箭頭才顯示的「其他帳戶」區塊（支援點擊證券戶看持股明細） */}
      {isExpanded && otherAccounts.length > 0 && (
        <div className="space-y-3 pt-5 border-t border-[#F5F2EC] animate-in slide-in-from-top-2 duration-300">
          <p className="text-[10px] font-bold text-[#8C827A] tracking-widest uppercase">其他資產與信用卡</p>
          {otherAccounts.map((a: any) => {
            const hasInvestments = isInvestmentAccount(a.name) && a.investments?.length > 0;
            return (
              <div 
                key={a.id} 
                onClick={() => {
                  if (hasInvestments) {
                    setSelectedBroker(a); // 點擊證券戶彈出明細
                  }
                  onSelectAccount?.(a);
                }}
                className="flex justify-between items-center p-4 bg-white rounded-2xl border border-[#E5E0D8] hover:border-[#D1CCC5] transition-colors cursor-pointer"
              >
                <div>
                  <span className="font-bold text-[#8C827A]">{a.name}</span>
                  {hasInvestments && (
                    <span className="ml-2 text-[10px] bg-[#FBF9F5] border border-[#E5E0D8] px-2 py-0.5 rounded-md text-[#D2A782] font-bold">
                      查看持股 ↗
                    </span>
                  )}
                </div>
                <span className="font-extrabold text-[#2C2623] tracking-tight">${parseFloat(a.balance || 0).toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 📈 點擊券商後彈出的股票明細 Modal */}
      {selectedBroker && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C2623]/20 backdrop-blur-sm p-4"
          onClick={() => setSelectedBroker(null)}
        >
          <div 
            className="bg-white rounded-[2rem] max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[#E5E0D8] flex items-center justify-between bg-[#FBF9F5]">
              <div>
                <h3 className="text-lg font-bold text-[#2C2623]">{selectedBroker.name} - 持股明細</h3>
                <p className="text-xs text-[#8C827A] mt-0.5">總市值：${parseFloat(selectedBroker.balance || 0).toLocaleString()}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBroker(null)}
                className="w-8 h-8 rounded-full bg-white border border-[#E5E0D8] flex items-center justify-center text-[#8C827A] hover:text-[#2C2623]"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-3 bg-white">
              {selectedBroker.investments?.length > 0 ? (
                selectedBroker.investments.map((inv: any, idx: number) => (
                  <div key={inv.id || idx} className="p-4 rounded-2xl bg-[#FBF9F5] border border-[#E5E0D8] flex justify-between items-center">
                    <div>
                      <p className="font-bold text-[#2C2623]">{inv.symbol} <span className="text-xs font-normal text-[#8C827A] ml-1">({inv.shares} 股)</span></p>
                      <p className="text-xs text-[#8C827A] mt-0.5">成本價: ${inv.cost_price || inv.costPrice || 0} | 現價: ${inv.current_price || inv.currentPrice || 0}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#2C2623]">${((inv.shares || 0) * (inv.current_price || inv.currentPrice || 0)).toLocaleString()}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-[#8C827A] text-sm font-bold">此帳戶目前無登記持股資料</div>
              )}
            </div>

            <div className="p-5 border-t border-[#E5E0D8] bg-[#FBF9F5] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedBroker(null)}
                className="px-6 py-2.5 bg-[#2C2623] text-white text-sm rounded-xl font-bold hover:bg-black transition-colors"
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
