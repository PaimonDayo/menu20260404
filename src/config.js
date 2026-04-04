/**
 * スプレッドシートの設定
 *
 * SPREADSHEET_ID: GoogleスプレッドシートのURLの /d/ と /edit の間の文字列
 * 例: https://docs.google.com/spreadsheets/d/【ここ】/edit
 *
 * SHEET_GIDS: 各月シートのGID（シートタブをクリックしたときのURLの #gid=XXXX の値）
 *   新しい月シートを追加したら、ここにも追加してください。
 *
 * ※ スプレッドシートの共有設定を「リンクを知っている全員が閲覧可能」にしてください。
 *    APIキーは不要です。
 */
export const SPREADSHEET_ID = '1uAo7E8_rMbUZlml1H0vj119htQeoa2eMWqASUXQTqgg';

export const SHEET_GIDS = {
  '3月': 678173586,
  '4月': 1778912983,
  '5月': 1041993577,
  '6月': 1888012997,
  '7月': 1687179879,
};
