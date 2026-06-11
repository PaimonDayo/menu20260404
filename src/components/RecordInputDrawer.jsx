import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { fetchMemberDayRecord, submitPracticeRecord } from '../services/sheetsService';

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

const formatIsoDate = (date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const getTodayIso = () => formatIsoDate(new Date());

const addDays = (dateStr, amount) => {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + amount);
  return formatIsoDate(date);
};

const makeRecentDates = () => {
  return Array.from({ length: 30 }, (_, idx) => {
    const offset = 29 - idx;
    const date = new Date();
    date.setDate(date.getDate() - offset);
    let caption = WEEKDAYS[date.getDay()];
    if (offset === 0) caption = '今日';
    if (offset === 1) caption = '昨日';
    if (offset === 2) caption = '一昨日';
    return {
      dateStr: formatIsoDate(date),
      day: date.getDate(),
      month: date.getMonth() + 1,
      weekday: WEEKDAYS[date.getDay()],
      caption,
    };
  });
};

const dateParts = (dateStr) => {
  const date = new Date(`${dateStr}T00:00:00`);
  return {
    month: date.getMonth() + 1,
    day: date.getDate(),
    weekday: WEEKDAYS[date.getDay()],
    full: `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 (${WEEKDAYS[date.getDay()]})`,
  };
};

const asNumberOrBlank = (value) => value === '' ? '' : parseFloat(value);

const mergeRecordResponse = (cached, remote) => {
  if (cached?.exists && cached.data && (!remote?.exists || !remote.data)) {
    return cached;
  }
  if (!cached?.exists || !cached.data || !remote?.exists || !remote.data) {
    return remote || cached || { exists: false };
  }

  const data = { ...remote.data };
  ['result', 'reinforce', 'comment'].forEach((key) => {
    if ((data[key] === undefined || data[key] === null || data[key] === '') && cached.data[key]) {
      data[key] = cached.data[key];
    }
  });

  return { ...remote, data };
};

// 強度ドットの色（マイページの強度別グラフと同じ系統色）
const INTENSITY_DOTS = {
  jog: '#007aff',
  mlt: '#34c759',
  cv: '#ffcc00',
  speed: '#ff9500',
};

