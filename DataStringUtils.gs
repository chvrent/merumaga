/**
 * DataStringUtils.gs
 * 文字列・セル正規化 / 日付パース・フォーマット
 */

// ---- 文字列・セル正規化 ----

function normalizeCell_(value) {
  if (value == null) return '';
  const text = String(value).trim();
  return text === '#REF!' || text === '#VALUE!' ? '' : text;
}

function normalizeIdKey_(value) {
  const text = normalizeCell_(value);
  const numericTextMatch = text.match(/^(\d+)\.0+$/);
  return numericTextMatch ? numericTextMatch[1] : text;
}

// 【正本】クライアント側の normalizeIdKey() と同じロジック
// Sheets が数値ID を 5.0 で返す場合、5 に統一する
// 参照: ClientUtils.html normalizeIdKey()

function isTruthy_(value) {
  const text = normalizeCell_(value).toLowerCase();
  return ['true', 'yes', '1', '確定済', 'fixed', 'lock', 'locked'].indexOf(text) !== -1 || value === true;
}

function isBooleanText_(value) {
  const text = normalizeCell_(value).toLowerCase();
  return ['true', 'false'].indexOf(text) !== -1 || value === true || value === false;
}

function toAliasList_(aliases) {
  if (Array.isArray(aliases)) return aliases;
  if (aliases == null || aliases === '') return [];
  return [String(aliases)];
}

function isMasterObjectInactive_(row, aliases) {
  return isTruthy_(getObjectFieldByAliases_(row, aliases || ['is_inactive', '配信停止', '停止', '無効']));
}

// ---- 日付パース・フォーマット ----

function parseScheduleDate_(value) {
  const text = normalizeCell_(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const parts = text.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(text)) {
    const parts = text.split('/').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (!Number.isNaN(serial) && serial > 20000) {
      return new Date(1899, 11, 30 + serial);
    }
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function parseDateTime_(value) {
  const text = normalizeCell_(value);
  if (!text) return null;
  const normalized = text.replace(/\//g, '-').replace(' ', 'T');
  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const match = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]));
}

function formatDate_(date) {
  return Utilities.formatDate(date, Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy-MM-dd');
}

function getWeekdayLabelForDate_(dateStr) {
  const date = parseScheduleDate_(dateStr);
  if (!date) return '';
  return ['日', '月', '火', '水', '木', '金', '土'][date.getDay()];
}

function normalizeScheduleIdForMove_(scheduleId) {
  const value = normalizeCell_(scheduleId);
  if (!value) return '';
  const parts = value.split('|');
  if (parts.length >= 2 && /^\d{4}-\d{2}-\d{2}$/.test(parts[parts.length - 1])) {
    return parts.slice(0, -1).join('|');
  }
  return value;
}

// ---- 日付正規化（クライアント・サーバー共通） ----

/**
 * 日付文字列を YYYY-MM-DD 形式に正規化
 * @param {*} value - 入力値（様々な形式に対応）
 * @returns {string} YYYY-MM-DD 形式の日付、または元の値（パース不可な場合）
 */
function normalizeDateString_(value) {
  const text = String(value == null ? '' : value).trim();
  if (!text) return '';
  // 既に YYYY-MM-DD 形式ならそのまま返す
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  // YYYY/M/D 形式を YYYY-MM-DD に変換
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(text)) {
    const parts = text.split('/');
    return `${parts[0]}-${String(parts[1]).padStart(2, '0')}-${String(parts[2]).padStart(2, '0')}`;
  }
  // Excelシリアル形式（20000以上の数字）を日付に変換
  if (/^\d+(\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (!Number.isNaN(serial) && serial > 20000) {
      const utc = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      return formatDate_(utc);
    }
  }
  // Date オブジェクトの場合
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDate_(value);
  }
  // その他の文字列をパース試行
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return formatDate_(parsed);
}

/**
 * サイクルラベルを正規化（日本語表記を内部コードに統一）
 * @param {*} value - サイクル値（「隔週A」「月末」「第1週」など）
 * @returns {string} 正規化されたサイクルコード（A, B, M1, M2, M3, M4, 毎日, 毎月, 月末, 単発など）
 */
function normalizeCycleLabel_(value) {
  const text = String(value == null ? '' : value).trim();
  if (!text || text === '毎週' || text === '毎週配信') return '';
  if (text === '単発') return text;
  if (text === '毎日' || text === '毎日配信') return '毎日';
  if (text === '毎月' || text === '毎月配信') return '毎月';
  if (text === '月末' || text === '月末増発') return '月末';
  // 毎月第N週（M1〜M4）
  if (text.includes('第1週')) return 'M1';
  if (text.includes('第2週')) return 'M2';
  if (text.includes('第3週')) return 'M3';
  if (text.includes('第4週')) return 'M4';
  // 隔週パターン
  if (text.includes('隔週配信A') || text.includes('隔週A') || text === 'A') return 'A';
  if (text.includes('隔週配信B') || text.includes('隔週B') || text === 'B') return 'B';
  // 数値のみの場合は抽出
  const match = text.match(/(\d+)/);
  return match ? String(Number(match[1])) : text;
}

// ---- 曜日正規化 ----

/**
 * 曜日ラベルを日本語に正規化
 * @param {*} value - 曜日値（sun/sunday/日 など）
 * @returns {string} 日本語曜日（日月火水木金土）
 */
function normalizeWeekdayLabel_(value) {
  const text = String(value == null ? '' : value).trim();
  if (!text) return '';
  const lower = text.toLowerCase();
  const map = {
    sun: '日',
    sunday: '日',
    '日': '日',
    mon: '月',
    monday: '月',
    '月': '月',
    tue: '火',
    tues: '火',
    tuesday: '火',
    '火': '火',
    wed: '水',
    wednesday: '水',
    '水': '水',
    thu: '木',
    thur: '木',
    thurs: '木',
    thursday: '木',
    '木': '木',
    fri: '金',
    friday: '金',
    '金': '金',
    sat: '土',
    saturday: '土',
    '土': '土'
  };
  return map[lower] || map[text] || text;
}
