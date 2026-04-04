import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin, Clock, ListChecks, Timer, StickyNote,
  ChevronDown, ChevronUp, CalendarDays, Zap, Trophy, Map, ExternalLink, RefreshCcw
} from 'lucide-react';
import { months, practiceData as mockData, locationStyles, defaultLocationStyle, locationDetails } from './data/mockData';
import { fetchPracticeData, hasConfig } from './services/sheetsService';
import CalendarModal from './components/CalendarModal';
import LocationsModal from './components/LocationsModal';

// ── Helpers ──────────────────────────────────────────────────────────────────

const TODAY_ISO = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

function formatDate(dateStr, dayOfWeek) {
  if (!dateStr || dateStr === 'Invalid Date') return '日付不明';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return dateStr;
  return `${d.getMonth() + 1}月${d.getDate()}日（${dayOfWeek}）`;
}

/** 時刻以外のテキストが入っていたら試合名として扱う */
function getMatchName(time) {
  if (!time) return null;
  return /^\d{1,2}:\d{2}$/.test(time.trim()) ? null : time.trim();
}

/** セッションリストを 今日 / 次 / 残り未来 / 過去 に分類 */
function classifySessions(sessions) {
  const todayItems  = sessions.filter(s => s.date === TODAY_ISO);
  const futureItems = sessions
    .filter(s => s.date > TODAY_ISO)
    .sort((a, b) => a.date.localeCompare(b.date));
  const pastItems   = sessions
    .filter(s => s.date < TODAY_ISO)
    .sort((a, b) => a.date.localeCompare(b.date));

  const nextItem   = futureItems[0] ?? null;
  const restFuture = futureItems.slice(1);

  return { todayItems, nextItem, restFuture, pastItems };
}

// ── Section component ─────────────────────────────────────────────────────────

function Section({ icon: Icon, title, content, bgColor, textColor }) {
  if (!content?.trim()) return null;
  return (
    <div className="rounded-xl p-3 mb-2" style={{ backgroundColor: bgColor }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={14} className="shrink-0 opacity-60" style={{ color: textColor }} />
        <span className="text-xs font-bold tracking-wider uppercase opacity-60" style={{ color: textColor }}>{title}</span>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: textColor, overflowWrap: 'break-word' }}>
        {content}
      </p>
    </div>
  );
}

// ── PracticeCard ──────────────────────────────────────────────────────────────

