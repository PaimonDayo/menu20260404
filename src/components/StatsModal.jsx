import { useState, useEffect, useMemo } from 'react';
import { X, Trophy, BarChart3, User, Calendar, Flame, AlertCircle, RefreshCcw, Activity, ChevronDown } from 'lucide-react';
import { fetchSheetList, fetchMemberPracticeData, hasConfig } from '../services/sheetsService';

// 強度別のプレミアムカラー設定
const INTENSITY_COLORS = {
  jog:   { name: '低強度 (jog)',    hex: '#10B981', bg: '#ECFDF5', text: '#047857' },
  mlt:   { name: '中強度 (M~LT)',   hex: '#3B82F6', bg: '#EFF6FF', text: '#1D4ED8' },
  cv:    { name: '高強度 (CV~VO2)',  hex: '#F59E0B', bg: '#FFFBEB', text: '#B45309' },
  speed: { name: '解糖系 (スピード)', hex: '#EF4444', bg: '#FEF2F2', text: '#B91C1C' },
};

// 期間定義
const PERIODS = {
  week:  '今週 (直近7日)',
  month: '今月',
  lastMonth: '先月',
  total: '累計',
};

// ヘルパー: 今日の日付 (YYYY-MM-DD)
const getTodayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ヘルパー: 日付が期間内かチェック
const isDateInPeriod = (dateStr, periodKey, todayIso) => {
  if (!dateStr) return false;
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date(todayIso + 'T00:00:00');
  
  if (periodKey === 'week') {
    const diffTime = today.getTime() - date.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays < 7;
  }
  
  if (periodKey === 'month') {
    return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth();
  }
  
  if (periodKey === 'lastMonth') {
    const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return date.getFullYear() === lastMonthDate.getFullYear() && date.getMonth() === lastMonthDate.getMonth();
  }
  
  return true; // total (累計)
};

// シート名から学年を抽出する（例: "B2山田" -> "B2"）
const getGradeFromName = (name) => {
  const match = name.match(/^([BM]\d)/);
  return match ? match[1] : 'その他';
};

// 学年と名前を分離して名前だけを返す（例: "B2山田" -> "山田"）
const getOnlyName = (name) => {
  const match = name.match(/^[BM]\d(.+)$/);
  return match ? match[1] : name;
};

// 学年+名前を綺麗に表示するフォーマット ("B2山田" -> "B2 山田")
const formatMemberName = (name) => {
  const match = name.match(/^([BM]\d)(.+)$/);
  return match ? `${match[1]} ${match[2]}` : name;
};

