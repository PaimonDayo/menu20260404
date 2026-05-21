import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Trophy, BarChart3, User, Calendar, Flame, AlertCircle, RefreshCcw, Activity, ChevronDown, Award, Users, TrendingUp, X, ChevronRight, HelpCircle } from 'lucide-react';
import { fetchSheetList, fetchMemberPracticeData, hasConfig } from '../services/sheetsService';

// 強度別のプレミアム・パステルカラー設定 (スプレッドシート準拠の配色)
const INTENSITY_COLORS = {
  jog:          { name: '低強度 (jog)',    hex: '#3b82f6', bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' }, // ロイヤル・パステルブルー
  mlt:          { name: '中強度 (M~LT)',   hex: '#10b981', bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' }, // ミント・エメラルドグリーン
  cv:           { name: '高強度 (CV~VO2)',  hex: '#eab308', bg: '#fef9c3', text: '#854d0e', border: '#fef08a' }, // サンシャインイエロー
  speed:        { name: '解糖系 (スピード)', hex: '#f97316', bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' }, // コーラルオレンジ
  unclassified: { name: 'その他 (アップ等)', hex: '#94a3b8', bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' }, // プレミアム・ライトグレー
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

// ランキング用の絶対物理スケール上限（ブレない基準）を計算するヘルパー
const getStableRankingLimit = (maxVal, period) => {
  if (maxVal <= 0) maxVal = 10;
  if (period === 'week') {
    if (maxVal <= 20) return 20;
    if (maxVal <= 40) return 40;
    if (maxVal <= 60) return 60;
    if (maxVal <= 80) return 80;
    return Math.ceil(maxVal / 50) * 50; // 100, 150, 200, ...
  }
  if (period === 'month' || period === 'lastMonth') {
    if (maxVal <= 50) return 50;
    if (maxVal <= 100) return 100;
    if (maxVal <= 150) return 150;
    if (maxVal <= 200) return 200;
    if (maxVal <= 300) return 300;
    return Math.ceil(maxVal / 100) * 100; // 400, 500, ...
  }
  // 累計
  if (maxVal <= 300) return 300;
  if (maxVal <= 500) return 500;
  if (maxVal <= 800) return 800;
  return Math.ceil(maxVal / 200) * 200; // 1000, 1200, 1400, ...
};

// ランキング用の目盛り（ticks）を生成するヘルパー
const getRankingTicks = (limit) => {
  if (limit <= 20) return [0, 10, 20];
  if (limit <= 40) return [0, 20, 40];
  if (limit <= 60) return [0, 20, 40, 60];
  if (limit <= 80) return [0, 40, 80];
  if (limit <= 100) return [0, 50, 100];
  if (limit <= 150) return [0, 50, 100, 150];
  if (limit <= 200) return [0, 100, 200];
  if (limit <= 300) return [0, 100, 200, 300];
  if (limit <= 500) return [0, 250, 500];
  if (limit <= 800) return [0, 400, 800];
  return [0, Math.round(limit / 2), limit];
};

export default function StatsDashboard({ 
  showSection = 'ranking', 
  onDataLoaded = null,
  selectedMember = '',
  setSelectedMember = () => {}
}) {
  const [period, setPeriod] = useState('month'); // 'week' | 'month' | 'lastMonth' | 'total'
  const [sortKey, setSortKey] = useState('total'); // 'total' | 'jog' | 'mlt' | 'cv' | 'speed'
  const [activeDropdown, setActiveDropdown] = useState(null); // 'period' | 'rankingSort' | null
  const [showMemberSheet, setShowMemberSheet] = useState(false); // iOS風メンバー選択シートの表示状態
  const [activeDailyIdx, setActiveDailyIdx] = useState(null); // タップされた日次のインデックス
  const [activeMonthIdx, setActiveMonthIdx] = useState(null); // タップされた月次のインデックス
  const [rankingGrade, setRankingGrade] = useState(''); // ランキング用学年フィルター ("" = すべて)
  const [showAllRanking, setShowAllRanking] = useState(false); // もっと見るフラグ
  const [rankingDetailMember, setRankingDetailMember] = useState(''); // ランキング内詳細表示部員名
  const [modalGrade, setModalGrade] = useState(''); // モーダル内学年フィルター

  useEffect(() => {
    setTimeout(() => {
      setActiveDailyIdx(null);
      setActiveMonthIdx(null);
    }, 0);
  }, [selectedMember]);

  useEffect(() => {
    setTimeout(() => {
      setActiveDailyIdx(null);
      setActiveMonthIdx(null);
    }, 0);
  }, [rankingDetailMember]);
  const CACHE_KEY = 'tf_member_stats_cache';
  const CACHE_TS_KEY = 'tf_member_stats_cache_ts';

  const [members, setMembers] = useState(() => {
    try {
      const cached = localStorage.getItem('tf_member_stats_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('キャッシュデータの初期パース失敗:', e);
    }
    return [];
  });

  const [loading, setLoading] = useState(() => {
    try {
      const cachedData = localStorage.getItem('tf_member_stats_cache');
      const cachedTs = localStorage.getItem('tf_member_stats_cache_ts');
      return !(cachedData && cachedTs);
    } catch {
      return true;
    }
  });

  const [error, setError] = useState(null);

  // 📱 メンバー選択シートのドラッグクローズ用ステート＆Ref
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false); // iOS風メンバー選択シートのクローズアニメーション状態
  const touchStartY = useRef(0);

  // 📱 メンバー選択シートをアニメーション付きで閉じる共通関数
  const closeMemberSheet = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowMemberSheet(false);
      setIsClosing(false);
      setDragOffsetY(0);
    }, 300);
  };

  const todayIso = useMemo(() => getTodayIso(), []);

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

  // 📱 メンバー選択シートのタッチドラッグ処理
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!touchStartY.current) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartY.current;
    
    // 下方向へのドラッグのみOffsetYを反映
    const offset = Math.max(0, deltaY);
    setDragOffsetY(offset);
    
    // スクロールなどの規定の動作を防止
    if (offset > 0 && e.cancelable) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (dragOffsetY > 100) {
      // 100px以上下にドラッグした場合は閉じる
      closeMemberSheet();
    } else {
      // dragOffsetY を 0 に戻す
      setDragOffsetY(0);
    }
    touchStartY.current = 0;
  };

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



  // membersが読み込まれた時の初期設定
  useEffect(() => {
    if (members.length > 0 && !selectedMember) {
      // ユーザーの初期状態をセット。全学年の最初のメンバーをデフォルトメンバーとする
      const defaultMember = members[0];
      
      setTimeout(() => {
        setSelectedMember(defaultMember.name);
      }, 0);
    }
  }, [members, selectedMember, setSelectedMember]);



  // スプレッドシートからのデータ取得とパース
  const fetchAndParseData = async (force = false, isBackground = false) => {
    if (!hasConfig()) {
      setLoading(false);
      setError('スプレッドシートIDが設定されていないため、データは利用できません。');
      return;
    }

    try {
      if (!isBackground) {
        setLoading(true);
      }
      setError(null);

      // フォールバック用の既存キャッシュをマップ化して保持
      const cachedData = localStorage.getItem(CACHE_KEY);
      const prevMembersMap = {};
      if (cachedData) {
        try {
          const parsed = JSON.parse(cachedData);
          if (Array.isArray(parsed)) {
            parsed.forEach(m => {
              if (m && m.gid) {
                prevMembersMap[m.gid] = m;
              }
            });
          }
        } catch (e) {
          console.warn('既存キャッシュのパース失敗:', e);
        }
      }
      
      const sheetList = await fetchSheetList();
      if (sheetList.length === 0) {
        setMembers([]);
        setLoading(false);
        return;
      }

      const cacheBuster = force ? Date.now() : null;
      
      // 同時実行数を制限してフェッチを実行するキュー処理 (同時最大4件)
      const CONCURRENCY_LIMIT = 4;
      const results = [];
      const queue = [...sheetList];

      // リトライ機能付きの個別フェッチ関数
      const fetchWithRetry = async (sheet, retries = 1) => {
        try {
          const records = await fetchMemberPracticeData(sheet.gid, cacheBuster);
          if (records !== null) {
            return {
              name: sheet.name,
              gid: sheet.gid,
              records: records
            };
          }
          // 中長距離以外の部員（records === null）の場合は null を返す
          return null;
        } catch (err) {
          if (retries > 0) {
            console.warn(`メンバー「${sheet.name}」のフェッチ失敗。200ms後に再試行します...`, err);
            await new Promise(resolve => setTimeout(resolve, 200));
            return fetchWithRetry(sheet, retries - 1);
          }
          throw err;
        }
      };

      // 順行フェッチを行うワーカーを起動
      const workers = Array(Math.min(CONCURRENCY_LIMIT, queue.length)).fill(null).map(async () => {
        while (queue.length > 0) {
          const sheet = queue.shift();
          if (!sheet) continue;
          try {
            const memberData = await fetchWithRetry(sheet, 1);
            if (memberData !== null) {
              results.push(memberData);
            }
          } catch (err) {
            console.error(`メンバー「${sheet.name}」のデータ取得に完全に失敗しました。キャッシュから復元します:`, err);
            // 過去のキャッシュがあれば復元して救済
            if (prevMembersMap[sheet.gid]) {
              results.push(prevMembersMap[sheet.gid]);
            } else {
              // キャッシュもない場合は空データで枠だけ維持
              results.push({
                name: sheet.name,
                gid: sheet.gid,
                records: []
              });
            }
          }
        }
      });

      // すべてのワーカーが終了するのを待つ
      await Promise.all(workers);

      const sorted = results.sort((a, b) => a.name.localeCompare(b.name));
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
      setLoading(false);

      if (onDataLoaded) {
        onDataLoaded(sorted);
      }

    } catch (err) {
      console.error('走行距離データの読み込みエラー:', err);
      setError('スプレッドシートからのデータ取得に失敗しました。');
      setLoading(false);
    }
  };

  // マウント時にキャッシュが無ければフェッチ。ある場合は初期レンダリング後にバックグラウンドフェッチ(SWR)のみを実行
  useEffect(() => {
    const cachedData = localStorage.getItem(CACHE_KEY);
    const cachedTs = localStorage.getItem(CACHE_TS_KEY);

    if (cachedData && cachedTs) {
      if (onDataLoaded) {
        try {
          const parsed = JSON.parse(cachedData);
          onDataLoaded(parsed);
        } catch (e) {
          console.warn('親コンポーネント通知用キャッシュパース失敗:', e);
        }
      }
      // バックグラウンドで最新データをフェッチして更新する (SWR) - レンダリングサイクル後に実行して cascading render エラーを回避
      setTimeout(() => {
        fetchAndParseData(true, true);
      }, 0);
    } else {
      // キャッシュが無い場合のみ、ローディング表示を伴う通常フェッチ - レンダリングサイクル後に実行して cascading render エラーを回避
      setTimeout(() => {
        fetchAndParseData(true, false);
      }, 0);
    }

    // バックグラウンドでの自動ロード連携リスナー
    const handleCacheUpdated = (e) => {
      const { members: newMembers } = e.detail;
      setMembers(newMembers);
      setLoading(false);
      setError(null);
      if (onDataLoaded) {
        onDataLoaded(newMembers);
      }
    };

    window.addEventListener('tf_stats_cache_updated', handleCacheUpdated);
    return () => {
      window.removeEventListener('tf_stats_cache_updated', handleCacheUpdated);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps



  // ランキング集計データの算出
  const rankingData = useMemo(() => {
    return members.map(m => {
      const stats = { total: 0, jog: 0, mlt: 0, cv: 0, speed: 0, unclassified: 0 };
      
      m.records.forEach(r => {
        if (isDateInPeriod(r.date, period, todayIso)) {
          stats.total += r.total;
          stats.jog   += r.jog;
          stats.mlt   += r.mlt;
          stats.cv    += r.cv;
          stats.speed += r.speed;
          const detailSum = r.jog + r.mlt + r.cv + r.speed;
          stats.unclassified += Math.max(0, r.total - detailSum);
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
        unclassified: round(stats.unclassified),
      };
    })
    .filter(m => m.total > 0)
    .filter(m => {
      if (!rankingGrade) return true;
      return getGradeFromName(m.name) === rankingGrade;
    })
    .sort((a, b) => {
      const valA = Number.isFinite(a[sortKey]) ? a[sortKey] : 0;
      const valB = Number.isFinite(b[sortKey]) ? b[sortKey] : 0;
      return valB - valA;
    });
  }, [members, period, sortKey, todayIso, rankingGrade]);

  // 表彰台トップ3の選出
  const podiumMembers = useMemo(() => {
    if (rankingData.length === 0) return [];
    return rankingData.slice(0, 3);
  }, [rankingData]);

  // 表彰台表示用の並び替え [2位, 1位, 3位] の順
  const podiumLayout = useMemo(() => {
    if (podiumMembers.length === 0) return [];
    const layout = [];
    if (podiumMembers[1]) layout.push({ member: podiumMembers[1], rank: 2 }); // 2位
    if (podiumMembers[0]) layout.push({ member: podiumMembers[0], rank: 1 }); // 1位
    if (podiumMembers[2]) layout.push({ member: podiumMembers[2], rank: 3 }); // 3位
    return layout;
  }, [podiumMembers]);

  // ランキングの絶対物理スケール上限値とグリッド ticks の計算
  const rankingScale = useMemo(() => {
    const maxVal = rankingData.length > 0 ? Math.max(...rankingData.map(r => r[sortKey])) : 50;
    const limit = getStableRankingLimit(maxVal, period);
    const ticks = getRankingTicks(limit);
    return { limit, ticks };
  }, [rankingData, period, sortKey]);

  // リスト展開制御に対応したランキングデータ
  const displayedRanking = useMemo(() => {
    return showAllRanking ? rankingData : rankingData.slice(0, 10);
  }, [rankingData, showAllRanking]);

  // 選択されたメンバーの集計データ
  const selectedMemberData = useMemo(() => {
    const member = members.find(m => m.name === selectedMember);
    if (!member) return null;

    const stats = { total: 0, jog: 0, mlt: 0, cv: 0, speed: 0, unclassified: 0 };
    const monthlyTrend = {}; // 'YYYY-MM' -> { total, jog, mlt, cv, speed, unclassified }
    const dailyRecords = [];

    member.records.forEach(r => {
      if (isDateInPeriod(r.date, period, todayIso)) {
        stats.total += r.total;
        stats.jog   += r.jog;
        stats.mlt   += r.mlt;
        stats.cv    += r.cv;
        stats.speed += r.speed;
        const detailSum = r.jog + r.mlt + r.cv + r.speed;
        stats.unclassified += Math.max(0, r.total - detailSum);
      }
      
      dailyRecords.push(r);

      if (r.date) {
        const monthKey = r.date.substring(0, 7); // 'YYYY-MM'
        if (!monthlyTrend[monthKey]) {
          monthlyTrend[monthKey] = { total: 0, jog: 0, mlt: 0, cv: 0, speed: 0, unclassified: 0 };
        }
        monthlyTrend[monthKey].total += r.total;
        monthlyTrend[monthKey].jog   += r.jog;
        monthlyTrend[monthKey].mlt   += r.mlt;
        monthlyTrend[monthKey].cv    += r.cv;
        monthlyTrend[monthKey].speed += r.speed;
        const detailSum = r.jog + r.mlt + r.cv + r.speed;
        monthlyTrend[monthKey].unclassified += Math.max(0, r.total - detailSum);
      }
    });

    const round = (val) => Math.round(val * 100) / 100;
    
    // 直近6ヶ月の推移を計算する
    const trendList = Object.keys(monthlyTrend)
      .sort()
      .slice(-6) // 過去6ヶ月に拡大
      .map(key => {
        const t = monthlyTrend[key];
        const m = key.split('-')[1];
        return {
          label: `${parseInt(m)}月`,
          total: round(t.total),
          jog:   round(t.jog),
          mlt:   round(t.mlt),
          cv:    round(t.cv),
          speed: round(t.speed),
          unclassified: round(t.unclassified),
        };
      });

    return {
      name: member.name,
      total: round(stats.total),
      jog:   round(stats.jog),
      mlt:   round(stats.mlt),
      cv:    round(stats.cv),
      speed: round(stats.speed),
      unclassified: round(stats.unclassified),
      trend: trendList,
      daily: dailyRecords.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)
    };
  }, [members, selectedMember, period, todayIso]);

  // 【新規】直近7日間の日次アクティビティデータ (月〜日の絶対走行距離)
  const weeklyDailyActivity = useMemo(() => {
    const member = members.find(m => m.name === selectedMember);
    if (!member) return [];

    const list = [];
    const weekdays = ['日','月','火','水','木','金','土'];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      
      const dayIndex = d.getDay();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const dayName = weekdays[dayIndex];
      const label = `${month}/${day}`;
      const shortDay = dayName;

      // 日付に一致する練習レコードを検索
      const record = member.records.find(r => r.date === iso);
      const round = (val) => val ? Math.round(val * 10) / 10 : 0;

      const recordTotal = record ? round(record.total) : 0;
      const recordJog = record ? round(record.jog) : 0;
      const recordMlt = record ? round(record.mlt) : 0;
      const recordCv = record ? round(record.cv) : 0;
      const recordSpeed = record ? round(record.speed) : 0;
      
      const rawUnclassified = record ? Math.max(0, record.total - (record.jog + record.mlt + record.cv + record.speed)) : 0;
      const recordUnclassified = round(rawUnclassified);
      
      list.push({
        date: iso,
        label,
        dayName: shortDay,
        total: recordTotal,
        jog: recordJog,
        mlt: recordMlt,
        cv: recordCv,
        speed: recordSpeed,
        unclassified: recordUnclassified,
      });
    }
    return list;
  }, [members, selectedMember]);

  // 日次グラフの物理限界 (0~20kmベースで、超えた場合は5km単位で動的に調整)
  const dailyScale = useMemo(() => {
    const targetKey = sortKey === 'total' ? 'total' : sortKey;
    const maxVal = weeklyDailyActivity.length > 0 ? Math.max(...weeklyDailyActivity.map(x => x[targetKey]), 5) : 5;
    let limit = 10;
    let ticks = [0, 5, 10];
    
    if (maxVal <= 10) {
      limit = 10;
      ticks = [0, 5, 10];
    } else if (maxVal <= 15) {
      limit = 15;
      ticks = [0, 5, 10, 15];
    } else if (maxVal <= 20) {
      limit = 20;
      ticks = [0, 10, 20];
    } else if (maxVal <= 30) {
      limit = 30;
      ticks = [0, 10, 20, 30];
    } else {
      limit = Math.ceil(maxVal / 10) * 10;
      ticks = [0, Math.round(limit / 2), limit];
    }
    return { limit, ticks };
  }, [weeklyDailyActivity, sortKey]);

  // 月別推移グラフの物理限界 (安定目盛り)
  const monthlyScale = useMemo(() => {
    if (!selectedMemberData || selectedMemberData.trend.length === 0) return { limit: 100, ticks: [0, 50, 100] };
    const targetKey = sortKey === 'total' ? 'total' : sortKey;
    const maxVal = Math.max(...selectedMemberData.trend.map(x => x[targetKey]), 50);
    
    let limit = 100;
    let ticks = [0, 50, 100];
    
    if (maxVal <= 50) {
      limit = 50;
      ticks = [0, 25, 50];
    } else if (maxVal <= 100) {
      limit = 100;
      ticks = [0, 50, 100];
    } else if (maxVal <= 150) {
      limit = 150;
      ticks = [0, 50, 100, 150];
    } else if (maxVal <= 200) {
      limit = 200;
      ticks = [0, 100, 200];
    } else if (maxVal <= 300) {
      limit = 300;
      ticks = [0, 100, 200, 300];
    } else {
      limit = Math.ceil(maxVal / 100) * 100;
      ticks = [0, Math.round(limit / 2), limit];
    }
    return { limit, ticks };
  }, [selectedMemberData, sortKey]);

  // ドーナツグラフ（SVG）用の計算 (ライトモード・ソフトシャドウ仕様 - 常に全強度の割合で円を100%埋める)
  const donutData = useMemo(() => {
    if (!selectedMemberData || selectedMemberData.total === 0) return [];
    
    const { total, jog, mlt, cv, speed, unclassified } = selectedMemberData;
    const allItems = [
      { key: 'jog',          val: jog,          color: INTENSITY_COLORS.jog.hex },
      { key: 'mlt',          val: mlt,          color: INTENSITY_COLORS.mlt.hex },
      { key: 'cv',           val: cv,           color: INTENSITY_COLORS.cv.hex },
      { key: 'speed',        val: speed,        color: INTENSITY_COLORS.speed.hex },
      { key: 'unclassified', val: unclassified, color: INTENSITY_COLORS.unclassified.hex },
    ];

    // sortKey にかかわらず、常に全強度の割合を表示
    const items = allItems.filter(item => item.val > 0);

    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    let accumulatedLength = 0;

    const displayTotal = total;

    return items.map(item => {
      const percentage = displayTotal > 0 ? (item.val / displayTotal) * 100 : 0;
      const strokeLength = displayTotal > 0 ? (item.val / displayTotal) * circumference : 0;
      const strokeOffset = -accumulatedLength;
      accumulatedLength += strokeLength;

      return {
        ...item,
        percentage: Math.round(percentage * 10) / 10,
        strokeDash: `${strokeLength} ${circumference}`,
        strokeOffset
      };
    });
  }, [selectedMemberData]);

  // ランキング詳細表示用のメンバーデータ
  const rankingDetailMemberData = useMemo(() => {
    if (!rankingDetailMember) return null;
    const member = members.find(m => m.name === rankingDetailMember);
    if (!member) return null;

    const stats = { total: 0, jog: 0, mlt: 0, cv: 0, speed: 0, unclassified: 0 };
    const monthlyTrend = {}; // 'YYYY-MM' -> { total, jog, mlt, cv, speed, unclassified }
    const dailyRecords = [];

    member.records.forEach(r => {
      if (isDateInPeriod(r.date, period, todayIso)) {
        stats.total += r.total;
        stats.jog   += r.jog;
        stats.mlt   += r.mlt;
        stats.cv    += r.cv;
        stats.speed += r.speed;
        const detailSum = r.jog + r.mlt + r.cv + r.speed;
        stats.unclassified += Math.max(0, r.total - detailSum);
      }
      
      dailyRecords.push(r);

      if (r.date) {
        const monthKey = r.date.substring(0, 7); // 'YYYY-MM'
        if (!monthlyTrend[monthKey]) {
          monthlyTrend[monthKey] = { total: 0, jog: 0, mlt: 0, cv: 0, speed: 0, unclassified: 0 };
        }
        monthlyTrend[monthKey].total += r.total;
        monthlyTrend[monthKey].jog   += r.jog;
        monthlyTrend[monthKey].mlt   += r.mlt;
        monthlyTrend[monthKey].cv    += r.cv;
        monthlyTrend[monthKey].speed += r.speed;
        const detailSum = r.jog + r.mlt + r.cv + r.speed;
        monthlyTrend[monthKey].unclassified += Math.max(0, r.total - detailSum);
      }
    });

    const round = (val) => Math.round(val * 100) / 100;
    
    const trendList = Object.keys(monthlyTrend)
      .sort()
      .slice(-6)
      .map(key => {
        const t = monthlyTrend[key];
        const m = key.split('-')[1];
        return {
          label: `${parseInt(m)}月`,
          total: round(t.total),
          jog:   round(t.jog),
          mlt:   round(t.mlt),
          cv:    round(t.cv),
          speed: round(t.speed),
          unclassified: round(t.unclassified),
        };
      });

    return {
      name: member.name,
      total: round(stats.total),
      jog:   round(stats.jog),
      mlt:   round(stats.mlt),
      cv:    round(stats.cv),
      speed: round(stats.speed),
      unclassified: round(stats.unclassified),
      trend: trendList,
      daily: dailyRecords.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)
    };
  }, [members, rankingDetailMember, period, todayIso]);

  // ランキング詳細表示用の週次日次アクティビティ
  const rankingDetailWeeklyDailyActivity = useMemo(() => {
    if (!rankingDetailMember) return [];
    const member = members.find(m => m.name === rankingDetailMember);
    if (!member) return [];

    const list = [];
    const weekdays = ['日','月','火','水','木','金','土'];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      
      const dayIndex = d.getDay();
      const month = d.getMonth() + 1;
      const day = d.getDate();
      const dayName = weekdays[dayIndex];
      const label = `${month}/${day}`;
      const shortDay = dayName;

      const record = member.records.find(r => r.date === iso);
      const round = (val) => val ? Math.round(val * 10) / 10 : 0;

      const recordTotal = record ? round(record.total) : 0;
      const recordJog = record ? round(record.jog) : 0;
      const recordMlt = record ? round(record.mlt) : 0;
      const recordCv = record ? round(record.cv) : 0;
      const recordSpeed = record ? round(record.speed) : 0;
      const rawUnclassified = record ? Math.max(0, record.total - (record.jog + record.mlt + record.cv + record.speed)) : 0;
      const recordUnclassified = round(rawUnclassified);
      
      list.push({
        date: iso,
        label,
        dayName: shortDay,
        total: recordTotal,
        jog: recordJog,
        mlt: recordMlt,
        cv: recordCv,
        speed: recordSpeed,
        unclassified: recordUnclassified,
      });
    }
    return list;
  }, [members, rankingDetailMember]);

  // ランキング詳細用の日次スケール（常に'total'＝普通の分析を使用）
  const rankingDetailDailyScale = useMemo(() => {
    const targetKey = 'total';
    const maxVal = rankingDetailWeeklyDailyActivity.length > 0 ? Math.max(...rankingDetailWeeklyDailyActivity.map(x => x[targetKey]), 5) : 5;
    let limit = 10;
    let ticks = [0, 5, 10];
    
    if (maxVal <= 10) {
      limit = 10;
      ticks = [0, 5, 10];
    } else if (maxVal <= 15) {
      limit = 15;
      ticks = [0, 5, 10, 15];
    } else if (maxVal <= 20) {
      limit = 20;
      ticks = [0, 10, 20];
    } else if (maxVal <= 30) {
      limit = 30;
      ticks = [0, 10, 20, 30];
    } else {
      limit = Math.ceil(maxVal / 10) * 10;
      ticks = [0, Math.round(limit / 2), limit];
    }
    return { limit, ticks };
  }, [rankingDetailWeeklyDailyActivity]);

  // ランキング詳細用の月次スケール（常に'total'＝普通の分析を使用）
  const rankingDetailMonthlyScale = useMemo(() => {
    if (!rankingDetailMemberData || rankingDetailMemberData.trend.length === 0) return { limit: 100, ticks: [0, 50, 100] };
    const targetKey = 'total';
    const maxVal = Math.max(...rankingDetailMemberData.trend.map(x => x[targetKey]), 50);
    
    let limit = 100;
    let ticks = [0, 50, 100];
    
    if (maxVal <= 50) {
      limit = 50;
      ticks = [0, 25, 50];
    } else if (maxVal <= 100) {
      limit = 100;
      ticks = [0, 50, 100];
    } else if (maxVal <= 150) {
      limit = 150;
      ticks = [0, 50, 100, 150];
    } else if (maxVal <= 200) {
      limit = 200;
      ticks = [0, 100, 200];
    } else if (maxVal <= 300) {
      limit = 300;
      ticks = [0, 100, 200, 300];
    } else {
      limit = Math.ceil(maxVal / 100) * 100;
      ticks = [0, Math.round(limit / 2), limit];
    }
    return { limit, ticks };
  }, [rankingDetailMemberData]);

  // ランキング詳細用のドーナツデータ（常に'total'＝普通の分析を使用）
  const rankingDetailDonutData = useMemo(() => {
    if (!rankingDetailMemberData || rankingDetailMemberData.total === 0) return [];
    
    const { total, jog, mlt, cv, speed, unclassified } = rankingDetailMemberData;
    const allItems = [
      { key: 'jog',          val: jog,          color: INTENSITY_COLORS.jog.hex },
      { key: 'mlt',          val: mlt,          color: INTENSITY_COLORS.mlt.hex },
      { key: 'cv',           val: cv,           color: INTENSITY_COLORS.cv.hex },
      { key: 'speed',        val: speed,        color: INTENSITY_COLORS.speed.hex },
      { key: 'unclassified', val: unclassified, color: INTENSITY_COLORS.unclassified.hex },
    ];

    const items = allItems.filter(item => item.val > 0);

    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    let accumulatedLength = 0;

    const displayTotal = total;

    return items.map(item => {
      const percentage = displayTotal > 0 ? (item.val / displayTotal) * 100 : 0;
      const strokeLength = displayTotal > 0 ? (item.val / displayTotal) * circumference : 0;
      const strokeOffset = -accumulatedLength;
      accumulatedLength += strokeLength;

      return {
        ...item,
        percentage: Math.round(percentage * 10) / 10,
        strokeDash: `${strokeLength} ${circumference}`,
        strokeOffset
      };
    });
  }, [rankingDetailMemberData]);

  // ローディングとエラーの表示
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-4 bg-white border border-slate-100 rounded-3xl mx-3 my-8 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
        <div className="relative w-10 h-10">
          <div className="absolute inset-0 border-3 border-slate-100 rounded-full" />
          <div className="absolute inset-0 border-3 border-t-blue-500 rounded-full animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-extrabold text-sm text-slate-800">走行データ同期中</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center bg-white border border-red-100 rounded-3xl mx-3 my-8 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
        <AlertCircle size={32} className="text-red-500 mb-2 animate-bounce" />
        <p className="font-extrabold text-sm text-slate-800">同期に失敗しました</p>
        <p className="text-[10px] text-slate-400 mt-1">{error}</p>
        <button 
          onClick={() => fetchAndParseData(true)}
          className="mt-4 px-4 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-xs font-black text-blue-600 active:scale-95 transition-all shadow-sm"
        >
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in pb-8">
      {/* 🏆 Tab 2: ランキング表示 */}
      {showSection === 'ranking' && !rankingDetailMember && (
        <div className="space-y-4">
          
          {/* 👑 表彰台 (Podium Graphics) */}
          {podiumLayout.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-3.5">
              <div className="flex items-center gap-1">
                <Trophy size={14} className="text-amber-500" />
                <span className="text-[10px] text-slate-400 font-black tracking-wider uppercase">表彰台 (今月のTOP3)</span>
              </div>
              
              <div className="flex items-end justify-center gap-3 pt-8 px-1">
                {podiumLayout.map(({ member, rank }) => {
                  const is1st = rank === 1;
                  const is2nd = rank === 2;
                  const nameOnly = getOnlyName(member.name);
                  
                  // 各ランクに応じた装飾
                  const cardBg = is1st 
                    ? 'bg-gradient-to-t from-amber-50 to-amber-100/30 border-amber-200' 
                    : is2nd 
                      ? 'bg-gradient-to-t from-slate-50 to-slate-100/30 border-slate-200' 
                      : 'bg-gradient-to-t from-orange-50 to-orange-100/30 border-orange-100';

                  const badgeBg = is1st 
                    ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/20' 
                    : is2nd 
                      ? 'bg-slate-400 text-white' 
                      : 'bg-orange-400 text-white';

                  const heightClass = is1st ? 'h-[125px]' : is2nd ? 'h-[100px]' : 'h-[90px]';
                  const shadowClass = is1st ? 'shadow-[0_8px_24px_rgba(245,158,11,0.08)]' : 'shadow-sm';

                  return (
                    <div key={member.name} className="flex-1 relative">
                      {/* 王冠やメダルアイコン (台座の上に絶対配置) */}
                      <div className={`absolute -top-7 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black z-20 ${badgeBg}`}>
                        {rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}
                      </div>
                      
                      {/* 台座 (クリックでランキング内詳細表示) */}
                      <button 
                        onClick={() => {
                          setRankingDetailMember(member.name);
                        }}
                        className={`w-full ${heightClass} ${cardBg} border rounded-2xl flex flex-col justify-between p-2.5 text-center cursor-pointer transition-all active:scale-95 ${shadowClass} hover:opacity-90 relative z-10`}
                      >
                        <div className="min-w-0 w-full">
                          <span className="text-[8px] font-black text-slate-400 block leading-none mb-0.5">{getGradeFromName(member.name)}</span>
                          <span className={`text-[11px] font-black text-slate-800 block truncate ${is1st ? 'text-amber-800' : ''}`}>{nameOnly}</span>
                        </div>
                        
                        <div className="w-full">
                          <span className={`text-[14px] font-black tracking-tight inline-block ${is1st ? 'text-amber-600 text-[16px]' : 'text-slate-700'}`}>
                            {member[sortKey]}
                            <span className="text-[8px] font-bold text-slate-400 ml-0.5">km</span>
                          </span>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 🏆 ランキングカード */}
          <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500">
                  <Trophy size={13} />
                </div>
                <h3 className="text-sm font-black text-slate-800">走行距離ランキング</h3>
              </div>
              
              <div className="flex items-center gap-1.5">
                {/* 期間選択ドロップダウン (上品なライト仕様) */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveDropdown(activeDropdown === 'period' ? null : 'period');
                    }}
                    className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-[10px] font-black text-slate-600 hover:bg-slate-100 hover:text-slate-800 transition-all shadow-sm"
                  >
                    <span>{PERIODS[period]}</span>
                    <ChevronDown size={11} className={`text-slate-400 transition-transform ${activeDropdown === 'period' ? 'rotate-180' : ''}`} />
                  </button>
                
                {activeDropdown === 'period' && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setActiveDropdown(null)} />
                    <div className="absolute top-[calc(100%+4px)] right-0 w-36 bg-white border border-slate-100 rounded-2xl shadow-xl py-1.5 z-25 animate-fade-in">
                      {Object.entries(PERIODS).map(([k, v]) => (
                        <button
                          key={k}
                          onClick={() => {
                            setPeriod(k);
                            setActiveDropdown(null);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors ${
                            period === k ? 'bg-blue-50 text-blue-600 font-extrabold' : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

            {/* ソートボタン（タブ） */}
            <div className="flex bg-slate-50 p-0.5 rounded-xl text-[9px] font-black gap-0.5 overflow-x-auto whitespace-nowrap scrollbar-none border border-slate-100">
              {[
                { key: 'total', label: '総距離' },
                { key: 'jog', label: 'jog' },
                { key: 'mlt', label: 'M~LT' },
                { key: 'cv', label: 'CV' },
                { key: 'speed', label: 'スピード' },
              ].map(item => (
                <button
                  key={item.key}
                  onClick={() => setSortKey(item.key)}
                  className={`flex-1 py-2 px-3 rounded-lg transition-all ${
                    sortKey === item.key ? 'bg-white text-blue-600 shadow-sm border border-slate-100 font-black' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* 学年別フィルターチップス（横スクロール） */}
            <div className="flex gap-1.5 overflow-x-auto whitespace-nowrap py-1 scrollbar-none border-b border-slate-50">
              <button
                onClick={() => {
                  setRankingGrade('');
                  setShowAllRanking(false);
                }}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black border transition-all active:scale-95 ${
                  rankingGrade === ''
                    ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm font-black'
                    : 'bg-slate-50/60 border-slate-100/80 text-slate-500 hover:bg-slate-100'
                }`}
              >
                すべて
              </button>
              {gradeList.map(g => (
                <button
                  key={g}
                  onClick={() => {
                    setRankingGrade(g);
                    setShowAllRanking(false);
                  }}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black border transition-all active:scale-95 ${
                    rankingGrade === g
                      ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm font-black'
                      : 'bg-slate-50/60 border-slate-100/80 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>

             {/* スムーズスクロール誘導先アンカー */}
            <div id="ranking-list-top" />

            {/* ランキングリスト (絶対物理スケール・ブレない基準表示) */}
            {rankingData.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs font-bold bg-slate-50/50 rounded-2xl border border-dashed border-slate-100">
                選択した期間のデータはありません
              </div>
            ) : (
              <div className="space-y-2 relative pb-2">
                {/* 背景絶対グリッド線 */}
                <div className="absolute inset-0 pl-[38px] pr-2 pointer-events-none flex justify-between z-0">
                  {rankingScale.ticks.map((tick, idx) => (
                    <div key={idx} className="h-full border-r border-dashed border-slate-100 relative">
                      {/* 目盛り値の表示 */}
                    </div>
                  ))}
                </div>

                {/* リストの上部にグリッドの目盛りラベルを表示 */}
                <div className="flex justify-between pl-[38px] pr-2 text-[8px] font-extrabold text-slate-400 uppercase tracking-widest pb-1 border-b border-slate-50">
                  {rankingScale.ticks.map((tick, idx) => (
                    <span key={idx} className="text-center w-6 shrink-0 block">{tick}</span>
                  ))}
                </div>

                {displayedRanking.map((item, index) => {
                  const isTop3 = index < 3;
                  const totalVal = item[sortKey];
                  const barPercent = Math.max(0, Math.min(100, (totalVal / rankingScale.limit) * 100));

                  const badgeBg = isTop3 
                    ? (index === 0 
                        ? 'bg-amber-100 border-amber-200 text-amber-800 font-black' 
                        : index === 1 
                          ? 'bg-slate-100 border-slate-200 text-slate-700 font-black' 
                          : 'bg-orange-100 border-orange-200 text-orange-800 font-black')
                    : 'bg-slate-50 border-slate-100 text-slate-400 font-bold';
                  const badgeIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}`;

                  // 強度の構成割合
                  const detailSum = item.jog + item.mlt + item.cv + item.speed;
                  const rawUnclassified = Math.max(0, item.total - detailSum);
                  const jogPercent = Math.max(0, Math.min(100, (item.jog / item.total) * 100));
                  const mltPercent = Math.max(0, Math.min(100, (item.mlt / item.total) * 100));
                  const cvPercent = Math.max(0, Math.min(100, (item.cv / item.total) * 100));
                  const speedPercent = Math.max(0, Math.min(100, (item.speed / item.total) * 100));
                  const unclassifiedPercent = Math.max(0, Math.min(100, (rawUnclassified / item.total) * 100));

                  return (
                    <button 
                      key={item.name} 
                      id={`ranking-item-${item.name}`}
                      onClick={() => {
                        setRankingDetailMember(item.name);
                      }}
                      className="w-full flex items-center gap-2.5 p-2 bg-slate-50/30 border border-slate-100/50 rounded-2xl shadow-inner relative z-10 text-left cursor-pointer hover:bg-blue-50/20 active:scale-[0.99] transition-all"
                    >
                      {/* 順位バッジ */}
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs border ${badgeBg}`}>
                        {badgeIcon}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1 gap-2">
                          <h4 className="text-xs font-black text-slate-800 truncate flex-1 min-w-0">
                            {formatMemberName(item.name)}
                          </h4>
                          <p className="text-xs font-black text-blue-600 shrink-0 whitespace-nowrap ml-auto">
                            {totalVal}<span className="text-[8px] text-slate-400 font-bold ml-0.5">km</span>
                            {sortKey !== 'total' && (
                              <span className="text-[8px] text-slate-400 font-bold ml-1">({item.total}km)</span>
                            )}
                          </p>
                        </div>
                        
                        {/* 絶対プログレスバー (グリッド上限に比例した物理幅) */}
                        <div className="w-full bg-slate-100/80 h-2 rounded-[3px] overflow-hidden flex border border-slate-200/20 shadow-inner">
                          {sortKey === 'total' ? (
                            <div style={{ width: `${barPercent}%` }} className="flex h-full rounded-[3px] overflow-hidden">
                              {jogPercent > 0 && <div style={{ width: `${jogPercent}%`, backgroundColor: INTENSITY_COLORS.jog.hex }} />}
                              {mltPercent > 0 && <div style={{ width: `${mltPercent}%`, backgroundColor: INTENSITY_COLORS.mlt.hex }} />}
                              {cvPercent > 0  && <div style={{ width: `${cvPercent}%`,  backgroundColor: INTENSITY_COLORS.cv.hex }} />}
                              {speedPercent > 0 && <div style={{ width: `${speedPercent}%`, backgroundColor: INTENSITY_COLORS.speed.hex }} />}
                              {unclassifiedPercent > 0 && <div style={{ width: `${unclassifiedPercent}%`, backgroundColor: INTENSITY_COLORS.unclassified.hex }} />}
                            </div>
                          ) : (
                            <div style={{ width: `${barPercent}%`, backgroundColor: INTENSITY_COLORS[sortKey].hex }} className="h-full rounded-[3px]" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* 10位以下を隠す時のフェードマスク */}
                {!showAllRanking && rankingData.length > 10 && (
                  <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none z-10" />
                )}
              </div>
            )}

            {/* もっと見る・閉じる ボタン */}
            {rankingData.length > 10 && (
              <div className="pt-2 flex justify-center z-20 relative">
                <button
                  type="button"
                  onClick={() => {
                    if (showAllRanking) {
                      setShowAllRanking(false);
                      document.getElementById('ranking-list-top')?.scrollIntoView({ behavior: 'smooth' });
                    } else {
                      setShowAllRanking(true);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-1 bg-slate-50 hover:bg-slate-100 border border-slate-100 text-slate-600 px-4 py-2.5 rounded-2xl text-xs font-black shadow-sm active:scale-95 transition-all"
                >
                  <span>{showAllRanking ? 'ランキングを閉じる' : `もっと見る (他 ${rankingData.length - 10} 名を表示)`}</span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${showAllRanking ? 'rotate-180' : ''}`} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🏆 Tab 2-2: ランキング内詳細表示 */}
      {showSection === 'ranking' && rankingDetailMember && (
        <div className="space-y-4">
          
          {/* ← ランキングに戻るボタン */}
          <div className="bg-white border border-slate-100 rounded-3xl p-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.015)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRankingDetailMember('')}
                className="flex items-center justify-center w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 text-blue-500 hover:text-blue-700 active:scale-95 transition-all shadow-sm shrink-0"
              >
                <ChevronRight size={18} className="rotate-180" />
              </button>
              <div>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block leading-none">MEMBER DETAIL</span>
                <span className="text-base font-black text-slate-800 block mt-0.5 leading-none">{rankingDetailMember ? formatMemberName(rankingDetailMember) : ''}</span>
              </div>
            </div>
            
            <button
              onClick={() => setRankingDetailMember('')}
              className="flex items-center gap-1 bg-slate-50 border border-slate-100 text-slate-600 px-3.5 py-2.5 rounded-2xl text-xs font-black shadow-sm active:scale-95 transition-all"
            >
              <span>ランキングに戻る</span>
            </button>
          </div>

          {!rankingDetailMemberData ? (
            <div className="text-center py-12 text-slate-400 font-bold text-xs border border-dashed border-slate-100 rounded-3xl bg-white shadow-sm">
              メンバーデータがありません
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* ① 合計距離 & ドーナツグラフ */}
              <div className="bg-white border border-slate-100 rounded-3xl p-4 flex items-center justify-between gap-3 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 text-slate-400 mb-1">
                    <Activity size={12} className="text-blue-500" />
                    <span className="text-[9px] font-black uppercase tracking-wider">
                      期間内合計走行距離
                    </span>
                  </div>
                  <p className="text-3xl font-black text-slate-800 leading-none">
                    {rankingDetailMemberData.total}
                    <span className="text-sm text-slate-400 font-bold ml-1">km</span>
                  </p>
                  
                  {/* 強度凡例リスト */}
                  <div className="mt-4 space-y-1.5">
                    {Object.entries(INTENSITY_COLORS).map(([key, item]) => {
                      const val = rankingDetailMemberData[key] || 0;
                      if (val <= 0) return null;
                      const percent = rankingDetailMemberData.total > 0 
                        ? Math.round((val / rankingDetailMemberData.total) * 100) 
                        : 0;
                      return (
                        <div key={key} className="flex items-center gap-1.5 text-[10px] font-bold">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.hex }} />
                          <span className="text-slate-500 block truncate max-w-[80px]">{item.name.split(' (')[0]}</span>
                          <span className="font-black text-slate-800 ml-auto">{val}km <span className="text-[8px] text-slate-400 font-medium ml-0.5">({percent}%)</span></span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* SVG ドーナツグラフ */}
                <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="12" />
                    {rankingDetailMemberData.total > 0 ? (
                      rankingDetailDonutData.map((item, idx) => (
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
                          strokeLinecap="butt"
                          className="transition-all duration-500"
                        />
                      ))
                    ) : (
                      <circle cx="60" cy="60" r="50" fill="none" stroke="#e2e8f0" strokeWidth="12" strokeDasharray="4 4" />
                    )}
                  </svg>
                  
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-[7px] text-slate-400 font-black leading-none uppercase tracking-widest">
                      TOTAL
                    </span>
                    <span className="text-base font-black text-slate-800 mt-1 leading-none">
                      {Math.round(rankingDetailMemberData.total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 期間内データ0のインラインアラート */}
              {rankingDetailMemberData.total === 0 && (
                <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 text-amber-800 rounded-2xl text-[10px] font-bold leading-relaxed shadow-sm">
                  <AlertCircle size={14} className="shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    選択中の期間（{PERIODS[period]}）に練習データがありません。
                  </div>
                </div>
              )}

              {/* ② 直近7日間の日次アクティビティグラフ */}
              <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    直近7日間の日次走行距離 (総距離)
                  </h4>
                </div>
                
                <div className="h-36 w-full relative flex items-end justify-between px-1 pt-5 pb-1">
                  <div className="absolute inset-x-0 bottom-6 h-px bg-slate-100 z-0" />
                  {rankingDetailDailyScale.ticks.map((tick, idx) => {
                    const bottomPercent = 24 + ((tick / rankingDetailDailyScale.limit) * 80);
                    return (
                      <div key={idx} className="absolute inset-x-0 border-t border-dashed border-slate-100/80 z-0" style={{ bottom: `${bottomPercent}px` }}>
                        <span className="absolute -top-1.5 left-0 text-[7px] font-black text-slate-400 bg-white pr-1 leading-none">{tick}</span>
                      </div>
                    );
                  })}
                  
                  <div className="w-full flex justify-between z-10 pl-6 h-full items-end gap-1.5">
                    {rankingDetailWeeklyDailyActivity.map((day, idx) => {
                      const targetVal = day.total;
                      const barHeight = Math.max(2, (targetVal / rankingDetailDailyScale.limit) * 80);
                      
                      const jogHeight         = day.total > 0 ? (day.jog / day.total) * 100 : 0;
                      const mltHeight         = day.total > 0 ? (day.mlt / day.total) * 100 : 0;
                      const cvHeight          = day.total > 0 ? (day.cv / day.total) * 100 : 0;
                      const speedHeight       = day.total > 0 ? (day.speed / day.total) * 100 : 0;
                      const unclassifiedHeight = day.total > 0 ? (day.unclassified / day.total) * 100 : 0;
                      const isActive = activeDailyIdx === idx;

                      return (
                        <button 
                          key={idx} 
                          onClick={() => setActiveDailyIdx(isActive ? null : idx)}
                          className="flex flex-col items-center flex-1 h-full justify-end relative focus:outline-none animate-fade-in"
                        >
                          {targetVal > 0 && (
                            <span className={`text-[8px] font-black mb-0.5 block leading-none transition-colors ${isActive ? 'text-blue-600 scale-110' : 'text-slate-700'}`}>{targetVal}</span>
                          )}
                          
                          {targetVal > 0 ? (
                            <div 
                              className={`w-4.5 rounded-t-[3px] overflow-hidden flex flex-col justify-end bg-slate-50 border shadow-sm transition-all duration-200 ${
                                isActive ? 'ring-2 ring-blue-500/50 scale-105 border-blue-400' : 'border-slate-100'
                              }`} 
                              style={{ height: `${barHeight}px` }}
                            >
                              <>
                                {unclassifiedHeight > 0 && <div style={{ height: `${unclassifiedHeight}%`, backgroundColor: INTENSITY_COLORS.unclassified.hex }} />}
                                {speedHeight > 0 && <div style={{ height: `${speedHeight}%`, backgroundColor: INTENSITY_COLORS.speed.hex }} />}
                                {cvHeight > 0    && <div style={{ height: `${cvHeight}%`,    backgroundColor: INTENSITY_COLORS.cv.hex }} />}
                                {mltHeight > 0   && <div style={{ height: `${mltHeight}%`,   backgroundColor: INTENSITY_COLORS.mlt.hex }} />}
                                {jogHeight > 0   && <div style={{ height: `${jogHeight}%`,   backgroundColor: INTENSITY_COLORS.jog.hex }} />}
                              </>
                            </div>
                          ) : (
                            <div className="w-4.5 h-1 bg-slate-100 rounded-t-[3px] border border-slate-200" />
                          )}
                          
                          <div className="h-6 flex flex-col justify-end items-center mt-1">
                            <span className={`text-[8px] font-black block leading-none transition-colors ${isActive ? 'text-blue-600 font-extrabold' : 'text-slate-500'}`}>{day.label.split('/')[1]}</span>
                            <span className={`text-[7px] font-extrabold block leading-none mt-0.5 transition-colors ${
                              isActive ? 'text-blue-600 font-extrabold' : (day.dayName === '日' ? 'text-red-500' : day.dayName === '土' ? 'text-blue-500' : 'text-slate-400')
                            }`}>{day.dayName}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {activeDailyIdx !== null && (
                  <div className="mt-3 p-3 rounded-2xl bg-blue-50/40 border border-blue-100/50 animate-fade-in">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-black text-blue-800">
                        📅 {rankingDetailWeeklyDailyActivity[activeDailyIdx].label} ({rankingDetailWeeklyDailyActivity[activeDailyIdx].dayName}) の走行内訳
                      </span>
                      <span className="text-xs font-black text-blue-700">
                        合計 {rankingDetailWeeklyDailyActivity[activeDailyIdx].total} km
                      </span>
                    </div>
                    {rankingDetailWeeklyDailyActivity[activeDailyIdx].total > 0 ? (
                      <div className="flex flex-wrap gap-1.5 text-[9px] font-bold justify-start">
                        {Object.entries(INTENSITY_COLORS).map(([key, item]) => {
                          const val = rankingDetailWeeklyDailyActivity[activeDailyIdx][key] || 0;
                          if (val <= 0) return null;
                          return (
                            <div key={key} className="bg-white rounded-lg p-1.5 border border-slate-100 text-center min-w-[50px] flex-1">
                              <span className="block text-slate-400">{item.name.split(' (')[0]}</span>
                              <span className="block font-black mt-0.5" style={{ color: item.hex }}>{val}km</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[9px] font-bold text-slate-400 text-center py-1">この日の走行記録はありません</p>
                    )}
                  </div>
                )}
              </div>

              {/* ③ 月別走行推移 */}
              {rankingDetailMemberData.trend.length > 0 && (
                <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                      月別走行推移 (過去6ヶ月, 総距離)
                    </h4>
                  </div>
                  
                  <div className="h-36 w-full relative flex items-end justify-between px-1 pt-5 pb-1">
                    <div className="absolute inset-x-0 bottom-6 h-px bg-slate-100 z-0" />
                    {rankingDetailMonthlyScale.ticks.map((tick, idx) => {
                      const bottomPercent = 24 + ((tick / rankingDetailMonthlyScale.limit) * 80);
                      return (
                        <div key={idx} className="absolute inset-x-0 border-t border-dashed border-slate-100/80 z-0" style={{ bottom: `${bottomPercent}px` }}>
                          <span className="absolute -top-1.5 left-0 text-[7px] font-black text-slate-400 bg-white pr-1 leading-none">{tick}</span>
                        </div>
                      );
                    })}
                    
                    <div className="w-full flex justify-between z-10 pl-6 h-full items-end gap-2">
                      {rankingDetailMemberData.trend.map((t, idx) => {
                        const targetVal = t.total;
                        const barHeight = Math.max(2, (targetVal / rankingDetailMonthlyScale.limit) * 80);
                        
                        const jogHeight         = (t.jog / t.total) * 100;
                        const mltHeight         = (t.mlt / t.total) * 100;
                        const cvHeight          = (t.cv / t.total) * 100;
                        const speedHeight       = (t.speed / t.total) * 100;
                        const unclassifiedHeight = (t.unclassified / t.total) * 100;
                        const isActive = activeMonthIdx === idx;

                        return (
                          <button 
                            key={idx} 
                            onClick={() => setActiveMonthIdx(isActive ? null : idx)}
                            className="flex flex-col items-center flex-1 h-full justify-end relative focus:outline-none animate-fade-in"
                          >
                            {targetVal > 0 && (
                              <span className={`text-[8px] font-black mb-0.5 block leading-none transition-colors ${isActive ? 'text-blue-600 scale-110' : 'text-slate-700'}`}>{targetVal}</span>
                            )}
                            
                            <div 
                              className={`w-5 rounded-t-[3px] overflow-hidden flex flex-col justify-end bg-slate-50 border shadow-sm transition-all duration-200 ${
                                isActive ? 'ring-2 ring-blue-500/50 scale-105 border-blue-400' : 'border-slate-100'
                              }`} 
                              style={{ height: `${barHeight}px` }}
                            >
                              {targetVal > 0 ? (
                                <>
                                  {unclassifiedHeight > 0 && <div style={{ height: `${unclassifiedHeight}%`, backgroundColor: INTENSITY_COLORS.unclassified.hex }} />}
                                  {speedHeight > 0 && <div style={{ height: `${speedHeight}%`, backgroundColor: INTENSITY_COLORS.speed.hex }} />}
                                  {cvHeight > 0    && <div style={{ height: `${cvHeight}%`,    backgroundColor: INTENSITY_COLORS.cv.hex }} />}
                                  {mltHeight > 0   && <div style={{ height: `${mltHeight}%`,   backgroundColor: INTENSITY_COLORS.mlt.hex }} />}
                                  {jogHeight > 0   && <div style={{ height: `${jogHeight}%`,   backgroundColor: INTENSITY_COLORS.jog.hex }} />}
                                </>
                              ) : (
                                <div className="w-full h-full bg-slate-100/40" />
                              )}
                            </div>
                            
                            <div className="h-6 flex items-center justify-center mt-1">
                              <span className={`text-[9px] font-black block leading-none transition-colors ${isActive ? 'text-blue-600 font-extrabold' : 'text-slate-500'}`}>{t.label}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {activeMonthIdx !== null && (
                    <div className="mt-3 p-3 rounded-2xl bg-blue-50/40 border border-blue-100/50 animate-fade-in">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-blue-800">
                          📅 {rankingDetailMemberData.trend[activeMonthIdx].label} の走行内訳
                        </span>
                        <span className="text-xs font-black text-blue-700">
                          合計 {rankingDetailMemberData.trend[activeMonthIdx].total} km
                        </span>
                      </div>
                      {rankingDetailMemberData.trend[activeMonthIdx].total > 0 ? (
                        <div className="flex flex-wrap gap-1.5 text-[9px] font-bold justify-start">
                          {Object.entries(INTENSITY_COLORS).map(([key, item]) => {
                            const val = rankingDetailMemberData.trend[activeMonthIdx][key] || 0;
                            if (val <= 0) return null;
                            return (
                              <div key={key} className="bg-white rounded-lg p-1.5 border border-slate-100 text-center min-w-[50px] flex-1">
                                <span className="block text-slate-400">{item.name.split(' (')[0]}</span>
                                <span className="block font-black mt-0.5" style={{ color: item.hex }}>{val}km</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[9px] font-bold text-slate-400 text-center py-1">この月の走行記録はありません</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ④ 練習履歴タイムライン */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1 block">練習活動タイムライン</h4>
                
                <div className="relative pl-3.5 border-l border-slate-200 space-y-3.5 ml-2.5">
                  {rankingDetailMemberData.daily.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs font-bold border border-dashed border-slate-100 rounded-2xl bg-white shadow-sm">
                      活動タイムラインの記録がありません
                    </div>
                  ) : (
                    rankingDetailMemberData.daily.map((rec, i) => {
                      const recUnclassified = Math.max(0, rec.total - (rec.jog + rec.mlt + rec.cv + rec.speed));
                      const hasMetrics = rec.jog > 0 || rec.mlt > 0 || rec.cv > 0 || rec.speed > 0 || recUnclassified > 0;
                      const dateText = rec.date ? rec.date.substring(5).replace('-', '/') : '日付不明';
                      
                      return (
                        <div key={i} className="relative group animate-fade-in" style={{ animationDelay: `${i * 0.04}s` }}>
                          <div className="absolute -left-[20.5px] top-2 w-2.5 h-2.5 rounded-full bg-white border-2 border-blue-500 shadow-sm group-hover:scale-125 transition-transform" />
                          
                          <div className="bg-white border border-slate-100 rounded-3xl p-3.5 space-y-2.5 relative shadow-[0_2px_12px_rgba(0,0,0,0.01)] hover:border-slate-200/60 transition-all">
                            <div className="absolute -left-[5px] top-3 w-2 h-2 bg-white border-l border-b border-slate-100 transform rotate-45" />
                            
                            <div className="flex justify-between items-center text-[10px] font-black text-slate-400 relative z-10">
                              <span>{dateText} の練習記録</span>
                              <span className="text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider shadow-sm">
                                {rec.total} km
                              </span>
                            </div>
                            
                            {hasMetrics && (
                              <div className="h-1 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200/10 shadow-inner">
                                <>
                                  {rec.jog > 0 && <div style={{ width: `${(rec.jog/rec.total)*100}%`, backgroundColor: INTENSITY_COLORS.jog.hex }} />}
                                  {rec.mlt > 0 && <div style={{ width: `${(rec.mlt/rec.total)*100}%`, backgroundColor: INTENSITY_COLORS.mlt.hex }} />}
                                  {rec.cv > 0  && <div style={{ width: `${(rec.cv/rec.total)*100}%`,  backgroundColor: INTENSITY_COLORS.cv.hex }} />}
                                  {rec.speed > 0 && <div style={{ width: `${(rec.speed/rec.total)*100}%`, backgroundColor: INTENSITY_COLORS.speed.hex }} />}
                                  {recUnclassified > 0 && <div style={{ width: `${(recUnclassified/rec.total)*100}%`, backgroundColor: INTENSITY_COLORS.unclassified.hex }} />}
                                </>
                              </div>
                            )}

                            <div className="space-y-1 relative z-10 text-xs">
                              {rec.menu && (
                                <p className="text-slate-700 font-extrabold leading-snug">
                                  <span className="text-[9px] text-slate-400 font-black mr-1 uppercase">メニュー:</span>
                                  {rec.menu}
                                </p>
                              )}
                              {rec.comment && (
                                <p className="text-slate-500 leading-relaxed font-bold bg-slate-50/50 p-2.5 rounded-2xl border border-slate-100/50 mt-1.5 italic">
                                  &ldquo;{rec.comment}&rdquo;
                                </p>
                              )}
                            </div>
                          </div>
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

      {/* 📊 Tab 3: 個人詳細分析 */}
      {showSection === 'analytics' && (
        <div className="space-y-4">
          
          {/* iOS風メンバー選択トリガーの粘着コンテナ (ヘッダーとの美しい隙間を保ちつつ、スクロールコンテンツを下に綺麗に潜り込ませる) */}
          <div className="sticky top-[calc(env(safe-area-inset-top,0px)+52px)] z-20 bg-[#f8fafc] pt-2.5 pb-1">
            <div className="bg-white border border-slate-100 rounded-3xl p-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.015)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500 font-black">
                  <User size={18} />
                </div>
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block leading-none">ANALYTICS TARGET</span>
                  <span className="text-base font-black text-slate-800 block mt-0.5 leading-none">{selectedMember ? formatMemberName(selectedMember) : '部員を選択'}</span>
                </div>
              </div>
              
              <button
                onClick={() => setShowMemberSheet(true)}
                className="flex items-center gap-1 bg-blue-50 border border-blue-100 text-blue-600 px-3.5 py-2.5 rounded-2xl text-xs font-black shadow-sm active:scale-95 transition-all"
              >
                <span>部員を切り替え</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>

          {!selectedMemberData ? (
            <div className="text-center py-12 text-slate-400 font-bold text-xs border border-dashed border-slate-100 rounded-3xl bg-white shadow-sm">
              メンバーデータがありません
            </div>
          ) : (
            <div className="space-y-4">
              
              {/* ① 合計距離 & ドーナツグラフ (ライト・プレミアム) */}
              <div className="bg-white border border-slate-100 rounded-3xl p-4 flex items-center justify-between gap-3 shadow-[0_8px_30px_rgba(0,0,0,0.015)]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 text-slate-400 mb-1">
                    <Activity size={12} className="text-blue-500" />
                    <span className="text-[9px] font-black uppercase tracking-wider">
                      {sortKey === 'total' ? '期間内合計走行距離' : `期間内合計 ${INTENSITY_COLORS[sortKey].name.split(' (')[0]} 走行距離`}
                    </span>
                  </div>
                  <p className="text-3xl font-black text-slate-800 leading-none">
                    {sortKey === 'total' ? selectedMemberData.total : selectedMemberData[sortKey]}
                    <span className="text-sm text-slate-400 font-bold ml-1">km</span>
                  </p>
                  
                  {/* 強度凡例リスト (高さを完全に固定するため常に全5項目を表示し、選択中の項目以外は透過度を下げてフォーカスを表現) */}
                  <div className="mt-4 space-y-1.5 min-h-[92px] flex flex-col justify-between">
                    {Object.entries(INTENSITY_COLORS).map(([key, item]) => {
                      const val = selectedMemberData[key] || 0;
                      const percent = selectedMemberData.total > 0 
                        ? Math.round((val / selectedMemberData.total) * 100) 
                        : 0;
                      
                      // 選択状態の判定: 
                      // 1. sortKey が 'total' の場合は、その項目の値が 0 より大きければハイライト、0 なら薄く表示
                      // 2. sortKey が特定の強度の場合は、その強度だけをハイライトし、それ以外は薄く表示
                      const isHighlighted = sortKey === 'total' 
                        ? val > 0 
                        : sortKey === key;
                      
                      return (
                        <div 
                          key={key} 
                          className={`flex items-center gap-1.5 text-[10px] font-bold transition-all duration-200 ${
                            isHighlighted ? 'opacity-100 scale-100' : 'opacity-35 scale-[0.98]'
                          }`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.hex }} />
                          <span className="text-slate-500 block truncate max-w-[80px]">{item.name.split(' (')[0]}</span>
                          <span className="font-black text-slate-800 ml-auto">{val}km <span className="text-[8px] text-slate-400 font-medium ml-0.5">({percent}%)</span></span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                {/* SVG ドーナツグラフ */}
                <div className="relative w-24 h-24 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="12" />
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
                          strokeLinecap="butt"
                          className="transition-all duration-500"
                        />
                      ))
                    ) : (
                      <circle cx="60" cy="60" r="50" fill="none" stroke="#e2e8f0" strokeWidth="12" strokeDasharray="4 4" />
                    )}
                  </svg>
                  
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-[7px] text-slate-400 font-black leading-none uppercase tracking-widest">
                      {sortKey === 'total' ? 'TOTAL' : sortKey.toUpperCase()}
                    </span>
                    <span className="text-base font-black text-slate-800 mt-1 leading-none">
                      {Math.round(sortKey === 'total' ? selectedMemberData.total : (selectedMemberData[sortKey] || 0))}
                    </span>
                  </div>
                </div>
              </div>

              {/* 期間内データ0のインラインアラート */}
              {selectedMemberData.total === 0 && (
                <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 text-amber-800 rounded-2xl text-[10px] font-bold leading-relaxed shadow-sm">
                  <AlertCircle size={14} className="shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    選択中の期間（{PERIODS[period]}）に練習データがありません。画面上部の期間設定で<strong>「累計」</strong>を選ぶと、すべての活動履歴が表示されます。
                  </div>
                </div>
              )}

              {/* ② 【新規】直近7日間の日次アクティビティグラフ (曜日別絶対スケール表示) */}
              <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                    直近7日間の日次走行距離 ({sortKey === 'total' ? '総距離' : INTENSITY_COLORS[sortKey].name.split(' (')[0]})
                  </h4>
                </div>
                
                <div className="h-36 w-full relative flex items-end justify-between px-1 pt-5 pb-1">
                  {/* 横軸グリッド線 & Y軸目盛り */}
                  <div className="absolute inset-x-0 bottom-6 h-px bg-slate-100 z-0" />
                  {dailyScale.ticks.map((tick, idx) => {
                    const bottomPercent = 24 + ((tick / dailyScale.limit) * 80); // Y軸目盛りの配置
                    return (
                      <div key={idx} className="absolute inset-x-0 border-t border-dashed border-slate-100/80 z-0" style={{ bottom: `${bottomPercent}px` }}>
                        <span className="absolute -top-1.5 left-0 text-[7px] font-black text-slate-400 bg-white pr-1 leading-none">{tick}</span>
                      </div>
                    );
                  })}
                  
                  {/* 棒グラフ項目 */}
                  <div className="w-full flex justify-between z-10 pl-6 h-full items-end gap-1.5">
                    {weeklyDailyActivity.map((day, idx) => {
                      const targetVal = sortKey === 'total' ? day.total : day[sortKey];
                      const barHeight = Math.max(2, (targetVal / dailyScale.limit) * 80); // 目盛り高の割合
                      
                      const jogHeight         = day.total > 0 ? (day.jog / day.total) * 100 : 0;
                      const mltHeight         = day.total > 0 ? (day.mlt / day.total) * 100 : 0;
                      const cvHeight          = day.total > 0 ? (day.cv / day.total) * 100 : 0;
                      const speedHeight       = day.total > 0 ? (day.speed / day.total) * 100 : 0;
                      const unclassifiedHeight = day.total > 0 ? (day.unclassified / day.total) * 100 : 0;
                      const isActive = activeDailyIdx === idx;

                      return (
                        <button 
                          key={idx} 
                          onClick={() => setActiveDailyIdx(isActive ? null : idx)}
                          className="flex flex-col items-center flex-1 h-full justify-end relative focus:outline-none animate-fade-in"
                        >
                          {/* 棒の上の数値表示 */}
                          {targetVal > 0 && (
                            <span className={`text-[8px] font-black mb-0.5 block leading-none transition-colors ${isActive ? 'text-blue-600 scale-110' : 'text-slate-700'}`}>{targetVal}</span>
                          )}
                          
                          {/* 物理積層バー */}
                          {targetVal > 0 ? (
                            <div 
                              className={`w-4.5 rounded-t-[3px] overflow-hidden flex flex-col justify-end bg-slate-50 border shadow-sm transition-all duration-200 ${
                                isActive ? 'ring-2 ring-blue-500/50 scale-105 border-blue-400' : 'border-slate-100'
                              }`} 
                              style={{ height: `${barHeight}px` }}
                            >
                              {sortKey === 'total' ? (
                                <>
                                  {unclassifiedHeight > 0 && <div style={{ height: `${unclassifiedHeight}%`, backgroundColor: INTENSITY_COLORS.unclassified.hex }} />}
                                  {speedHeight > 0 && <div style={{ height: `${speedHeight}%`, backgroundColor: INTENSITY_COLORS.speed.hex }} />}
                                  {cvHeight > 0    && <div style={{ height: `${cvHeight}%`,    backgroundColor: INTENSITY_COLORS.cv.hex }} />}
                                  {mltHeight > 0   && <div style={{ height: `${mltHeight}%`,   backgroundColor: INTENSITY_COLORS.mlt.hex }} />}
                                  {jogHeight > 0   && <div style={{ height: `${jogHeight}%`,   backgroundColor: INTENSITY_COLORS.jog.hex }} />}
                                </>
                              ) : (
                                <div className="w-full h-full animate-fade-in" style={{ backgroundColor: INTENSITY_COLORS[sortKey].hex }} />
                              )}
                            </div>
                          ) : (
                            <div className="w-4.5 h-1 bg-slate-100 rounded-t-[3px] border border-slate-200" />
                          )}
                          
                          {/* 下部日付ラベル */}
                          <div className="h-6 flex flex-col justify-end items-center mt-1">
                            <span className={`text-[8px] font-black block leading-none transition-colors ${isActive ? 'text-blue-600 font-extrabold' : 'text-slate-500'}`}>{day.label.split('/')[1]}</span>
                            <span className={`text-[7px] font-extrabold block leading-none mt-0.5 transition-colors ${
                              isActive ? 'text-blue-600 font-extrabold' : (day.dayName === '日' ? 'text-red-500' : day.dayName === '土' ? 'text-blue-500' : 'text-slate-400')
                            }`}>{day.dayName}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 選択された日の詳細内訳 */}
                {activeDailyIdx !== null && (
                  <div className="mt-3 p-3 rounded-2xl bg-blue-50/40 border border-blue-100/50 animate-fade-in">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-black text-blue-800">
                        📅 {weeklyDailyActivity[activeDailyIdx].label} ({weeklyDailyActivity[activeDailyIdx].dayName}) の走行内訳
                      </span>
                      <span className="text-xs font-black text-blue-700">
                        合計 {sortKey === 'total' ? weeklyDailyActivity[activeDailyIdx].total : weeklyDailyActivity[activeDailyIdx][sortKey]} km
                        {sortKey !== 'total' && ` (総距離: ${weeklyDailyActivity[activeDailyIdx].total}km)`}
                      </span>
                    </div>
                    {weeklyDailyActivity[activeDailyIdx].total > 0 ? (
                      <div className="flex flex-wrap gap-1.5 text-[9px] font-bold justify-start">
                        {Object.entries(INTENSITY_COLORS).map(([key, item]) => {
                          const val = weeklyDailyActivity[activeDailyIdx][key] || 0;
                          if (val <= 0) return null;
                          if (sortKey !== 'total' && sortKey !== key) return null;
                          return (
                            <div key={key} className="bg-white rounded-lg p-1.5 border border-slate-100 text-center min-w-[50px] flex-1">
                              <span className="block text-slate-400">{item.name.split(' (')[0]}</span>
                              <span className="block font-black mt-0.5" style={{ color: item.hex }}>{val}km</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-[9px] font-bold text-slate-400 text-center py-1">この日の走行記録はありません</p>
                    )}
                  </div>
                )}
              </div>

              {/* ③ 月別走行推移 (直近6ヶ月・絶対目盛り安定) */}
              {selectedMemberData.trend.length > 0 && (
                <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-[0_8px_30px_rgba(0,0,0,0.015)] space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                      月別走行推移 (過去6ヶ月, {sortKey === 'total' ? '総距離' : INTENSITY_COLORS[sortKey].name.split(' (')[0]})
                    </h4>
                  </div>
                  
                  <div className="h-36 w-full relative flex items-end justify-between px-1 pt-5 pb-1">
                    {/* 横軸 & Y軸目盛り */}
                    <div className="absolute inset-x-0 bottom-6 h-px bg-slate-100 z-0" />
                    {monthlyScale.ticks.map((tick, idx) => {
                      const bottomPercent = 24 + ((tick / monthlyScale.limit) * 80);
                      return (
                        <div key={idx} className="absolute inset-x-0 border-t border-dashed border-slate-100/80 z-0" style={{ bottom: `${bottomPercent}px` }}>
                          <span className="absolute -top-1.5 left-0 text-[7px] font-black text-slate-400 bg-white pr-1 leading-none">{tick}</span>
                        </div>
                      );
                    })}
                    
                    {/* 棒グラフ項目 */}
                    <div className="w-full flex justify-between z-10 pl-6 h-full items-end gap-2">
                      {selectedMemberData.trend.map((t, idx) => {
                        const targetVal = sortKey === 'total' ? t.total : t[sortKey];
                        const barHeight = Math.max(2, (targetVal / monthlyScale.limit) * 80);
                        
                        const jogHeight   = (t.jog / t.total) * 100;
                        const mltHeight   = (t.mlt / t.total) * 100;
                        const cvHeight    = (t.cv / t.total) * 100;
                        const speedHeight = (t.speed / t.total) * 100;
                        const isActive = activeMonthIdx === idx;

                        return (
                          <button 
                            key={idx} 
                            onClick={() => setActiveMonthIdx(isActive ? null : idx)}
                            className="flex flex-col items-center flex-1 h-full justify-end relative focus:outline-none animate-fade-in"
                          >
                            {targetVal > 0 && (
                              <span className={`text-[8px] font-black mb-0.5 block leading-none transition-colors ${isActive ? 'text-blue-600 scale-110' : 'text-slate-700'}`}>{targetVal}</span>
                            )}
                            
                            {/* 積層バー */}
                            <div 
                              className={`w-5 rounded-t-[3px] overflow-hidden flex flex-col justify-end bg-slate-50 border shadow-sm transition-all duration-200 ${
                                isActive ? 'ring-2 ring-blue-500/50 scale-105 border-blue-400' : 'border-slate-100'
                              }`} 
                              style={{ height: `${barHeight}px` }}
                            >
                              {targetVal > 0 ? (
                                sortKey === 'total' ? (
                                  <>
                                    {speedHeight > 0 && <div style={{ height: `${speedHeight}%`, backgroundColor: INTENSITY_COLORS.speed.hex }} />}
                                    {cvHeight > 0    && <div style={{ height: `${cvHeight}%`,    backgroundColor: INTENSITY_COLORS.cv.hex }} />}
                                    {mltHeight > 0   && <div style={{ height: `${mltHeight}%`,   backgroundColor: INTENSITY_COLORS.mlt.hex }} />}
                                    {jogHeight > 0   && <div style={{ height: `${jogHeight}%`,   backgroundColor: INTENSITY_COLORS.jog.hex }} />}
                                  </>
                                ) : (
                                  <div className="w-full h-full animate-fade-in" style={{ backgroundColor: INTENSITY_COLORS[sortKey].hex }} />
                                )
                              ) : (
                                <div className="w-full h-full bg-slate-100/40" />
                              )}
                            </div>
                            
                            {/* 下部ラベル */}
                            <div className="h-6 flex items-center justify-center mt-1">
                              <span className={`text-[9px] font-black block leading-none transition-colors ${isActive ? 'text-blue-600 font-extrabold' : 'text-slate-500'}`}>{t.label}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 選択された月の詳細内訳 */}
                  {activeMonthIdx !== null && (
                    <div className="mt-3 p-3 rounded-2xl bg-blue-50/40 border border-blue-100/50 animate-fade-in">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-black text-blue-800">
                          📅 {selectedMemberData.trend[activeMonthIdx].label} の走行内訳
                        </span>
                        <span className="text-xs font-black text-blue-700">
                          合計 {sortKey === 'total' ? selectedMemberData.trend[activeMonthIdx].total : selectedMemberData.trend[activeMonthIdx][sortKey]} km
                          {sortKey !== 'total' && ` (総距離: ${selectedMemberData.trend[activeMonthIdx].total}km)`}
                        </span>
                      </div>
                      {selectedMemberData.trend[activeMonthIdx].total > 0 ? (
                        <div className="flex flex-wrap gap-1.5 text-[9px] font-bold justify-start">
                          {Object.entries(INTENSITY_COLORS).map(([key, item]) => {
                            const val = selectedMemberData.trend[activeMonthIdx][key] || 0;
                            if (val <= 0) return null;
                            if (sortKey !== 'total' && sortKey !== key) return null;
                            return (
                              <div key={key} className="bg-white rounded-lg p-1.5 border border-slate-100 text-center min-w-[50px] flex-1">
                                <span className="block text-slate-400">{item.name.split(' (')[0]}</span>
                                <span className="block font-black mt-0.5" style={{ color: item.hex }}>{val}km</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[9px] font-bold text-slate-400 text-center py-1">この月の走行記録はありません</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ④ 練習履歴タイムライン (チャット吹き出し・クリーンUI) */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-1 block">練習活動タイムライン</h4>
                
                <div className="relative pl-3.5 border-l border-slate-200 space-y-3.5 ml-2.5">
                  {selectedMemberData.daily.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs font-bold border border-dashed border-slate-100 rounded-2xl bg-white shadow-sm">
                      活動タイムラインの記録がありません
                    </div>
                  ) : (
                    selectedMemberData.daily.map((rec, i) => {
                      const hasMetrics = rec.jog > 0 || rec.mlt > 0 || rec.cv > 0 || rec.speed > 0;
                      const dateText = rec.date ? rec.date.substring(5).replace('-', '/') : '日付不明'; // "05/18"
                      
                      return (
                        <div key={i} className="relative group animate-fade-in" style={{ animationDelay: `${i * 0.04}s` }}>
                          {/* タイムラインのノード点 (ライトネオンカラー) */}
                          <div className="absolute -left-[20.5px] top-2 w-2.5 h-2.5 rounded-full bg-white border-2 border-blue-500 shadow-sm group-hover:scale-125 transition-transform" />
                          
                          {/* チャット風の吹き出し (純白・微細シャドウ) */}
                          <div className="bg-white border border-slate-100 rounded-3xl p-3.5 space-y-2.5 relative shadow-[0_2px_12px_rgba(0,0,0,0.01)] hover:border-slate-200/60 transition-all">
                            {/* 吹き出しの三角ツノ */}
                            <div className="absolute -left-[5px] top-3 w-2 h-2 bg-white border-l border-b border-slate-100 transform rotate-45" />
                            
                            {/* 日付・走行距離のヘッダー */}
                            <div className="flex justify-between items-center text-[10px] font-black text-slate-400 relative z-10">
                              <span>{dateText} の練習記録</span>
                              <span className="text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider shadow-sm">
                                {sortKey === 'total' ? rec.total : (rec[sortKey] || 0)} km
                                {sortKey !== 'total' && (
                                  <span className="text-[7px] text-slate-400 font-bold ml-1">/ {rec.total}km</span>
                                )}
                              </span>
                            </div>
                            
                            {/* 強度割合メーター (細いカラーバー) */}
                            {hasMetrics && (
                              <div className="h-1 bg-slate-100 rounded-full overflow-hidden flex border border-slate-200/10 shadow-inner">
                                {sortKey === 'total' ? (
                                  <>
                                    {rec.jog > 0 && <div style={{ width: `${(rec.jog/rec.total)*100}%`, backgroundColor: INTENSITY_COLORS.jog.hex }} />}
                                    {rec.mlt > 0 && <div style={{ width: `${(rec.mlt/rec.total)*100}%`, backgroundColor: INTENSITY_COLORS.mlt.hex }} />}
                                    {rec.cv > 0  && <div style={{ width: `${(rec.cv/rec.total)*100}%`,  backgroundColor: INTENSITY_COLORS.cv.hex }} />}
                                    {rec.speed > 0 && <div style={{ width: `${(rec.speed/rec.total)*100}%`, backgroundColor: INTENSITY_COLORS.speed.hex }} />}
                                  </>
                                ) : (
                                  <div style={{ width: `${((rec[sortKey] || 0)/rec.total)*100}%`, backgroundColor: INTENSITY_COLORS[sortKey].hex }} />
                                )}
                              </div>
                            )}

                            {/* 練習メニュー、コメント */}
                            <div className="space-y-1 relative z-10 text-xs">
                              {rec.menu && (
                                <p className="text-slate-700 font-extrabold leading-snug">
                                  <span className="text-[9px] text-slate-400 font-black mr-1 uppercase">メニュー:</span>
                                  {rec.menu}
                                </p>
                              )}
                              {rec.comment && (
                                <p className="text-slate-500 leading-relaxed font-bold bg-slate-50/50 p-2.5 rounded-2xl border border-slate-100/50 mt-1.5 italic">
                                  &ldquo;{rec.comment}&rdquo;
                                </p>
                              )}
                            </div>
                          </div>
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

      {/* 📱 画面右下の上品なフローティング部員切り替えボタン (FAB) - スクロール中の部員切り替えを劇的にスムーズに */}
      {showSection === 'analytics' && (
        <button
          onClick={() => setShowMemberSheet(true)}
          className="fixed bottom-24 right-4.5 z-40 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white pl-4.5 pr-5 py-3 rounded-full shadow-[0_8px_30px_rgba(37,99,235,0.35)] active:scale-95 transition-all font-black text-xs border border-blue-500/20 active:bg-blue-700 cursor-pointer animate-fade-in"
        >
          <Users size={14} className="shrink-0" />
          <span>部員切り替え</span>
        </button>
      )}

      {/* 📱 ランキング詳細表示時用のフローティング戻るボタン */}
      {showSection === 'ranking' && rankingDetailMember && (
        <button
          onClick={() => setRankingDetailMember('')}
          className="fixed bottom-24 right-4.5 z-40 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white pl-4 pr-4.5 py-3 rounded-full shadow-[0_8px_30px_rgba(15,23,42,0.3)] active:scale-95 transition-all font-black text-xs border border-slate-700/20 active:bg-slate-900 cursor-pointer animate-fade-in"
        >
          <ChevronRight size={14} className="rotate-180 shrink-0" />
          <span>戻る</span>
        </button>
      )}

      {/* 📱 メンバー選択シート (モバイルではボトムシート、PCでは中央モーダルにレスポンシブ対応 - React Portal化によりfixed崩れを100%防止) */}
      {showMemberSheet && createPortal(
        <>
          {/* 黒背景オーバーレイ */}
          <div 
            className="fixed inset-0 bg-slate-900/40 z-45 backdrop-blur-sm"
            style={{
              opacity: isClosing ? 0 : 1,
              transition: 'opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={closeMemberSheet}
          />
          
          {/* シート本体 */}
          <div 
            className={`fixed bottom-0 left-0 right-0 md:bottom-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full md:w-[420px] h-[480px] max-h-[85vh] bg-white rounded-t-[32px] md:rounded-[32px] z-50 shadow-[0_-12px_40px_rgba(0,0,0,0.08)] md:shadow-[0_12px_40px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden pb-safe ${
              isClosing ? '' : 'animate-slide-up md:animate-fade-in'
            }`}
            style={{
              transform: `translateY(${isClosing ? (window.innerWidth >= 768 ? '0px' : '100%') : `${dragOffsetY}px`}) ${
                window.innerWidth >= 768 ? `translate(-50%, -50%) ${isClosing ? 'scale(0.95)' : 'scale(1)'}` : ''
              }`,
              opacity: isClosing ? 0 : 1,
              transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* ハンドルバー (モバイルのみ表示 - タッチドラッグで閉じるエリア) */}
            <div 
              className="w-12 h-1 bg-slate-200 rounded-full mx-auto my-3.5 shrink-0 md:hidden cursor-grab active:cursor-grabbing"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            />
            
            {/* ヘッダー - タッチドラッグで閉じるエリア */}
            <div 
              className="px-5 py-4 flex justify-between items-center border-b border-slate-50 shrink-0 select-none cursor-grab active:cursor-grabbing"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div>
                <h3 className="text-base font-black text-slate-800">部員を選択</h3>
                <p className="text-[9px] text-slate-400 font-bold block mt-0.5 uppercase tracking-wider">Tap to change statistics targets</p>
              </div>
              <button 
                onClick={closeMemberSheet}
                className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 active:scale-95 transition-all shadow-sm"
              >
                <X size={15} />
              </button>
            </div>

            {/* 学年別フィルターチップス (モーダル用、横スクロール) */}
            <div className="flex gap-1.5 overflow-x-auto whitespace-nowrap px-5 py-2.5 scrollbar-none border-b border-slate-50 bg-slate-50/30 shrink-0">
              <button
                onClick={() => setModalGrade('')}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black border transition-all active:scale-95 ${
                  modalGrade === ''
                    ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm font-black'
                    : 'bg-white border-slate-100/80 text-slate-500 hover:bg-slate-50'
                }`}
              >
                すべて
              </button>
              {gradeList.map(g => (
                <button
                  key={g}
                  onClick={() => setModalGrade(g)}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-black border transition-all active:scale-95 ${
                    modalGrade === g
                      ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm font-black'
                      : 'bg-white border-slate-100/80 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
            
            {/* リストエリア (スクロール可、親指で押しやすい2列グリッド - シート全体の高さ固定化に伴い flex-1 で高さを一定に保持) */}
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-2.5 pb-6 content-start">
              {(() => {
                const filtered = members.filter(m => !modalGrade || getGradeFromName(m.name) === modalGrade);
                if (filtered.length === 0) {
                  return (
                    <div className="col-span-2 text-center py-8 text-slate-400 text-xs font-bold">
                      該当するメンバーがいません
                    </div>
                  );
                }
                return filtered.map(m => {
                  const isSelected = selectedMember === m.name;
                  const grade = getGradeFromName(m.name);
                  const nameOnly = getOnlyName(m.name);
                  
                  return (
                    <button
                      key={m.name}
                      onClick={() => {
                        setSelectedMember(m.name);
                        closeMemberSheet();
                      }}
                      className={`flex items-center gap-2.5 p-3.5 rounded-2xl border text-left transition-all ${
                        isSelected 
                          ? 'bg-blue-50 border-blue-200 text-blue-600 font-extrabold shadow-sm active:scale-98'
                          : 'bg-slate-50/50 border-slate-100 text-slate-600 hover:bg-slate-50 active:scale-98 active:bg-slate-100/50'
                      }`}
                    >
                      {/* アバター文字 */}
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {nameOnly.substring(0, 2)}
                      </div>
                      
                      <div className="truncate min-w-0">
                        <span className="text-[8px] block text-slate-400 font-extrabold leading-none uppercase tracking-wider">{grade}</span>
                        <span className="text-xs font-black block mt-1 truncate">{nameOnly}</span>
                      </div>
                    </button>
                  );
                });
              })()}
            </div>
          </div>
        </>,
        document.body
      )}

    </div>
  );
}
