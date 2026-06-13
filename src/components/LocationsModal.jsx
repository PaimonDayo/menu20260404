import { MapPin, ExternalLink, Map, Train } from 'lucide-react';
import { locationDetails, locationStyles, defaultLocationStyle } from '../data/mockData';

export default function LocationsModal() {
    const locationsList = Object.entries(locationDetails);

    return (
        <div className="animate-fade-in pb-8 space-y-4 px-1">
            {/* シンプルでスマートな上部紹介 */}
            <div className="flex items-center gap-2 mb-2 pl-1">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#007aff] shadow-sm">
                    <Map size={16} />
                </div>
                <div>
                    <h2 className="text-sm font-bold text-zinc-800 leading-tight">練習場所アクセス</h2>
                    <p className="text-[10px] text-zinc-400 font-bold leading-none mt-0.5 uppercase tracking-wider">Direct navigation with Google / Apple Maps</p>
                </div>
            </div>

            {/* ロケーションカードリスト (クリーンな純白カード) */}
            <div className="space-y-3.5">
                {locationsList.map(([key, info]) => {
                    const style = locationStyles[key] || defaultLocationStyle;
                    const appleMapsUrl = info.appleUrl || `https://maps.apple.com/?q=${encodeURIComponent(info.appleQuery || info.name)}`;
                    
                    return (
                        <div key={key} className="bg-white border border-zinc-100 rounded-3xl p-4 shadow-[0_8px_30px_rgba(0,0,0,0.015)] relative overflow-hidden">
                            {/* 左端の上品なカラーアクセントライン */}
                            <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: style.border }} />
                            
                            {/* タイトルとタグ */}
                            <div className="flex items-start gap-2 mb-3">
                                <span
                                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-md border shrink-0 mt-0.5 tracking-wider uppercase shadow-inner"
                                    style={{ 
                                        backgroundColor: 'rgba(241, 245, 249, 0.5)', 
                                        borderColor: style.border, 
                                        color: style.text 
                                    }}
                                >
                                    <MapPin size={9} />
                                    {key}
                                </span>
                                <h3 className="text-zinc-800 font-bold text-[15px] leading-tight">
                                    {info.name}
                                </h3>
                            </div>

                            {/* アクセス情報と料金 */}
                            <div className="pl-1 space-y-2.5 text-xs">
                                {info.access?.length > 0 && (
                                    <div className="flex items-start gap-2 text-zinc-600">
                                        <Train size={14} className="mt-0.5 shrink-0 opacity-50 text-zinc-400" />
                                        <div className="flex flex-col gap-0.5 font-bold">
                                            {info.access.map((acc, i) => (
                                                <span key={i} className="leading-snug text-zinc-600">{acc}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {info.fee && (
                                    <div className="flex items-start gap-2 text-zinc-600">
                                        <span className="text-[10px] border border-zinc-100 bg-zinc-50 rounded px-1.5 py-0.5 text-zinc-400 font-bold shrink-0 uppercase tracking-wider">利用料金</span>
                                        <span className="leading-snug font-bold text-zinc-500">{info.fee}</span>
                                    </div>
                                )}
                            </div>

                            {/* Apple / Google Map 連携ボタン */}
                            {info.url && (
                                <div className="flex gap-2 mt-4.5">
                                    <a
                                        href={info.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-blue-50 border border-blue-100 text-[#007aff] text-xs font-bold hover:bg-blue-100 active:scale-95 transition-all shadow-sm"
                                    >
                                        <Map size={12} className="text-[#007aff]" />
                                        Google Maps
                                        <ExternalLink size={9} className="opacity-40" />
                                    </a>
                                    <a
                                        href={appleMapsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-bold hover:bg-emerald-100 active:scale-95 transition-all shadow-sm"
                                    >
                                        <MapPin size={12} className="text-emerald-500" />
                                        Apple Maps
                                        <ExternalLink size={9} className="opacity-40" />
                                    </a>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
