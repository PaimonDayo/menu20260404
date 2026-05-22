/**
 * スプレッドシートの設定
 *
 * SPREADSHEET_ID: GoogleスプレッドシートのURLの /d/ と /edit の間の文字列
 * 例: https://docs.google.com/spreadsheets/d/【ここ】/edit
 *
 * 月別メニューは「3月メニュー」「4月メニュー」のようなシート名で取得します。
 * 新しい月を追加する場合は、スプレッドシート側に「n月メニュー」シートを作成してください。
 *
 * ※ スプレッドシートの共有設定を「リンクを知っている全員が閲覧可能」にしてください。
 *    APIキーは不要です。
 */
export const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1uAo7E8_rMbUZlml1H0vj119htQeoa2eMWqASUXQTqgg/edit';

export const SPREADSHEET_ID = (() => {
  const match = SPREADSHEET_URL.match(/\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : SPREADSHEET_URL;
})();

export const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbwkaaeMPrGiahDmrw0vb4GC3VwmNCjn2nem8JzsfUdx0n8hOJmKFCqL2HwudzsqJFQ/exec';
