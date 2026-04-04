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

// ── メインのフェッチ関数 ──────────────────────────────────────────────────────

/**
 * 指定月の練習データをスプレッドシートから取得する。
 * GIDが config.js に登録されている場合は GID を使用（型推論なし）。
 * 未登録の場合はシート名フォールバック（一部ブラウザ・環境で動作しない可能性あり）。
 */
export async function fetchPracticeData(month) {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'ここにスプレッドシートIDを入力') {
    throw new Error('config.js にスプレッドシートIDが設定されていません。');
  }

  const gid = SHEET_GIDS[month];
  let url;
  if (gid != null) {
    // GIDが分かっている場合: 型推論なしの生CSVエクスポート
    url = `${BASE_URL}/${SPREADSHEET_ID}/export?format=csv&gid=${gid}`;
  } else {
    // GID不明の場合: シート名フォールバック（gviz は使わない）
    const sheetName = encodeURIComponent(`${month}メニュー`);
    url = `${BASE_URL}/${SPREADSHEET_ID}/export?format=csv&sheet=${sheetName}`;
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
      const isMatch  = cVal && !/^\d{1,2}:\d{2}$/.test(cVal); // 時刻以外 = 試合名

      return location || menu || isMatch;
    })
    .map((row, i) => ({
      id:        i + 1,
      date:      parseSheetDate(row[0] ?? ''),
      dayOfWeek: (row[1] ?? '').trim(),
      time:      formatTime(row[2] ?? ''),       // 試合名もここに入る
      location:  (row[3] ?? '').trim(),
      weather:   '',
      menu:      (row[4] ?? '').replace(/\\n/g, '\n'),
      pace:      (row[5] ?? '').replace(/\\n/g, '\n'),
      notes:     (row[6] ?? '').replace(/\\n/g, '\n'),
    }));
}

export function hasConfig() {
  return Boolean(SPREADSHEET_ID && SPREADSHEET_ID !== 'ここにスプレッドシートIDを入力');
}
