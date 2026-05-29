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

// ---- スクリプトロック【原子的書き込み正本】 ----

/**
 * スクリプトロックを使用した原子的書き込み処理（正本）
 * @param {Function} callback - スプシへの書き込みを行うコールバック関数
 * @returns {*} callback の戻り値
 * 
 * 【目的】
 * - 複数ユーザーが同時にスプシ操作する際、競合を防ぐ
 * - 読み込み → 変更 → 書き込みの一連を分割不可能（atomic）にする
 * - Lock timeout（30秒待機）なので、処理は高速に
 * 
 * 【使用パターン】
 *   return withScriptLock_(() => {
 *     const sheetData = getSheetValuesAndHeaders_(sheet);
 *     // 読 → 変 → 書
 *     return { success: true, modified: count };
 *   });
 * 
 * 【注意】
 * - callback が時間がかかる処理を含まないこと（30秒タイムアウト）
 * - callback 内で例外が起きても releaseLock() は必ず呼ばれる (finally)
 */
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

/**
 * スプシから値・ヘッダー・範囲を一括取得（テンプレート）【正本】
 * @param {Sheet} sheet - Google Sheets の Sheet オブジェクト
 * @returns {Object|null} { sheet, range, values, headers } または null
 * 
 * 【目的】
 * - スプシ操作の標準パターン。一度に全データを取得し、メモリで修正して一括書き込み
 * - 効率的（複数行の読み書きがあるなら数回に分割するより一括が早い）
 * - 読 → 変 → 書 を withScriptLock_() で包むことで原子性を確保
 * 
 * 【使用パターン】
 *   const sheetData = getSheetValuesAndHeaders_(sheet);
 *   if (!sheetData) return { success: false };
 *   const { headers, values, range } = sheetData;
 *   // values[i][j] を直接修正
 *   range.setValues(values); // 一括書き込み
 * 
 * 【注意】
 * - 大規模シート（>10000行）の場合、メモリ使用量に注意
 * - 行数が多い場合は、日付範囲を絞ってから呼ぶ
 */
function getSheetValuesAndHeaders_(sheet) {
  if (!sheet) return null;
  const range = sheet.getDataRange();
  const values = range.getValues();
  if (!values.length) return null;
  const headers = values[0].map(header => String(header || '').trim());
  return { sheet, range, values, headers };
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
