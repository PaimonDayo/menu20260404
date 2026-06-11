import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  MapPin, Clock, ListChecks, Timer, StickyNote,
  ChevronDown, ChevronUp, CalendarDays, Trophy, Map, ExternalLink, RefreshCcw, User, Users, Footprints, CalendarDays as CalendarIcon
} from 'lucide-react';
import { months, practiceData as mockData, mockScheduleData, locationStyles, defaultLocationStyle, locationDetails } from './data/mockData';
import { fetchPracticeData, fetchScheduleData, getEntryPeriodStatus, hasConfig } from './services/sheetsService';
import CalendarModal from './components/CalendarModal';
import LocationsModal from './components/LocationsModal';
import StatsDashboard from './components/StatsDashboard';
import RecordInputDrawer from './components/RecordInputDrawer';

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

function Section({ icon, title, content, bgColor, textColor, borderNeon }) {
  if (!content?.trim()) return null;
  const Icon = icon;
  return (
    <div 
      className="rounded-2xl p-3.5 mb-2.5 relative overflow-hidden" 
      style={{ 
        backgroundColor: bgColor, 
        border: `1px solid ${borderNeon}15`,
      }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} className="shrink-0" style={{ color: textColor }} />
        <span className="text-[10px] font-black tracking-wider uppercase opacity-70" style={{ color: textColor }}>{title}</span>
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap font-bold text-slate-800" style={{ overflowWrap: 'break-word' }}>
        {content}
      </p>
    </div>
  );
}

// ── PracticeCard ──────────────────────────────────────────────────────────────

