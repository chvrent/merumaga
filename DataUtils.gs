/**
 * DataUtils.gs
 * 汎用ユーティリティ関数群
 *
 * - 文字列・セル正規化
 * - 日付パース・フォーマット
 * - ヘッダー・エイリアス解決
 * - マスターID生成
 * - キャッシュ・スクリプトロック
 * - スプレッドシートアクセス基盤
 * - ユーザー情報・権限チェック
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

// ---- ヘッダー・エイリアス解決 ----

function buildHeaderMap_(headers) {
  return new Map(headers.map((header, index) => [String(header).trim(), index]));
}

function findHeaderIndex_(headers, alias) {
  const exact = headers.indexOf(alias);
  if (exact >= 0) return exact;
  return headers.findIndex(h => String(h).includes('/') && String(h).split('/').map(s => s.trim()).includes(alias));
}

function headerExists_(headers, alias) {
  return findHeaderIndex_(headers, alias) >= 0;
}

function resolveHeaderIndex_(headerMap, alias) {
  const exact = headerMap.get(alias);
  if (exact != null) return exact;
  for (const [header, index] of headerMap) {
    if (header.includes('/') && header.split('/').map(s => s.trim()).includes(alias)) return index;
  }
  return null;
}

function firstExistingHeaderIndex_(headerMap, aliases) {
  for (const alias of toAliasList_(aliases)) {
    const index = resolveHeaderIndex_(headerMap, alias);
    if (index != null) return index;
  }
  return null;
}

function getFieldByAliases_(headers, row, aliases) {
  for (const alias of toAliasList_(aliases)) {
    let index = headers.indexOf(alias);
    if (index < 0) {
      index = headers.findIndex(h => String(h).includes('/') && String(h).split('/').map(s => s.trim()).includes(alias));
    }
    if (index >= 0) {
      const value = normalizeCell_(row[index]);
      if (value !== '') return value;
    }
  }
  return '';
}

function getPersonFieldByAliases_(headers, row, aliases) {
  for (const alias of toAliasList_(aliases)) {
    let index = headers.indexOf(alias);
    if (index < 0) {
      index = headers.findIndex(h => String(h).includes('/') && String(h).split('/').map(s => s.trim()).includes(alias));
    }
    if (index < 0) continue;
    const value = normalizeCell_(row[index]);
    if (value !== '' && !isBooleanText_(value)) return value;
  }
  return '';
}

function getObjectFieldByAliases_(obj, aliases) {
  if (!obj) return '';
  for (const alias of toAliasList_(aliases)) {
    if (Object.prototype.hasOwnProperty.call(obj, alias)) {
      const value = normalizeCell_(obj[alias]);
      if (value !== '') return value;
    }
  }
  return '';
}

/**
 * getObjectFieldByAliases_ のセグメント対応版。
 * キーが「日本語/英語」形式でも各セグメントを alias と照合する。
 */
function getObjectFieldByAliasesSegment_(obj, aliases) {
  if (!obj) return '';
  for (const alias of toAliasList_(aliases)) {
    if (Object.prototype.hasOwnProperty.call(obj, alias)) {
      const value = normalizeCell_(obj[alias]);
      if (value !== '') return value;
    }
    for (const key of Object.keys(obj)) {
      if (key.includes('/') && key.split('/').map(s => s.trim()).includes(alias)) {
        const value = normalizeCell_(obj[key]);
        if (value !== '') return value;
      }
    }
  }
  return '';
}

function getMasterFieldAliases_(sheetName) {
  switch (String(sheetName || '').trim()) {
    case SCHEDULE_SHEET_NAME:
      return SCHEDULE_FIELD_ALIASES;
    case 'app_pr':
      return PR_FIELD_ALIASES;
    case 'app_pr_targets':
      return PR_TARGET_FIELD_ALIASES;
    default:
      return null;
  }
}

function getCanonicalKeyForHeader_(sheetName, header) {
  return getCanonicalKeyFromAliases_(getMasterFieldAliases_(sheetName), header);
}

function getCanonicalKeyFromAliases_(aliasesByKey, header) {
  const safeHeader = String(header || '').trim();
  if (!aliasesByKey || !safeHeader) return '';
  for (const key in aliasesByKey) {
    if (toAliasList_(aliasesByKey[key]).indexOf(safeHeader) !== -1) return key;
  }
  if (safeHeader.includes('/')) {
    const segments = safeHeader.split('/').map(s => s.trim());
    for (const key in aliasesByKey) {
      if (segments.some(seg => toAliasList_(aliasesByKey[key]).indexOf(seg) !== -1)) return key;
    }
  }
  return '';
}

function getCheckStatusCanonicalKey_(header) {
  return getCanonicalKeyFromAliases_(CHECK_STATUS_FIELD_ALIASES, header) || String(header || '').trim();
}

