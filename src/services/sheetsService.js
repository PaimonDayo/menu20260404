/**
 * Google Sheets からCSVを取得するサービス。
 *
 * GIDベースの /export?format=csv&gid=XXXX を使用。
 * gviz/tq は時刻型列の文字列（試合名など）を null に変換するため使用しない。
 * /export URL は型推論なしで生のセル値をCSVとして返す。
 *
 * APIキー不要。共有設定:「リンクを知っている全員が閲覧可能」のみ必要。
 *
 * スプレッドシートの列構成（A5行目からデータ開始）:
 * A: 日付 (例: 4/19)
 * B: 曜日
 * C: 時間 (例: 17:00) または 試合名 (例: 科学大戦)
 * D: 場所 (例: 武蔵野)
 * E: メニュー（複数行）
 * F: ペース（複数行）
 * G: 補足（複数行）
 */

import { SPREADSHEET_ID, GAS_API_URL } from '../config';

const BASE_URL = 'https://docs.google.com/spreadsheets/d';

// Promiseをキャッシュすることで、並列呼び出し時もhtmlviewの取得が1回で済む
let sheetMetaPromise = null;

function fetchSheetMetaList() {
  if (sheetMetaPromise) return sheetMetaPromise;

  sheetMetaPromise = (async () => {
    const url = `${BASE_URL}/${SPREADSHEET_ID}/htmlview`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`シート一覧の取得に失敗しました (${res.status})`);
    }

    const html = await res.text();
    if (html.trimStart().startsWith('<!DOCTYPE') && html.includes('エラー')) {
      throw new Error('シート一覧の取得に失敗しました。共有設定を確認してください。');
    }

    const regex = /items\.push\(\s*({[^}]+})\s*\)/g;
    const sheets = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      const objText = match[1];
      const nameMatch = /name:\s*"([^"]+)"/.exec(objText);
      const gidMatch = /gid:\s*"([^"]+)"/.exec(objText);
      if (nameMatch && gidMatch) {
        sheets.push({ name: nameMatch[1], gid: gidMatch[1] });
      }
    }

    return sheets;
  })().catch(err => {
    sheetMetaPromise = null; // 失敗時はキャッシュを破棄し、次回リトライ可能にする
    throw err;
  });

  return sheetMetaPromise;
}

async function findSheetGidByName(sheetName) {
  const sheets = await fetchSheetMetaList();
  const exact = sheets.find(sheet => sheet.name === sheetName);
  return exact ? exact.gid : null;
}

async function fetchCsvByGid(gid, timestamp) {
  const cacheBuster = timestamp ? `&t=${timestamp}` : '';
  const url = `${BASE_URL}/${SPREADSHEET_ID}/export?format=csv&gid=${gid}${cacheBuster}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`スプレッドシートの取得に失敗しました (${res.status})`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  const text = await res.text();
  if (contentType.includes('text/html') || text.trimStart().startsWith('<!DOCTYPE')) {
    throw new Error('スプレッドシートのCSV取得に失敗しました。共有設定を確認してください。');
  }
  return text;
}

async function readJsonResponse(response, actionLabel) {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();

  if (contentType.includes('text/html') || text.trimStart().startsWith('<!DOCTYPE')) {
    const extracted = text
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const message = extracted.includes('アクセスする権限がありません')
      ? 'GAS Web App にアクセス権限がありません。デプロイURLまたは公開設定を確認してください。'
      : 'GAS Web App がJSONではなくHTMLを返しています。デプロイ状態を確認してください。';
    throw new Error(`${actionLabel}: ${message}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${actionLabel}: GAS Web App のレスポンスをJSONとして解析できません。`);
  }
}

// ── CSV パーサー ──────────────────────────────────────────────────────────────

/** CSVテキストを行の配列に変換（ダブルクォート内の改行・カンマに対応） */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') { inQuote = false; }
      else { cell += ch; }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
      else if (ch === '\r') { /* skip */ }
      else { cell += ch; }
    }
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

// ── 日付・時刻ヘルパー ────────────────────────────────────────────────────────

/**
 * "M/D", "YYYY/M/D", "YYYY-MM-DD" → "YYYY-MM-DD" に統一。
 * /export CSV は日付を "2026/4/19" 形式で返すことが多い。
 */
function parseSheetDate(raw) {
  // 時刻部分（" 0:00:00"）がついている場合は除去
  let s = raw.trim().split(' ')[0];
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parts = s.split('/').map(p => p.trim());
  const year = new Date().getFullYear();
  if (parts.length === 2) {
    return `${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
  }
  if (parts.length === 3) {
    return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
  }
  return s;
}

