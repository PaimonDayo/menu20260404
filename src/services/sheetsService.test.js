import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import {
  parseCsv,
  parseSheetDate,
  parseScheduleRange,
  parseDistanceValue,
  getEntryPeriodStatus,
} from './sheetsService';

// 日付依存の関数を決定的にテストするため、システム時刻を固定する
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-06-11T12:00:00'));
});

afterAll(() => {
  vi.useRealTimers();
});

describe('parseCsv', () => {
  it('単純なCSVを行列に変換する', () => {
    expect(parseCsv('a,b\nc,d')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('クォート内のカンマを保持する', () => {
    expect(parseCsv('a,"b,c"')).toEqual([['a', 'b,c']]);
  });

  it('クォート内の改行を保持する', () => {
    expect(parseCsv('"1行目\n2行目",x')).toEqual([['1行目\n2行目', 'x']]);
  });

  it('二重クォートのエスケープを解決する', () => {
    expect(parseCsv('"He said ""hi""",y')).toEqual([['He said "hi"', 'y']]);
  });

  it('CRLF改行を処理する', () => {
    expect(parseCsv('a,b\r\nc,d')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('末尾に改行がなくても最終行を返す', () => {
    expect(parseCsv('a,b\nc,d\n')).toEqual([['a', 'b'], ['c', 'd']]);
  });
});

describe('parseSheetDate', () => {
  it('M/D 形式は現在の年で補完する', () => {
    expect(parseSheetDate('4/19')).toBe('2026-04-19');
  });

  it('YYYY/M/D 形式をパースする', () => {
    expect(parseSheetDate('2026/4/19')).toBe('2026-04-19');
  });

  it('YYYY-MM-DD 形式はそのまま返す', () => {
    expect(parseSheetDate('2026-04-19')).toBe('2026-04-19');
  });

  it('時刻部分が付いていても除去する', () => {
    expect(parseSheetDate('2026/4/19 0:00:00')).toBe('2026-04-19');
  });
});

describe('parseScheduleRange', () => {
  it('単日の日付をパースする', () => {
    const result = parseScheduleRange('2026', '1/17');
    expect(result.startDate).toBe('2026-01-17');
    expect(result.endDate).toBeNull();
  });

  it('月またぎでない範囲（11/13～15）をパースする', () => {
    const result = parseScheduleRange('2026', '11/13～15');
    expect(result.startDate).toBe('2026-11-13');
    expect(result.endDate).toBe('2026-11-15');
  });

  it('月/日が両方ある範囲（5/21～5/24）をパースする', () => {
    const result = parseScheduleRange('2026', '5/21～5/24');
    expect(result.startDate).toBe('2026-05-21');
    expect(result.endDate).toBe('2026-05-24');
  });

  it('波ダッシュのゆらぎ（〜と~）を受け付ける', () => {
    expect(parseScheduleRange('2026', '5/21〜5/24').endDate).toBe('2026-05-24');
    expect(parseScheduleRange('2026', '5/21~5/24').endDate).toBe('2026-05-24');
  });

  it('日付でない文字列には null を返す', () => {
    expect(parseScheduleRange('2026', '未定')).toBeNull();
    expect(parseScheduleRange('2026', '')).toBeNull();
  });
});

describe('parseDistanceValue', () => {
  it('数値をそのまま返す', () => {
    expect(parseDistanceValue('8.5')).toBe(8.5);
  });

  it('括弧の注記を除去する', () => {
    expect(parseDistanceValue('12 (1000m x 5)')).toBe(12);
  });

  it('+ 区切りを合計する（括弧付き）', () => {
    expect(parseDistanceValue('5+5(jog)')).toBe(10);
  });

  it('全角数字・全角プラスを変換して合計する', () => {
    expect(parseDistanceValue('５＋３')).toBe(8);
  });

  it('カンマ区切りも合計する', () => {
    expect(parseDistanceValue('3,2')).toBe(5);
  });

  it('閉じ括弧がない場合は以降を切り捨てる', () => {
    expect(parseDistanceValue('10(1000m')).toBe(10);
  });

  it('数値がなければ 0 を返す', () => {
    expect(parseDistanceValue('jog')).toBe(0);
    expect(parseDistanceValue('')).toBe(0);
    expect(parseDistanceValue(undefined)).toBe(0);
  });
});

describe('getEntryPeriodStatus', () => {
  // システム時刻は 2026-06-11 に固定されている
  it('期間中なら active を返す', () => {
    expect(getEntryPeriodStatus('6/1〜6/20', '2026')).toBe('active');
  });

  it('開始前なら upcoming を返す', () => {
    expect(getEntryPeriodStatus('7/1〜7/10', '2026')).toBe('upcoming');
  });

  it('終了後なら past を返す', () => {
    expect(getEntryPeriodStatus('5/1〜5/10', '2026')).toBe('past');
  });

  it('境界日（開始日・終了日当日）は active を返す', () => {
    expect(getEntryPeriodStatus('6/11〜6/20', '2026')).toBe('active');
    expect(getEntryPeriodStatus('6/1〜6/11', '2026')).toBe('active');
  });

  it('期間でない文字列には null を返す', () => {
    expect(getEntryPeriodStatus('', '2026')).toBeNull();
    expect(getEntryPeriodStatus('未定', '2026')).toBeNull();
  });
});
