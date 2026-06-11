import { useMemo, useState } from 'react';
import {
  Search, X, Check, CalendarDays, Users, Trophy, User, Plus,
  ChevronsUpDown, Heart, Send,
} from 'lucide-react';

// ── モックデータ ──────────────────────────────────────────────────────────────

const MOCK_MEMBERS = [
  'B1阿部悠真', 'B1石川蓮', 'B1上田大和', 'B1遠藤湊',
  'B2加藤陽翔', 'B2木村颯太', 'B2小林岳',
  'B3佐藤健心', 'B3清水律', 'B3鈴木朝陽', 'B3高橋奏太',
  'B4田村航大', 'B4中村樹',
  'M1橋本悠', 'M2藤井遼',
];

const getGrade = (name) => name.match(/^[BM]\d/)?.[0] ?? 'その他';
const getName = (name) => name.replace(/^[BM]\d/, '');

const INTENSITIES = [
  { key: 'jog', label: '低強度 (jog)', dot: '#007aff' },
  { key: 'mlt', label: '中強度 (M-LT)', dot: '#34c759' },
  { key: 'cv', label: '高強度 (CV-VO2)', dot: '#ffcc00' },
  { key: 'speed', label: '解糖系 (スピード)', dot: '#ff9500' },
];

// ── 共通パーツ ────────────────────────────────────────────────────────────────

function Section({ title, description, children }) {
  return (
    <section className="mb-10">
      <h2 className="text-[17px] font-bold text-zinc-900 mb-1">{title}</h2>
      <p className="text-[13px] text-zinc-500 mb-4 leading-relaxed">{description}</p>
      {children}
    </section>
  );
}

