/**
 * DataSheetAccess.gs
 * シートアクセス抽象層
 *
 * - シートヘッダー取得
 * - 入力制御シート読み込み
 * - シートオブジェクト取得（キャッシュ対応）
 * - 日本の祝日取得
 * - 運用日付レンジ計算
 * - ヘッダー列の自動追加
 */

function getSheetHeaders_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0]
    .map(header => String(header || '').trim())
    .filter(Boolean);
}

function getInputControlRows_() {
  const ss = getSourceSpreadsheet_();
  const sheetNames = ['入力制御', 'input_control', 'app_input_control'];
  let sheet = null;
  for (const name of sheetNames) {
    sheet = ss.getSheetByName(name);
    if (sheet) break;
  }
  if (!sheet) return [];

  const values = sheet.getDataRange().getDisplayValues();
  const rows = [];
  let section = '';
  for (let rowIndex = 0; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex].map(value => String(value || '').trim());
    if (row[0] && row.slice(1).every(value => !value)) {
      section = row[0];
      continue;
    }
    if (row[0] !== '画面' || row[1] !== 'モーダル') continue;
    const headers = row;
    for (let dataIndex = rowIndex + 1; dataIndex < values.length; dataIndex++) {
      const dataRow = values[dataIndex].map(value => String(value || '').trim());
      if (!dataRow.some(Boolean)) break;
      if (dataRow[0] === '画面' && dataRow[1] === 'モーダル') break;
      const obj = {};
      obj.__section = section;
      headers.forEach((header, columnIndex) => {
        if (!header) return;
        obj[header] = dataRow[columnIndex] || '';
      });
      rows.push(obj);
    }
  }
  return rows;
}

function getSheetObjects_(sheetName, allowMissing = false) {
  const ss = getSourceSpreadsheet_();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    if (allowMissing) return [];
    throw new Error(`Sheet not found: ${sheetName}`);
  }

  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) return [];

  const headers = values[0].map(header => String(header || '').trim());
  const safeSheetName = String(sheetName || '').trim();
  return values
    .slice(1)
    .filter(row => row.some(v => v !== ''))
    .map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        if (isDeprecatedScheduleHeader_(safeSheetName, header)) return;
        obj[header] = normalizeCell_(row[index]);
      });
      addCanonicalMasterFields_(safeSheetName, headers, row, obj);
      return obj;
    });
}

function getSheetObjectsCached_(sheetName, allowMissing = false) {
  const cacheKey = `initialData:objects:${sheetName}`;
  const cached = getJsonCache_(cacheKey);
  if (Array.isArray(cached)) return cached;

  const rows = getSheetObjects_(sheetName, allowMissing);
  putJsonCache_(cacheKey, rows, INITIAL_DATA_CACHE_TTL_SECONDS);
  return rows;
}

function getSheetObjectsByNames_(sheetNames, allowMissing) {
  for (const sheetName of sheetNames) {
    const rows = getSheetObjects_(sheetName, true);
    if (rows.length) return rows;
  }
  return allowMissing ? [] : [];
}

function getSheetObjectsByNamesCached_(sheetNames, allowMissing) {
  for (const sheetName of sheetNames) {
    const rows = getSheetObjectsCached_(sheetName, true);
    if (rows.length) return rows;
  }
  return allowMissing ? [] : [];
}

function getJapaneseHolidays_() {
  const cache = CacheService.getScriptCache();
  const cacheKey = `japanese_holidays_${new Date().getFullYear()}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      console.error('Failed to parse cached Japanese holidays: ' + error);
    }
  }

  try {
    const calendar = CalendarApp.getCalendarById('ja.japanese#holiday@group.v.calendar.google.com');
    if (!calendar) return [];

    const today = new Date();
    const start = new Date(today.getFullYear() - 1, 0, 1);
    const end = new Date(today.getFullYear() + 2, 11, 31, 23, 59, 59);
    const holidays = calendar.getEvents(start, end).map(event => ({
      date: formatDate_(event.getStartTime()),
      title: event.getTitle()
    }));
    cache.put(cacheKey, JSON.stringify(holidays), 21600);
    return holidays;
  } catch (error) {
    console.error('Failed to fetch Japanese holidays: ' + error);
    return [];
  }
}

function buildOperationalDateRange_(options) {
  if (!options || typeof options !== 'object') return null;
  const start = parseScheduleDate_(options.startDate);
  const end = parseScheduleDate_(options.endDate);
  if (!start || !end) return null;

  const rangeStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  rangeStart.setDate(rangeStart.getDate() - 7);
  const rangeEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  rangeEnd.setDate(rangeEnd.getDate() + 7);
  return { start: rangeStart, end: rangeEnd };
}

function isDateInOperationalRange_(value, dateRange) {
  if (!dateRange) return true;
  const date = parseScheduleDate_(value);
  if (!date) return false;
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return target >= dateRange.start && target <= dateRange.end;
}

function ensureHeader_(sheet, headers, headerName) {
  const index = headers.indexOf(headerName);
  if (index >= 0) return index;

  const newIndex = headers.length;
  sheet.getRange(1, newIndex + 1).setValue(headerName);
  headers.push(headerName);
  return newIndex;
}

function ensureHeaderAtMinColumn_(sheet, headers, headerName, preferredIndex) {
  const index = headers.indexOf(headerName);
  if (index >= 0) return index;

  const preferredHeader = normalizeCell_(headers[preferredIndex]);
  const newIndex = preferredHeader ? headers.length : preferredIndex;
  sheet.getRange(1, newIndex + 1).setValue(headerName);
  while (headers.length < newIndex) headers.push('');
  headers[newIndex] = headerName;
  return newIndex;
}
