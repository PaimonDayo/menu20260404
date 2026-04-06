import { X, MapPin, ExternalLink, Map, Train } from 'lucide-react';
import { locationDetails, locationStyles, defaultLocationStyle } from '../data/mockData';

export default function LocationsModal({ onClose }) {
    const locationsList = Object.entries(locationDetails);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-3xl w-[92vw] max-w-[390px] max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="shrink-0 flex items-center justify-between px-5 pt-6 pb-4 bg-white border-b border-slate-50">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                            <Map size={20} />
                        </div>
                        <h2 className="text-lg font-black text-slate-800">練習場所アクセス</h2>
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
                        const appleMapsUrl = info.appleUrl || `https://maps.apple.com/?q=${encodeURIComponent(info.appleQuery || info.name)}`;
                        
                        return (
                            <div key={key} className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 relative overflow-hidden">
                                {/* Accent line */}
                                <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: style.border }} />
                                
                                {/* Title / Tag */}
                                <div className="flex items-start gap-2 mb-2">
                                    <span
                                        className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md border shrink-0 mt-0.5 tracking-wider uppercase"
                                        style={{ backgroundColor: style.bg, borderColor: style.border, color: style.text }}
                                    >
                                        <MapPin size={10} />
                                        {key}
                                    </span>
                                    <h3 className="text-slate-800 font-black text-[15px] leading-tight">
                                        {info.name}
                                    </h3>
                                </div>

                                {/* Access & Fee */}
                                <div className="pl-1 mt-3 space-y-2">
                                    {info.access?.length > 0 && (
                                        <div className="flex items-start gap-2 text-sm text-slate-600">
                                            <Train size={15} className="mt-0.5 shrink-0 opacity-40 text-slate-400" />
                                            <div className="flex flex-col gap-0.5">
                                                {info.access.map((acc, i) => (
                                                    <span key={i} className="leading-snug font-medium">{acc}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {info.fee && (
                                        <div className="flex items-start gap-2 text-sm text-slate-600">
                                            <span className="text-[10px] border border-slate-200 bg-slate-50 rounded px-1.5 mt-0.5 text-slate-500 font-black shrink-0">料金</span>
                                            <span className="leading-snug font-medium">{info.fee}</span>
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
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-50 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors border border-slate-200 shadow-sm"
                                        >
                                            <Map size={14} />
                                            Google Maps
                                            <ExternalLink size={12} className="opacity-30" />
                                        </a>
                                        <a
                                            href={appleMapsUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-50 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors border border-slate-200 shadow-sm"
                                        >
                                            <MapPin size={14} />
                                            Apple Maps
                                            <ExternalLink size={12} className="opacity-30" />
                                        </a>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