function PracticeCard({ item, defaultOpen = false, isToday = false, isNext = false, isPast = false, scrollRef }) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const cardRef = useRef(null);

  // カレンダーからのスクロール対応
  useEffect(() => {
    if (scrollRef?.current === item.id && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      scrollRef.current = null;
      setExpanded(true);
    }
  }, [scrollRef, item.id]);

  const loc = locationStyles[item.location] ?? defaultLocationStyle;
  const matchName = getMatchName(item.time);
  const displayTime = matchName ? null : item.time;

  return (
    <div
      ref={cardRef}
      className={`bg-white rounded-2xl shadow-sm overflow-hidden mb-3 transition-all border ${isPast ? 'opacity-55' : ''}`}
      style={{ borderColor: expanded ? loc.border : '#e2e8f0', boxShadow: expanded ? `0 2px 12px 0 ${loc.border}33` : undefined }}
    >
      {/* 今日の場合は場所の色でトップストライプ */}
      {isToday && (
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${loc.border}, #6366f1)` }} />
      )}

      {/* Card header — クリックで展開 */}
      <button className="w-full text-left px-4 py-3.5 focus:outline-none" onClick={() => setExpanded(v => !v)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">

            {/* Date + status badges */}
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <p className={`text-base font-bold leading-tight ${isPast ? 'text-slate-500' : 'text-slate-800'}`}>
                {formatDate(item.date, item.dayOfWeek)}
              </p>
              {isToday && (
                <span className="text-xs font-bold px-2 py-0.5 bg-blue-600 text-white rounded-full">今日</span>
              )}
              {isNext && (
                <span className="text-xs font-bold px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full">次の練習</span>
              )}
              {!isToday && !isNext && !isPast && (
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full">予定</span>
              )}
              {isPast && (
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full">終了</span>
              )}
              {matchName && (
                <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 bg-red-50 text-red-600 rounded-full border border-red-200">
                  <Trophy size={10} /> 試合
                </span>
              )}
            </div>

            {/* Location + time / match name */}
            <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1">
              {item.location && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border"
                  style={{ backgroundColor: loc.bg, borderColor: loc.border, color: loc.text }}
                >
                  <MapPin size={10} />
                  {item.location}
                </span>
              )}
              {displayTime && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
                  <Clock size={11} className="text-slate-400" />
                  {displayTime}
                </span>
              )}
              {matchName && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-500">
                  <Trophy size={11} />
                  {matchName}
                </span>
              )}
            </div>
          </div>

          {/* Chevron */}
          <div className={`shrink-0 mt-0.5 p-1 rounded-full ${isPast ? 'text-slate-300' : 'text-slate-300'}`}>
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-50">
          <div className="pt-3">
            {matchName ? (
              // 試合の場合は補足のみ
              <Section icon={Trophy} title="詳細・メモ" content={item.notes} bgColor="#FEF2F2" textColor="#991B1B" />
            ) : (
              <>
                <Section icon={ListChecks} title="メニュー" content={item.menu} bgColor="#EFF6FF" textColor="#1E40AF" />
                <Section icon={Timer} title="ペース" content={item.pace} bgColor="#F0FDF4" textColor="#166534" />
                <Section icon={StickyNote} title="補足" content={item.notes} bgColor="#FFFBEB" textColor="#92400E" />
              </>
            )}

            {/* 場所・アクセス */}
            {item.location && locationDetails[item.location] && (
              <div className="mt-3 p-3 rounded-xl border border-slate-100 bg-slate-50">
                <div className="flex items-center gap-1.5 mb-2">
                  <MapPin size={14} className="opacity-60" style={{ color: loc.text }} />
                  <span className="text-xs font-bold tracking-wider uppercase opacity-60" style={{ color: loc.text }}>アクセス・マップ</span>
                </div>
                <div className="text-sm text-slate-700 leading-relaxed mb-3">
                  <p className="font-semibold text-[15px] mb-1">{locationDetails[item.location].name}</p>
                  {locationDetails[item.location].access?.length > 0 && (
                    <div className="flex flex-col gap-1 mb-1.5">
                      {locationDetails[item.location].access.map((acc, i) => (
                        <p key={i} className="text-slate-500 text-xs bg-white self-start px-1.5 py-0.5 rounded border border-slate-200">
                          {acc}
                        </p>
                      ))}
                    </div>
                  )}
                  {locationDetails[item.location].fee && (
                    <p className="text-slate-500 text-xs">
                      料金: {locationDetails[item.location].fee}
                    </p>
                  )}
                </div>
                {locationDetails[item.location].url && (
                  <div className="flex gap-2">
                    <a
                      href={locationDetails[item.location].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                    >
                      <Map size={14} />
                      Google Maps
                      <ExternalLink size={12} className="opacity-40" />
                    </a>
                    <a
                      href={`https://maps.apple.com/?q=${encodeURIComponent(locationDetails[item.location].appleQuery || locationDetails[item.location].name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                    >
                      <MapPin size={14} />
                      Apple Maps
                      <ExternalLink size={12} className="opacity-40" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────

function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-slate-200" />
      <span className="text-xs text-slate-400 font-semibold tracking-wide uppercase">{label}</span>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const currentMonthStr = `${new Date().getMonth() + 1}月`;
  const [activeMonth, setActiveMonth] = useState(() => months.includes(currentMonthStr) ? currentMonthStr : months[months.length - 1]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const scrollToId = useRef(null);
  const sessionCache = useRef({}); // 月ごとのデータをキャッシュ

  const loadData = useCallback(async (month) => {
    if (sessionCache.current[month]) {
      setSessions(sessionCache.current[month]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (hasConfig()) {
        const data = await fetchPracticeData(month);
        setSessions(data);
        sessionCache.current[month] = data;
      } else {
        const mock = [...(mockData[month] ?? [])];
        setSessions(mock);
        sessionCache.current[month] = mock;
      }
    } catch (e) {
      setError(e.message);
      const mockFallback = [...(mockData[month] ?? [])];
      setSessions(mockFallback);
      sessionCache.current[month] = mockFallback;
    }
    setLoading(false);
  }, []);

  async function handleManualRefresh() {
    delete sessionCache.current[activeMonth]; // 現在の月のキャッシュを破棄
    await loadData(activeMonth); // 再読み込み
  }

  // タブ切替時に先頭にスクロール
  function handleMonthChange(month) {
    setActiveMonth(month);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  useEffect(() => { loadData(activeMonth); }, [activeMonth, loadData]);

  const { todayItems, nextItem, restFuture, pastItems } = classifySessions(sessions);
  const hasContent = sessions.length > 0;

  function handleSelectDate(dateStr) {
    setShowCalendar(false);
    const target = sessions.find(s => s.date === dateStr);
    if (target) {
      setTimeout(() => { scrollToId.current = target.id; }, 100);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20">
        <div 
          className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 shadow-lg pb-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.875rem)' }}
        >
          <div className="max-w-lg mx-auto px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 relative">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm shrink-0">
                  <Zap size={20} className="text-white" />
                </div>
                <div className="relative">
                  <button 
                    onClick={() => setShowMonthDropdown(!showMonthDropdown)}
                    className="flex items-center gap-1 text-white font-black text-xl leading-none tracking-tight focus:outline-none"
                  >
                    {activeMonth} <ChevronDown size={18} className={`transition-transform duration-200 opacity-90 ${showMonthDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  <p className="text-blue-200 text-xs font-semibold leading-none mt-1 tracking-wide">練習メニュー</p>
                  
                  {/* Dropdown Menu */}
                  {showMonthDropdown && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowMonthDropdown(false)} />
                      <div className="absolute top-full left-0 mt-3 w-40 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-40 transform origin-top-left transition-all">
                        <div className="py-1">
                          {months.map(month => (
                            <button 
                              key={month} 
                              onClick={() => { handleMonthChange(month); setShowMonthDropdown(false); }}
                              className={`w-full text-left px-5 py-3 text-[15px] font-bold transition-colors border-b border-slate-50 last:border-none ${
                                activeMonth === month ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {month}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button onClick={handleManualRefresh}
                  disabled={loading}
                  className={`p-2.5 rounded-full hover:bg-white/20 transition-all text-white/80 hover:text-white ${loading ? 'animate-spin opacity-50' : ''}`} title="最新データを取得">
                  <RefreshCcw size={20} />
                </button>
                <button onClick={() => setShowLocations(true)}
                  className="p-2.5 rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white" title="場所・アクセス一覧">
                  <Map size={22} />
                </button>
                <button id="btn-calendar" onClick={() => setShowCalendar(true)}
                  className="p-2.5 rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white" title="カレンダー">
                  <CalendarDays size={22} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-lg mx-auto px-3 sm:px-4 py-4">
        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 leading-relaxed">
            <strong>取得エラー:</strong> {error}（モックデータを表示中）
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <div className="w-6 h-6 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
            <p className="text-sm font-medium">読み込み中...</p>
          </div>
        ) : !hasContent ? (
          <div className="text-center py-16 text-slate-400">
            <CalendarDays size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-base font-medium">データがありません</p>
          </div>
        ) : (
          <>
            {/* ① 今日の練習 */}
            {todayItems.map(item => (
              <PracticeCard key={item.id} item={item} defaultOpen={true} isToday={true} scrollRef={scrollToId} />
            ))}

            {/* ② 次の練習（今日の練習がない場合のみ展開） */}
            {nextItem && (
              <PracticeCard item={nextItem} defaultOpen={todayItems.length === 0} isNext={true} scrollRef={scrollToId} />
            )}

            {/* ③ それ以降の予定（昇順・折りたたみ） */}
            {restFuture.map(item => (
              <PracticeCard key={item.id} item={item} defaultOpen={false} scrollRef={scrollToId} />
            ))}

            {/* ④ 過去の練習（仕切り + 昇順 + 薄く） */}
            {pastItems.length > 0 && (
              <>
                <SectionDivider label="終了した練習" />
                {pastItems.map(item => (
                  <PracticeCard key={item.id} item={item} defaultOpen={false} isPast={true} scrollRef={scrollToId} />
                ))}
              </>
            )}
          </>
        )}
      </main>

      {/* ── Modals ── */}
      {showCalendar && (
        <CalendarModal sessions={sessions} onClose={() => setShowCalendar(false)} onSelectDate={handleSelectDate} activeMonthStr={activeMonth} />
      )}
      {showLocations && (
        <LocationsModal onClose={() => setShowLocations(false)} />
      )}
    </div>
  );
}