function buildMasterAliasFieldIndex_(headers, aliasesByKey) {
  const headerMap = buildHeaderMap_(headers);
  const fieldIdx = {};
  Object.keys(aliasesByKey).forEach(key => {
    const idx = firstExistingHeaderIndex_(headerMap, aliasesByKey[key]);
    fieldIdx[key] = idx != null ? idx : -1;
  });
  return fieldIdx;
}

function buildCanonicalHeaderMeta_(sheetName, headers) {
  const safeSheetName = String(sheetName || '').trim();
  return headers.map((header, columnIndex) => ({
    header,
    columnIndex,
    deprecated: isDeprecatedScheduleHeader_(safeSheetName, header),
    storeKey: getCanonicalKeyForHeader_(safeSheetName, header) || header || `column_${columnIndex + 1}`
  }));
}

/**
 * DisplayValues からマスタ行オブジェクトを生成する。
 * エイリアス定義があるシートは正規キーで格納し、ループ外で列インデックスを解決する。
 */
function mapDisplayValuesToMasterRows_(sheetName, values, options) {
  const safeSheetName = String(sheetName || '').trim();
  const opts = options || {};
  if (!values || values.length < 2) return [];

  const headers = values[0].map(header => String(header || '').trim());
  const aliasesByKey = getMasterFieldAliases_(safeSheetName);

  if (!aliasesByKey) {
    return values
      .slice(1)
      .filter(row => row.some(v => v !== ''))
      .map((row, index) => {
        const obj = opts.withRowNumber ? { __rowNumber: String(index + 2) } : {};
        headers.forEach((header, columnIndex) => {
          if (isDeprecatedScheduleHeader_(safeSheetName, header)) return;
          obj[header] = normalizeCell_(row[columnIndex]);
        });
        return obj;
      })
      .filter(row => !opts.filterEmptyObjects || Object.keys(row).some(
        key => key !== '__rowNumber' && row[key] !== ''
      ));
  }

  const activeHeaderMeta = buildCanonicalHeaderMeta_(safeSheetName, headers).filter(m => !m.deprecated);
  const aliasFieldIdx = buildMasterAliasFieldIndex_(headers, aliasesByKey);

  return values
    .slice(1)
    .filter(row => row.some(v => v !== ''))
    .map((row, index) => {
      const obj = opts.withRowNumber ? { __rowNumber: String(index + 2) } : {};
      activeHeaderMeta.forEach(({ storeKey, columnIndex }) => {
        obj[storeKey] = normalizeCell_(row[columnIndex]);
      });
      addCanonicalMasterFields_(safeSheetName, headers, row, obj, aliasFieldIdx);
      return obj;
    })
    .filter(row => !opts.filterEmptyObjects || Object.keys(row).some(
      key => key !== '__rowNumber' && row[key] !== ''
    ));
}

function addCanonicalMasterFields_(sheetName, headers, row, obj, fieldIdx) {
  const aliasesByKey = getMasterFieldAliases_(sheetName);
  if (!aliasesByKey || !obj) return obj;
  const indices = fieldIdx || buildMasterAliasFieldIndex_(headers, aliasesByKey);
  Object.keys(aliasesByKey).forEach(key => {
    if (Object.prototype.hasOwnProperty.call(obj, key) && normalizeCell_(obj[key]) !== '') return;
    const idx = indices[key];
    if (idx == null || idx < 0) return;
    const value = normalizeCell_(row[idx]);
    if (value !== '') obj[key] = value;
  });
  return obj;
}

function addCanonicalObjectFields_(aliasesByKey, obj) {
  if (!aliasesByKey || !obj) return obj;
  Object.keys(aliasesByKey).forEach(key => {
    const aliases = aliasesByKey[key];
    if (Array.isArray(aliases)) {
      const value = getObjectFieldByAliases_(obj, aliases);
      if (value !== '' && (!Object.prototype.hasOwnProperty.call(obj, key) || normalizeCell_(obj[key]) === '')) {
        obj[key] = value;
      }
    }
  });
  return obj;
}

// ---- マスターID・行番号ユーティリティ ----

function getMasterIdIndex_(sheetName, headers) {
  const config = MASTER_ID_CONFIG[sheetName];
  if (!config) return null;
  return firstExistingHeaderIndex_(buildHeaderMap_(headers), config.aliases);
}

function generateNextMasterId_(sheetName, values, idIndex) {
  const config = MASTER_ID_CONFIG[sheetName];
  if (!config) return '';

  let maxNumber = 0;
  const prefixPattern = sheetName === 'app_pr'
    ? /^(\d+)(?:\.0+)?$/
    : new RegExp(`^${config.prefix}_(\\d+)$`);
  values.slice(1).forEach(row => {
    const value = normalizeCell_(row[idIndex]);
    const match = String(value || '').match(prefixPattern);
    if (match) maxNumber = Math.max(maxNumber, Number(match[1]));
  });

  return sheetName === 'app_pr'
    ? String(maxNumber + 1)
    : `${config.prefix}_${String(maxNumber + 1).padStart(3, '0')}`;
}