/** "17:00:00" → "17:00"（秒を除去）。時刻以外の文字列はそのまま返す。 */
function formatTime(raw) {
  if (!raw) return '';
  return raw.trim().replace(/^(\d{1,2}:\d{2}):\d{2}$/, '$1');
}

/**
 * 日程一覧の日付文字列（「5/21～5/24」「11/13～15」「1/17」等）をパースし、
 * YYYY-MM-DD 形式の開始日と終了日を返す。
 */
function parseScheduleRange(yearStr, dateStr) {
  if (!dateStr) return null;
  const normalized = dateStr.replace(/[〜~]/g, '～').replace(/\s+/g, '');
  const parts = normalized.split('～');
  
  const startMatch = parts[0].match(/(\d{1,2})\/(\d{1,2})/);
  if (!startMatch) return null;
  
  const startMonth = startMatch[1];
  const startDay = startMatch[2];
  const startIso = `${yearStr}-${startMonth.padStart(2, '0')}-${startDay.padStart(2, '0')}`;
  
  const getW = (iso) => {
    const d = new Date(iso);
    return ['日','月','火','水','木','金','土'][d.getDay()];
  };
  const startW = getW(startIso);
  
  let endIso = null;
  let endW = '';
  if (parts.length > 1 && parts[1]) {
    const endMatch = parts[1].match(/(\d{1,2})\/(\d{1,2})/);
    if (endMatch) {
      endIso = `${yearStr}-${endMatch[1].padStart(2, '0')}-${endMatch[2].padStart(2, '0')}`;
      endW = getW(endIso);
    } else {
      const endDayMatch = parts[1].match(/(\d{1,2})/);
      if (endDayMatch) {
        endIso = `${yearStr}-${startMonth.padStart(2, '0')}-${endDayMatch[1].padStart(2, '0')}`;
        endW = getW(endIso);
      }
    }
  }
  
  let displayDate = `${startMonth}月${startDay}日（${startW}）`;
  if (endIso) {
    const endM = parseInt(endIso.split('-')[1], 10);
    const endD = parseInt(endIso.split('-')[2], 10);
    const endPart = endM === parseInt(startMonth, 10) ? `${endD}日（${endW}）` : `${endM}月${endD}日（${endW}）`;
    displayDate += `～${endPart}`;
  }
  
  return { startDate: startIso, endDate: endIso, displayDate };
}

/**
 * エントリー期間のステータスを判定して返す。
 * periodStr: "2/25〜3/11"
 * itemYear: その行事自体の年（2026など）
 * returns: 'active' (募集中), 'upcoming' (開始前), 'past' (終了), or null
 */
export function getEntryPeriodStatus(periodStr, itemYear) {
  if (!periodStr) return null;
  const today = new Date();
  const currentYear = today.getFullYear();
  const refYear = itemYear ? parseInt(itemYear) : currentYear;
  
  const normalized = periodStr.replace(/[〜~]/g, '～').replace(/\s+/g, '');
  const parts = normalized.split('～');
  if (parts.length < 2) return null;

  const parseMD = (s, baseYear) => {
    const m = s.match(/(\d{1,2})\/(\d{1,2})/);
    if (!m) return null;
    return new Date(baseYear, parseInt(m[1]) - 1, parseInt(m[2]));
  };

  let start = parseMD(parts[0], refYear);
  let end = parseMD(parts[1], refYear);
  
  if (!start || !end) return null;
  
  if (start > end) {
    start = parseMD(parts[0], refYear - 1);
  }
  
  // 今日の日付（時刻なし）
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  if (t < start) return 'upcoming';
  if (t > end) return 'past';
  return 'active';
}

/** 既存の呼び出し元への互換性維持（募集中かどうか） */
export function isWithinEntryPeriod(periodStr, itemYear) {
  return getEntryPeriodStatus(periodStr, itemYear) === 'active';
}

// ── メインのフェッチ関数 ──────────────────────────────────────────────────────

