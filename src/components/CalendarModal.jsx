import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
    return new Date(year, month, 1).getDay(); // 0=Sun
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export default function CalendarModal({ sessions, onClose, onSelectDate, activeMonthStr }) {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // activeMonthStr (例："4月") から月を取得。不正な場合は現在の月。
    const mMatch = activeMonthStr ? activeMonthStr.match(/(\d+)月/) : null;
    const initialMonth = mMatch ? parseInt(mMatch[1], 10) - 1 : today.getMonth();
    
    // 年は現在の年を使用（後で複数年に対応する場合は調整）
    const viewYear = today.getFullYear();
    const viewMonth = initialMonth;

    // s.date をキーとし、試合判定(isMatch)を保持する
    const practiceMap = new Map(
        sessions.map(s => {
            const isMatch = s.time && !/^\d{1,2}:\d{2}$/.test(s.time.trim());
            return [s.date, { isMatch }];
        })
    );

    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDow = getFirstDayOfWeek(viewYear, viewMonth);

    const cells = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    function dateStr(d) {
        const mm = String(viewMonth + 1).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        return `${viewYear}-${mm}-${dd}`;
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-2xl w-full max-w-sm mx-auto shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="relative flex items-center justify-center px-5 pt-6 pb-4">
                    <h2 className="text-lg font-bold text-slate-800">
                        {viewYear}年 {viewMonth + 1}月
                    </h2>
                    <button
                        onClick={onClose}
                        className="absolute right-4 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Weekday labels */}
                <div className="grid grid-cols-7 px-4 mb-1">
                    {WEEKDAYS.map((w, i) => (
                        <div key={w} className={`text-center text-xs font-semibold py-1 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'}`}>
                            {w}
                        </div>
                    ))}
                </div>

                {/* Dates */}
                <div className="grid grid-cols-7 px-4 pb-6 gap-y-1">
                    {cells.map((d, i) => {
                        if (!d) return <div key={`empty-${i}`} />;
                        const ds = dateStr(d);
                        const info = practiceMap.get(ds);
                        const hasPractice = !!info;
                        const isMatch = info?.isMatch;
                        const isToday = ds === todayStr;
                        const dow = (firstDow + d - 1) % 7;
                        
                        return (
                            <button
                                key={ds}
                                onClick={() => hasPractice && onSelectDate(ds)}
                                className={`relative flex flex-col items-center py-1.5 rounded-xl transition-colors
                  ${hasPractice ? (isMatch ? 'hover:bg-red-50' : 'hover:bg-blue-50') + ' cursor-pointer' : 'cursor-default'}
                  ${isToday ? 'bg-blue-600 shadow-sm' : ''}
                `}
                            >
                                <span className={`text-sm font-medium leading-none
                  ${isToday ? 'text-white' : dow === 0 ? 'text-red-400' : dow === 6 ? 'text-blue-500' : 'text-slate-700'}
                `}>
                                    {d}
                                </span>
                                {hasPractice && !isToday && (
                                    <span className={`mt-1 w-1.5 h-1.5 rounded-full ${isMatch ? 'bg-red-500' : 'bg-blue-500'}`} />
                                )}
                                {hasPractice && isToday && (
                                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-white/80" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-4 px-5 pb-5 pt-2 text-xs text-slate-500 font-medium">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        練習
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        試合
                    </div>
                </div>
            </div>
        </div>
    );
}
