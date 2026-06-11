import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calculator, Loader2, Send, X } from 'lucide-react';
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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm animate-fade-in">
      <button type="button" className="absolute inset-0 cursor-default" onClick={requestClose} aria-label="閉じる" />

      <div className="w-full max-w-md bg-white rounded-t-[34px] shadow-[0_-18px_48px_rgba(0,0,0,0.14)] animate-slide-up border-t border-white z-10 max-h-[92vh] overflow-hidden">
        <div className="max-h-[92vh] overflow-y-auto px-5 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+20px)]">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4" />

          <div className="flex justify-between items-start mb-5">
            <div className="min-w-0 pr-4">
              <h3 className="text-base font-extrabold text-slate-900 truncate">{memberName} の練習記録</h3>
            </div>
            <button
              onClick={requestClose}
              className="w-8 h-8 rounded-full bg-[#f2f2f7] flex items-center justify-center text-zinc-400 hover:text-zinc-700 active:scale-95 transition-all shrink-0"
              aria-label="閉じる"
              type="button"
            >
              <X size={15} />
            </button>
          </div>

          <div className="pb-4 border-b border-slate-100">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">日付</span>
                <div className="flex items-end gap-2 mt-1">
                  <span className="text-3xl font-black leading-none text-slate-900">{selectedDate.day}</span>
                  <span className="text-xs font-extrabold text-slate-400 pb-0.5">{selectedDate.month}月 / {selectedDate.weekday}</span>
                </div>
              </div>
              <div className="h-7 flex items-center gap-2">
                {syncing && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                    <Loader2 size={12} className="animate-spin" />
                    同期中
                  </span>
                )}
                {date !== todayIso && (
                  <button
                    type="button"
                    onClick={() => requestDateChange(todayIso)}
                    className="h-7 px-3 rounded-full bg-[#f2f2f7] text-[#007aff] text-[10px] font-black active:scale-95 transition-all"
                  >
                    今日
                  </button>
                )}
              </div>
            </div>

            <div ref={railRef} className="overflow-x-auto scrollbar-none scroll-smooth snap-x snap-mandatory -mx-5 px-5">
              <div className="flex gap-1.5 min-w-max">
                {recentDates.map((item) => {
                  const isActive = date === item.dateStr;
                  const isToday = item.dateStr === todayIso;
                  return (
                    <button
                      key={item.dateStr}
                      data-date={item.dateStr}
                      type="button"
                      onClick={() => requestDateChange(item.dateStr)}
                      className={`snap-center shrink-0 w-[52px] h-[64px] rounded-[20px] flex flex-col items-center justify-center transition-all active:scale-95 ${
                        isActive ? 'bg-[#007aff] text-white shadow-sm' : 'bg-transparent text-slate-500 hover:bg-[#f2f2f7]'
                      }`}
                    >
                      <span className={`text-[9px] font-black leading-none ${isActive ? 'text-white/80' : 'text-slate-400'}`}>{item.caption}</span>
                      <span className="text-xl font-black leading-none mt-1">{item.day}</span>
                      <span className={`w-1 h-1 rounded-full mt-1.5 ${isToday ? (isActive ? 'bg-white' : 'bg-[#007aff]') : 'bg-transparent'}`} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="ios-list">
              <Field label="結果">
                <input type="text" placeholder="例: 12000mPR 3'40" value={result} onChange={(e) => update(setResult)(e.target.value)} autoComplete="off" className="ios-input" />
              </Field>

              <div className="ios-list-row p-3">
                <label className="ios-label mb-1.5">走行距離 (km)</label>
                <div className="grid grid-cols-2 gap-3">
                  <DistanceInput label="低強度 (jog)" color="text-[#007aff]" value={jog} onChange={update(setJog)} />
                  <DistanceInput label="中強度 (M-LT)" color="text-emerald-500" value={mlt} onChange={update(setMlt)} />
                  <DistanceInput label="高強度 (CV-VO2)" color="text-amber-500" value={cv} onChange={update(setCv)} />
                  <DistanceInput label="解糖系 (スピード)" color="text-orange-500" value={speed} onChange={update(setSpeed)} />
                </div>
              </div>

              <div className="ios-list-row p-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="ios-label mb-1">流し</label>
                  <input type="number" inputMode="numeric" min="0" placeholder="例: 3" value={strides} onChange={(e) => update(setStrides)(e.target.value)} autoComplete="off" className="ios-input !py-2.5 !rounded-xl" />
                </div>
                <div className="flex flex-col justify-end">
                  <span className="ios-label mb-1">自動合計</span>
                  <div className="px-4 py-2.5 bg-[#f2f2f7] rounded-xl text-xs font-extrabold text-zinc-600 flex items-center justify-between">
                    <span>{calculatedTotal} km</span>
                    <Calculator size={12} className="text-zinc-400" />
                  </div>
                </div>
              </div>

              <Field label="補強">
                <input type="text" placeholder="例: 腹筋200, スクワット50" value={reinforce} onChange={(e) => update(setReinforce)(e.target.value)} autoComplete="off" className="ios-input" />
              </Field>

              <Field label="感想">
                <textarea placeholder="今日の感想、状態、反省など" value={comment} onChange={(e) => update(setComment)(e.target.value)} autoComplete="off" className="ios-input h-32 min-h-32 resize-y text-sm leading-relaxed" />
              </Field>
            </div>

            <div className="flex gap-2 pt-2">
              <button type="submit" className="h-12 min-w-0 flex-1 bg-[#007aff] text-white font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 active:opacity-75 transition-all shadow-[0_8px_18px_rgba(0,122,255,0.18)] overflow-hidden">
                <Send size={12} className="shrink-0" />
                <span className="whitespace-nowrap">保存</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="ios-list-row p-3">
      <label className="ios-label mb-1">{label}</label>
      {children}
    </div>
  );
}

function DistanceInput({ label, color, value, onChange }) {
  return (
    <div>
      <span className={`text-[9px] font-extrabold ${color} block mb-0.5`}>{label}</span>
      <input type="number" inputMode="decimal" step="0.1" min="0" placeholder="0.0" value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" className="ios-input !px-3 !py-2.5 !rounded-xl" />
    </div>
  );
}
