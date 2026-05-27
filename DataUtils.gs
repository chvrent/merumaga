/**
 * DataUtils.gs
 * キャッシュ / スクリプトロック / スプレッドシートアクセス基盤 / ユーザー・権限
 *
 * 文字列・日付ユーティリティ → DataStringUtils.gs
 * ヘッダー・エイリアス・マスターID → DataAliasUtils.gs
 */

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