/**
 * 指定月の練習データをスプレッドシートから取得する。
 * GIDが config.js に登録されている場合は GID を使用（型推論なし）。
 * 未登録の場合はシート名フォールバック（一部ブラウザ・環境で動作しない可能性あり）。
 */
export async function fetchPracticeData(month, timestamp) {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'ここにスプレッドシートIDを入力') {
    throw new Error('config.js にスプレッドシートIDが設定されていません。');
  }

  if (GAS_API_URL && GAS_API_URL.trim() !== '') {
    try {
      const gasUrl = `${GAS_API_URL}?action=fetchPractice&month=${encodeURIComponent(month)}${timestamp ? `&t=${timestamp}` : ''}`;
      const gasRes = await fetch(gasUrl);
      if (gasRes.ok) {
        const json = await gasRes.json();
        if (Array.isArray(json?.data)) {
          // IDは月をまたいで一意にする（月別に連番を振ると他の月と衝突するため）
          return json.data.map((item, i) => ({ ...item, id: `${month}-${i + 1}` }));
        }
      }
    } catch (err) {
      console.warn('GAS経由の練習メニュー取得に失敗しました。CSV取得へフォールバックします。', err);
    }
  }

  const rawMonthLabel = String(month).trim().replace(/メニュー$/, '');
  const monthLabel = rawMonthLabel.endsWith('月') ? rawMonthLabel : `${rawMonthLabel}月`;
  const targetSheetName = `${monthLabel}メニュー`;
  const gid = await findSheetGidByName(targetSheetName);
  if (!gid) {
    throw new Error(`${targetSheetName} シートが見つかりません。`);
  }

  const text = await fetchCsvByGid(gid, timestamp);

  const allRows = parseCsv(text);

  // データ開始行を自動検出（最初のA列が日付形式の行から開始）
  const dataStart = allRows.findIndex(
    row => /^\d{1,4}\/\d{1,2}/.test(row[0]?.trim() ?? '')
  );
  const dataRows = dataStart >= 0 ? allRows.slice(dataStart) : allRows.slice(4);

  return dataRows
    .filter(row => {
      const dateVal = row[0]?.trim();
      if (!dateVal) return false;

      const location = (row[3] ?? '').trim();   // D: 場所
      const menu     = (row[4] ?? '').trim();   // E: メニュー

      return location || menu;
    })
    .map((row, i) => {
      const dateStr = parseSheetDate(row[0] ?? '');
      const locStr = (row[3] ?? '').trim();

      return {
        id:        `${month}-${i + 1}`,
        date:      dateStr,
        dayOfWeek: (row[1] ?? '').trim(),
        time:      formatTime(row[2] ?? ''),
        location:  locStr,
        weather:   '',
        menu:      (row[4] ?? '').replace(/\\n/g, '\n'),
        pace:      (row[5] ?? '').replace(/\\n/g, '\n'),
        notes:     (row[6] ?? '').replace(/\\n/g, '\n'),
      };
    });
}

/**
 * 日程一覧（行事・大会および記録会）を取得する。
 */
export async function fetchScheduleData(timestamp) {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'ここにスプレッドシートIDを入力') {
    return [];
  }

  try {
    const gid = await findSheetGidByName('日程一覧');
    if (!gid) return [];

    const text = await fetchCsvByGid(gid, timestamp);

    const allRows = parseCsv(text);
    // 3行目（インデックス2）からデータ開始
    const dataRows = allRows.slice(2);
    
    const schedules = [];
    let idCounter = 10000; // 練習メニューのIDと被らないように大きめの数
    let lastSeenYear = '';

    for (const row of dataRows) {
      const yearRaw = (row[0] ?? '').trim();
      if (yearRaw && /^\d{4}$/.test(yearRaw)) {
        lastSeenYear = yearRaw;
      }
      const year = lastSeenYear;
      
      if (!year) continue;

      // --- 大会・行事のパース (B, C, D) ---
      const eventDateRaw = (row[1] ?? '').trim();
      const eventName = (row[2] ?? '').trim();
      const eventLocation = (row[3] ?? '').trim();

      if (eventName && eventDateRaw) {
        const parsed = parseScheduleRange(year, eventDateRaw);
        if (parsed) {
          schedules.push({
            id: ++idCounter,
            type: 'event', // 大会・行事
            date: parsed.startDate,
            endDate: parsed.endDate,
            displayDate: parsed.displayDate,
            name: eventName,
            location: eventLocation,
            dayOfWeek: '', // 日程一覧からは取れないので空
          });
        }
      }

      // --- 長距離記録会のパース (F, G, H) ---
      const recordName = (row[5] ?? '').trim();
      const recordDateRaw = (row[6] ?? '').trim();
      const entryPeriod = (row[7] ?? '').trim();

      if (recordName && recordDateRaw) {
        const parsed = parseScheduleRange(year, recordDateRaw);
        if (parsed) {
          schedules.push({
            id: ++idCounter,
            type: 'record', // 記録会
            date: parsed.startDate,
            endDate: parsed.endDate,
            displayDate: parsed.displayDate,
            name: recordName,
            entryPeriod: entryPeriod,
            location: '', // 記録会には場所がない
            dayOfWeek: '',
          });
        }
      }
    }
    
    return schedules.sort((a, b) => a.date.localeCompare(b.date));
  } catch (e) {
    console.warn('日程一覧の取得に失敗しました', e);
    return [];
  }
}