function isDeprecatedScheduleHeader_(sheetName, header) {
  return String(sheetName || '').trim() === SCHEDULE_SHEET_NAME &&
    DEPRECATED_SCHEDULE_HEADERS.indexOf(String(header || '').trim()) !== -1;
}

function getSubCategoryClass_(value, category) {
  if (normalizeCell_(category) === 'MA') return '';

  const text = normalizeCell_(value);
  if (text.indexOf('特殊') !== -1) return 'is-special';
  if (text.indexOf('商品') !== -1) return 'is-product';
  if (text.indexOf('その他') !== -1 || text.indexOf('他部署') !== -1) return 'is-others';
  return text ? 'is-others' : '';
}

function isScheduleRowFixed_(sheet, rowNumber) {
  const values = sheet.getDataRange().getValues();
  if (!values.length || rowNumber < 2 || rowNumber > values.length) return false;
  const headers = values[0].map(header => String(header || '').trim());
  return isRowFixedByHeaders_(headers, values[rowNumber - 1]);
}

function isRowFixedByHeaders_(headers, row) {
  return isTruthy_(getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.is_fixed));
}

// ---- キャッシュ ----

function getJsonCache_(key) {
  try {
    const cached = CacheService.getScriptCache().get(key);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch (error) {
    return null;
  }
}

function putJsonCache_(key, value, ttlSeconds) {
  try {
    const json = JSON.stringify(value);
    if (json.length > INITIAL_DATA_CACHE_MAX_CHARS) return;
    CacheService.getScriptCache().put(key, json, ttlSeconds);
  } catch (error) {
    // ignore cache errors
  }
}

function invalidateInitialDataCaches_(sheetNames) {
  try {
    const names = Array.isArray(sheetNames) ? sheetNames : [];
    const keys = [];
    names.forEach(sheetName => {
      keys.push(`initialData:headers:${sheetName}`);
      keys.push(`initialData:objects:${sheetName}`);
      if (sheetName === SCHEDULE_SHEET_NAME) {
        keys.push('initialData:scheduleRows');
        keys.push(`initialData:headers:${SCHEDULE_SHEET_NAME}`);
      }
    });
    if (keys.length) CacheService.getScriptCache().removeAll(Array.from(new Set(keys)));
  } catch (error) {
    // ignore cache errors
  }
}

// ---- スクリプトロック ----

function withScriptLock_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

// ---- スプレッドシートアクセス基盤 ----

function getSourceSpreadsheet_() {
  return SpreadsheetApp.openById(getSourceSpreadsheetId_());
}

function getSourceSpreadsheetId_() {
  return PropertiesService.getScriptProperties().getProperty(SOURCE_SPREADSHEET_ID_PROPERTY)
    || DEFAULT_SOURCE_SPREADSHEET_ID;
}

function setSourceSpreadsheetIdForEnvironment(spreadsheetId) {
  if (!spreadsheetId || typeof spreadsheetId !== 'string') {
    throw new Error('spreadsheetId is required.');
  }
  PropertiesService.getScriptProperties().setProperty(
    SOURCE_SPREADSHEET_ID_PROPERTY,
    spreadsheetId.trim()
  );
  return { sourceSpreadsheetId: getSourceSpreadsheetId_() };
}

function copySourceSpreadsheetForStaging(copyName) {
  const name = copyName || `mail-magazine-maker staging ${Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd-HHmm')}`;
  const copiedSpreadsheet = getSourceSpreadsheet_().copy(name);
  return {
    id: copiedSpreadsheet.getId(),
    name: copiedSpreadsheet.getName(),
    url: copiedSpreadsheet.getUrl()
  };
}

function getDeploymentEnvironmentInfo() {
  return {
    sourceSpreadsheetId: getSourceSpreadsheetId_(),
    defaultSourceSpreadsheetId: DEFAULT_SOURCE_SPREADSHEET_ID,
    sourceSpreadsheetIdProperty: SOURCE_SPREADSHEET_ID_PROPERTY
  };
}

// ---- ユーザー・権限 ----

function getCurrentUserLabel_() {
  const email = Session.getActiveUser().getEmail();
  return email || 'ユーザー';
}

function assertEditableSheet_(sheetName) {
  const safeSheetName = String(sheetName || '').trim();
  if (EDITABLE_MASTER_SHEETS.indexOf(safeSheetName) === -1) {
    throw new Error(`Sheet is not editable from this app: ${safeSheetName}`);
  }
  return safeSheetName;
}
