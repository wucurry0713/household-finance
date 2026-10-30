import React, { useState, useEffect } from 'react';
import { 
  Camera, PlusCircle, Trash2, Settings, Dumbbell, Coffee, 
  ChevronRight, ArrowLeft, RefreshCw, Sparkles, CheckCircle2 
} from 'lucide-react';

const DEFAULT_TARGETS = {
  training: { calories: 2200, protein: 150, carbs: 250, fat: 60, sugar: 40 },
  rest: { calories: 1800, protein: 140, carbs: 180, fat: 55, sugar: 35 }
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('dt_currentUser') || 'husband');
  const [dayType, setDayType] = useState('training'); // 'training' | 'rest'
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'add' | 'settings'
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  
  const [profiles, setProfiles] = useState(() => {
    const saved = localStorage.getItem('dt_profiles');
    if (saved) return JSON.parse(saved);
    return {
      husband: { name: '老公', targets: { ...DEFAULT_TARGETS } },
      wife: { name: '老婆', targets: { ...DEFAULT_TARGETS } }
    };
  });

  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem('dt_logs');
    return saved ? JSON.parse(saved) : [];
  });

  // 表單輸入狀態
  const [formData, setFormData] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    sugar: '',
    mealType: '午餐'
  });

  // AI 辨識狀態
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiMode, setAiMode] = useState('meal'); // 'meal' | 'label'
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => {
    localStorage.setItem('dt_currentUser', currentUser);
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('dt_profiles', JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    localStorage.setItem('dt_logs', JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem('gemini_api_key', apiKey);
  }, [apiKey]);

  const activeProfile = profiles[currentUser];
  const currentTargets = activeProfile.targets[dayType];

  // 計算今日累計 (過濾當前使用者與今日日期)
  const todayStr = new Date().toISOString().split('T')[0];
  const userTodayLogs = logs.filter(
    l => l.user === currentUser && l.date.startsWith(todayStr)
  );

  const totals = userTodayLogs.reduce((acc, item) => ({
    calories: acc.calories + (Number(item.calories) || 0),
    protein: acc.protein + (Number(item.protein) || 0),
    carbs: acc.carbs + (Number(item.carbs) || 0),
    fat: acc.fat + (Number(item.fat) || 0),
    sugar: acc.sugar + (Number(item.sugar) || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0 });

  // 處理照片上傳與 Base64 轉換
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
      callGeminiAI(reader.result);
    };
    reader.readAsDataURL(file);
  };

  // 呼叫 Gemini Flash 進行多模態辨識
  const callGeminiAI = async (base64Image) => {
    setIsAnalyzing(true);
    const cleanBase64 = base64Image.split(',')[1];

    if (!apiKey) {
      // 模擬回傳，供尚未設定 API Key 時快速測試
      setTimeout(() => {
        setFormData({
          name: aiMode === 'meal' ? 'AI辨識：雞胸肉沙拉' : 'AI辨識：燕麥奶',
          calories: '320',
          protein: '28',
          carbs: '22',
          fat: '8',
          sugar: '4',
          mealType: '午餐'
        });
        setIsAnalyzing(false);
      }, 1200);
      return;
    }

    try {
      const prompt = aiMode === 'meal'
        ? `這是一張食物/料理的照片。請辨識食物名稱，並估算這份餐點的總營養成分。請嚴格只以標準 JSON 格式輸出，不得有 Markdown 標記，格式如下：
           {"name": "料理名稱", "calories": 450, "protein": 30, "carbs": 40, "fat": 12, "sugar": 5}`
        : `這是一張食品包裝上的營養標示表格照片。請辨識並提取其營養數值。如果標示為每份或每100g，請以整份總量或單份為準填入。請嚴格只以標準 JSON 格式輸出，不得有 Markdown 標記，格式如下：
           {"name": "食品名稱", "calories": 250, "protein": 10, "carbs": 30, "fat": 5, "sugar": 8}`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } }
            ]
          }]
        })
      });

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleanJsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJsonStr);

      setFormData(prev => ({
        ...prev,
        name: parsed.name || prev.name,
        calories: parsed.calories?.toString() || prev.calories,
        protein: parsed.protein?.toString() || prev.protein,
        carbs: parsed.carbs?.toString() || prev.carbs,
        fat: parsed.fat?.toString() || prev.fat,
        sugar: parsed.sugar?.toString() || prev.sugar
      }));
    } catch (err) {
      alert('辨識失敗或網路錯誤，請手動確認填寫。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveMeal = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.calories) return;

    const newEntry = {
      id: Date.now().toString(),
      user: currentUser,
      date: new Date().toISOString(),
      ...formData
    };

    setLogs([newEntry, ...logs]);
    setFormData({ name: '', calories: '', protein: '', carbs: '', fat: '', sugar: '', mealType: '午餐' });
    setImagePreview(null);
    setView('dashboard');
  };

  const handleDelete = (id) => {
    setLogs(logs.filter(l => l.id !== id));
  };

  const handleTargetChange = (user, type, key, value) => {
    setProfiles(prev => ({
      ...prev,
      [user]: {
        ...prev[user],
        targets: {
          ...prev[user].targets,
          [type]: {
            ...prev[user].targets[type],
            [key]: Number(value) || 0
          }
        }
      }
    }));
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans pb-10">
      {/* 頂部切換夫妻身分與設定 */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-20 flex justify-between items-center shadow-sm">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setCurrentUser('husband')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${currentUser === 'husband' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600'}`}
          >
            {profiles.husband.name}
          </button>
          <button
            onClick={() => setCurrentUser('wife')}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${currentUser === 'wife' ? 'bg-pink-500 text-white shadow' : 'text-slate-600'}`}
          >
            {profiles.wife.name}
          </button>
        </div>

        <button 
          onClick={() => setView(view === 'settings' ? 'dashboard' : 'settings')}
          className="p-2 text-slate-500 hover:text-slate-800 rounded-lg"
        >
          <Settings size={20} />
        </button>
      </header>

      {/* 主儀表板畫面 */}
      {view === 'dashboard' && (
        <main className="p-4 flex-1 space-y-4">
          {/* 日期與訓練/休息切換 */}
          <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
            <div>
              <p className="text-xs text-slate-400 font-medium">今日模式</p>
              <h2 className="text-base font-bold text-slate-800">
                {dayType === 'training' ? '🔥 重訓日 (高蛋白/高碳)' : '☕ 休息日 (低碳修復)'}
              </h2>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setDayType('training')}
                className={`p-2 rounded-lg flex items-center gap-1 text-xs font-semibold ${dayType === 'training' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}
              >
                <Dumbbell size={14} /> 重訓
              </button>
              <button
                onClick={() => setDayType('rest')}
                className={`p-2 rounded-lg flex items-center gap-1 text-xs font-semibold ${dayType === 'rest' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}
              >
                <Coffee size={14} /> 休息
              </button>
            </div>
          </div>

          {/* 熱量核心卡片 */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-3xl shadow-lg relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-xs text-slate-300">今日總熱量上限</p>
                <p className="text-3xl font-extrabold mt-1">
                  {totals.calories} <span className="text-sm font-normal text-slate-400">/ {currentTargets.calories} kcal</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-300">剩餘額度</p>
                <p className={`text-xl font-bold mt-1 ${currentTargets.calories - totals.calories < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {currentTargets.calories - totals.calories}
                </p>
              </div>
            </div>

            {/* 熱量進度條 */}
            <div className="w-full bg-slate-700/60 h-2.5 rounded-full overflow-hidden mt-3">
              <div 
                className={`h-full transition-all duration-300 ${totals.calories > currentTargets.calories ? 'bg-red-500' : 'bg-indigo-400'}`}
                style={{ width: `${Math.min((totals.calories / (currentTargets.calories || 1)) * 100, 100)}%` }}
              />
            </div>
          </div>

          {/* 四大營養素進度網格 */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '蛋白質', current: totals.protein, target: currentTargets.protein, unit: 'g', color: 'bg-emerald-500' },
              { label: '碳水化合物', current: totals.carbs, target: currentTargets.carbs, unit: 'g', color: 'bg-blue-500' },
              { label: '脂肪', current: totals.fat, target: currentTargets.fat, unit: 'g', color: 'bg-amber-500' },
              { label: '糖分上限', current: totals.sugar, target: currentTargets.sugar, unit: 'g', color: 'bg-rose-500' }
            ].map((macro) => (
              <div key={macro.label} className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex justify-between items-center text-xs mb-1">
                  <span className="font-semibold text-slate-600">{macro.label}</span>
                  <span className="text-slate-400">{macro.current} / {macro.target}{macro.unit}</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                  <div 
                    className={`h-full ${macro.color}`}
                    style={{ width: `${Math.min((macro.current / (macro.target || 1)) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* 新增紀錄按鈕入口 */}
          <div className="pt-2">
            <button
              onClick={() => setView('add')}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-2xl shadow-md flex items-center justify-center gap-2 transition"
            >
              <PlusCircle size={20} /> 記錄這餐（手動 / AI 拍照辨識）
            </button>
          </div>

          {/* 今日飲食清單 */}
          <div className="space-y-2 pt-2">
            <h3 className="text-sm font-bold text-slate-600 px-1">今日紀錄清單 ({userTodayLogs.length})</h3>
            {userTodayLogs.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-400 text-sm">今天還沒有紀錄任何餐點</p>
              </div>
            ) : (
              userTodayLogs.map((item) => (
                <div key={item.id} className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md font-medium">{item.mealType}</span>
                      <h4 className="font-bold text-slate-800 text-sm">{item.name}</h4>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {item.calories} kcal ｜ 蛋 {item.protein}g ｜ 碳 {item.carbs}g ｜ 脂 {item.fat}g ｜ 糖 {item.sugar}g
                    </p>
                  </div>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-slate-300 hover:text-red-500 rounded-lg"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </main>
      )}

      {/* 新增餐點 / 拍照辨識畫面 */}
      {view === 'add' && (
        <div className="p-4 flex-1">
          <div className="flex items-center justify-between mb-4">
            <button 
              onClick={() => setView('dashboard')}
              className="p-1 text-slate-600 flex items-center gap-1 text-sm font-semibold"
            >
              <ArrowLeft size={18} /> 返回儀表板
            </button>
            <h2 className="font-bold text-base">新增飲食紀錄</h2>
            <div className="w-8" />
          </div>

          {/* AI 拍照/上傳辨識區塊 */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-indigo-800 flex items-center gap-1">
                <Sparkles size={14} /> AI 智能辨識帶入
              </span>
              <div className="flex bg-white rounded-lg p-0.5 border border-indigo-100 text-xs">
                <button
                  type="button"
                  onClick={() => setAiMode('meal')}
                  className={`px-2.5 py-1 rounded-md font-medium ${aiMode === 'meal' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}
                >
                  食物估算
                </button>
                <button
                  type="button"
                  onClick={() => setAiMode('label')}
                  className={`px-2.5 py-1 rounded-md font-medium ${aiMode === 'label' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}
                >
                  營養標籤 OCR
                </button>
              </div>
            </div>

            <label className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-200 bg-white rounded-xl p-4 cursor-pointer hover:bg-indigo-50/50 transition">
              {imagePreview ? (
                <div className="relative w-full h-36">
                  <img src={imagePreview} alt="預覽" className="w-full h-full object-cover rounded-lg" />
                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-black/50 rounded-lg flex flex-col items-center justify-center text-white">
                      <RefreshCw className="animate-spin mb-1" size={24} />
                      <span className="text-xs">AI 辨識營養成分中...</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-2">
                  <Camera className="mx-auto text-indigo-500 mb-1" size={28} />
                  <span className="text-xs font-medium text-slate-600">拍照或上傳食物/標籤圖片</span>
                </div>
              )}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageUpload} />
            </label>
          </div>

          {/* 手動輸入 / 確認數值表單 */}
          <form onSubmit={handleSaveMeal} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-500">餐點名稱</label>
              <input 
                type="text"
                required
                placeholder="例如：舒肥雞胸便當"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500">熱量 (kcal)</label>
                <input 
                  type="number"
                  required
                  placeholder="0"
                  value={formData.calories}
                  onChange={e => setFormData({ ...formData, calories: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">餐別</label>
                <select 
                  value={formData.mealType}
                  onChange={e => setFormData({ ...formData, mealType: e.target.value })}
                  className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                >
                  <option>早餐</option>
                  <option>午餐</option>
                  <option>晚餐</option>
                  <option>點心/補給</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-1">
              <div>
                <label className="text-xs font-bold text-slate-500">蛋白(g)</label>
                <input 
                  type="number"
                  value={formData.protein}
                  onChange={e => setFormData({ ...formData, protein: e.target.value })}
                  className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">碳水(g)</label>
                <input 
                  type="number"
                  value={formData.carbs}
                  onChange={e => setFormData({ ...formData, carbs: e.target.value })}
                  className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">脂肪(g)</label>
                <input 
                  type="number"
                  value={formData.fat}
                  onChange={e => setFormData({ ...formData, fat: e.target.value })}
                  className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">糖(g)</label>
                <input 
                  type="number"
                  value={formData.sugar}
                  onChange={e => setFormData({ ...formData, sugar: e.target.value })}
                  className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-4 bg-slate-900 text-white font-bold py-3 rounded-xl shadow transition"
            >
              儲存此筆飲食紀錄
            </button>
          </form>
        </div>
      )}

      {/* 設定畫面（熱量/營養素上限與 API Key 設定） */}
      {view === 'settings' && (
        <div className="p-4 flex-1 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <button 
              onClick={() => setView('dashboard')}
              className="p-1 text-slate-600 flex items-center gap-1 text-sm font-semibold"
            >
              <ArrowLeft size={18} /> 返回儀表板
            </button>
            <h2 className="font-bold text-base">個人目標與設定</h2>
            <div className="w-8" />
          </div>

          {/* Gemini API Key */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
            <h3 className="text-sm font-bold text-slate-800">Google Gemini API Key (免費版)</h3>
            <p className="text-xs text-slate-400">填入 API Key 即可啟動真實 AI 拍照與營養標籤辨識。留空時會使用內建測試資料。</p>
            <input 
              type="password"
              placeholder="貼上 AI Studio 取得的 API Key"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
            />
          </div>

          {/* 當前使用者的目標設定 */}
          {['training', 'rest'].map((mode) => (
            <div key={mode} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-800">
                {activeProfile.name} - {mode === 'training' ? '🔥 重訓日上限設定' : '☕ 休息日上限設定'}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">熱量上限 (kcal)</label>
                  <input 
                    type="number"
                    value={activeProfile.targets[mode].calories}
                    onChange={e => handleTargetChange(currentUser, mode, 'calories', e.target.value)}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">蛋白質 (g)</label>
                  <input 
                    type="number"
                    value={activeProfile.targets[mode].protein}
                    onChange={e => handleTargetChange(currentUser, mode, 'protein', e.target.value)}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">碳水化合物 (g)</label>
                  <input 
                    type="number"
                    value={activeProfile.targets[mode].carbs}
                    onChange={e => handleTargetChange(currentUser, mode, 'carbs', e.target.value)}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">脂肪 (g)</label>
                  <input 
                    type="number"
                    value={activeProfile.targets[mode].fat}
                    onChange={e => handleTargetChange(currentUser, mode, 'fat', e.target.value)}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-slate-400">精緻糖上限 (g)</label>
                  <input 
                    type="number"
                    value={activeProfile.targets[mode].sugar}
                    onChange={e => handleTargetChange(currentUser, mode, 'sugar', e.target.value)}
                    className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  />
                </div>
              </div>
            </div>
          ))}

          {/* 備份與還原 */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
            <h3 className="text-sm font-bold text-slate-800">資料備份與夫妻同步</h3>
            <p className="text-xs text-slate-400">可將資料匯出成 JSON 備份檔，或傳給另一半的手機直接匯入。</p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ profiles, logs }));
                  const downloadAnchor = document.createElement('a');
                  downloadAnchor.setAttribute("href", dataStr);
                  downloadAnchor.setAttribute("download", `diet_backup_${todayStr}.json`);
                  document.body.appendChild(downloadAnchor);
                  downloadAnchor.click();
                  downloadAnchor.remove();
                }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-semibold"
              >
                匯出備份 (JSON)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