export function hasConfig() {
  return Boolean(SPREADSHEET_ID && SPREADSHEET_ID !== 'ここにスプレッドシートIDを入力');
}

/**
 * 全シート名とGIDのリストをhtmlviewから抽出する。
 * B+数字 または M+数字 で始まるシート（部員個人シート）を自動選別する。
 */
export async function fetchSheetList() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'ここにスプレッドシートIDを入力') {
    return [];
  }
  const sheets = await fetchSheetMetaList();
  return sheets.filter(sheet => /^[BM]\d/.test(sheet.name));
}

/**
 * 特定の部員シート（GID）から練習データを取得してパースする。
 * ヘッダーに '低強度(jog)' または '低強度' が含まれていない場合は短距離とみなし null を返す。
 */
export async function fetchMemberPracticeData(gid, timestamp) {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'ここにスプレッドシートIDを入力') {
    return null;
  }
  const cacheBuster = timestamp ? `&t=${timestamp}` : '';
  const url = `${BASE_URL}/${SPREADSHEET_ID}/export?format=csv&gid=${gid}${cacheBuster}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`メンバーデータの取得に失敗しました (${res.status})`);
  }
  const text = await res.text();
  const rows = parseCsv(text);

  // 最初の15行からヘッダー行（'低強度' を含む行）を検出
  const headerIdx = rows.slice(0, 15).findIndex(r => r.some(cell => cell.includes('低強度')));
  if (headerIdx === -1) {
    // '低強度' 列がない場合は短距離等とみなし null を返す
    return null;
  }

  const header = rows[headerIdx];
  const jogCol   = header.findIndex(cell => cell.includes('低強度'));
  const mltCol   = header.findIndex(cell => cell.includes('中強度'));
  const cvCol    = header.findIndex(cell => cell.includes('高強度'));
  const speedCol = header.findIndex(cell => cell.includes('解糖系'));
  // まず「実際の距離」を最優先で検索し、なければ完全一致で「距離」を検索（「目標距離」等への誤マッチを防止）
  let totalCol = header.findIndex(cell => cell.includes('実際の距離'));
  if (totalCol === -1) {
    totalCol = header.findIndex(cell => cell.trim() === '距離');
  }
  const stridesCol   = header.findIndex(cell => cell.includes('流し'));
  const reinforceCol = header.findIndex(cell => cell.includes('補強'));
  const resultCol    = header.findIndex(cell => cell.includes('結果') || cell.includes('ペース'));
  let commentCol = header.findIndex(cell => cell.includes('感想') || cell.includes('コメント'));
  if (commentCol === -1) {
    commentCol = 17;
  }

  const getReplies = (row) => {
    const replies = [];
    const startCol = commentCol !== -1 ? commentCol + 1 : header.length;
    for (let col = startCol; col < Math.max(header.length, row.length); col++) {
      const headerText = (header[col] ?? '').trim();
      if (headerText) continue;
      const text = row[col]?.trim() ?? '';
      if (text) replies.push(text);
    }
    return replies;
  };

  const dataRows = rows.slice(headerIdx + 1);
  const records = [];

  for (const row of dataRows) {
    const dateRaw = row[0]?.trim();
    if (!dateRaw || !/^\d{1,2}\/\d{1,2}/.test(dateRaw)) continue; // 有効な日付形式でなければスキップ

    const dateStr = parseSheetDate(dateRaw); // YYYY-MM-DD 形式にパース

    const parseVal = (val) => {
      if (!val) return 0;
      
      // 1. 全角英数字、全角記号を半角に標準化
      let cleanVal = val.trim().replace(/[０-９．＋，、（）]/g, (s) => {
        if (s === '．') return '.';
        if (s === '＋') return '+';
        if (s === '，' || s === '、') return ',';
        if (s === '（') return '(';
        if (s === '）') return ')';
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
      });

      // 2. 括弧とその中身を完全に除去（例: "12 (1000m x 5)" -> "12 ", "5+5(jog)" -> "5+5"）
      while (cleanVal.includes('(')) {
        const start = cleanVal.indexOf('(');
        const end = cleanVal.indexOf(')', start);
        if (end !== -1) {
          cleanVal = cleanVal.substring(0, start) + cleanVal.substring(end + 1);
        } else {
          // 閉じ括弧がない場合は、開き括弧以降をすべて切り落とす
          cleanVal = cleanVal.substring(0, start);
          break;
        }
      }

      // 3. + や , で分割してそれぞれをパースし、合計する
      const parts = cleanVal.split(/[+,]/);
      let sum = 0;
      for (const part of parts) {
        let p = part.trim();
        // 数字とピリオド以外を完全に除去
        p = p.replace(/[^\d.]/g, '');
        if (!p) continue;
        const num = parseFloat(p);
        if (!isNaN(num)) {
          sum += num;
        }
      }
      return sum;
    };


    const jogRaw = jogCol !== -1 ? parseVal(row[jogCol]) : 0;
    const mlt    = mltCol !== -1 ? parseVal(row[mltCol]) : 0;
    const cv     = cvCol !== -1 ? parseVal(row[cvCol]) : 0;
    const speed  = speedCol !== -1 ? parseVal(row[speedCol]) : 0;
    const actual = (totalCol !== -1 && row[totalCol]) ? parseVal(row[totalCol]) : 0;

    const sumIntensities = jogRaw + mlt + cv + speed;
    let jog = jogRaw;
    let total = 0;

    if (sumIntensities > 0) {
      if (actual > sumIntensities) {
        // 実際の距離が強度の合計より大きい場合（内訳不足）
        // 総走行距離は「実際の距離」を採用し、差分はダッシュボード側で自動的に「その他」として色付けされる
        total = actual;
      } else {
        // 強度別の合計を優先（二重カウントや余計な「その他」を排除）
        total = sumIntensities;
      }
    } else if (actual > 0) {
      // 実際の距離のみ記入されている場合（救済措置）
      // 走行距離の漏れを防ぐため採用。内訳は 0 のままとし、自動的に「その他」としてカウントさせる
      total = actual;
    }

    const strides = stridesCol !== -1 ? parseVal(row[stridesCol]) : 0;
    const reinforce = reinforceCol !== -1 ? (row[reinforceCol]?.trim() ?? '') : '';
    const result = resultCol !== -1 ? (row[resultCol]?.trim() ?? '') : '';
    const comment = commentCol !== -1 ? (row[commentCol]?.trim() ?? '') : '';
    const replies = getReplies(row);

    if (total > 0 || jog > 0 || mlt > 0 || cv > 0 || speed > 0 || strides > 0 || reinforce || result || comment || replies.length > 0) {
      records.push({
        date: dateStr,
        total: Math.round(total * 100) / 100,
        jog: Math.round(jog * 100) / 100,
        mlt: Math.round(mlt * 100) / 100,
        cv: Math.round(cv * 100) / 100,
        speed: Math.round(speed * 100) / 100,
        strides,
        reinforce,
        result,
        comment,
        replies
      });
    }
  }

  return records;
}

export async function fetchAllMembersStats(bypassCache = false) {
  if (!GAS_API_URL || GAS_API_URL.trim() === '') {
    return null;
  }

  const cacheBuster = bypassCache ? '&bypassCache=true' : '';
  const url = `${GAS_API_URL}?action=fetchAll${cacheBuster}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GASデータの取得に失敗しました (${res.status})`);
  }
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    throw new Error('GAS Web App がJSONではなくHTMLを返しています。公開設定またはデプロイURLを確認してください。');
  }
  const json = await readJsonResponse(res, 'GASデータ取得');
  if (json?.error) {
    throw new Error(json.error);
  }
  return Array.isArray(json?.data) ? json.data : null;
}

export async function fetchLatestRecords({ limit = 30, bypassCache = false } = {}) {
  if (!GAS_API_URL || GAS_API_URL.trim() === '') {
    return null;
  }

  const params = new URLSearchParams({
    action: 'fetchLatestRecords',
    limit: String(limit),
  });
  if (bypassCache) {
    params.set('bypassCache', 'true');
  }

  const res = await fetch(`${GAS_API_URL}?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`GAS最近記録の取得に失敗しました (${res.status})`);
  }

  const json = await readJsonResponse(res, 'GAS最近記録取得');
  if (json?.error) {
    throw new Error(json.error);
  }
  return Array.isArray(json?.data) ? json.data : null;
}

