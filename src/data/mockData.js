export const months = ['3月', '4月', '5月', '6月', '7月', '日程一覧'];

// 場所ごとの色定義（インラインスタイル用）
export const locationStyles = {
  '農部':       { bg: '#E6F4EA', border: '#2E9B52', text: '#155C2C' }, // 緑
  '工部':       { bg: '#F5E6DC', border: '#7A4520', text: '#4A2510' }, // こげ茶
  '府中':       { bg: '#F3F0FF', border: '#7C3AED', text: '#4C1D95' }, // 紫
  '外大':       { bg: '#D1FAE8', border: '#1A7A55', text: '#145040' }, // 深い緑
  '武蔵野':     { bg: '#ECFCCB', border: '#6AAD2D', text: '#3D6B14' }, // 黄緑
  '済美山':     { bg: '#FDF3D3', border: '#B8860B', text: '#7A5500' }, // 黄土色
  '東大和':     { bg: '#DBEAFE', border: '#2557BD', text: '#1E3F8A' }, // 深い青
  '富士森':     { bg: '#FFEDD5', border: '#D9650B', text: '#942A0B' }, // オレンジ
  '駒場':       { bg: '#F1F5F9', border: '#94A3B8', text: '#475569' }, 
  '織田':       { bg: '#F1F5F9', border: '#94A3B8', text: '#475569' }, 
};
// 上記に含まれない場所のデフォルト色
export const defaultLocationStyle = { bg: '#F1F5F9', border: '#94A3B8', text: '#475569' };

// 競技場の詳細情報（アクセス、料金、マップリンク）
export const locationDetails = {
    '農部': {
        name: '農学部グラウンド',
        access: [
            '北府中駅から徒歩16分',
            '府中駅から徒歩25分',
            '国分寺駅から徒歩30分'
        ],
        fee: null,
        url: 'https://maps.app.goo.gl/GYYNeaxw1dZ6gF2x7?g_st=ic',
        appleUrl: 'https://maps.apple/p/FdazX.hU9Xfcxg'
    },
    '工部': {
        name: '工学部トレーニングルーム・グラウンド',
        access: [
            '東小金井駅から徒歩8分'
        ],
        fee: null,
        url: 'https://maps.app.goo.gl/bgkgVcUe5Gx7Dde19?g_st=ipc',
        appleUrl: 'https://maps.apple/p/ojGd6gPUHMnZ5shu'
    },
    '府中': {
        name: '府中市民陸上競技場',
        access: [
            '北府中駅から徒歩7分',
            '府中駅から徒歩15分'
        ],
        fee: '府中市民50円、府中市外100円',
        url: 'https://maps.app.goo.gl/YgmvyKWSzgmiRVWp9?g_st=com.google.maps.preview.copy',
        appleUrl: 'https://maps.apple/p/bfvb3xbYR18uFt'
    },
    '外大': {
        name: '東京外国語大学 陸上競技場',
        access: [
            '多磨駅から徒歩11分',
            '飛田給駅から徒歩22分',
            '武蔵野台駅から徒歩22分'
        ],
        fee: null,
        url: 'https://maps.app.goo.gl/v9WX5EeRfrsWqb2u5',
        appleUrl: 'https://maps.apple/p/0u8-IvcFqo1GMe'
    },
    '武蔵野': {
        name: '武蔵野陸上競技場',
        access: [
            '三鷹駅から徒歩25分（バス8分）',
            '東伏見駅から徒歩20分'
        ],
        fee: '100円',
        url: 'https://maps.app.goo.gl/pw5YHpi3B4UaJPiV8?g_st=ic',
        appleUrl: 'https://maps.apple/p/3Ix8Cb8NQbqI6u'
    },
    '駒場': {
        name: '駒場運動公園陸上競技場',
        access: [
            '浦和駅から徒歩25分'
        ],
        fee: '100円/1時間',
        url: 'https://maps.app.goo.gl/MptB9nNKj5DtEHVF6?g_st=ic',
        appleUrl: 'https://maps.apple/p/QiYToWFCiHfyzU'
    },
    '東大和': {
        name: '東大和南公園',
        access: [
            '玉川上水駅から徒歩10分'
        ],
        fee: '無し',
        url: 'https://maps.app.goo.gl/Dz4Y64AHBN4cfdnG8?g_st=ic',
        appleUrl: 'https://maps.apple/p/AAomBYYAtmvZCo'
    },
    '済美山': {
        name: '和田堀公園 第二競技場 (済美山運動場)',
        access: [
            '方南町駅(丸ノ内線)から徒歩12分',
            '永福町駅(井の頭線)から徒歩17分'
        ],
        fee: '無し',
        url: 'https://maps.app.goo.gl/TYtmyjJD8RWGxiTp8?g_st=com.google.maps.preview.copy',
        appleUrl: 'https://maps.apple/p/peIYuN.6cZAuhh'
    },
    '織田': {
        name: '代々木公園陸上競技場 (織田フィールド)',
        access: [
            '原宿駅(JR)から徒歩10分',
            '代々木公園駅(千代田線)から徒歩7分',
            '代々木八幡駅(小田急線)から徒歩9分'
        ],
        fee: null,
        url: 'https://www.google.com/maps/search/?api=1&query=代々木公園陸上競技場',
        appleUrl: 'https://maps.apple/p/_hGUm4ZFfggzGN'
    }
};

