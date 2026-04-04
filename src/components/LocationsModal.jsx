import { X, MapPin, ExternalLink, Map, Train } from 'lucide-react';
import { locationDetails, locationStyles, defaultLocationStyle } from '../data/mockData';

export default function LocationsModal({ onClose }) {
    const locationsList = Object.entries(locationDetails);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-slate-50 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="shrink-0 flex items-center justify-between px-5 py-4 bg-white border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                            <Map size={20} />
                        </div>
                        <h2 className="text-lg font-bold text-slate-800">練習場所アクセス</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full hover:bg-slate-100 transition-colors"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                    {locationsList.map(([key, info]) => {
                        const style = locationStyles[key] || defaultLocationStyle;
                        return (
                            <div key={key} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
                                {/* Title / Tag */}
                                <div className="flex items-start gap-2 mb-2">
                                    <span
                                        className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md border shrink-0 mt-0.5"
                                        style={{ backgroundColor: style.bg, borderColor: style.border, color: style.text }}
                                    >
                                        <MapPin size={11} />
                                        {key}
                                    </span>
                                    <h3 className="text-slate-800 font-bold text-[15px] leading-tight">
                                        {info.name}
                                    </h3>
                                </div>

                                {/* Access & Fee */}
                                <div className="pl-1 mt-3 space-y-2">
                                    {info.access?.length > 0 && (
                                        <div className="flex items-start gap-2 text-sm text-slate-600">
                                            <Train size={15} className="mt-0.5 shrink-0 opacity-50" />
                                            <div className="flex flex-col gap-0.5">
                                                {info.access.map((acc, i) => (
                                                    <span key={i} className="leading-snug">{acc}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {info.fee && (
                                        <div className="flex items-start gap-2 text-sm text-slate-600">
                                            <span className="text-[11px] border border-slate-300 rounded px-1 mt-0.5 text-slate-500 font-bold shrink-0">料金</span>
                                            <span className="leading-snug">{info.fee}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Map Links */}
                                {info.url && (
                                    <div className="flex gap-2 mt-4">
                                        <a
                                            href={info.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-blue-50 hover:text-blue-600 transition-colors border border-slate-200"
                                        >
                                            <Map size={14} />
                                            Google Maps
                                            <ExternalLink size={12} className="opacity-50" />
                                        </a>
                                        <a
                                            href={`https://maps.apple.com/?q=${encodeURIComponent(info.appleQuery || info.name)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-100 transition-colors border border-slate-200"
                                        >
                                            <MapPin size={14} />
                                            Apple Maps
                                            <ExternalLink size={12} className="opacity-50" />
                                        </a>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer Close */}
                <div className="shrink-0 p-3 bg-white border-t border-slate-100">
                    <button
                        onClick={onClose}
                        className="w-full py-2.5 rounded-xl bg-slate-100 text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}