export default function StatsModal({ onClose, activeMonthStr }) {
  const [activeTab, setActiveTab] = useState('ranking'); // 'ranking' | 'personal'
  const [period, setPeriod] = useState('month'); // 'week' | 'month' | 'lastMonth' | 'total'
  const [sortKey, setSortKey] = useState('total'); // 'total' | 'jog' | 'mlt' | 'cv' | 'speed'
  const [selectedGrade, setSelectedGrade] = useState(''); // 選択された学年
  const [selectedMember, setSelectedMember] = useState(''); // 選択されたメンバー（フルネーム、例: "B2山田"）
  const [activeDropdown, setActiveDropdown] = useState(null); // 'grade' | 'member' | 'period' | 'rankingPeriod' | 'rankingSort' | null
  
  const [members, setMembers] = useState([]); // { name, gid, records }
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState({ current: 0, total: 0, name: '' });
  const [error, setError] = useState(null);
  const [cacheTime, setCacheTime] = useState(''); // キャッシュ最終更新日時

  const todayIso = useMemo(() => getTodayIso(), []);

  const CACHE_KEY = 'tf_member_stats_cache';
  const CACHE_TS_KEY = 'tf_member_stats_cache_ts';

  // アウトサイドクリックでドロップダウンを閉じる
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveDropdown(null);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, []);

  // 存在するユニークな学年リスト
  const gradeList = useMemo(() => {
    const grades = new Set();
    members.forEach(m => {
      grades.add(getGradeFromName(m.name));
    });
    return Array.from(grades).sort((a, b) => {
      if (a === 'その他') return 1;
      if (b === 'その他') return -1;
      return a.localeCompare(b);
    });
  }, [members]);

  // 選択された学年に所属するメンバーリスト
  const filteredMembersOfGrade = useMemo(() => {
    return members.filter(m => getGradeFromName(m.name) === selectedGrade);
  }, [members, selectedGrade]);

  // membersが読み込まれた時の初期設定
  useEffect(() => {
    if (members.length > 0) {
      const firstMember = members[0];
      const grade = getGradeFromName(firstMember.name);
      setSelectedGrade(grade);
      setSelectedMember(firstMember.name);
    }
  }, [members]);

  // 学年が変更された際の処理
  const handleGradeChange = (grade) => {
    setSelectedGrade(grade);
    const firstMemberOfGrade = members.find(m => getGradeFromName(m.name) === grade);
    if (firstMemberOfGrade) {
      setSelectedMember(firstMemberOfGrade.name);
    }
  };

  // スプレッドシートからのデータ取得とパース
  const fetchAndParseData = async (force = false) => {
    if (!hasConfig()) {
      setLoading(false);
      setError('スプレッドシートIDが設定されていないため、データは利用できません。');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const sheetList = await fetchSheetList();
      if (sheetList.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      setProgress({ current: 0, total: 1, name: '同期中...' });

      const cacheBuster = force ? Date.now() : null;
      
      // Promise.all を使用して並行フェッチに変更（劇的な高速化）
      const promises = sheetList.map(async (sheet) => {
        try {
          const records = await fetchMemberPracticeData(sheet.gid, cacheBuster);
          if (records !== null) {
            return {
              name: sheet.name,
              gid: sheet.gid,
              records: records
            };
          }
        } catch (err) {
          console.warn(`メンバー「${sheet.name}」のデータ取得に失敗:`, err);
        }
        return null;
      });

      const results = await Promise.all(promises);
      const parsedMembers = results.filter(m => m !== null);

      const sorted = parsedMembers.sort((a, b) => a.name.localeCompare(b.name));
      setMembers(sorted);

      // localStorageにキャッシュを保存
      localStorage.setItem(CACHE_KEY, JSON.stringify(sorted));
      const nowStr = new Date().toLocaleString('ja-JP', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      localStorage.setItem(CACHE_TS_KEY, nowStr);
      setCacheTime(nowStr);
      setLoading(false);

    } catch (err) {
      console.error('走行距離データの読み込みエラー:', err);
      setError('スプレッドシートからのデータ取得に失敗しました。');
      setLoading(false);
    }
  };

  // マウント時にキャッシュがあればそれを読み込み、なければ取得する
  useEffect(() => {
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTs = localStorage.getItem(CACHE_TS_KEY);

    if (cachedData && cachedTs) {
      try {
        const parsed = JSON.parse(cachedData);
        setMembers(parsed);
        setCacheTime(cachedTs);
        setLoading(false);
      } catch (e) {
        console.warn('キャッシュデータのパースに失敗しました。再取得します。', e);
        fetchAndParseData(false);
      }
    } else {
      fetchAndParseData(false);
    }

    // バックグラウンドでプリロードが完了した際のリアルタイム更新リスナー
    const handleCacheUpdated = (e) => {
      const { members: newMembers, timestamp } = e.detail;
      setMembers(newMembers);
      setCacheTime(timestamp);
      setLoading(false);
      setError(null);
    };

    window.addEventListener('tf_stats_cache_updated', handleCacheUpdated);
    return () => {
      window.removeEventListener('tf_stats_cache_updated', handleCacheUpdated);
    };
  }, []);

  // 2. ランキング集計データの算出
  const rankingData = useMemo(() => {
    return members.map(m => {
      const stats = { total: 0, jog: 0, mlt: 0, cv: 0, speed: 0 };
      
      m.records.forEach(r => {
        if (isDateInPeriod(r.date, period, todayIso)) {
          stats.total += r.total;
          stats.jog   += r.jog;
          stats.mlt   += r.mlt;
          stats.cv    += r.cv;
          stats.speed += r.speed;
        }
      });

      const round = (val) => Math.round(val * 100) / 100;

      return {
        name: m.name,
        total: round(stats.total),
        jog:   round(stats.jog),
        mlt:   round(stats.mlt),
        cv:    round(stats.cv),
        speed: round(stats.speed),
      };
    })
    .filter(m => m.total > 0)
    .sort((a, b) => b[sortKey] - a[sortKey]);
  }, [members, period, sortKey, todayIso]);

  // 3. 選択されたメンバーの集計データ
  const selectedMemberData = useMemo(() => {
    const member = members.find(m => m.name === selectedMember);
    if (!member) return null;

    const stats = { total: 0, jog: 0, mlt: 0, cv: 0, speed: 0 };
    const monthlyTrend = {}; // 'YYYY-MM' -> { total, jog, mlt, cv, speed }
    const dailyRecords = [];

    member.records.forEach(r => {
      // 期間内集計
      if (isDateInPeriod(r.date, period, todayIso)) {
        stats.total += r.total;
        stats.jog   += r.jog;
        stats.mlt   += r.mlt;
        stats.cv    += r.cv;
        stats.speed += r.speed;
      }
      
      // 全履歴の蓄積 (期間に関わらず常に表示)
      dailyRecords.push(r);

      // 月別推移（全データを月別に集計）
      if (r.date) {
        const monthKey = r.date.substring(0, 7); // 'YYYY-MM'
        if (!monthlyTrend[monthKey]) {
          monthlyTrend[monthKey] = { total: 0, jog: 0, mlt: 0, cv: 0, speed: 0 };
        }
        monthlyTrend[monthKey].total += r.total;
        monthlyTrend[monthKey].jog   += r.jog;
        monthlyTrend[monthKey].mlt   += r.mlt;
        monthlyTrend[monthKey].cv    += r.cv;
        monthlyTrend[monthKey].speed += r.speed;
      }
    });

    const round = (val) => Math.round(val * 100) / 100;
    
    // 直近6ヶ月の月別トレンドを生成
    const trendList = Object.keys(monthlyTrend)
      .sort()
      .slice(-6)
      .map(key => {
        const t = monthlyTrend[key];
        const [y, m] = key.split('-');
        return {
          label: `${parseInt(m)}月`,
          total: round(t.total),
          jog:   round(t.jog),
          mlt:   round(t.mlt),
          cv:    round(t.cv),
          speed: round(t.speed),
        };
      });

    return {
      name: member.name,
      total: round(stats.total),
      jog:   round(stats.jog),
      mlt:   round(stats.mlt),
      cv:    round(stats.cv),
      speed: round(stats.speed),
      trend: trendList,
      daily: dailyRecords.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)
    };
  }, [members, selectedMember, period, todayIso]);

  // 4. ドーナツグラフ（SVG）用の計算
  const donutData = useMemo(() => {
    if (!selectedMemberData || selectedMemberData.total === 0) return [];
    
    const { total, jog, mlt, cv, speed } = selectedMemberData;
    const items = [
      { key: 'jog',   val: jog,   color: INTENSITY_COLORS.jog.hex },
      { key: 'mlt',   val: mlt,   color: INTENSITY_COLORS.mlt.hex },
      { key: 'cv',    val: cv,    color: INTENSITY_COLORS.cv.hex },
      { key: 'speed', val: speed, color: INTENSITY_COLORS.speed.hex },
    ].filter(item => item.val > 0);

    const radius = 50;
    const circumference = 2 * Math.PI * radius; // 約314.16
    let accumulatedAngle = 0;

    return items.map(item => {
      const percentage = (item.val / total) * 100;
      const strokeLength = (item.val / total) * circumference;
      const strokeOffset = circumference - strokeLength + accumulatedAngle;
      accumulatedAngle -= strokeLength;

      return {
        ...item,
        percentage: Math.round(percentage * 10) / 10,
        strokeDash: `${strokeLength} ${circumference}`,
        strokeOffset
      };
    });
  }, [selectedMemberData]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg h-[92vh] sm:h-[85vh] flex flex-col overflow-hidden animate-slide-up">
        
        {/* Header */}
        <header className="px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <Flame size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight leading-none">走行距離・ランキング</h2>
              <p className="text-[10px] text-blue-200 font-semibold mt-1">
                {cacheTime ? `データ最終更新: ${cacheTime}` : 'スプレッドシート連携（読み取り専用）'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!loading && (
              <button 
                onClick={() => fetchAndParseData(true)} 
                className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors"
                title="データを最新に更新"
              >
                <RefreshCcw size={18} />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Tab Selector */}
        <div className="flex bg-slate-100 p-1.5 mx-4 mt-4 rounded-2xl shrink-0 gap-1">
          <button
            onClick={() => setActiveTab('ranking')}
            className={`flex-1 py-3 text-sm font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'ranking' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Trophy size={16} />
            部内ランキング
          </button>
          <button
            onClick={() => setActiveTab('personal')}
            className={`flex-1 py-3 text-sm font-black rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'personal' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 size={16} />
            個人グラフ
          </button>
        </div>

        {/* Loading / Error States */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-slate-500 gap-5 animate-fade-in">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 border-4 border-slate-100 rounded-full" />
              <div className="absolute inset-0 border-4 border-t-blue-500 rounded-full animate-spin" />
            </div>
            <div className="text-center space-y-1.5 max-w-xs">
              <p className="font-bold text-slate-800">スプレッドシートと同期中</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                部員の走行距離データを集計しています。同期は数秒で完了します。
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
            <AlertCircle size={40} className="text-red-500 mb-2" />
            <p className="font-bold text-slate-800">データの読み込みに失敗しました</p>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">{error}</p>
          </div>
        ) : (
          /* Main Content Frame (Scrollable) */
          <div className="flex-1 overflow-y-auto px-4 py-3">
            
            {/* 📋 RANKING TAB */}
            {activeTab === 'ranking' && (
              <div className="space-y-4">
                
                {/* Filters */}
                <div className="grid grid-cols-2 gap-2 relative z-30">
                  {/* 集計期間 */}
                  <div className="flex flex-col gap-1 relative">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">集計期間</label>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(activeDropdown === 'rankingPeriod' ? null : 'rankingPeriod');
                      }}
                      className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 hover:border-blue-500 transition-all text-left"
                    >
                      <span>{PERIODS[period]}</span>
                      <ChevronDown size={12} className={`text-slate-400 transition-transform duration-200 ${activeDropdown === 'rankingPeriod' ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {activeDropdown === 'rankingPeriod' && (
                      <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-slate-100 rounded-xl shadow-xl py-1 z-40 animate-slide-up">
                        {Object.entries(PERIODS).map(([k, v]) => (
                          <button
                            key={k}
                            onClick={() => {
                              setPeriod(k);
                              setActiveDropdown(null);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors ${
                              period === k ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* ソート基準 */}
                  <div className="flex flex-col gap-1 relative">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ソート基準</label>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDropdown(activeDropdown === 'rankingSort' ? null : 'rankingSort');
                      }}
                      className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 hover:border-blue-500 transition-all text-left"
                    >
                      <span className="truncate">{
                        sortKey === 'total' ? '総走行距離' :
                        sortKey === 'jog' ? '低強度 (jog)' :
                        sortKey === 'mlt' ? '中強度 (M~LT)' :
                        sortKey === 'cv' ? '高強度 (CV~VO2)' : '解糖系 (スピード)'
                      }</span>
                      <ChevronDown size={12} className={`text-slate-400 transition-transform duration-200 shrink-0 ml-1 ${activeDropdown === 'rankingSort' ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {activeDropdown === 'rankingSort' && (
                      <div className="absolute top-[calc(100%+4px)] right-0 w-full bg-white border border-slate-100 rounded-xl shadow-xl py-1 z-40 animate-slide-up">
                        {[
                          { k: 'total', v: '総走行距離' },
                          { k: 'jog', v: '低強度 (jog)' },
                          { k: 'mlt', v: '中強度 (M~LT)' },
                          { k: 'cv', v: '高強度 (CV~VO2)' },
                          { k: 'speed', v: '解糖系 (スピード)' }
                        ].map(({ k, v }) => (
                          <button
                            key={k}
                            onClick={() => {
                              setSortKey(k);
                              setActiveDropdown(null);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors ${
                              sortKey === k ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Ranking List */}
                {rankingData.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <Calendar size={36} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-medium">この期間のデータはありません</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rankingData.map((item, index) => {
                      const isTop3 = index < 3;
                      const badgeBg = isTop3 
                        ? (index === 0 ? 'bg-amber-100 border-amber-300 text-amber-700' : index === 1 ? 'bg-slate-100 border-slate-300 text-slate-600' : 'bg-orange-100 border-orange-200 text-orange-700')
                        : 'bg-slate-50 border-slate-100 text-slate-500';
                      const badgeIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;

                      // 積層バーの計算
                      const jogPercent = Math.max(0, Math.min(100, (item.jog / item.total) * 100));
                      const mltPercent = Math.max(0, Math.min(100, (item.mlt / item.total) * 100));
                      const cvPercent = Math.max(0, Math.min(100, (item.cv / item.total) * 100));
                      const speedPercent = Math.max(0, Math.min(100, (item.speed / item.total) * 100));

                      return (
                        <div key={item.name} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl shadow-sm">
                          {/* Rank Icon */}
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-black border ${badgeBg}`}>
                            {badgeIcon}
                          </div>
                          
                          {/* Member info & Stacked bar */}
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-baseline mb-1">
                              <h4 className="text-sm font-black text-slate-800 truncate">
                                {formatMemberName(item.name)}
                              </h4>
                              <p className="text-sm font-black text-blue-600 shrink-0">
                                {item[sortKey]}<span className="text-[10px] text-slate-400 font-bold ml-0.5">km</span>
                                {sortKey !== 'total' && (
                                  <span className="text-[10px] text-slate-400 font-bold ml-1">/ {item.total}km</span>
                                )}
                              </p>
                            </div>
                            
                            {/* Proportional bar visualizer */}
                            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex border border-slate-100">
                              <div style={{ width: `${jogPercent}%`, backgroundColor: INTENSITY_COLORS.jog.hex }} title={`jog: ${item.jog}km`} />
                              <div style={{ width: `${mltPercent}%`, backgroundColor: INTENSITY_COLORS.mlt.hex }} title={`M~LT: ${item.mlt}km`} />
                              <div style={{ width: `${cvPercent}%`, backgroundColor: INTENSITY_COLORS.cv.hex }} title={`CV: ${item.cv}km`} />
                              <div style={{ width: `${speedPercent}%`, backgroundColor: INTENSITY_COLORS.speed.hex }} title={`スピード: ${item.speed}km`} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 📊 PERSONAL TAB */}
            {activeTab === 'personal' && (
              <div className="space-y-4">
                
                {/* Grade & Member selector & Period */}
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100/80 space-y-3 shadow-inner relative z-30">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {/* 学年 */}
                    <div className="flex flex-col gap-1 relative col-span-1 sm:col-span-1">
                      <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">学年</label>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdown(activeDropdown === 'grade' ? null : 'grade');
                        }}
                        className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:border-blue-500 transition-all text-left"
                      >
                        <span>{selectedGrade || '選択'}</span>
                        <ChevronDown size={12} className={`text-slate-400 transition-transform duration-200 ${activeDropdown === 'grade' ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {activeDropdown === 'grade' && (
                        <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-slate-100 rounded-xl shadow-xl py-1 z-40 max-h-40 overflow-y-auto animate-slide-up">
                          {gradeList.map(g => (
                            <button
                              key={g}
                              onClick={() => {
                                handleGradeChange(g);
                                setActiveDropdown(null);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors ${
                                selectedGrade === g ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 部員 */}
                    <div className="flex flex-col gap-1 relative col-span-1 sm:col-span-1">
                      <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">部員</label>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdown(activeDropdown === 'member' ? null : 'member');
                        }}
                        className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:border-blue-500 transition-all text-left min-w-0"
                      >
                        <span className="truncate">{selectedMember ? getOnlyName(selectedMember) : '選択'}</span>
                        <ChevronDown size={12} className={`text-slate-400 transition-transform duration-200 shrink-0 ml-1 ${activeDropdown === 'member' ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {activeDropdown === 'member' && (
                        <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-slate-100 rounded-xl shadow-xl py-1 z-40 max-h-48 overflow-y-auto animate-slide-up">
                          {filteredMembersOfGrade.map(m => (
                            <button
                              key={m.name}
                              onClick={() => {
                                setSelectedMember(m.name);
                                setActiveDropdown(null);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors truncate ${
                                selectedMember === m.name ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {getOnlyName(m.name)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* 集計期間 */}
                    <div className="flex flex-col gap-1 relative col-span-2 sm:col-span-1">
                      <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">集計期間</label>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDropdown(activeDropdown === 'period' ? null : 'period');
                        }}
                        className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:border-blue-500 transition-all text-left min-w-0"
                      >
                        <span className="truncate">{PERIODS[period]}</span>
                        <ChevronDown size={12} className={`text-slate-400 transition-transform duration-200 shrink-0 ml-1 ${activeDropdown === 'period' ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {activeDropdown === 'period' && (
                        <div className="absolute top-[calc(100%+4px)] right-0 w-full bg-white border border-slate-100 rounded-xl shadow-xl py-1 z-40 animate-slide-up">
                          {Object.entries(PERIODS).map(([k, v]) => (
                            <button
                              key={k}
                              onClick={() => {
                                setPeriod(k);
                                setActiveDropdown(null);
                              }}
                              className={`w-full text-left px-3 py-2 text-xs font-bold transition-colors ${
                                period === k ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {!selectedMemberData ? (
                  <div className="text-center py-16 text-slate-400 bg-slate-50 rounded-3xl border border-slate-100/80">
                    <User size={36} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm font-semibold">メンバーデータがありません</p>
                  </div>
                ) : (
                  <div className="space-y-4 animate-fade-in">
                    
                    {/* Summary box & Donut Graph */}
                    <div className="bg-white border border-slate-100/80 rounded-3xl p-4.5 shadow-sm flex items-center justify-between gap-4 transition-all hover:shadow-md">
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5 text-slate-400 mb-1">
                          <Activity size={14} className="text-blue-500" />
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">期間内の合計走行距離</span>
                        </div>
                        <p className="text-3.5xl font-black text-slate-800 leading-none tracking-tight">
                          {selectedMemberData.total}
                          <span className="text-xs text-slate-400 font-bold ml-1">km</span>
                        </p>
                        
                        {/* Mini legend list */}
                        <div className="mt-3.5 space-y-1.5">
                          {Object.entries(INTENSITY_COLORS).map(([key, item]) => {
                            const val = selectedMemberData[key] || 0;
                            const percent = selectedMemberData.total > 0 
                              ? Math.round((val / selectedMemberData.total) * 100) 
                              : 0;
                            return (
                              <div key={key} className="flex items-center gap-2 text-xs">
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.hex }} />
                                <span className="text-slate-500 font-semibold">{item.name}:</span>
                                <span className="font-bold text-slate-700 ml-auto">{val}km ({percent}%)</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      
                      {/* SVG Donuts circular chart */}
                      <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                          {/* Background Track Circle */}
                          <circle cx="60" cy="60" r="50" fill="none" stroke="#F1F5F9" strokeWidth="12" />
                          
                          {/* Segment Circles */}
                          {selectedMemberData.total > 0 ? (
                            donutData.map((item, idx) => (
                              <circle
                                key={idx}
                                cx="60"
                                cy="60"
                                r="50"
                                fill="none"
                                stroke={item.color}
                                strokeWidth="12"
                                strokeDasharray={item.strokeDash}
                                strokeDashoffset={item.strokeOffset}
                                strokeLinecap={donutData.length === 1 ? 'butt' : 'round'}
                                className="transition-all duration-500"
                              />
                            ))
                          ) : (
                            <circle cx="60" cy="60" r="50" fill="none" stroke="#E2E8F0" strokeWidth="12" strokeDasharray="4 4" />
                          )}
                        </svg>
                        
                        {/* Center overlay label */}
                        <div className="absolute flex flex-col items-center justify-center">
                          <span className="text-[9px] text-slate-400 font-extrabold leading-none uppercase">Total</span>
                          <span className="text-base font-black text-slate-800 mt-0.5 leading-none">{Math.round(selectedMemberData.total)}</span>
                        </div>
                      </div>
                    </div>

                    {/* 期間内データがない場合のスタイリッシュなアラート */}
                    {selectedMemberData.total === 0 && (
                      <div className="flex items-start gap-2.5 p-3.5 bg-amber-50 border border-amber-100 text-amber-800 rounded-2xl text-[11px] font-semibold leading-relaxed shadow-sm">
                        <AlertCircle size={14} className="shrink-0 text-amber-500 mt-0.5" />
                        <div>
                          選択された期間（{PERIODS[period]}）の走行距離データはありません。
                          上部メニューで期間を<strong>「累計」</strong>に変更すると、全てのデータを表示できます。
                        </div>
                      </div>
                    )}

                    {/* Monthly Trend (SVG Stacked Bar Chart) */}
                    {selectedMemberData.trend.length > 0 && (
                      <div className="bg-white border border-slate-100/80 rounded-3xl p-4.5 shadow-sm">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">月別走行距離推移 (直近6ヶ月)</h4>
                        
                        <div className="h-40 w-full relative flex items-end justify-between px-2 pt-4">
                          {/* Grid Lines */}
                          <div className="absolute inset-x-0 bottom-0 h-px bg-slate-100" />
                          <div className="absolute inset-x-0 top-1/3 h-px bg-slate-50 border-t border-dashed border-slate-100" />
                          <div className="absolute inset-x-0 top-2/3 h-px bg-slate-50 border-t border-dashed border-slate-100" />
                          
                          {/* Bars */}
                          {selectedMemberData.trend.map((t, idx) => {
                            const maxVal = Math.max(...selectedMemberData.trend.map(x => x.total), 10);
                            const scale = (val) => (val / maxVal) * 110;

                            const jogHeight   = scale(t.jog);
                            const mltHeight   = scale(t.mlt);
                            const cvHeight    = scale(t.cv);
                            const speedHeight = scale(t.speed);

                            return (
                              <div key={idx} className="flex flex-col items-center gap-1.5 flex-1 relative group">
                                
                                {/* Hover Tooltip label */}
                                <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg pointer-events-none z-10 whitespace-nowrap">
                                  {t.total} km
                                </div>
                                
                                {/* Stacked Bar */}
                                <div className="w-5 rounded-md overflow-hidden flex flex-col justify-end bg-slate-50 border border-slate-100" style={{ height: '110px' }}>
                                  <div style={{ height: `${speedHeight}px`, backgroundColor: INTENSITY_COLORS.speed.hex }} />
                                  <div style={{ height: `${cvHeight}px`,    backgroundColor: INTENSITY_COLORS.cv.hex }} />
                                  <div style={{ height: `${mltHeight}px`,   backgroundColor: INTENSITY_COLORS.mlt.hex }} />
                                  <div style={{ height: `${jogHeight}px`,   backgroundColor: INTENSITY_COLORS.jog.hex }} />
                                </div>
                                
                                <span className="text-[10px] font-bold text-slate-500">{t.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Recent records with comments */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">最近の練習データ (最新10件)</h4>
                      <div className="space-y-2">
                        {selectedMemberData.daily.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-4">データがありません</p>
                        ) : (
                          selectedMemberData.daily.map((r, i) => {
                            const [y, m, d] = r.date.split('-');
                            return (
                              <div key={i} className="p-3.5 bg-white border border-slate-100 rounded-2xl shadow-sm text-xs space-y-1.5 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-slate-700">{m}月{d}日</span>
                                  <span className="font-black text-slate-800 bg-slate-50 px-2.5 py-0.5 rounded-lg border border-slate-200">
                                    合計: {r.total}km
                                  </span>
                                </div>
                                
                                {/* Indvidual intensities details inline */}
                                <div className="flex gap-2 flex-wrap text-[10px] text-slate-500 font-semibold pt-0.5">
                                  {r.jog > 0 && <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: INTENSITY_COLORS.jog.bg, color: INTENSITY_COLORS.jog.text }}>jog: {r.jog}k</span>}
                                  {r.mlt > 0 && <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: INTENSITY_COLORS.mlt.bg, color: INTENSITY_COLORS.mlt.text }}>M~LT: {r.mlt}k</span>}
                                  {r.cv > 0 && <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: INTENSITY_COLORS.cv.bg, color: INTENSITY_COLORS.cv.text }}>CV: {r.cv}k</span>}
                                  {r.speed > 0 && <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: INTENSITY_COLORS.speed.bg, color: INTENSITY_COLORS.speed.text }}>解糖系: {r.speed}k</span>}
                                </div>

                                {r.comment && (
                                  <p className="text-[11px] text-slate-500 leading-relaxed italic bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-100 mt-1 whitespace-pre-wrap">
                                    "{r.comment}"
                                  </p>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
