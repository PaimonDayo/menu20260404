import { useState } from 'react';
import { X, ChevronDown } from 'lucide-react';

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
    return new Date(year, month, 1).getDay(); // 0=Sun
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export default function CalendarModal({ sessions, onClose, onSelectDate, activeMonthStr, availableMonthsList = [] }) {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const mMatch = activeMonthStr ? activeMonthStr.match(/(\d+)月/) : null;
    const initialMonth = mMatch ? parseInt(mMatch[1], 10) - 1 : today.getMonth();
    const initialYear = today.getFullYear();
    
    const [viewYear, setViewYear] = useState(initialYear);
    const [viewMonth, setViewMonth] = useState(initialMonth);
    const [showMonthSelector, setShowMonthSelector] = useState(false);

    // 月リストの作成 (App.jsx から渡されたリストを使用)
    const currentYear = today.getFullYear();
    const listToUse = (availableMonthsList && availableMonthsList.length > 0) 
        ? availableMonthsList 
        : ['3月', '4月', '5月', '6月', '7月'];

    const availableMonths = listToUse.map(mStr => {
        const match = mStr.match(/(\d+)/);
        if (!match) return null;
        const mNum = parseInt(match[0], 10);
        const mIdx = mNum - 1;
        // 基本的に2026年内の表示。12月を超えて1〜3月なら来年とみなすが、
        // 現時点（4月）から見て3月は過去（今年）なので currentYear とする。
        // ※ ユーザーの要望に基づき、不自然な「来年の3月」にならないよう修正。
        const y = (mNum >= 1 && mNum <= 3 && today.getMonth() >= 9) ? currentYear + 1 : currentYear;
        return { y, m: mIdx, label: `${y}年 ${mNum}月` };
    }).filter(Boolean).sort((a, b) => (a.y * 12 + a.m) - (b.y * 12 + b.m));

    // s.date をキーとし、予定の種別と名称を保持する
    const activitiesMap = new Map();
    sessions.forEach(s => {
        if (!s.date) return;
        
        // 開始日(date)から終了日(endDate)までの全日程を算出
        const dates = [s.date];
        if (s.endDate) {
            let current = new Date(s.date);
            const stop = new Date(s.endDate);
            let limit = 0; // 安全策
            while (current < stop && limit < 14) {
                current.setDate(current.getDate() + 1);
                dates.push(current.toISOString().split('T')[0]);
                limit++;
            }
        }

        dates.forEach(dStr => {
            if (!activitiesMap.has(dStr)) {
                activitiesMap.set(dStr, { hasPractice: false, hasEvent: false, hasRecord: false, names: [] });
            }
            const state = activitiesMap.get(dStr);
            if (s.type === 'event') {
                state.hasEvent = true;
                if (s.name) state.names.push({ text: s.name, type: 'event' });
            } else if (s.type === 'record') {
                state.hasRecord = true;
                if (s.name) state.names.push({ text: s.name, type: 'record' });
            } else {
                state.hasPractice = true;
            }
        });
    });

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDow = getFirstDayOfWeek(viewYear, viewMonth);

    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    // 常に6行（42マス）埋めることで、高さを一定に保つ
    while (cells.length < 42) cells.push(null);

    function dateStr(d) {
        const mm = String(viewMonth + 1).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        return `${viewYear}-${mm}-${dd}`;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl w-full max-w-sm mx-auto shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="relative z-30 flex items-center justify-between px-4 pt-6 pb-4 border-b border-slate-50 shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <button 
                                onClick={() => setShowMonthSelector(!showMonthSelector)}
                                className="flex items-center gap-1.5 text-lg font-black text-slate-800 px-3 py-1.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all shadow-sm"
                            >
                                {viewYear}年 {viewMonth + 1}月
                                <ChevronDown size={18} className={`text-slate-400 transition-transform ${showMonthSelector ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {showMonthSelector && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowMonthSelector(false)} />
                                    <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-100 z-20 py-1 overflow-hidden">
                                        <div className="max-h-60 overflow-y-auto">
                                            {availableMonths.map(item => (
                                                <button
                                                    key={`${item.y}-${item.m}`}
                                                    onClick={() => {
                                                        setViewYear(item.y);
                                                        setViewMonth(item.m);
                                                        setShowMonthSelector(false);
                                                    }}
                                                    className={`w-full text-left px-4 py-2.5 text-sm font-semibold transition-colors
                                                        ${viewYear === item.y && viewMonth === item.m ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}
                                                    `}
                                                >
                                                    {item.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto">
                    {/* Weekday labels */}
                    <div className="grid grid-cols-7 px-2 mb-1 pt-4">
                        {WEEKDAYS.map((w, i) => (
                            <div key={w} className={`text-center text-xs font-semibold py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'}`}>
                                {w}
                            </div>
                        ))}
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-7 px-2 pb-4 gap-y-1">
                        {cells.map((d, i) => {
                            if (!d) return <div key={`empty-${i}`} className="h-[88px]" />;
                            const ds = dateStr(d);
                            const info = activitiesMap.get(ds);
                            const hasActivities = !!info;
                            const isToday = ds === todayStr;
                            const dow = (firstDow + d - 1) % 7;
                            
                            let hoverClass = 'hover:bg-slate-50';
                            if (info?.hasEvent) hoverClass = 'hover:bg-fuchsia-50';
                            else if (info?.hasRecord) hoverClass = 'hover:bg-teal-50';
                            else if (info?.hasPractice) hoverClass = 'hover:bg-blue-50';
                            
                            return (
                                <button
                                    key={ds}
                                    onClick={() => hasActivities && onSelectDate(ds)}
                                    className={`relative flex flex-col items-center pt-2.5 pb-1 rounded-xl transition-all h-[88px] overflow-hidden
                                      ${hasActivities ? 'cursor-pointer ' + hoverClass : 'cursor-default'}
                                    `}
                                >
                                    <div className={`flex items-center justify-center w-8 h-8 rounded-full mb-1.5 text-base font-black transition-transform active:scale-95
                                      ${isToday ? 'bg-blue-600 text-white shadow-md' : dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-slate-500'}
                                    `}>
                                        {d}
                                    </div>
                                    
                                    <div className="flex flex-col items-center gap-0.5 w-full flex-1 min-h-0">
                                        {info?.names && info.names.length > 0 && (
                                            <div className="flex flex-col gap-0.5 w-full px-1 overflow-hidden">
                                                {info.names.slice(0, 2).map((evt, idx) => (
                                                    <div 
                                                        key={idx} 
                                                        className={`text-[10px] leading-[12px] truncate w-full text-center font-bold px-1 py-0.5 rounded-[2px]
                                                            ${isToday ? 'bg-white/20 text-white' : evt.type === 'event' ? 'bg-fuchsia-100 text-fuchsia-700' : 'bg-teal-100 text-teal-700'}
                                                        `}
                                                    >
                                                        {evt.text}
                                                    </div>
                                                ))}
                                                {info.names.length > 2 && (
                                                    <div className={`text-[10px] leading-[12px] text-center font-black ${isToday ? 'text-white' : 'text-slate-400'}`}>
                                                        +{info.names.length - 2}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {hasActivities && (!info?.names || info.names.length === 0) && (
                                            <div className="flex items-center gap-0.5 mt-0.5">
                                                {info.hasPractice && <span className={`w-2 h-2 rounded-full ${isToday ? 'bg-white' : 'bg-blue-500'}`} />}
                                                {info.hasEvent && <span className={`w-2 h-2 rounded-full ${isToday ? 'bg-white' : 'bg-fuchsia-500'}`} />}
                                                {info.hasRecord && <span className={`w-2 h-2 rounded-full ${isToday ? 'bg-white' : 'bg-teal-500'}`} />}
                                            </div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Legend */}
                    <div className="flex items-center justify-center gap-4 px-5 pb-6 pt-2 text-xs text-slate-500 font-medium">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            練習
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-fuchsia-500" />
                            大会・行事
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-teal-500" />
                            記録会
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
