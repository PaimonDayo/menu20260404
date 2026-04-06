import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin, Clock, ListChecks, Timer, StickyNote,
  ChevronDown, ChevronUp, CalendarDays, Zap, Trophy, Map, ExternalLink, RefreshCcw, Flag, CalendarPlus
} from 'lucide-react';
import { months, practiceData as mockData, mockScheduleData, locationStyles, defaultLocationStyle, locationDetails } from './data/mockData';
import { fetchPracticeData, fetchScheduleData, getEntryPeriodStatus, isWithinEntryPeriod, hasConfig } from './services/sheetsService';
import CalendarModal from './components/CalendarModal';
import LocationsModal from './components/LocationsModal';

// ── Helpers ──────────────────────────────────────────────────────────────────

const TODAY_ISO = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

function formatDate(dateStr, dayOfWeek, displayDate) {
  if (displayDate) return displayDate;
  if (!dateStr || dateStr === 'Invalid Date') return '日付不明';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d)) return dateStr;
  const w = dayOfWeek || ['日','月','火','水','木','金','土'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日（${w}）`;
}

/** 時刻以外のテキストが入っていたら試合名として扱う */
function getMatchName(time) {
  if (!time) return null;
  return /^\d{1,2}:\d{2}$/.test(time.trim()) ? null : time.trim();
}

/** セッションリストを 今日 / 次 / 残り未来 / 過去 に分類 */
function classifySessions(sessions, globalTodayExists, globalNextItemId) {
  const todayItems  = sessions.filter(s => s.date === TODAY_ISO);
  const futureItems = sessions
    .filter(s => s.date > TODAY_ISO)
    .sort((a, b) => a.date.localeCompare(b.date));
  const pastItems   = sessions
    .filter(s => s.date < TODAY_ISO)
    .sort((a, b) => a.date.localeCompare(b.date));

  // 「次の予定」として扱うのは：
  // 1. グローバル（全データ）で今日の予定が1つもない
  // 2. そのアイテムがグローバルで最も近い未来の予定である
  // という条件を満たす時のみ。
  let nextItem = null;
  let restFuture = futureItems;

  if (!globalTodayExists && globalNextItemId) {
    const foundIdx = futureItems.findIndex(s => s.id === globalNextItemId);
    if (foundIdx !== -1) {
      nextItem = futureItems[foundIdx];
      restFuture = [...futureItems.slice(0, foundIdx), ...futureItems.slice(foundIdx + 1)];
    }
  }

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

function PracticeCard({ item, defaultOpen = false, isToday = false, isNext = false, isPast = false, scrollRef, isScheduleView = false }) {
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
              {/* 日程一覧以外、または通常の練習の場合は日付をメインに */}
              {(!isScheduleView || (!(item.type === 'event' || item.type === 'record' || matchName))) && (
                <p className={`text-base font-bold leading-tight ${isPast ? 'text-slate-500' : 'text-slate-800'}`}>
                  {formatDate(item.date, item.dayOfWeek, item.displayDate)}
                </p>
              )}
              {isToday && (
                <span className="text-xs font-bold px-2 py-0.5 bg-blue-600 text-white rounded-full">今日</span>
              )}
              {isNext && (
                <span className="text-xs font-bold px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full">次の予定</span>
              )}
              {item.type === 'event' && (
                <span className="text-xs font-bold px-2 py-0.5 bg-fuchsia-100 text-fuchsia-700 rounded-full border border-fuchsia-200">大会・行事</span>
              )}
              {item.type === 'record' && (
                <span className="text-xs font-bold px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full border border-teal-200">記録会</span>
              )}
              {matchName && !item.type && (
                <span className="text-xs font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded-full border border-red-200">試合</span>
              )}
              {isPast && (
                <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full">終了</span>
              )}
              {/* 日程一覧かつ大会・記録会の場合は日付をサブに */}
              {isScheduleView && (item.type === 'event' || item.type === 'record' || matchName) && (
                <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full border border-slate-200">
                  {formatDate(item.date, item.dayOfWeek, item.displayDate)}
                </span>
              )}
            </div>

            {/* Title / Name (条件出し分け) */}
            {(item.type === 'event' || item.type === 'record' || matchName) && (
              <h3 className={`${isScheduleView ? 'text-lg' : 'text-base'} font-black leading-tight mb-1 ${
                item.type === 'event' ? 'text-fuchsia-800' : 
                item.type === 'record' ? 'text-teal-800' : 
                'text-red-800'
              }`}>
                {item.name || matchName}
              </h3>
            )}

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
              {displayTime && !item.type && (
                <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-medium">
                  <Clock size={11} className="text-slate-400" />
                  {displayTime}
                </span>
              )}

              {item.type === 'record' && item.entryPeriod && (
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                    item.entryStatus === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                    item.entryStatus === 'upcoming' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                    'bg-white text-slate-400 border-slate-100'
                }`}>
                  {item.entryStatus === 'active' ? '募集中: ' : item.entryStatus === 'upcoming' ? '予告: ' : '受付終了: '}
                  {item.entryPeriod}
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
            {item.type === 'record' ? (
              <Section icon={Clock} title="エントリー期間" content={item.entryPeriod} bgColor="#FFFBEB" textColor="#D97706" />
            ) : matchName ? (
              // 試合の場合は補足のみ
              <Section icon={Trophy} title="詳細・メモ" content={item.notes} bgColor="#FEF2F2" textColor="#991B1B" />
            ) : (
              (item.type !== 'event') && (
                <>
                  <Section icon={ListChecks} title="メニュー" content={item.menu} bgColor="#EFF6FF" textColor="#1E40AF" />
                  <Section icon={Timer} title="ペース" content={item.pace} bgColor="#F0FDF4" textColor="#166534" />
                  <Section icon={StickyNote} title="補足" content={item.notes} bgColor="#FFFBEB" textColor="#92400E" />
                </>
              )
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
                      href={locationDetails[item.location].appleUrl || `https://maps.apple.com/?q=${encodeURIComponent(locationDetails[item.location].appleQuery || locationDetails[item.location].name)}`}
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
  const [activeMonth, setActiveMonth] = useState(() => months.includes(currentMonthStr) ? currentMonthStr : months[months.length - 2] ?? months[0]);
  const [practiceSessions, setPracticeSessions] = useState([]);
  const [scheduleSessions, setScheduleSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showLocations, setShowLocations] = useState(false);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const scrollToId = useRef(null);
  const sessionCache = useRef({}); // 月ごとの練習データをキャッシュ
  const [scheduleCategory, setScheduleCategory] = useState('大会・行事'); //大会・行事, 記録会

  // 全月分のデータをバックグラウンドで読み込む
  useEffect(() => {
    async function preloadAll() {
      const targetMonths = months.filter(m => m !== '日程一覧');
      const isBeginningOfMonth = new Date().getDate() <= 3;
      const ts = isBeginningOfMonth ? Date.now() : null;

      for (const m of targetMonths) {
        // 月初めかつ初回のみキャッシュを無視して強制リロード
        if (!sessionCache.current[m] || isBeginningOfMonth) {
          try {
            if (hasConfig()) {
              const d = await fetchPracticeData(m, ts);
              sessionCache.current[m] = d;
            } else {
              sessionCache.current[m] = [...(mockData[m] ?? [])];
            }
          } catch (e) {
            sessionCache.current[m] = [...(mockData[m] ?? [])];
          }
        }
      }
      // 再描画を促すために空の更新、または practiceSessions が空なら最新月をロード
      if (practiceSessions.length === 0) {
        setPracticeSessions(sessionCache.current[activeMonth] || []);
      }
    }
    preloadAll();
  }, [activeMonth, practiceSessions.length]);

  const loadSchedule = useCallback(async (timestamp) => {
    setLoading(true);
    let sched = [];
    if (hasConfig()) {
      try {
        sched = await fetchScheduleData(timestamp);
      } catch(e) {
        sched = mockScheduleData;
      }
    } else {
      sched = mockScheduleData;
    }
    
    // エントリステータスの付与
    const updated = sched.map(s => {
      const year = s.date?.split('-')[0];
      const status = s.type === 'record' ? getEntryPeriodStatus(s.entryPeriod, year) : null;
      return {
        ...s,
        entryStatus: status,
        isRecruiting: status === 'active'
      };
    });
    setScheduleSessions(updated);
    setLoading(false);
  }, []);

  // 初回に日程一覧を一括フェッチする
  useEffect(() => {
    const isBeginningOfMonth = new Date().getDate() <= 3;
    loadSchedule(isBeginningOfMonth ? Date.now() : null);
  }, [loadSchedule]);

  const loadData = useCallback(async (month) => {
    if (month === '日程一覧') {
      return; // 日程一覧の時は練習データをフェッチしない
    }

    if (sessionCache.current[month]) {
      setPracticeSessions(sessionCache.current[month]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (hasConfig()) {
        const data = await fetchPracticeData(month);
        setPracticeSessions(data);
        sessionCache.current[month] = data;
      } else {
        const mock = [...(mockData[month] ?? [])];
        setPracticeSessions(mock);
        sessionCache.current[month] = mock;
      }
    } catch (e) {
      setError(e.message);
      const mockFallback = [...(mockData[month] ?? [])];
      setPracticeSessions(mockFallback);
      sessionCache.current[month] = mockFallback;
    }
    setLoading(false);
  }, []);

  async function handleManualRefresh() {
    if (activeMonth === '日程一覧') {
      await loadSchedule(Date.now());
    } else {
      delete sessionCache.current[activeMonth]; // 現在の月のキャッシュを破棄
      await loadData(activeMonth); // 再読み込み
    }
  }

  // タブ切替時に先頭にスクロール
  function handleMonthChange(month) {
    setActiveMonth(month);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  useEffect(() => { loadData(activeMonth); }, [activeMonth, loadData]);

  // 同一日の優先順位: 1. 大会 2. 記録会 3. 練習
  const getPriority = (item) => {
    if (item.type === 'event') return 1;
    if (item.type === 'record') return 2;
    if (getMatchName(item.time)) return 1.5; // 練習枠の試合は大体大会と同じ扱い
    return 3;
  };

  const sortSessions = (sessions) => {
    return sessions.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return getPriority(a) - getPriority(b);
    });
  };

  // 表示用のセッションを計算（練習メニュー＋その月の予定）
  let displaySessions = [];
  if (activeMonth === '日程一覧') {
    // フィルタリング
    let filtered = [...scheduleSessions];
    if (scheduleCategory === '大会・行事') {
      filtered = filtered.filter(s => s.type === 'event');
    } else if (scheduleCategory === '記録会') {
      filtered = filtered.filter(s => s.type === 'record');
    }

    // ソート（未来・今日を上に、過去を下に）
    const upcoming = filtered.filter(s => s.date >= TODAY_ISO);
    const past = filtered.filter(s => s.date < TODAY_ISO);
    displaySessions = [...sortSessions(upcoming), ...sortSessions(past)];
  } else {
    const monthNumMatch = activeMonth.match(/^(\d+)月/);
    if (monthNumMatch) {
      const monthNum = parseInt(monthNumMatch[1], 10);
      const currentYear = new Date().getFullYear();
      
      const filteredSchedule = scheduleSessions.filter(s => {
        if (!s.date) return false;
        const [sYear, sMonth] = s.date.split('-').map(v => parseInt(v, 10));
        // 年度を考慮: 現在の年の該当月のみ表示（来年の3月などは除外）
        return sMonth === monthNum && sYear === currentYear;
      });
      displaySessions = sortSessions([...practiceSessions, ...filteredSchedule]);
    } else {
      displaySessions = sortSessions([...practiceSessions]);
    }
  }

  // カレンダー用の全セッション (全月の練習 + 全日程)
  const allSessionsForCalendar = (() => {
    const allPractice = Object.values(sessionCache.current).flat();
    return [...allPractice, ...scheduleSessions];
  })();

  const isScheduleView = activeMonth === '日程一覧';

  let groupedSchedules = {};
  if (isScheduleView) {
    displaySessions.forEach(item => {
      if (!item.date) return;
      const year = item.date.split('-')[0];
      if (!groupedSchedules[year]) groupedSchedules[year] = [];
      groupedSchedules[year].push(item);
    });
  }

  const { globalTodayExists, globalNextItemId } = (() => {
    const all = allSessionsForCalendar;
    const todayExists = all.some(s => s.date === TODAY_ISO);
    const next = all
      .filter(s => s.date > TODAY_ISO)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    return { globalTodayExists: todayExists, globalNextItemId: next?.id };
  })();

  const { todayItems, nextItem, restFuture, pastItems } = classifySessions(displaySessions, globalTodayExists, globalNextItemId);
  const hasContent = displaySessions.length > 0;

  function handleSelectDate(dateStr) {
    setShowCalendar(false);
    const target = displaySessions.find(s => s.date === dateStr);
    if (target) {
      setTimeout(() => { scrollToId.current = target.id; }, 100);
    }
  }

  // 表示する月のリストを制限 (日程一覧を先頭に、あとは今月と来月のみ)
  const visibleMonths = (() => {
    const todayMonth = new Date().getMonth() + 1;
    const nextMonth = todayMonth === 12 ? 1 : todayMonth + 1;
    
    // 日程一覧を先頭に
    const result = ['日程一覧'];
    
    // 今月と来月を追加
    months.forEach(m => {
      const match = m.match(/^(\d+)月/);
      if (match) {
        const mNum = parseInt(match[1], 10);
        if (mNum === todayMonth || mNum === nextMonth) {
          result.push(m);
        }
      }
    });
    
    return result;
  })();

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
                  <p className="text-blue-200 text-xs font-semibold leading-none mt-1 tracking-wide">
                    {activeMonth === '日程一覧' ? '大会・行事・記録会' : '練習メニュー'}
                  </p>
                  
                  {/* Dropdown Menu */}
                  {showMonthDropdown && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowMonthDropdown(false)} />
                      <div className="absolute top-full left-0 mt-3 w-44 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-40 transform origin-top-left transition-all">
                        <div className="py-1">
                          {visibleMonths.map(month => (
                            <button 
                              key={month} 
                              onClick={() => { handleMonthChange(month); setShowMonthDropdown(false); }}
                              className={`w-full text-left px-5 py-3.5 text-[15px] font-bold transition-colors border-b border-slate-50 last:border-none ${
                                activeMonth === month ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              {month === '日程一覧' ? (
                                <span className="flex items-center gap-2">
                                  <Trophy size={16} className="text-amber-500" />
                                  日程一覧
                                </span>
                              ) : (
                                <span className="flex items-center gap-2">
                                  <CalendarDays size={16} className="text-blue-500 opacity-60" />
                                  {month}
                                </span>
                              )}
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
        {isScheduleView && (
          <div className="flex bg-slate-200 p-1 rounded-xl mb-4 gap-1">
            {['大会・行事', '記録会'].map(cat => (
              <button
                key={cat}
                onClick={() => setScheduleCategory(cat)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                  scheduleCategory === cat ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
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
        ) : isScheduleView ? (
          // 日程一覧の表示 (年ごとにグループ化)
          Object.keys(groupedSchedules).sort().map(year => {
            const sessions = groupedSchedules[year];
            const upcoming = sessions.filter(s => s.date >= TODAY_ISO);
            const past = sessions.filter(s => s.date < TODAY_ISO);

            return (
              <div key={year}>
                <SectionDivider label={`${year}年`} />
                {upcoming.map(item => (
                  <PracticeCard key={item.id} item={item} defaultOpen={false} scrollRef={scrollToId} isScheduleView={true} />
                ))}
                {past.length > 0 && (
                  <>
                    <SectionDivider label="終了した予定" />
                    {past.map(item => (
                      <PracticeCard key={item.id} item={item} defaultOpen={false} isPast={true} scrollRef={scrollToId} isScheduleView={true} />
                    ))}
                  </>
                )}
              </div>
            );
          })
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
                <SectionDivider label="終了した予定" />
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
        <CalendarModal sessions={allSessionsForCalendar} onClose={() => setShowCalendar(false)} onSelectDate={handleSelectDate} activeMonthStr={activeMonth} />
      )}
      {showLocations && (
        <LocationsModal onClose={() => setShowLocations(false)} />
      )}
    </div>
  );
}