export default function RecordInputDrawer({ isOpen, onClose, memberName, onRecordSubmitted }) {
  const [date, setDate] = useState(getTodayIso);
  const [result, setResult] = useState('');
  const [jog, setJog] = useState('');
  const [mlt, setMlt] = useState('');
  const [cv, setCv] = useState('');
  const [speed, setSpeed] = useState('');
  const [strides, setStrides] = useState('');
  const [reinforce, setReinforce] = useState('');
  const [comment, setComment] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [hasExisting, setHasExisting] = useState(false); // 選択日に既存記録があるか（編集バッジ用）

  const todayIso = useMemo(() => getTodayIso(), []);
  const minIso = useMemo(() => addDays(todayIso, -29), [todayIso]);
  const recentDates = useMemo(() => makeRecentDates(), []);
  const selectedDate = useMemo(() => dateParts(date), [date]);
  const railRef = useRef(null);
  // 取得済み記録のキャッシュ。表示には使わないため state ではなく ref で保持する
  const cacheRef = useRef({});
  // 未保存の編集があるか。確認なしの破棄や、同期完了時の入力上書きを防ぐ
  const dirtyRef = useRef(false);

  const update = (setter) => (value) => {
    dirtyRef.current = true;
    setter(value);
  };

  const requestClose = () => {
    if (dirtyRef.current && !window.confirm('入力中の内容が保存されていません。破棄して閉じますか？')) return;
    dirtyRef.current = false;
    onClose();
  };

  const requestDateChange = (nextDate) => {
    if (nextDate === date) return;
    if (dirtyRef.current && !window.confirm('入力中の内容が保存されていません。破棄して日付を変更しますか？')) return;
    dirtyRef.current = false;
    setDate(nextDate);
  };

  useEffect(() => {
    if (isOpen) dirtyRef.current = false;
  }, [isOpen]);

  const cacheKeyFor = useCallback((member, dateStr) => `${member}__${dateStr}`, []);

  useEffect(() => {
    if (!isOpen || !memberName) return;
    // 開いたメンバー自身のキャッシュは破棄して常に最新を取得させる
    const nextCache = {};
    Object.entries(cacheRef.current).forEach(([key, value]) => {
      if (!key.startsWith(`${memberName}__`)) {
        nextCache[key] = value;
      }
    });
    cacheRef.current = nextCache;
  }, [isOpen, memberName]);

  const clearForm = useCallback(() => {
    setResult('');
    setJog('');
    setMlt('');
    setCv('');
    setSpeed('');
    setStrides('');
    setReinforce('');
    setComment('');
    setHasExisting(false);
  }, []);

  const applyRecord = useCallback((res) => {
    if (res?.exists && res.data) {
      const data = res.data;
      setResult(data.result || '');
      setJog(data.jog ? String(data.jog) : '');
      setMlt(data.mlt ? String(data.mlt) : '');
      setCv(data.cv ? String(data.cv) : '');
      setSpeed(data.speed ? String(data.speed) : '');
      setStrides(data.strides ? String(data.strides) : '');
      setReinforce(data.reinforce || '');
      setComment(data.comment || '');
      setHasExisting(true);
      return;
    }
    clearForm();
  }, [clearForm]);

  const fetchAndCache = useCallback(async (member, dateStr) => {
    const key = cacheKeyFor(member, dateStr);
    const res = await fetchMemberDayRecord(member, dateStr);
    cacheRef.current = { ...cacheRef.current, [key]: res || { exists: false } };
    return res;
  }, [cacheKeyFor]);

  useEffect(() => {
    if (!isOpen || !date) return;
    railRef.current?.querySelector(`[data-date="${date}"]`)?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [date, isOpen]);

  useEffect(() => {
    if (!isOpen || !memberName || !date) return;

    let mounted = true;
    const key = cacheKeyFor(memberName, date);
    const cached = cacheRef.current[key];

    if (cached) {
      applyRecord(cached);
      setSyncing(false);
    } else {
      clearForm();
      setSyncing(true);
    }

    fetchAndCache(memberName, date)
      .then((res) => {
        if (mounted) {
          const merged = mergeRecordResponse(cached, res);
          cacheRef.current = { ...cacheRef.current, [key]: merged };
          // 同期中にユーザーが入力を始めていたら、取得結果で上書きしない
          if (!dirtyRef.current) applyRecord(merged);
        }
      })
      .catch((err) => {
        console.warn('既存記録の取得に失敗しました', err);
        if (mounted && !cached && !dirtyRef.current) clearForm();
      })
      .finally(() => {
        if (mounted) setSyncing(false);
      });

    [-2, -1, 1, 2]
      .map((offset) => addDays(date, offset))
      .filter((candidate) => candidate >= minIso && candidate <= todayIso)
      .filter((candidate) => !cacheRef.current[cacheKeyFor(memberName, candidate)])
      .forEach((candidate) => {
        fetchAndCache(memberName, candidate).catch(() => {});
      });

    return () => {
      mounted = false;
    };
  }, [memberName, date, isOpen, minIso, todayIso, applyRecord, clearForm, fetchAndCache, cacheKeyFor]);

  const totalDistance = () => {
    const total = (parseFloat(jog) || 0) + (parseFloat(mlt) || 0) + (parseFloat(cv) || 0) + (parseFloat(speed) || 0);
    return Math.round(total * 100) / 100;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!memberName || !date) return;

    const total = totalDistance();
    const payload = {
      memberName,
      date,
      result: result.trim(),
      jog: asNumberOrBlank(jog),
      mlt: asNumberOrBlank(mlt),
      cv: asNumberOrBlank(cv),
      speed: asNumberOrBlank(speed),
      strides: asNumberOrBlank(strides),
      reinforce: reinforce.trim(),
      comment: comment.trim(),
      total: total > 0 ? total : '',
    };

    // 楽観的送信: 即座に閉じて送信は裏で行う。入力内容はキャッシュに残るので、
    // 失敗時はドロワーを開き直せばそのまま再保存できる
    cacheRef.current = { ...cacheRef.current, [cacheKeyFor(memberName, date)]: { exists: true, data: payload } };
    onRecordSubmitted?.(payload);
    dirtyRef.current = false;
    onClose();

    submitPracticeRecord(payload).catch((err) => {
      window.alert(`${dateParts(date).full} の記録の保存に失敗しました: ${err.message}\n入力内容は残っています。記録入力を開き直して、もう一度保存してください。`);
    });
  };

  if (!isOpen) return null;

  const calculatedTotal = totalDistance();
  const distanceFields = [
    { key: 'jog', label: '低強度 (jog)', value: jog, set: setJog },
    { key: 'mlt', label: '中強度 (M-LT)', value: mlt, set: setMlt },
    { key: 'cv', label: '高強度 (CV-VO2)', value: cv, set: setCv },
    { key: 'speed', label: '解糖系 (スピード)', value: speed, set: setSpeed },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-[#f2f2f7] animate-slide-up">
      <form onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">

        {/* ── 上部バー（キャンセル / タイトル / 保存）── */}
        <div className="shrink-0 bg-[#f2f2f7]/95 backdrop-blur border-b border-zinc-200/60 pt-[calc(env(safe-area-inset-top,0px)+6px)]">
          <div className="max-w-md mx-auto w-full">
            <div className="flex items-center justify-between px-4 py-3 gap-3">
              <button
                type="button"
                onClick={requestClose}
                className="text-[16px] text-[#007aff] active:opacity-60 transition-opacity shrink-0"
              >
                キャンセル
              </button>
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="text-[16px] font-semibold text-zinc-900 truncate">{memberName}</span>
                {hasExisting && (
                  <span className="text-[11px] font-medium text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-md shrink-0">編集</span>
                )}
              </span>
              <button
                type="submit"
                className="text-[16px] font-semibold text-[#007aff] active:opacity-60 transition-opacity shrink-0"
              >
                保存
              </button>
            </div>

            {/* 日付情報行 */}
            <div className="flex items-center justify-between px-4 pb-1.5">
              <span className="text-[13px] text-zinc-500">{selectedDate.full}</span>
              <span className="flex items-center gap-2 h-6">
                {syncing && (
                  <span className="inline-flex items-center gap-1 text-[12px] text-zinc-400">
                    <Loader2 size={12} className="animate-spin" />
                    同期中
                  </span>
                )}
                {date !== todayIso && (
                  <button
                    type="button"
                    onClick={() => requestDateChange(todayIso)}
                    className="h-6 px-2.5 rounded-full bg-zinc-200/55 text-[#007aff] text-[12px] font-medium active:scale-95 transition-all"
                  >
                    今日
                  </button>
                )}
              </span>
            </div>

            {/* 日付レール */}
            <div ref={railRef} className="overflow-x-auto scrollbar-none scroll-smooth snap-x snap-mandatory px-4 pb-2.5">
              <div className="flex gap-1 min-w-max">
                {recentDates.map((item) => {
                  const isActive = date === item.dateStr;
                  const isToday = item.dateStr === todayIso;
                  return (
                    <button
                      key={item.dateStr}
                      data-date={item.dateStr}
                      type="button"
                      onClick={() => requestDateChange(item.dateStr)}
                      className={`snap-center shrink-0 w-[46px] py-1.5 rounded-xl flex flex-col items-center transition-all active:scale-95 ${
                        isActive ? 'bg-[#007aff] text-white' : 'text-zinc-500'
                      }`}
                    >
                      <span className={`text-[10px] leading-none ${isActive ? 'text-white/80' : 'text-zinc-400'}`}>{item.caption}</span>
                      <span className="text-[17px] font-semibold leading-none mt-1">{item.day}</span>
                      <span className={`w-1 h-1 rounded-full mt-1 ${isToday ? (isActive ? 'bg-white' : 'bg-[#007aff]') : 'bg-transparent'}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── フィールド（スクロール領域）── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-md mx-auto w-full px-4 py-3 space-y-3 pb-[calc(env(safe-area-inset-bottom,0px)+24px)]">

            {/* 走行距離 + 合計 */}
            <div className="bg-white rounded-2xl p-3.5">
              <p className="text-[13px] font-medium text-zinc-500 mb-2.5">走行距離 (km)</p>
              <div className="grid grid-cols-2 gap-2.5">
                {distanceFields.map((f) => (
                  <div key={f.key}>
                    <span className="flex items-center gap-1.5 text-[12px] text-zinc-500 mb-1">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: INTENSITY_DOTS[f.key] }} />
                      {f.label}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      placeholder="0.0"
                      value={f.value}
                      onChange={(e) => update(f.set)(e.target.value)}
                      autoComplete="off"
                      className="w-full bg-[#f2f2f7] rounded-xl px-3 py-2.5 text-[15px] font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-[#007aff]/25"
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-100">
                <span className="text-[13px] text-zinc-500">合計</span>
                <span className="text-[17px] font-semibold text-zinc-900">{calculatedTotal} km</span>
              </div>
            </div>

            {/* 流し */}
            <div className="bg-white rounded-2xl px-4 py-3 flex items-center justify-between">
              <span className="text-[15px] text-zinc-900">流し</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="0"
                value={strides}
                onChange={(e) => update(setStrides)(e.target.value)}
                autoComplete="off"
                className="w-24 bg-[#f2f2f7] rounded-lg px-3 py-1.5 text-[15px] font-semibold text-right text-zinc-900 outline-none focus:ring-2 focus:ring-[#007aff]/25"
              />
            </div>

            {/* 結果・補強・感想 */}
            <div className="bg-white rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100">
                <span className="text-[12px] text-zinc-400 block mb-0.5">結果・タイム</span>
                <input
                  type="text"
                  placeholder="例: 12000mPR 3'40"
                  value={result}
                  onChange={(e) => update(setResult)(e.target.value)}
                  autoComplete="off"
                  className="w-full bg-transparent text-[15px] text-zinc-900 outline-none placeholder:text-zinc-300"
                />
              </div>
              <div className="px-4 py-3 border-b border-zinc-100">
                <span className="text-[12px] text-zinc-400 block mb-0.5">補強</span>
                <input
                  type="text"
                  placeholder="例: 腹筋200, スクワット50"
                  value={reinforce}
                  onChange={(e) => update(setReinforce)(e.target.value)}
                  autoComplete="off"
                  className="w-full bg-transparent text-[15px] text-zinc-900 outline-none placeholder:text-zinc-300"
                />
              </div>
              <div className="px-4 py-3">
                <span className="text-[12px] text-zinc-400 block mb-0.5">感想</span>
                <textarea
                  placeholder="今日の感想、状態、反省など"
                  value={comment}
                  onChange={(e) => update(setComment)(e.target.value)}
                  autoComplete="off"
                  className="w-full bg-transparent text-[15px] text-zinc-900 outline-none placeholder:text-zinc-300 resize-y h-28 leading-relaxed"
                />
              </div>
            </div>

          </div>
        </div>
      </form>
    </div>
  );
}