export function getSheetName(month) {
    return `${month}メニュー`; // e.g. "4月メニュー"
}

export const practiceData = {
    '4月': [
        {
            id: 1,
            date: '2025-04-28',
            dayOfWeek: '月',
            location: 'トラック',
            time: '17:00〜19:00',
            weather: '晴れ',
            menu: `【ウォームアップ】
ジョグ 2km
動的ストレッチ 10分

【メインセット】
400m × 8本
- レスト: 3分
- 目標タイム: 65〜68秒

【クールダウン】
ジョグ 1km + スタティックストレッチ`,
            pace: `400m: 65〜68秒/本\n平均ペース: 2:42〜2:50/km`,
            notes: `・雨天の場合は延期\n・心拍数を意識して走ること\n・水分補給をこまめに行う`,
        },
        {
            id: 2,
            date: '2025-04-23',
            dayOfWeek: '水',
            location: 'ロード',
            time: '17:00〜19:30',
            weather: '曇り',
            menu: `【ウォームアップ】
ジョグ 3km (easy)

【メインセット】
ペース走 10km
- 目標ペース: 4:10〜4:20/km

【クールダウン】
ウォーク 5分 + ストレッチ`,
            pace: `目標: 4:10〜4:20/km\n合計距離: 約13km`,
            notes: `・フォームチェック重点回\n・ストライドを意識する\n・シューズはレース用禁止`,
        },
        {
            id: 3,
            date: '2025-04-19',
            dayOfWeek: '土',
            location: 'トラック',
            time: '09:00〜12:00',
            weather: '晴れ',
            menu: `【ウォームアップ】
ジョグ 2km + ドリル

【メインセット】
200m × 12本
- レスト: 90秒
- 目標タイム: 30〜32秒

【クールダウン】
ジョグ 1km`,
            pace: `200m目標: 30〜32秒`,
            notes: `・スプリント練習のため十分なウォームアップを\n・着地を意識すること`,
        },
        {
            id: 4,
            date: '2025-04-14',
            dayOfWeek: '月',
            location: 'フィールド',
            time: '17:00〜19:00',
            weather: '晴れ',
            menu: `【ウォームアップ】
ジョグ 2km

【メインセット】
補強トレーニング
- スクワット 3×15
- ランジ 3×12
- プランク 3×60秒
- デッドリフト (軽め) 3×10

【クールダウン】
ストレッチ 15分`,
            pace: `−（筋トレのためペース指定なし）`,
            notes: `・重量は8割程度に抑える\n・フォームを崩さないこと\n・翌日の疲労度をモニタリング`,
        },
        {
            id: 5,
            date: '2025-04-07',
            dayOfWeek: '月',
            location: 'ロード',
            time: '17:00〜18:30',
            weather: '曇り',
            menu: `【ウォームアップ】
ウォーク 5分 + ジョグ 2km

【メインセット】
LSDラン 60分
- 目標ペース: 5:30〜6:00/km

【クールダウン】
ウォーク 5分`,
            pace: `5:30〜6:00/km（有酸素ゾーン）`,
            notes: `・新学期最初の練習\n・無理せず自分のペースで\n・練習後にフィードバックシートを記入`,
        },
    ],
    '5月': [
        {
            id: 6,
            date: '2025-05-26',
            dayOfWeek: '月',
            location: 'トラック',
            time: '17:00〜19:00',
            weather: '晴れ',
            menu: `【ウォームアップ】
ジョグ 2km + ドリル

【メインセット】
1000m × 5本
- レスト: 4分
- 目標タイム: 3:00〜3:10

【クールダウン】
ジョグ 1.5km`,
            pace: `1000m目標: 3:00〜3:10/本`,
            notes: `・大会2週間前調整\n・ラスト2本はペースアップ\n・体調不良者は申し出ること`,
        },
        {
            id: 7,
            date: '2025-05-21',
            dayOfWeek: '水',
            location: 'トラック',
            time: '17:00〜19:00',
            weather: '晴れ',
            menu: `【ウォームアップ】
ジョグ 2km + A-skip, B-skip

【メインセット】
インターバル走
600m × 6本
- レスト: 2分30秒

【クールダウン】
ジョグ 1km + 股関節ストレッチ`,
            pace: `600m目標: 1:48〜1:54`,
            notes: `・腕振りフォームチェックあり\n・コーチが動画撮影予定`,
        },
        {
            id: 8,
            date: '2025-05-14',
            dayOfWeek: '水',
            location: 'ロード',
            time: '17:00〜18:30',
            weather: '雨',
            menu: `【代替メニュー（雨天のため）】
室内補強 + トレッドミル

補強:
- コアトレーニング 20分
- 体幹ローテーション 3×15

トレッドミル:
- 5km (easy, 5:00/km)`,
            pace: `5:00/km (easy)`,
            notes: `・雨天代替メニュー\n・室内シューズに履き替えること\n・床を濡らさないよう注意`,
        },
        {
            id: 9,
            date: '2025-05-07',
            dayOfWeek: '水',
            location: 'トラック',
            time: '17:00〜20:00',
            weather: '晴れ',
            menu: `【ウォームアップ】
ジョグ 2km

【メインセット】
タイムトライアル 3000m
- 全力走

【クールダウン】
ジョグ 2km + 十分なストレッチ`,
            pace: `目標: 自己ベスト更新`,
            notes: `・GW明け最初の練習\n・計測結果を記録シートに記入\n・体調に合わせて判断すること`,
        },
    ],
};

export const mockScheduleData = [
    {
        id: 'mock-s-1',
        type: 'event', // 大会・行事
        date: '2026-05-21',
        endDate: '2026-05-24',
        displayDate: '5/21～5/24',
        name: '関東インカレ',
        location: '国立競技場',
        dayOfWeek: '',
    },
    {
        id: 'mock-s-2',
        type: 'event', // 大会・行事
        date: '2026-04-19',
        endDate: null,
        displayDate: '4/19',
        name: '春季オープン',
        location: '武蔵野',
        dayOfWeek: '',
    },
    {
        id: 'mock-s-3',
        type: 'record', // 記録会
        date: '2026-04-04',
        endDate: null,
        displayDate: '4/4',
        name: '長距離記録会 第1回',
        entryPeriod: '2/25〜3/11',
        location: '',
        dayOfWeek: '',
    },
    {
        id: 'mock-s-4',
        type: 'record', // 記録会
        date: '2026-05-18',
        endDate: null,
        displayDate: '5/18',
        name: '長距離記録会 第2回',
        entryPeriod: '4/1〜4/15',
        location: '',
        dayOfWeek: '',
    }
];

export const locationColors = {
    'トラック': { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
    'ロード': { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
    'フィールド': { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
};
