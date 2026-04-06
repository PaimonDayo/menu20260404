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

import { SPREADSHEET_ID, SHEET_GIDS } from '../config';

const BASE_URL = 'https://docs.google.com/spreadsheets/d';

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

  const gid = SHEET_GIDS[month];
  const cacheBuster = timestamp ? `&t=${timestamp}` : '';
  let url;
  if (gid != null) {
    // GIDが分かっている場合: 型推論なしの生CSVエクスポート
    url = `${BASE_URL}/${SPREADSHEET_ID}/export?format=csv&gid=${gid}${cacheBuster}`;
  } else {
    // GID不明の場合: シート名フォールバック（gviz は使わない）
    const sheetName = encodeURIComponent(`${month}メニュー`);
    url = `${BASE_URL}/${SPREADSHEET_ID}/export?format=csv&sheet=${sheetName}${cacheBuster}`;
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      `スプレッドシートの取得に失敗しました (${res.status})。` +
      `共有設定を「リンクを知っている全員が閲覧可能」にしてください。`
    );
  }

  // レスポンスがHTMLの場合（リダイレクト・ログインページ）はエラーとする
  const contentType = res.headers.get('content-type') ?? '';
  const text = await res.text();
  if (contentType.includes('text/html') || text.trimStart().startsWith('<!DOCTYPE')) {
    throw new Error('スプレッドシートのCSV取得に失敗しました（共有設定を確認してください）。');
  }

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

      const cVal     = (row[2] ?? '').trim();   // C: 時間 or 試合名
      const location = (row[3] ?? '').trim();   // D: 場所
      const menu     = (row[4] ?? '').trim();   // E: メニュー

      return location || menu;
    })
    .map((row, i) => ({
      id:        i + 1,
      date:      parseSheetDate(row[0] ?? ''),
      dayOfWeek: (row[1] ?? '').trim(),
      time:      formatTime(row[2] ?? ''),
      location:  (row[3] ?? '').trim(),
      weather:   '',
      menu:      (row[4] ?? '').replace(/\\n/g, '\n'),
      pace:      (row[5] ?? '').replace(/\\n/g, '\n'),
      notes:     (row[6] ?? '').replace(/\\n/g, '\n'),
    }));
}

/**
 * 日程一覧（行事・大会および記録会）を取得する。
 */
export async function fetchScheduleData(timestamp) {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'ここにスプレッドシートIDを入力') {
    return [];
  }

  // GID不明の場合はシート名フォールバック
  const sheetName = encodeURIComponent('日程一覧');
  const cacheBuster = timestamp ? `&t=${timestamp}` : '';
  const url = `${BASE_URL}/${SPREADSHEET_ID}/export?format=csv&sheet=${sheetName}${cacheBuster}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    
    const contentType = res.headers.get('content-type') ?? '';
    const text = await res.text();
    if (contentType.includes('text/html') || text.trimStart().startsWith('<!DOCTYPE')) {
      return [];
    }

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