function PracticeCard({ item, defaultOpen = false, isToday = false, isNext = false, isPast = false, scrollRef, isScheduleView = false }) {
  const [expanded, setExpanded] = useState(defaultOpen);
  const cardRef = useRef(null);

  useEffect(() => {
    if (scrollRef?.current === item.id && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      scrollRef.current = null;
      setTimeout(() => {
        setExpanded(true);
      }, 0);
    }
  }, [scrollRef, item.id]);

  const actualLocation = item.location ? (item.location.includes('→') ? item.location.split('→').pop().trim() : item.location) : '';
  const loc = locationStyles[actualLocation] ?? defaultLocationStyle;
  const isChangedLocation = item.location?.includes('変更') || item.location?.includes('→');
  
  // ライトモード用にバッジカラーを上品に調整
  const badgeStyle = isChangedLocation 
    ? { bg: 'rgba(239, 68, 68, 0.08)', border: '#FCA5A5', text: '#DC2626' } 
    : {
        bg: 'rgba(241, 245, 249, 0.7)',
        border: '#E2E8F0',
        text: '#475569'
      };
  
  const matchName = getMatchName(item.time);
  const displayTime = matchName ? null : item.time;

  return (
    <div
      ref={cardRef}
      className={`bg-white border border-slate-100 rounded-3xl overflow-hidden mb-3.5 transition-all duration-300 relative ${isPast ? 'opacity-50' : ''} ${
        expanded ? 'shadow-[0_8px_30px_rgba(0,0,0,0.03)] border-slate-200/80' : 'shadow-[0_2px_12px_rgba(0,0,0,0.01)] hover:border-slate-200/40'
      }`}
    >
      {/* 今日の場合は上端に美しいアクティビティカラーのグラデーションバー */}
      {isToday && (
        <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
      )}

      {/* Card Header — クリックで展開 */}
      <button className="w-full text-left px-4.5 py-4 focus:outline-none" onClick={() => setExpanded(v => !v)} aria-expanded={expanded}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">

            {/* Date + status badges */}
            <div className="flex items-center gap-1.5 flex-wrap mb-2">
              {(!isScheduleView || (!(item.type === 'event' || item.type === 'record' || matchName))) && (
                <p className={`text-[15px] font-black leading-tight ${isPast ? 'text-slate-400' : 'text-slate-800'}`}>
                  {formatDate(item.date, item.dayOfWeek, item.displayDate)}
                </p>
              )}
              {isToday && (
                <span className="text-[9px] font-black px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-100 uppercase tracking-wider">今日</span>
              )}
              {isNext && (
                <span className="text-[9px] font-black px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100 uppercase tracking-wider">次の予定</span>
              )}
              {item.type === 'event' && (
                 <span className="text-[9px] font-black px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full border border-orange-100 uppercase tracking-wider">大会・行事</span>
               )}
               {item.type === 'record' && (
                 <span className="text-[9px] font-black px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 uppercase tracking-wider">記録会</span>
               )}
              {matchName && !item.type && (
                <span className="text-[9px] font-black px-2 py-0.5 bg-red-50 text-red-600 rounded-full border border-red-100 uppercase tracking-wider">試合</span>
              )}
              {isPast && (
                <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 text-slate-400 rounded-full border border-slate-200/50 uppercase tracking-wider">終了</span>
              )}
              {isScheduleView && (item.type === 'event' || item.type === 'record' || matchName) && (
                <span className="text-[9px] font-black px-2 py-0.5 bg-slate-50 border border-slate-100 text-slate-500 rounded-full">
                  {formatDate(item.date, item.dayOfWeek, item.displayDate)}
                </span>
              )}
            </div>

            {/* Title / Name (条件出し分け) */}
             {(item.type === 'event' || item.type === 'record' || matchName) && (
               <h3 className={`${isScheduleView ? 'text-[17px]' : 'text-[15px]'} font-black leading-tight mb-2.5 ${
                 item.type === 'event' ? 'text-orange-600' : 
                 item.type === 'record' ? 'text-emerald-600' : 
                 'text-orange-600'
               }`}>
                {item.name || matchName}
              </h3>
            )}

            {/* Location + time */}
            <div className="flex items-center flex-wrap gap-x-2.5 gap-y-1.5">
              {item.location && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border"
                  style={{ backgroundColor: badgeStyle.bg, borderColor: badgeStyle.border, color: badgeStyle.text }}
                >
                  <MapPin size={9} />
                  {item.location}
                </span>
              )}
              {displayTime && !item.type && (
                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 font-bold">
                  <Clock size={10} className="text-slate-400" />
                  {displayTime}
                </span>
              )}

              {item.type === 'record' && item.entryPeriod && (
                <span className={`inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded border ${
                    item.entryStatus === 'active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                    item.entryStatus === 'upcoming' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                    'bg-slate-50 text-slate-400 border-slate-100'
                }`}>
                  {item.entryStatus === 'active' ? '募集中: ' : item.entryStatus === 'upcoming' ? '予告: ' : '受付終了: '}
                  {item.entryPeriod}
                </span>
              )}
            </div>
          </div>

          {/* Chevron */}
          <div className="shrink-0 mt-1 p-1 rounded-full text-slate-400 active:text-slate-600">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-4.5 pb-4.5 border-t border-slate-50">
          <div className="pt-3">
            {item.type === 'record' ? (
              <Section icon={Clock} title="エントリー期間" content={item.entryPeriod} bgColor="rgba(245, 158, 11, 0.05)" textColor="#d97706" borderNeon="#f59e0b" />
            ) : matchName ? (
              <Section icon={Trophy} title="詳細・メモ" content={item.notes} bgColor="rgba(239, 68, 68, 0.05)" textColor="#dc2626" borderNeon="#ef4444" />
            ) : (
              (item.type !== 'event') && (
                <>
                   <Section icon={ListChecks} title="練習メニュー" content={item.menu} bgColor="rgba(59, 130, 246, 0.05)" textColor="#2563eb" borderNeon="#3b82f6" />
                   <Section icon={Timer} title="ペース目安" content={item.pace} bgColor="rgba(16, 185, 129, 0.05)" textColor="#059669" borderNeon="#10b981" />
                   <Section icon={StickyNote} title="補足・メモ" content={item.notes} bgColor="rgba(234, 179, 8, 0.05)" textColor="#ca8a04" borderNeon="#eab308" />
                </>
              )
            )}

            {/* 場所・アクセス (アコーディオン内のロケーション詳細) */}
            {item.location && locationDetails[actualLocation] && (
              <div className="mt-3.5 p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-1.5 mb-2">
                  <MapPin size={12} className="opacity-70" style={{ color: loc.border }} />
                  <span className="text-[9px] font-black tracking-wider uppercase opacity-60 text-slate-500">アクセス情報</span>
                </div>
                
                <div className="text-xs text-slate-600 leading-relaxed mb-3">
                  <p className="font-black text-[13px] text-slate-800 mb-1">{locationDetails[actualLocation].name}</p>
                  {locationDetails[actualLocation].access?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {locationDetails[actualLocation].access.map((acc, i) => (
                        <p key={i} className="text-slate-500 text-[10px] bg-white px-2 py-0.5 rounded-md border border-slate-100 font-bold">
                          {acc}
                        </p>
                      ))}
                    </div>
                  )}
                  {locationDetails[actualLocation].fee && (
                    <p className="text-slate-400 text-[10px] font-bold">
                      料金: {locationDetails[actualLocation].fee}
                    </p>
                  )}
                </div>
                
                {locationDetails[actualLocation].url && (
                  <div className="flex gap-2">
                    <a
                      href={locationDetails[actualLocation].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-white border border-slate-100 text-slate-700 text-[11px] font-black hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                    >
                      <Map size={11} className="text-blue-500" />
                      Google Maps
                    </a>
                    <a
                      href={locationDetails[actualLocation].appleUrl || `https://maps.apple.com/?q=${encodeURIComponent(locationDetails[actualLocation].appleQuery || locationDetails[actualLocation].name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-white border border-slate-100 text-slate-700 text-[11px] font-black hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                    >
                      <MapPin size={11} className="text-emerald-500" />
                      Apple Maps
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
    <div className="flex items-center gap-3 my-4 px-1 animate-fade-in">
      <div className="flex-1 h-px bg-slate-100" />
      <span className="text-[9px] text-slate-400 font-black tracking-widest uppercase">{label}</span>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

// ── Main App Component ────────────────────────────────────────────────────────

export default function App() {
     const currentMonthStr = `${new Date().getMonth() + 1}月`;
     const [activeMonth, setActiveMonth] = useState(() => months.includes(currentMonthStr) ? currentMonthStr : months[months.length - 2] ?? months[0]);
     const [practiceSessions, setPracticeSessions] = useState([]);
     const [scheduleSessions, setScheduleSessions] = useState([]);
     const [loading, setLoading] = useState(false);
     const [showCalendar, setShowCalendar] = useState(false);
     const [showLocations, setShowLocations] = useState(false);
     const [scheduleCategory, setScheduleCategory] = useState('大会・行事'); // 大会・行事, 記録会
     
     // 📱 新マルチタブ用の状態変数
     const [activeTab, setActiveTab] = useState('schedule'); // 'schedule' | 'social' | 'analytics'
     const [socialSection, setSocialSection] = useState('recent'); // 'recent' | 'ranking'
     const [socialResetKey, setSocialResetKey] = useState(0);
     const [myPageResetKey, setMyPageResetKey] = useState(0);
     const [showInputDrawer, setShowInputDrawer] = useState(false);

    // メンバー状態の永続化。v2では初回表示を未選択にするため旧キーは読まない。
     const [selectedMember, setSelectedMember] = useState(() => {
       return localStorage.getItem('tf_selected_member_v2') || '';
     });

     useEffect(() => {
       if (selectedMember) {
         localStorage.setItem('tf_selected_member_v2', selectedMember);
       }
     }, [selectedMember]);

  const scrollToId = useRef(null);
  const sessionCache = useRef({});
  const freshPreloadDoneRef = useRef(false); // 月初の強制再取得はセッション中1回だけ
  const [allPracticeSessions, setAllPracticeSessions] = useState([]);

  const updateAllPracticeSessions = useCallback(() => {
    const allPractice = Object.values(sessionCache.current).flat();
    setAllPracticeSessions(allPractice);
  }, []);

  // 全月分のデータをバックグラウンドで読み込む
  useEffect(() => {
    async function preloadAll() {
      const targetMonths = months.filter(m => m !== '日程一覧');
      const isBeginningOfMonth = new Date().getDate() <= 3;
      const forceFresh = isBeginningOfMonth && !freshPreloadDoneRef.current;
      if (isBeginningOfMonth) freshPreloadDoneRef.current = true;
      const ts = forceFresh ? Date.now() : null;

      await Promise.all(targetMonths.map(async (m) => {
        if (sessionCache.current[m]?.length > 0 && !forceFresh) return;
        try {
          if (hasConfig()) {
            sessionCache.current[m] = await fetchPracticeData(m, ts);
          } else {
            sessionCache.current[m] = [...(mockData[m] ?? [])];
          }
        } catch {
          sessionCache.current[m] = [...(mockData[m] ?? [])];
        }
      }));
      if (practiceSessions.length === 0) {
        setPracticeSessions(sessionCache.current[activeMonth] || []);
      }
      updateAllPracticeSessions();
    }
    preloadAll();
  }, [activeMonth, practiceSessions.length, updateAllPracticeSessions]);

  const loadSchedule = useCallback(async (timestamp) => {
    setLoading(true);
    let sched = [];
    if (hasConfig()) {
      try {
        sched = await fetchScheduleData(timestamp);
      } catch {
        sched = mockScheduleData;
      }
    } else {
      sched = mockScheduleData;
    }
    
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

  useEffect(() => {
    const isBeginningOfMonth = new Date().getDate() <= 3;
    setTimeout(() => {
      loadSchedule(isBeginningOfMonth ? Date.now() : null);
    }, 0);
  }, [loadSchedule]);

  const loadData = useCallback(async (month) => {
    if (month === '日程一覧') return;

    if (sessionCache.current[month] && sessionCache.current[month].length > 0) {
      setPracticeSessions(sessionCache.current[month]);
      return;
    }

    setLoading(true);
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
      console.error(e);
      const mockFallback = [...(mockData[month] ?? [])];
      setPracticeSessions(mockFallback);
      sessionCache.current[month] = mockFallback;
    }
    updateAllPracticeSessions();
    setLoading(false);
  }, [updateAllPracticeSessions]);

  async function handleManualRefresh() {
    if (activeMonth === '日程一覧') {
      await loadSchedule(Date.now());
    } else {
      delete sessionCache.current[activeMonth];
      await loadData(activeMonth);
    }
  }

  function handleMonthChange(month) {
    setActiveMonth(month);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  useEffect(() => {
    setTimeout(() => {
      loadData(activeMonth);
    }, 0);
  }, [activeMonth, loadData]);

  const getPriority = (item) => {
    if (item.type === 'event') return 1;
    if (item.type === 'record') return 2;
    if (getMatchName(item.time)) return 1.5;
    return 3;
  };

  const sortSessions = (sessions) => {
    return sessions.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return getPriority(a) - getPriority(b);
    });
  };

  // 表示用セッションの算出
  let displaySessions = [];
  if (activeMonth === '日程一覧') {
    let filtered = [...scheduleSessions];
    if (scheduleCategory === '大会・行事') {
      filtered = filtered.filter(s => s.type === 'event');
    } else if (scheduleCategory === '記録会') {
      filtered = filtered.filter(s => s.type === 'record');
    }

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
        return sMonth === monthNum && sYear === currentYear;
      });
      displaySessions = sortSessions([...practiceSessions, ...filteredSchedule]);
    } else {
      displaySessions = sortSessions([...practiceSessions]);
    }
  }

  const allSessionsForCalendar = useMemo(() => {
    return [...allPracticeSessions, ...scheduleSessions];
  }, [allPracticeSessions, scheduleSessions]);

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
    // 選択された月へ自動的に切り替え
    const selectedDateObj = new Date(dateStr);
    const mStr = `${selectedDateObj.getMonth() + 1}月`;
    if (months.includes(mStr) && activeMonth !== mStr) {
      setActiveMonth(mStr);
    }
    
    // カレンダーを非表示に
    setShowCalendar(false);
    
    // スクロール先の特定
    setTimeout(() => {
      const target = displaySessions.find(s => s.date === dateStr);
      if (target) {
        scrollToId.current = target.id;
        const cardElem = document.getElementById(`card-${target.id}`);
        if (cardElem) {
          cardElem.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }, 200);
  }

  const handleRecordSubmitted = useCallback((payload) => {
    const CACHE_KEY = 'tf_member_stats_cache_v2';
    const CACHE_TS_KEY = 'tf_member_stats_cache_v2_ts';

    try {
      if (payload?.memberName && payload?.date) {
        window.dispatchEvent(new CustomEvent('tf_record_submitted', { detail: { payload } }));
      }

      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached || !payload?.memberName || !payload?.date) return;

      const members = JSON.parse(cached);
      if (!Array.isArray(members)) return;

      const toNum = (value) => {
        const num = parseFloat(value);
        return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
      };

      const nextMembers = members.map(member => {
        if (member.name !== payload.memberName) return member;

        const records = Array.isArray(member.records) ? [...member.records] : [];
        const existingIndex = records.findIndex(record => record.date === payload.date);

        if (payload.isDelete) {
          return {
            ...member,
            records: records.filter(record => record.date !== payload.date),
          };
        }

        const existing = existingIndex >= 0 ? records[existingIndex] : {};
        const jog = toNum(payload.jog);
        const mlt = toNum(payload.mlt);
        const cv = toNum(payload.cv);
        const speed = toNum(payload.speed);
        const total = payload.total !== undefined && payload.total !== ''
          ? toNum(payload.total)
          : Math.round((jog + mlt + cv + speed) * 100) / 100;

        const nextRecord = {
          ...existing,
          date: payload.date,
          total,
          jog,
          mlt,
          cv,
          speed,
          strides: toNum(payload.strides),
          reinforce: payload.reinforce || '',
          result: payload.result || '',
          comment: payload.comment || '',
          replies: existing.replies || [],
        };

        if (existingIndex >= 0) {
          records[existingIndex] = nextRecord;
        } else {
          records.push(nextRecord);
        }

        records.sort((a, b) => a.date.localeCompare(b.date));
        return { ...member, records };
      });

      localStorage.setItem(CACHE_KEY, JSON.stringify(nextMembers));
      localStorage.setItem(CACHE_TS_KEY, new Date().toLocaleString('ja-JP', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }));
      window.dispatchEvent(new CustomEvent('tf_stats_cache_updated', { detail: { members: nextMembers } }));
    } catch (err) {
      console.warn('記録保存後のローカル反映に失敗しました:', err);
    }
  }, []);

  // スマホ上部に並ぶ月選択チップスのリスト (日程一覧＋練習メニュー対象月)
  const visibleMonthChips = (() => {
    const todayMonth = new Date().getMonth() + 1;
    const nextMonth = todayMonth === 12 ? 1 : todayMonth + 1;
    
    const result = ['日程一覧'];
    months.forEach(m => {
      const match = m.match(/^(\d+)月/);
      if (match) {
        const mNum = parseInt(match[0], 10);
        if (mNum === todayMonth || mNum === nextMonth) {
          result.push(m);
        }
      }
    });
    return result;
  })();
  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col pb-24">

      {/* ── 📱 Header ── (一切の帯を省いたスマートヘッダー、PWAステータスバーSafe Area対応) */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-100 px-4 pt-[calc(env(safe-area-inset-top,0px)+14px)] pb-3.5 shadow-[0_2px_12px_rgba(0,0,0,0.01)]">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div>
              <h1 className="text-sm font-black text-slate-800 tracking-tight leading-none">TUAT RUNNING STATS</h1>
              <span className="text-[9px] text-slate-400 font-extrabold tracking-wider leading-none mt-1.5 block">TRACK & FIELD</span>
            </div>
          </div>
          
          {/* 手動同期ボタン */}
          <button 
            onClick={handleManualRefresh}
            disabled={loading}
            className={`p-2 rounded-xl bg-slate-50 border border-slate-100 text-slate-500 hover:text-slate-800 transition-colors shadow-sm ${loading ? 'animate-spin opacity-50' : ''}`}
            title="データを同期"
            aria-label="データを同期"
          >
            <RefreshCcw size={15} />
          </button>
        </div>
      </header>

      {/* ── 📱 Main Content Area ── */}
      <main className="flex-1 max-w-md mx-auto w-full px-3 pt-3">
        
        {/* 📅 Tab 1: スケジュール */}
        {activeTab === 'schedule' && (
          <div className="space-y-4">
            
            {/* 月選択 セグメンテッドコントロール (iOS仕様) */}
            <div className="bg-slate-100/70 p-0.5 rounded-2xl flex w-full relative">
              {visibleMonthChips.map(m => {
                const isActive = activeMonth === m;
                return (
                  <button
                    key={m}
                    onClick={() => handleMonthChange(m)}
                    className={`flex-1 py-2 text-center rounded-xl text-[11px] font-black transition-all relative z-10 duration-200 select-none ${
                      isActive 
                        ? 'bg-white text-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.06)]' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {m === '日程一覧' ? '🏆 日程一覧' : `📅 ${m}`}
                  </button>
                );
              })}
            </div>
 
            {/* ミニカレンダー表示トグル & 練習場所一覧トグル */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowCalendar(!showCalendar);
                  setShowLocations(false);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl text-xs font-black transition-all border ${
                  showCalendar 
                    ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-inner' 
                    : 'bg-white border-slate-100 text-slate-600'
                }`}
              >
                <CalendarIcon size={13} />
                {showCalendar ? 'カレンダー閉じる' : 'カレンダーで探す'}
              </button>

              <button
                onClick={() => {
                  setShowLocations(!showLocations);
                  setShowCalendar(false);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl text-xs font-black transition-all border ${
                  showLocations 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600 shadow-inner' 
                    : 'bg-white border-slate-100 text-slate-600'
                }`}
              >
                <MapPin size={13} />
                {showLocations ? '場所一覧を閉じる' : '練習場所一覧'}
              </button>
            </div>
 
            {/* インライン・マンスリーカレンダー (トグル式アコーディオン) */}
            {showCalendar && (
              <div className="animate-fade-in">
                <CalendarModal 
                  sessions={allSessionsForCalendar} 
                  onSelectDate={handleSelectDate} 
                  activeMonthStr={activeMonth}
                  availableMonthsList={months.filter(m => m !== '日程一覧')}
                />
              </div>
            )}

            {/* インライン・練習場所アクセス (トグル式アコーディオン) */}
            {showLocations && (
              <div className="animate-fade-in">
                <LocationsModal />
              </div>
            )}

            {/* 日程一覧用のカテゴリースイッチ */}
            {isScheduleView && (
              <div className="flex bg-slate-100 p-0.5 rounded-2xl border border-slate-200 shadow-inner">
                {['大会・行事', '記録会'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setScheduleCategory(cat)}
                    className={`flex-1 py-2 text-xs font-black rounded-xl transition-all ${
                      scheduleCategory === cat 
                        ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50' 
                        : 'text-slate-400 active:text-slate-600'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* 練習メニューリスト */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                <div className="w-6 h-6 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
                <p className="text-xs font-bold">練習メニュー取得中...</p>
              </div>
            ) : !hasContent ? (
              <div className="text-center py-16 text-slate-400 border border-dashed border-slate-200 rounded-3xl bg-white">
                <CalendarDays size={32} className="mx-auto mb-2 opacity-25 text-slate-300" />
                <p className="text-sm font-bold">この月の予定はありません</p>
              </div>
            ) : isScheduleView ? (
              // 日程一覧
              Object.keys(groupedSchedules).sort().map(year => {
                const sessions = groupedSchedules[year];
                const upcoming = sessions.filter(s => s.date >= TODAY_ISO);
                const past = sessions.filter(s => s.date < TODAY_ISO);

                return (
                  <div key={year} className="space-y-1">
                    <SectionDivider label={`${year}年`} />
                    {upcoming.map(item => (
                      <div key={item.id} id={`card-${item.id}`}>
                        <PracticeCard item={item} defaultOpen={false} scrollRef={scrollToId} isScheduleView={true} />
                      </div>
                    ))}
                    {past.length > 0 && (
                      <>
                        <SectionDivider label="終了した予定" />
                        {past.map(item => (
                          <div key={item.id} id={`card-${item.id}`}>
                            <PracticeCard item={item} defaultOpen={false} isPast={true} scrollRef={scrollToId} isScheduleView={true} />
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                );
              })
            ) : (
              // 月別メニュー
              <div className="space-y-3.5 pb-8">
                {/* ① 今日の練習 */}
                {todayItems.map(item => (
                  <div key={item.id} id={`card-${item.id}`}>
                    <PracticeCard item={item} defaultOpen={true} isToday={true} scrollRef={scrollToId} />
                  </div>
                ))}

                {/* ② 次の練習 */}
                {nextItem && (
                  <div key={nextItem.id} id={`card-${nextItem.id}`}>
                    <PracticeCard item={nextItem} defaultOpen={todayItems.length === 0} isNext={true} scrollRef={scrollToId} />
                  </div>
                )}

                {/* ③ それ以降の予定 */}
                {restFuture.map(item => (
                  <div key={item.id} id={`card-${item.id}`}>
                    <PracticeCard item={item} defaultOpen={false} scrollRef={scrollToId} />
                  </div>
                ))}

                {/* ④ 過去の練習 */}
                {pastItems.length > 0 && (
                  <div className="space-y-3">
                    <SectionDivider label="終了した予定" />
                    {pastItems.map(item => (
                      <div key={item.id} id={`card-${item.id}`}>
                        <PracticeCard item={item} defaultOpen={false} isPast={true} scrollRef={scrollToId} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* 🏆 Tab 2: ランキング */}
        {activeTab === 'social' && (
          <StatsDashboard 
            showSection={socialSection} 
            socialSection={socialSection}
            setSocialSection={setSocialSection}
            selectedMember={selectedMember}
            setSelectedMember={setSelectedMember}
            setActiveTab={setActiveTab}
            resetSignal={socialResetKey}
          />
        )}

        {/* 📊 Tab 3: 個人分析 */}
        {activeTab === 'analytics' && (
          <StatsDashboard 
            showSection="analytics" 
            selectedMember={selectedMember}
            setSelectedMember={setSelectedMember}
            setActiveTab={setActiveTab}
            onOpenInputDrawer={() => setShowInputDrawer(true)}
            resetSignal={myPageResetKey}
          />
        )}

      </main>

      <RecordInputDrawer
        isOpen={showInputDrawer}
        onClose={() => setShowInputDrawer(false)}
        memberName={selectedMember}
        onRecordSubmitted={handleRecordSubmitted}
      />

      {/* ── 📱 Floating Sleek Bottom Navigation Bar ── */}
      <nav
        className="fixed inset-x-4 z-40 rounded-[24px] bg-white/90 backdrop-blur-xl border border-slate-200/80 px-2 py-2.5 shadow-[0_-8px_30px_rgba(0,0,0,0.03)] flex justify-around items-center max-w-md mx-auto"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
      >
        
        {/* ボタン: 予定 */}
        <button
          onClick={() => {
            if (activeTab === 'schedule') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              setActiveTab('schedule');
            }
          }}
          className={`flex flex-col items-center gap-1 flex-1 py-1.5 rounded-xl transition-all ${
            activeTab === 'schedule' 
              ? 'text-blue-600 font-extrabold scale-105' 
              : 'text-slate-400 active:text-slate-600'
          }`}
        >
          <CalendarDays size={18} className={activeTab === 'schedule' ? 'text-blue-600' : ''} />
          <span className="text-[9px] tracking-wide font-black">予定</span>
        </button>

        {/* ボタン: ランキング */}
        <button
          onClick={() => {
            if (activeTab === 'social') {
              setSocialResetKey((prev) => prev + 1);
            } else {
              setActiveTab('social');
            }
          }}
          className={`flex flex-col items-center gap-1 flex-1 py-1.5 rounded-xl transition-all ${
            activeTab === 'social' 
              ? 'text-blue-600 font-extrabold scale-105' 
              : 'text-slate-400 active:text-slate-600'
          }`}
        >
          <Users size={18} className={activeTab === 'social' ? 'text-blue-600' : ''} />
          <span className="text-[9px] tracking-wide font-black">ソーシャル</span>
        </button>

        {/* ボタン: 個人分析 */}
        <button
          onClick={() => {
            if (activeTab === 'analytics') {
              setMyPageResetKey((prev) => prev + 1);
            } else {
              setActiveTab('analytics');
            }
          }}
          className={`flex flex-col items-center gap-1 flex-1 py-1.5 rounded-xl transition-all ${
            activeTab === 'analytics' 
              ? 'text-emerald-600 font-extrabold scale-105' 
              : 'text-slate-400 active:text-slate-600'
          }`}
        >
          <User size={18} className={activeTab === 'analytics' ? 'text-emerald-600' : ''} />
          <span className="text-[9px] tracking-wide font-black">マイページ</span>
        </button>

      </nav>

    </div>
  );
}