export async function fetchMemberDayRecord(memberName, date) {
  if (!GAS_API_URL || GAS_API_URL.trim() === '') {
    return null;
  }

  const url = `${GAS_API_URL}?action=getRecord&memberName=${encodeURIComponent(memberName)}&date=${encodeURIComponent(date)}&t=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`既存データの取得に失敗しました (${res.status})`);
  }
  return await readJsonResponse(res, '既存記録取得');
}

export async function submitPracticeRecord(data) {
  if (!GAS_API_URL || GAS_API_URL.trim() === '') {
    throw new Error('config.js に GAS_API_URL が設定されていません。');
  }

  const response = await fetch(GAS_API_URL, {
    method: 'POST',
    mode: 'cors',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`記録の送信に失敗しました (${response.status})`);
  }

  const json = await readJsonResponse(response, '記録送信');
  if (json?.error) {
    throw new Error(json.error);
  }
  return json;
}

export async function submitRecordReply({ memberName, date, reply }) {
  if (!GAS_API_URL || GAS_API_URL.trim() === '') {
    throw new Error('config.js に GAS_API_URL が設定されていません。');
  }

  const response = await fetch(GAS_API_URL, {
    method: 'POST',
    mode: 'cors',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'addReply',
      memberName,
      date,
      reply,
    }),
  });

  if (!response.ok) {
    throw new Error(`リプライの送信に失敗しました (${response.status})`);
  }

  const json = await readJsonResponse(response, 'リプライ送信');
  if (json?.error) {
    throw new Error(json.error);
  }
  return json;
}

export function getReactionActorId() {
  const key = 'tf_reaction_actor_id';
  let actorId = localStorage.getItem(key);
  if (!actorId) {
    const randomPart = Math.random().toString(36).slice(2, 10);
    actorId = `device_${Date.now().toString(36)}_${randomPart}`;
    localStorage.setItem(key, actorId);
  }
  return actorId;
}

export async function fetchRecordReactions() {
  if (!GAS_API_URL || GAS_API_URL.trim() === '') {
    return [];
  }

  const res = await fetch(`${GAS_API_URL}?action=fetchReactions&t=${Date.now()}`);
  if (!res.ok) {
    throw new Error(`リアクションの取得に失敗しました (${res.status})`);
  }

  const json = await readJsonResponse(res, 'リアクション取得');
  if (json?.error) {
    throw new Error(json.error);
  }
  return Array.isArray(json?.reactions) ? json.reactions : [];
}

export async function toggleRecordReaction({ memberName, date, type }) {
  if (!GAS_API_URL || GAS_API_URL.trim() === '') {
    throw new Error('config.js に GAS_API_URL が設定されていません。');
  }

  const response = await fetch(GAS_API_URL, {
    method: 'POST',
    mode: 'cors',
    redirect: 'follow',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'toggleReaction',
      memberName,
      date,
      type,
      actorId: getReactionActorId(),
    }),
  });

  if (!response.ok) {
    throw new Error(`リアクションの送信に失敗しました (${response.status})`);
  }

  const json = await readJsonResponse(response, 'リアクション送信');
  if (json?.error) {
    throw new Error(json.error);
  }
  return json;
}
