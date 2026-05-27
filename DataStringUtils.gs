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