function VariantTabs({ variants, active, onChange }) {
  return (
    <div className="bg-zinc-200/60 p-0.5 rounded-xl flex mb-4">
      {variants.map(v => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`flex-1 py-1.5 text-[12px] font-semibold rounded-[10px] transition-all ${
            active === v ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500'
          }`}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

/** スマホ画面風のフレーム */
function PhoneFrame({ children, className = '' }) {
  return (
    <div className={`mx-auto w-full max-w-[390px] rounded-[28px] border border-zinc-200 bg-[#f2f2f7] overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.06)] ${className}`}>
      {children}
    </div>
  );
}

// ── 1. 人選択シート: A案 検索付き1列リスト ───────────────────────────────────

function MemberPickerList({ selected, onSelect }) {
  const [query, setQuery] = useState('');

  const grouped = useMemo(() => {
    const filtered = MOCK_MEMBERS.filter(m =>
      !query.trim() || m.toLowerCase().includes(query.trim().toLowerCase())
    );
    const groups = {};
    filtered.forEach(m => {
      const g = getGrade(m);
      (groups[g] ??= []).push(m);
    });
    return groups;
  }, [query]);

  return (
    <div className="flex flex-col h-[480px]">
      {/* ハンドル + ヘッダー */}
      <div className="shrink-0 pt-2.5">
        <div className="w-9 h-1 bg-zinc-300 rounded-full mx-auto" />
        <div className="flex items-center justify-between px-4 pt-3 pb-2.5">
          <h3 className="text-[17px] font-semibold text-zinc-900">部員を選択</h3>
          <button className="w-7 h-7 rounded-full bg-zinc-200/70 flex items-center justify-center text-zinc-500 active:scale-95 transition-all" aria-label="閉じる">
            <X size={14} />
          </button>
        </div>
        {/* 検索バー */}
        <div className="px-4 pb-2.5">
          <div className="flex items-center gap-1.5 bg-zinc-200/55 rounded-[10px] px-2.5 py-[7px]">
            <Search size={15} className="text-zinc-400 shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="検索"
              className="flex-1 bg-transparent outline-none text-[15px] text-zinc-900 placeholder:text-zinc-400 min-w-0"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-zinc-400" aria-label="クリア">
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* グループ化リスト */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {Object.keys(grouped).length === 0 && (
          <p className="text-center text-[13px] text-zinc-400 py-10">該当するメンバーがいません</p>
        )}
        {Object.entries(grouped).map(([grade, names]) => (
          <div key={grade} className="mb-4">
            <p className="text-[13px] font-medium text-zinc-500 px-3 mb-1.5">{grade}</p>
            <div className="bg-white rounded-2xl overflow-hidden">
              {names.map((m, i) => (
                <button
                  key={m}
                  onClick={() => onSelect(m)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-left active:bg-zinc-50 transition-colors ${
                    i > 0 ? 'border-t border-zinc-100' : ''
                  }`}
                >
                  <span className="text-[16px] text-zinc-900">{getName(m)}</span>
                  {selected === m && <Check size={18} className="text-[#007aff]" strokeWidth={2.5} />}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 1. 人選択シート: B案 簡素化2列グリッド ───────────────────────────────────

function MemberPickerGrid({ selected, onSelect }) {
  const [grade, setGrade] = useState('');
  const grades = [...new Set(MOCK_MEMBERS.map(getGrade))];
  const filtered = MOCK_MEMBERS.filter(m => !grade || getGrade(m) === grade);

  return (
    <div className="flex flex-col h-[480px]">
      <div className="shrink-0 pt-2.5">
        <div className="w-9 h-1 bg-zinc-300 rounded-full mx-auto" />
        <div className="flex items-center justify-between px-4 pt-3 pb-2.5">
          <h3 className="text-[17px] font-semibold text-zinc-900">部員を選択</h3>
          <button className="w-7 h-7 rounded-full bg-zinc-200/70 flex items-center justify-center text-zinc-500 active:scale-95 transition-all" aria-label="閉じる">
            <X size={14} />
          </button>
        </div>
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-2.5 scrollbar-none">
          {['', ...grades].map(g => (
            <button
              key={g || 'all'}
              onClick={() => setGrade(g)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all ${
                grade === g ? 'bg-[#007aff] text-white' : 'bg-zinc-200/55 text-zinc-600'
              }`}
            >
              {g || 'すべて'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 grid grid-cols-2 gap-2 content-start">
        {filtered.map(m => {
          const isSelected = selected === m;
          return (
            <button
              key={m}
              onClick={() => onSelect(m)}
              className={`flex items-center justify-between px-3.5 py-3 rounded-2xl text-left transition-all active:scale-[0.98] ${
                isSelected ? 'bg-[#007aff]/10 text-[#007aff]' : 'bg-white text-zinc-900'
              }`}
            >
              <div className="min-w-0">
                <span className="text-[11px] text-zinc-400 block leading-none">{getGrade(m)}</span>
                <span className={`text-[14px] block mt-1 truncate ${isSelected ? 'font-semibold' : ''}`}>{getName(m)}</span>
              </div>
              {isSelected && <Check size={16} strokeWidth={2.5} className="shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── 2. マイページのメンバートリガー行 ────────────────────────────────────────

function TriggerCurrent() {
  return (
    <div className="bg-white border border-slate-100 rounded-3xl p-3.5 shadow-sm flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500">
          <User size={18} />
        </div>
        <div>
          <span className="text-[9px] font-bold text-slate-400 block leading-none">マイページ</span>
          <span className="text-base font-black text-slate-800 block mt-0.5 leading-none">佐藤健心</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1 bg-emerald-50 border border-emerald-100 text-emerald-600 px-3.5 py-2.5 rounded-2xl text-xs font-black shadow-sm">
          ⚡
        </button>
        <button className="flex items-center gap-1 bg-blue-50 border border-blue-100 text-blue-600 px-3.5 py-2.5 rounded-2xl text-xs font-black shadow-sm">
          <Users size={14} />
        </button>
      </div>
    </div>
  );
}

function TriggerProposed({ onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="w-full bg-white rounded-2xl px-4 py-3 flex items-center justify-between active:bg-zinc-50 transition-colors"
    >
      <span className="text-[15px] text-zinc-500">メンバー</span>
      <span className="flex items-center gap-1.5">
        <span className="text-[16px] font-semibold text-zinc-900">佐藤健心</span>
        <ChevronsUpDown size={15} className="text-zinc-400" />
      </span>
    </button>
  );
}

// ── 3. 距離入力 ──────────────────────────────────────────────────────────────

function DistanceVariantMono() {
  const [values, setValues] = useState({});
  return (
    <div className="bg-white rounded-2xl p-3.5">
      <p className="text-[13px] font-medium text-zinc-500 mb-2.5">走行距離 (km)</p>
      <div className="grid grid-cols-2 gap-2.5">
        {INTENSITIES.map(it => (
          <div key={it.key}>
            <span className="flex items-center gap-1.5 text-[12px] text-zinc-500 mb-1">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: it.dot }} />
              {it.label}
            </span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.0"
              value={values[it.key] ?? ''}
              onChange={e => setValues(v => ({ ...v, [it.key]: e.target.value }))}
              className="w-full bg-[#f2f2f7] rounded-xl px-3 py-2.5 text-[15px] font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-[#007aff]/25"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function DistanceVariantColor() {
  const [values, setValues] = useState({});
  const colors = { jog: 'text-[#007aff]', mlt: 'text-emerald-500', cv: 'text-amber-500', speed: 'text-orange-500' };
  return (
    <div className="bg-white rounded-2xl p-3.5">
      <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2.5">走行距離 (km)</p>
      <div className="grid grid-cols-2 gap-2.5">
        {INTENSITIES.map(it => (
          <div key={it.key}>
            <span className={`text-[9px] font-extrabold block mb-0.5 ${colors[it.key]}`}>{it.label}</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.0"
              value={values[it.key] ?? ''}
              onChange={e => setValues(v => ({ ...v, [it.key]: e.target.value }))}
              className="w-full bg-[#f2f2f7] rounded-xl px-3 py-2.5 text-xs font-bold text-zinc-900 outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 4. 4タブ + FAB モック ────────────────────────────────────────────────────

function TabBarFabMock() {
  const [tab, setTab] = useState('feed');
  const tabs = [
    { key: 'schedule', label: '予定', icon: CalendarDays },
    { key: 'feed', label: 'フィード', icon: Heart },
    { key: 'ranking', label: 'ランキング', icon: Trophy },
    { key: 'me', label: 'マイページ', icon: User },
  ];

  return (
    <div className="relative h-[420px] bg-[#f2f2f7] overflow-hidden">
      {/* ダミーフィード */}
      <div className="p-3 space-y-2.5 opacity-90">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[14px] font-semibold text-zinc-900">部員 {i}</span>
              <span className="text-[11px] text-zinc-400">6月{10 + i}日</span>
            </div>
            <p className="text-[13px] text-zinc-600 mb-2">12.5 km ・ jog 8 + 1000m×4</p>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[#f2f2f7] text-[12px] text-zinc-500">
                <Heart size={12} /> {i}
              </span>
              <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-full bg-[#f2f2f7] text-[12px] text-zinc-500">
                <Send size={11} /> 返信
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* FAB: タブバーの少し上、右下 */}
      <button
        className="absolute right-4 bottom-[86px] w-14 h-14 rounded-full bg-[#007aff] text-white flex items-center justify-center shadow-[0_8px_20px_rgba(0,122,255,0.35)] active:scale-95 transition-all"
        aria-label="記録を入力"
      >
        <Plus size={26} strokeWidth={2.2} />
      </button>

      {/* 4タブのボトムバー */}
      <nav className="absolute bottom-3 inset-x-3 rounded-3xl bg-white/92 backdrop-blur-xl border border-zinc-200/70 px-1 py-2 flex justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.04)]">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex flex-col items-center gap-0.5 flex-1 py-1 transition-colors ${
                active ? 'text-[#007aff]' : 'text-zinc-400'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              <span className={`text-[10px] ${active ? 'font-semibold' : 'font-medium'}`}>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ── 5. 入力フォーム形状 ──────────────────────────────────────────────────────

const RECENT_DAYS = (() => {
  const out = [];
  for (let offset = 6; offset >= 0; offset--) {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    out.push({
      key: offset,
      day: d.getDate(),
      caption: offset === 0 ? '今日' : offset === 1 ? '昨日' : ['日', '月', '火', '水', '木', '金', '土'][d.getDay()],
    });
  }
  return out;
})();

function MiniDateRail({ selected, onSelect }) {
  return (
    <div className="flex gap-1 overflow-x-auto scrollbar-none px-4 pb-3">
      {RECENT_DAYS.map(d => {
        const active = selected === d.key;
        return (
          <button
            key={d.key}
            onClick={() => onSelect(d.key)}
            className={`shrink-0 w-[46px] py-1.5 rounded-xl flex flex-col items-center transition-all ${
              active ? 'bg-[#007aff] text-white' : 'text-zinc-500'
            }`}
          >
            <span className={`text-[10px] leading-none ${active ? 'text-white/80' : 'text-zinc-400'}`}>{d.caption}</span>
            <span className="text-[17px] font-semibold leading-none mt-1">{d.day}</span>
          </button>
        );
      })}
    </div>
  );
}

/** 距離2x2 + 合計行 + 流し（決定済みのモノトーン+ドット仕様） */
function FormFields({ values, setValues }) {
  const total = INTENSITIES.reduce((sum, it) => sum + (parseFloat(values[it.key]) || 0), 0);
  const set = (key) => (e) => setValues(v => ({ ...v, [key]: e.target.value }));

  return (
    <div className="px-4 space-y-3">
      {/* 距離グループ */}
      <div className="bg-white rounded-2xl p-3.5">
        <p className="text-[13px] font-medium text-zinc-500 mb-2.5">走行距離 (km)</p>
        <div className="grid grid-cols-2 gap-2.5">
          {INTENSITIES.map(it => (
            <div key={it.key}>
              <span className="flex items-center gap-1.5 text-[12px] text-zinc-500 mb-1">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: it.dot }} />
                {it.label}
              </span>
              <input
                type="number" inputMode="decimal" placeholder="0.0"
                value={values[it.key] ?? ''} onChange={set(it.key)}
                className="w-full bg-[#f2f2f7] rounded-xl px-3 py-2.5 text-[15px] font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-[#007aff]/25"
              />
            </div>
          ))}
        </div>
        {/* 合計は距離グリッドの直下に */}
        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-100">
          <span className="text-[13px] text-zinc-500">合計</span>
          <span className="text-[17px] font-semibold text-zinc-900">{Math.round(total * 100) / 100} km</span>
        </div>
      </div>

      {/* 流し */}
      <div className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between">
        <span className="text-[15px] text-zinc-900">流し</span>
        <input
          type="number" inputMode="numeric" placeholder="0"
          value={values.strides ?? ''} onChange={set('strides')}
          className="w-20 bg-[#f2f2f7] rounded-lg px-3 py-1.5 text-[15px] font-semibold text-right text-zinc-900 outline-none"
        />
      </div>

      {/* テキスト系（結果・補強・感想） */}
      <div className="bg-white rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-100">
          <span className="text-[12px] text-zinc-400 block mb-0.5">結果・タイム</span>
          <input
            type="text" placeholder="例: 12000mPR 3'40"
            value={values.result ?? ''} onChange={set('result')}
            className="w-full bg-transparent text-[15px] text-zinc-900 outline-none placeholder:text-zinc-300"
          />
        </div>
        <div className="px-4 py-3 border-b border-zinc-100">
          <span className="text-[12px] text-zinc-400 block mb-0.5">補強</span>
          <input
            type="text" placeholder="例: 腹筋200, スクワット50"
            value={values.reinforce ?? ''} onChange={set('reinforce')}
            className="w-full bg-transparent text-[15px] text-zinc-900 outline-none placeholder:text-zinc-300"
          />
        </div>
        <div className="px-4 py-3">
          <span className="text-[12px] text-zinc-400 block mb-0.5">感想</span>
          <textarea
            placeholder="今日の感想、状態、反省など"
            value={values.comment ?? ''} onChange={set('comment')}
            className="w-full bg-transparent text-[15px] text-zinc-900 outline-none placeholder:text-zinc-300 resize-none h-20 leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
}

/** A案: iOS作成画面方式（上部バーにキャンセル/保存を固定） */
function FormVariantCompose() {
  const [values, setValues] = useState({});
  const [dateKey, setDateKey] = useState(0);
  const hasExisting = dateKey === 2; // デモ: 一昨日は既存記録あり扱い

  return (
    <div className="h-[560px] flex flex-col bg-[#f2f2f7]">
      {/* 上部バー（固定） */}
      <div className="shrink-0 bg-[#f2f2f7]/95 backdrop-blur border-b border-zinc-200/60">
        <div className="flex items-center justify-between px-4 py-3">
          <button className="text-[16px] text-[#007aff]">キャンセル</button>
          <span className="text-[16px] font-semibold text-zinc-900">
            記録入力
            {hasExisting && <span className="ml-1.5 text-[11px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-md align-middle">編集</span>}
          </span>
          <button className="text-[16px] font-semibold text-[#007aff]">保存</button>
        </div>
        <MiniDateRail selected={dateKey} onSelect={setDateKey} />
      </div>

      {/* フィールド（スクロール） */}
      <div className="flex-1 overflow-y-auto py-3">
        <FormFields values={values} setValues={setValues} />
        <div className="h-6" />
      </div>
    </div>
  );
}

/** B案: 現行ドロワー改良版（保存を下部スティッキーに、合計をボタン内に表示） */
function FormVariantDrawer() {
  const [values, setValues] = useState({});
  const [dateKey, setDateKey] = useState(0);
  const total = INTENSITIES.reduce((sum, it) => sum + (parseFloat(values[it.key]) || 0), 0);
  const hasExisting = dateKey === 2;

  return (
    <div className="h-[560px] flex flex-col bg-[#f2f2f7]">
      {/* ハンドル + 日付 */}
      <div className="shrink-0 pt-2.5">
        <div className="w-9 h-1 bg-zinc-300 rounded-full mx-auto" />
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <h3 className="text-[17px] font-semibold text-zinc-900">
            記録入力
            {hasExisting && <span className="ml-1.5 text-[11px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-md align-middle">編集</span>}
          </h3>
          <button className="w-7 h-7 rounded-full bg-zinc-200/70 flex items-center justify-center text-zinc-500" aria-label="閉じる">
            <X size={14} />
          </button>
        </div>
        <MiniDateRail selected={dateKey} onSelect={setDateKey} />
      </div>

      {/* フィールド（スクロール） */}
      <div className="flex-1 overflow-y-auto py-1">
        <FormFields values={values} setValues={setValues} />
        <div className="h-4" />
      </div>

      {/* スティッキー保存ボタン（合計入り） */}
      <div className="shrink-0 px-4 pb-4 pt-2 bg-gradient-to-t from-[#f2f2f7] via-[#f2f2f7]/95 to-transparent">
        <button className="w-full h-12 rounded-2xl bg-[#007aff] text-white text-[16px] font-semibold flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(0,122,255,0.25)] active:opacity-80 transition-all">
          保存
          {total > 0 && <span className="text-white/75 font-medium text-[14px]">{Math.round(total * 100) / 100} km</span>}
        </button>
      </div>
    </div>
  );
}

// ── メインページ ─────────────────────────────────────────────────────────────

export default function UILab() {
  const [pickerVariant, setPickerVariant] = useState('B案: 簡素化グリッド');
  const [distanceVariant, setDistanceVariant] = useState('A案: モノトーン+ドット');
  const [formVariant, setFormVariant] = useState('A案: iOS作成画面方式');
  const [selectedMember, setSelectedMember] = useState('B3佐藤健心');

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 pb-24">
      <header className="bg-white border-b border-zinc-100 px-5 py-4 mb-8 sticky top-0 z-10">
        <h1 className="text-[20px] font-bold">UI Lab</h1>
        <p className="text-[12px] text-zinc-400 mt-0.5">デザイン比較用の一時ページ（本体には影響しません）</p>
      </header>

      <main className="max-w-md mx-auto px-4">

        <Section
          title="1. 人選択シート"
          description="A案はiOSの連絡先ピッカー風（検索＋学年ごとの1列リスト＋チェックマーク）。B案は現行の2列グリッドから枠線・影・アバターを除いた簡素化版。実際にタップ・検索して比べてください。"
        >
          <VariantTabs
            variants={['A案: 検索付きリスト', 'B案: 簡素化グリッド']}
            active={pickerVariant}
            onChange={setPickerVariant}
          />
          <PhoneFrame>
            {pickerVariant === 'A案: 検索付きリスト' ? (
              <MemberPickerList selected={selectedMember} onSelect={setSelectedMember} />
            ) : (
              <MemberPickerGrid selected={selectedMember} onSelect={setSelectedMember} />
            )}
          </PhoneFrame>
        </Section>

        <Section
          title="2. マイページのメンバー表示行"
          description="現状はアイコンボタンが2つ並ぶカード。提案はiOSの設定アプリ風の1行（行全体タップで人選択が開く）。記録入力はFABに移るため、行から記録ボタンを撤去できます。"
        >
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">現状</p>
          <div className="mb-4"><TriggerCurrent /></div>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">提案</p>
          <TriggerProposed onOpen={() => {}} />
        </Section>

        <Section
          title="3. 距離入力の色使い"
          description="A案はラベルをグレーに統一し、強度の区別は小さな色ドットのみ（ドットの色はマイページの強度別グラフと同じ）。B案は現行の4色ラベル。"
        >
          <VariantTabs
            variants={['A案: モノトーン+ドット', 'B案: 現行4色ラベル']}
            active={distanceVariant}
            onChange={setDistanceVariant}
          />
          <PhoneFrame className="p-3">
            {distanceVariant === 'A案: モノトーン+ドット' ? <DistanceVariantMono /> : <DistanceVariantColor />}
          </PhoneFrame>
        </Section>

        <Section
          title="4. 4タブ + 右下FAB"
          description="決定済みの構成のモック。FABはタブバーの少し上・右端（Twitter方式）。タブも切り替えられます。FABの位置・サイズ感を確認してください。"
        >
          <PhoneFrame>
            <TabBarFabMock />
          </PhoneFrame>
        </Section>

        <Section
          title="5. 入力フォームの形状（新規）"
          description="どちらも「距離を先頭・合計は距離の直下・テキスト3つは1グループにまとめ・編集中バッジ付き」に再構成済み。違いは保存ボタンの位置。A案はiOSのメール作成画面方式で上部バーに常時表示。B案は現行のドロワーを維持しつつ保存を下部に固定し合計も表示。日付で「一昨日」を選ぶと編集バッジのデモが見られます。"
        >
          <VariantTabs
            variants={['A案: iOS作成画面方式', 'B案: ドロワー改良版']}
            active={formVariant}
            onChange={setFormVariant}
          />
          <PhoneFrame>
            {formVariant === 'A案: iOS作成画面方式' ? <FormVariantCompose /> : <FormVariantDrawer />}
          </PhoneFrame>
        </Section>

        <p className="text-[12px] text-zinc-400 text-center pb-8">
          確認できたら、採用する案を伝えてください。このフォルダ（src/ui-lab）は本実装後に削除します。
        </p>
      </main>
    </div>
  );
}
