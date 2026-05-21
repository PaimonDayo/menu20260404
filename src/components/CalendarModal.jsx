import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year, month) {
    return new Date(year, month, 1).getDay(); // 0=Sun
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export default function CalendarModal({ sessions, onSelectDate, activeMonthStr, availableMonthsList = [] }) {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const mMatch = activeMonthStr ? activeMonthStr.match(/(\d+)月/) : null;
    const initialMonth = mMatch ? parseInt(mMatch[1], 10) - 1 : today.getMonth();
    const initialYear = today.getFullYear();
    
    const [viewYear, setViewYear] = useState(initialYear);
    const [viewMonth, setViewMonth] = useState(initialMonth);
    const [showMonthSelector, setShowMonthSelector] = useState(false);

    const currentYear = today.getFullYear();
    const listToUse = (availableMonthsList && availableMonthsList.length > 0) 
        ? availableMonthsList 
        : ['3月', '4月', '5月', '6月', '7月'];

    const availableMonths = listToUse.map(mStr => {
        const match = mStr.match(/(\d+)/);
        if (!match) return null;
        const mNum = parseInt(match[0], 10);
        const mIdx = mNum - 1;
        const y = (mNum >= 1 && mNum <= 3 && today.getMonth() >= 9) ? currentYear + 1 : currentYear;
        return { y, m: mIdx, label: `${y}年 ${mNum}月` };
    }).filter(Boolean).sort((a, b) => (a.y * 12 + a.m) - (b.y * 12 + b.m));

    // s.date をキーとし、予定の種別と名称を保持する
    const activitiesMap = new Map();
    sessions.forEach(s => {
        if (!s.date) return;
        
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
    while (cells.length < 42) cells.push(null);

    function dateStr(d) {
        const mm = String(viewMonth + 1).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        return `${viewYear}-${mm}-${dd}`;
    }

    return (
        <div className="bg-white rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.02)] border border-slate-100 w-full animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-slate-50 shrink-0">
                <div className="relative">
                    <button 
                        onClick={() => setShowMonthSelector(!showMonthSelector)}
                        className="flex items-center gap-1.5 text-sm font-black text-slate-800 px-3.5 py-1.5 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-all"
                    >
                        {viewYear}年 {viewMonth + 1}月
                        <ChevronDown size={13} className="text-slate-400 transition-transform duration-200" />
                    </button>
                    
                    {showMonthSelector && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowMonthSelector(false)} />
                            <div className="absolute top-full left-0 mt-1 w-44 bg-white rounded-2xl shadow-xl border border-slate-100 z-25 py-1.5 overflow-hidden animate-fade-in">
                                <div className="max-h-52 overflow-y-auto">
                                    {availableMonths.map(item => (
                                        <button
                                            key={`${item.y}-${item.m}`}
                                            onClick={() => {
                                                setViewYear(item.y);
                                                setViewMonth(item.m);
                                                setShowMonthSelector(false);
                                            }}
                                            className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors
                                                ${viewYear === item.y && viewMonth === item.m ? 'bg-blue-50 text-blue-600 font-extrabold' : 'text-slate-600 hover:bg-slate-50'}
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
                <span className="text-[10px] text-slate-400 font-black tracking-widest uppercase">カレンダー</span>
            </div>

            {/* Grid */}
            <div className="px-2 pb-4 pt-2">
                {/* Weekdays */}
                <div className="grid grid-cols-7 mb-1.5">
                    {WEEKDAYS.map((w, i) => (
                        <div key={w} className={`text-center text-[10px] font-black py-1 tracking-wider ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'}`}>
                            {w}
                        </div>
                    ))}
                </div>

                {/* Dates */}
                <div className="grid grid-cols-7 gap-y-1">
                    {cells.map((d, i) => {
                        if (!d) return <div key={`empty-${i}`} className="h-[64px]" />;
                        const ds = dateStr(d);
                        const info = activitiesMap.get(ds);
                        const hasActivities = !!info;
                        const isToday = ds === todayStr;
                        const dow = (firstDow + d - 1) % 7;
                        
                        let hoverClass = 'active:bg-slate-50';
                        if (info?.hasEvent) hoverClass = 'active:bg-fuchsia-50';
                        else if (info?.hasRecord) hoverClass = 'active:bg-teal-50';
                        else if (info?.hasPractice) hoverClass = 'active:bg-blue-50';
                        
                        return (
                            <button
                                key={ds}
                                onClick={() => hasActivities && onSelectDate(ds)}
                                className={`relative flex flex-col items-center pt-2 pb-1.5 rounded-2xl transition-all h-[64px]
                                  ${hasActivities ? 'cursor-pointer ' + hoverClass : 'cursor-default opacity-30'}
                                `}
                            >
                                <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-black transition-all
                                  ${isToday 
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10' 
                                    : dow === 0 
                                      ? 'text-red-500' 
                                      : dow === 6 
                                        ? 'text-blue-600' 
                                        : 'text-slate-700'
                                  }
                                `}>
                                    {d}
                                </div>
                                
                                <div className="flex flex-col items-center w-full flex-1 min-h-0 mt-1">
                                    <div className="flex items-center justify-center gap-1 mt-auto pb-0.5">
                                        {info?.hasPractice && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                        )}
                                        {info?.hasEvent && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500" />
                                        )}
                                        {info?.hasRecord && (
                                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex items-center justify-center gap-4 px-3 pt-3.5 border-t border-slate-50 text-[9px] text-slate-400 font-black tracking-widest uppercase">
                    <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        練習
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-500" />
                        大会・行事
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                        記録会
                    </div>
                </div>
            </div>
        </div>
    );
}
