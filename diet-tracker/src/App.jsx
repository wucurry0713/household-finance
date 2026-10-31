import React, { useState, useEffect } from 'react';
import { 
  Camera, PlusCircle, Trash2, Settings, Dumbbell, Coffee, 
  ChevronRight, ChevronLeft, Calendar, ArrowLeft, RefreshCw, 
  Sparkles, FileText, Image as ImageIcon, Check
} from 'lucide-react';

const DEFAULT_TARGETS = {
  training: { calories: 1800, protein: 130, carbs: 180, fat: 50, sugar: 25 },
  rest: { calories: 1500, protein: 130, carbs: 120, fat: 40, sugar: 25 }
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('dt_currentUser') || 'husband');
  const [dayType, setDayType] = useState('training');
  const [view, setView] = useState('dashboard');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [showSavedToast, setShowSavedToast] = useState(false);
  
  const getTodayStr = () => new Date().toLocaleDateString('sv-SE');
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  
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

  const [formData, setFormData] = useState({
    name: '', calories: '', protein: '', carbs: '', fat: '', sugar: '', mealType: '午餐'
  });

  const [aiMode, setAiMode] = useState('text');
  const [textDescription, setTextDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);

  useEffect(() => { localStorage.setItem('dt_currentUser', currentUser); }, [currentUser]);
  useEffect(() => { localStorage.setItem('dt_profiles', JSON.stringify(profiles)); }, [profiles]);
  useEffect(() => { localStorage.setItem('dt_logs', JSON.stringify(logs)); }, [logs]);
  useEffect(() => { localStorage.setItem('gemini_api_key', apiKey.trim()); }, [apiKey]);

  const activeProfile = profiles[currentUser];
  const currentTargets = activeProfile.targets[dayType];

  const changeDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toLocaleDateString('sv-SE'));
  };

  const currentDayLogs = logs.filter(
    l => l.user === currentUser && l.date.startsWith(selectedDate)
  );

  const totals = currentDayLogs.reduce((acc, item) => ({
    calories: acc.calories + (Number(item.calories) || 0),
    protein: acc.protein + (Number(item.protein) || 0),
    carbs: acc.carbs + (Number(item.carbs) || 0),
    fat: acc.fat + (Number(item.fat) || 0),
    sugar: acc.sugar + (Number(item.sugar) || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0 });

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
      callGeminiAI({ type: 'image', data: reader.result, mimeType: file.type || 'image/jpeg' });
    };
    reader.readAsDataURL(file);
  };

  const handleTextAnalyze = () => {
    if (!textDescription.trim()) {
      alert('請先輸入餐點描述！');
      return;
    }
    callGeminiAI({ type: 'text', data: textDescription.trim() });
  };

  // 唯一指定使用官方強制要求的 gemini-3.8-flash 模型
  const callGeminiAI = async (input) => {
    const cleanKey = apiKey.trim();
    if (!cleanKey) {
      alert('請先至設定填入 Gemini API 金鑰！');
      return;
    }

    setIsAnalyzing(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      let contents = [];

      if (input.type === 'text') {
        const prompt = '你是專業營養師。請依照台灣常見外食標準，精算這份餐點。請務必「僅」回傳 JSON 格式物件，不要任何 markdown 標記或開場白。\n格式：{"name": "餐點名稱", "calories": 500, "protein": 30, "carbs": 55, "fat": 15, "sugar": 5}\n餐點描述：「' + input.data + '」';
        contents = [{ parts: [{ text: prompt }] }];
      } else {
        const base64Data = input.data.split(',')[1];
        const mimeType = input.mimeType || 'image/jpeg';
        const prompt = '這是一張食物或營養標示。請精準辨識圖中數值(熱量/蛋白質/脂肪/碳水等)或食物內容。請務必「僅」回傳 JSON 格式物件，不要任何 markdown 標記或開場白。\n格式：{"name": "辨識出的名稱", "calories": 159, "protein": 30, "carbs": 10, "fat": 3, "sugar": 2}';
        contents = [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: mimeType, data: base64Data } }
          ]
        }];
      }

      // 直接強制呼叫官方指定的 gemini-3.8-flash 帶著 x-goog-api-key 標頭
      const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-goog-api-key': cleanKey 
        },
        signal: controller.signal,
        body: JSON.stringify({ contents })
      });

      clearTimeout(timeoutId);
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error?.message || 'API 錯誤 (' + res.status + ')');
      }

      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('AI 沒有回傳正確的數值格式');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);

      setFormData(prev => ({
        ...prev,
        name: parsed.name || prev.name,
        calories: parsed.calories !== undefined ? Math.round(Number(parsed.calories)).toString() : prev.calories,
        protein: parsed.protein !== undefined ? Math.round(Number(parsed.protein)).toString() : prev.protein,
        carbs: parsed.carbs !== undefined ? Math.round(Number(parsed.carbs)).toString() : prev.carbs,
        fat: parsed.fat !== undefined ? Math.round(Number(parsed.fat)).toString() : prev.fat,
        sugar: parsed.sugar !== undefined ? Math.round(Number(parsed.sugar)).toString() : prev.sugar
      }));
    } catch (err) {
      if (err.name === 'AbortError') {
        alert('連線超時！請檢查網路或稍後再試。');
      } else {
        alert('AI 辨識失敗：' + err.message);
      }
    } finally {
      clearTimeout(timeoutId);
      setIsAnalyzing(false);
    }
  };

  const handleSaveMeal = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.calories) return;

    const currentTime = new Date().toISOString().split('T')[1];
    const newEntry = {
      id: Date.now().toString(),
      user: currentUser,
      date: selectedDate + 'T' + currentTime, 
      ...formData
    };

    setLogs([newEntry, ...logs]);
    setFormData({ name: '', calories: '', protein: '', carbs: '', fat: '', sugar: '', mealType: '午餐' });
    setImagePreview(null);
    setTextDescription('');
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

  const handleSaveSettings = () => {
    localStorage.setItem('dt_profiles', JSON.stringify(profiles));
    localStorage.setItem('gemini_api_key', apiKey.trim());
    setShowSavedToast(true);
    setTimeout(() => {
      setShowSavedToast(false);
      setView('dashboard');
    }, 800);
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans pb-10">
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

      {view === 'dashboard' && (
        <main className="p-4 flex-1 space-y-4">
          <div className="flex justify-between items-center bg-white p-2.5 rounded-2xl border border-slate-100 shadow-sm">
            <button onClick={() => changeDate(-1)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition">
              <ChevronLeft size={20} />
            </button>
            <div className="flex items-center gap-2 font-bold text-slate-700 text-sm">
              <Calendar size={16} className="text-indigo-600"/>
              <input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent font-bold text-slate-700 focus:outline-none cursor-pointer"
              />
              {selectedDate === getTodayStr() && <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">今天</span>}
            </div>
            <button onClick={() => changeDate(1)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition">
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="flex justify-between items-center bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
            <div>
              <p className="text-xs text-slate-400 font-medium">當日模式</p>
              <h2 className="text-base font-bold text-slate-800">
                {dayType === 'training' ? '🔥 重訓日' : '☕ 休息日'}
              </h2>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button onClick={() => setDayType('training')} className={`p-2 rounded-lg flex items-center gap-1 text-xs font-semibold ${dayType === 'training' ? 'bg-white shadow text-indigo-600' : 'text-slate-500'}`}>
                <Dumbbell size={14} /> 重訓
              </button>
              <button onClick={() => setDayType('rest')} className={`p-2 rounded-lg flex items-center gap-1 text-xs font-semibold ${dayType === 'rest' ? 'bg-white shadow text-emerald-600' : 'text-slate-500'}`}>
                <Coffee size={14} /> 休息
              </button>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-3xl shadow-lg relative overflow-hidden">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-xs text-slate-300">總熱量攝取</p>
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
            <div className="w-full bg-slate-700/60 h-2.5 rounded-full overflow-hidden mt-3">
              <div className={`h-full transition-all duration-300 ${totals.calories > currentTargets.calories ? 'bg-red-500' : 'bg-indigo-400'}`} style={{ width: `${Math.min((totals.calories / (currentTargets.calories || 1)) * 100, 100)}%` }} />
            </div>
          </div>

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
                  <div className={`h-full ${macro.color}`} style={{ width: `${Math.min((macro.current / (macro.target || 1)) * 100, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <button onClick={() => setView('add')} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-2xl shadow-md flex items-center justify-center gap-2 transition">
              <PlusCircle size={20} /> 記錄這餐（文字 / 拍照）
            </button>
          </div>

          <div className="space-y-2 pt-2">
            <h3 className="text-sm font-bold text-slate-600 px-1">{selectedDate} 紀錄清單 ({currentDayLogs.length})</h3>
            {currentDayLogs.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200">
                <p className="text-slate-400 text-sm">這天還沒有紀錄任何餐點</p>
              </div>
            ) : (
              currentDayLogs.map((item) => (
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
                  <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-300 hover:text-red-500 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </main>
      )}

      {view === 'add' && (
        <div className="p-4 flex-1">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setView('dashboard')} className="p-1 text-slate-600 flex items-center gap-1 text-sm font-semibold">
              <ArrowLeft size={18} /> 返回儀表板
            </button>
            <h2 className="font-bold text-base">新增紀錄 ({selectedDate})</h2>
            <div className="w-8" />
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 mb-4">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold text-indigo-800 flex items-center gap-1"><Sparkles size={14} /> Gemini 3.8 Flash 辨識</span>
              <div className="flex bg-white rounded-lg p-0.5 border border-indigo-100 text-xs">
                <button type="button" onClick={() => setAiMode('text')} className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 ${aiMode === 'text' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}><FileText size={12} /> 文字形容</button>
                <button type="button" onClick={() => setAiMode('meal')} className={`px-2.5 py-1 rounded-md font-medium flex items-center gap-1 ${aiMode === 'meal' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}><ImageIcon size={12} /> 拍照/標籤辨識</button>
              </div>
            </div>

            {aiMode === 'text' && (
              <div className="space-y-2">
                <textarea rows={3} value={textDescription} onChange={e => setTextDescription(e.target.value)} placeholder="例如：麥香魚、排骨飯" className="w-full p-2.5 text-sm bg-white border border-indigo-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                <button type="button" onClick={handleTextAnalyze} disabled={isAnalyzing} className="w-full bg-indigo-600 text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition disabled:bg-indigo-300">
                  {isAnalyzing ? <><RefreshCw className="animate-spin" size={14} /> 飆速分析中...</> : <><Sparkles size={14} /> 讓 AI 估算營養素並帶入</>}
                </button>
              </div>
            )}

            {aiMode === 'meal' && (
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-200 bg-white rounded-xl p-4 cursor-pointer hover:bg-indigo-50/50 transition">
                {imagePreview ? (
                  <div className="relative w-full h-36">
                    <img src={imagePreview} alt="預覽" className="w-full h-full object-cover rounded-lg" />
                    {isAnalyzing && <div className="absolute inset-0 bg-black/50 rounded-lg flex flex-col items-center justify-center text-white"><RefreshCw className="animate-spin mb-1" size={24} /><span className="text-xs">高速讀取標籤與照片...</span></div>}
                  </div>
                ) : (
                  <div className="text-center py-2"><Camera className="mx-auto text-indigo-500 mb-1" size={28} /><span className="text-xs font-medium text-slate-600">點擊拍攝食物或營養標示照片</span></div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            )}
          </div>

          <form onSubmit={handleSaveMeal} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-500">餐點名稱</label>
              <input type="text" required placeholder="例如：排骨便當" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500">熱量 (kcal)</label>
                <input type="number" required placeholder="0" value={formData.calories} onChange={e => setFormData({ ...formData, calories: e.target.value })} className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">餐別</label>
                <select value={formData.mealType} onChange={e => setFormData({ ...formData, mealType: e.target.value })} className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                  <option>早餐</option><option>午餐</option><option>晚餐</option><option>點心/補給</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 pt-1">
              {['protein', 'carbs', 'fat', 'sugar'].map(macro => (
                <div key={macro}>
                  <label className="text-xs font-bold text-slate-500">{macro === 'protein' ? '蛋白' : macro === 'carbs' ? '碳水' : macro === 'fat' ? '脂肪' : '糖'}(g)</label>
                  <input type="number" value={formData[macro]} onChange={e => setFormData({ ...formData, [macro]: e.target.value })} className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs" />
                </div>
              ))}
            </div>
            <button type="submit" className="w-full mt-4 bg-slate-900 text-white font-bold py-3 rounded-xl shadow transition">
              儲存至 {selectedDate}
            </button>
          </form>
        </div>
      )}

      {view === 'settings' && (
        <div className="p-4 flex-1 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => setView('dashboard')} className="p-1 text-slate-600 flex items-center gap-1 text-sm font-semibold"><ArrowLeft size={18} /> 返回儀表板</button>
            <h2 className="font-bold text-base">個人目標與設定</h2>
            <div className="w-8" />
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
            <h3 className="text-sm font-bold text-slate-800">Gemini API 金鑰設定</h3>
            <p className="text-xs text-slate-400">已全面切換為官方指定 gemini-3.8-flash 模型。</p>
            <input type="password" placeholder="貼上 API 金鑰" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
          </div>

          {['training', 'rest'].map((mode) => (
            <div key={mode} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-slate-800">{activeProfile.name} - {mode === 'training' ? '🔥 重訓日上限設定' : '☕ 休息日上限設定'}</h3>
              <div className="grid grid-cols-2 gap-3">
                {['calories', 'protein', 'carbs', 'fat', 'sugar'].map(key => (
                  <div key={key} className={key === 'sugar' ? 'col-span-2' : ''}>
                    <label className="text-xs text-slate-400">{key === 'calories' ? '熱量 (kcal)' : key === 'protein' ? '蛋白質 (g)' : key === 'carbs' ? '碳水 (g)' : key === 'fat' ? '脂肪 (g)' : '精緻糖 (g)'}</label>
                    <input type="number" value={activeProfile.targets[mode][key]} onChange={e => handleTargetChange(currentUser, mode, key, e.target.value)} className={`w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm ${key === 'calories' ? 'font-bold' : ''}`} />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <button type="button" onClick={handleSaveSettings} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow flex items-center justify-center gap-2 transition">
            {showSavedToast ? <><Check className="text-white" size={18} /> 設定已成功儲存！</> : '儲存所有設定並返回'}
          </button>
          
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
            <h3 className="text-sm font-bold text-slate-800">資料備份與還原</h3>
            <button type="button" onClick={() => {
              const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ profiles, logs }));
              const downloadAnchor = document.createElement('a'); downloadAnchor.setAttribute("href", dataStr); downloadAnchor.setAttribute("download", 'diet_backup_' + getTodayStr() + '.json');
              document.body.appendChild(downloadAnchor); downloadAnchor.click(); downloadAnchor.remove();
            }} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-semibold">匯出備份 (JSON)</button>
          </div>
        </div>
      )}
    </div>
  );
}
