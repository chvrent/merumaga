/**
 * DataService.gs
 */
const SOURCE_SPREADSHEET_ID = '1hr-bf6g0Lhe9tuTiGHjhM9uyfKOmiQ9ZCpgD5kVdnrs';
const SCHEDULE_SHEET_NAME = 'app_schedule';
const SCHEDULE_ARCHIVE_SHEET_NAME = 'app_schedule_archives';
const COMMENTS_SHEET_NAME = 'app_comments';
const EXCEPTIONS_SHEET_NAME = 'app_exceptions';
const CHECK_STATUS_SHEET_NAME = 'app_check_status';
const LOG_ARCHIVE_RETENTION_DAYS = 90;
const JOB_COUNT_REFRESH_INTERVAL_HOURS = 12;
const WEEKLY_ARCHIVE_ENABLED = false;
const INITIAL_DATA_CACHE_TTL_SECONDS = 60;
const INITIAL_DATA_CACHE_MAX_CHARS = 90000;
const EDITABLE_MASTER_SHEETS = ['app_schedule', 'app_pr', 'app_pr_targets'];
const CYCLE_BASE_DATE = new Date(2026, 3, 28); // 火曜日
const MASTER_ID_CONFIG = {
  app_schedule: { aliases: ['schedule_id', 'id'], prefix: 'SCH' },
  app_pr: { aliases: ['pr_id', 'PR', 'id'], prefix: 'PR' },
  app_pr_targets: { aliases: ['pr_target_id', 'id'], prefix: 'PRT' }
};

const PR_FIELD_ALIASES = {
  pr_id: ['pr_id', 'PR', 'id'],
  name: ['name', '名称', 'タイトル', '見出し', 'PRタイトル'],
  pr_text: ['pr_text', 'PR本文', '本文'],
  start_date: ['start_date', '開始日', '開始'],
  end_date: ['end_date', '終了日', '終了'],
  target_ids: ['target_ids', '紐付けID', '対象ID', 'PRが入るメルマガ', '紐付けメルマガ']
};

const SCHEDULE_FIELD_ALIASES = {
  schedule_id: ['schedule_id', 'id'],
  mail_name: ['mail_name', 'メルマガ内容'],
  weekday: ['weekday', '曜日'],
  hour: ['hour', '時間'],
  category: ['category', '種別'],
  sub_category: ['sub_category', 'サブカテゴリ'],
  format: ['format', '形式'],
  delivery_count: ['delivery_count', '通数'],
  assignee: ['assignee', '設定者'],
  reviewer: ['reviewer', '確認者'],
  start_date: ['start_date', '開始'],
  end_date: ['end_date', '終了'],
  pr: ['pr', 'PR'],
  notes: ['notes', '備考'],
  job_url: ['job_url', '自動求人特集URL', '求人URL', 'URL'],
  auto_job_feature_id: ['auto_job_feature_id', '自動求人特集ID'],
  target_age: ['target_age', '対象年齢'],
  target_address: ['target_address', '対象現住所'],
  new_flag: ['new_flag', '新規'],
  current_job_count: ['current_job_count', '現在求人数', '最新求人数', '求人数'],
  job_count_updated_at: ['job_count_updated_at', '求人数最終取得日時', '最終取得日時'],
  cycle: ['cycle', 'サイクル'],
  current_week_cycle: ['current_week_cycle', '今週サイクル(内部)'],
  current_week_inactive: ['current_week_inactive', '今週非配信(内部)'],
  is_inactive: ['is_inactive', '配信停止'],
  is_fixed: ['is_fixed', '確定済']
};

function getInitialData(options) {
  const ss = getSourceSpreadsheet_();
  const dateRange = buildOperationalDateRange_(options);
  return {
    schedule: getScheduleRowsCached_(ss),
    scheduleHeaders: getSheetHeadersCached_(ss, SCHEDULE_SHEET_NAME),
    pr: getSheetObjectsCached_('app_pr'),
    prTargets: getSheetObjectsCached_('app_pr_targets', true),
    holidays: getSheetObjectsCached_('app_holidays', true),
    japaneseHolidays: getJapaneseHolidays_(),
    commentCounts: getCommentCounts_(dateRange),
    fixedOccurrences: getFixedOccurrences_(dateRange),
    stoppedOccurrences: getStoppedOccurrences_(dateRange),
    checkStatuses: getCheckStatuses_(dateRange),
    readme: getSheetObjectsCached_('app_readme', true),
    adminMaster: getSheetObjectsByNamesCached_(['app_admin_master', 'app_name_master'], true)
  };
}

function getSheetHeaders_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0]
    .map(header => String(header || '').trim())
    .filter(Boolean);
}

function getMasterData(sheetName) {
  const safeSheetName = assertEditableSheet_(sheetName);
  const ss = getSourceSpreadsheet_();
  const sheet = ss.getSheetByName(safeSheetName);
  if (!sheet) throw new Error(`Sheet not found: ${safeSheetName}`);

  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) {
    return { sheetName: safeSheetName, headers: [], rows: [] };
  }

  const headers = values[0].map(header => String(header || '').trim());
  const rows = values
    .slice(1)
    .map((row, index) => {
      const obj = { __rowNumber: String(index + 2) };
      headers.forEach((header, columnIndex) => {
        obj[header || `column_${columnIndex + 1}`] = normalizeCell_(row[columnIndex]);
      });
      return obj;
    })
    .filter(row => Object.keys(row).some(key => key !== '__rowNumber' && row[key] !== ''));

  return { sheetName: safeSheetName, headers, rows };
}

/**
 * PR管理用の拡張データ取得
 * app_pr_targets に app_pr のタイトルを結合する
 */
function getPRData() {
  const prTargets = getMasterData('app_pr_targets');
  const prMaster = getMasterData('app_pr');
  
  const targetMap = {};
  prTargets.rows.forEach(row => {
    const prId = String(row.pr_id || '').trim();
    const mailName = String(row.mail_name || '').trim();
    if (prId && mailName) {
      if (!targetMap[prId]) targetMap[prId] = [];
      targetMap[prId].push(mailName);
    }
  });

  prMaster.rows.forEach(row => {
    const prId = String(row.pr_id || '').trim();
    const mailNames = targetMap[prId] || [];
    row.target_mails = mailNames.length > 0 ? mailNames.join(', ') : '(未設定)';
  });

  if (!prMaster.headers.includes('target_mails')) {
    prMaster.headers.push('target_mails');
  }

  return prMaster;
}

function saveMasterData(sheetName, payload) {
  return withScriptLock_(() => saveMasterDataUnlocked_(sheetName, payload));
}

function saveMasterDataUnlocked_(sheetName, payload) {
  const safeSheetName = assertEditableSheet_(sheetName);
  if (!payload || typeof payload !== 'object') throw new Error('payload is required');

  const ss = getSourceSpreadsheet_();
  const sheet = ss.getSheetByName(safeSheetName);
  if (!sheet) throw new Error(`Sheet not found: ${safeSheetName}`);

  const values = sheet.getDataRange().getValues();
  if (!values.length) throw new Error(`${safeSheetName} is empty`);

  const headers = values[0].map(header => String(header || '').trim());
  const rowNumber = Number(payload.__rowNumber || 0);
  const idIndex = getMasterIdIndex_(safeSheetName, headers);
  const row = rowNumber >= 2 && rowNumber <= sheet.getLastRow()
    ? values[rowNumber - 1].slice(0, headers.length)
    : headers.map(() => '');

  headers.forEach((header, index) => {
    if (Object.prototype.hasOwnProperty.call(payload, header)) {
      row[index] = normalizeCell_(payload[header]);
    }
  });

  if (idIndex != null && !normalizeCell_(row[idIndex])) {
    row[idIndex] = generateNextMasterId_(safeSheetName, values, idIndex);
  }

  if (rowNumber >= 2 && rowNumber <= sheet.getMaxRows()) {
    sheet.getRange(rowNumber, 1, 1, headers.length).setValues([row]);
    if (safeSheetName === SCHEDULE_SHEET_NAME) updateJobCountForRowUnlocked_(sheet, rowNumber, true);
    invalidateInitialDataCaches_([safeSheetName]);
    return { success: true, action: 'update', rowNumber, id: idIndex != null ? normalizeCell_(row[idIndex]) : '' };
  }

  sheet.appendRow(row);
  const insertedRowNumber = sheet.getLastRow();
  if (safeSheetName === SCHEDULE_SHEET_NAME) updateJobCountForRowUnlocked_(sheet, insertedRowNumber, true);
  invalidateInitialDataCaches_([safeSheetName]);
  return { success: true, action: 'insert', rowNumber: insertedRowNumber, id: idIndex != null ? normalizeCell_(row[idIndex]) : '' };
}

function deleteMasterData(sheetName, rowNumber) {
  return withScriptLock_(() => deleteMasterDataUnlocked_(sheetName, rowNumber));
}

function deleteMasterDataUnlocked_(sheetName, rowNumber) {
  const safeSheetName = assertEditableSheet_(sheetName);
  const targetRow = Number(rowNumber || 0);
  if (targetRow < 2) throw new Error('Invalid row number');

  const ss = getSourceSpreadsheet_();
  const sheet = ss.getSheetByName(safeSheetName);
  if (!sheet) throw new Error(`Sheet not found: ${safeSheetName}`);
  if (targetRow > sheet.getLastRow()) throw new Error('Row not found');

  // PR本文マスタ(app_pr)を削除した場合、紐づいている対象メルマガ(app_pr_targets)も削除する
  if (safeSheetName === 'app_pr') {
    const lastCol = sheet.getLastColumn();
    const prHeaders = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(h => String(h || '').trim());
    const prIdIndex = firstExistingHeaderIndex_(buildHeaderMap_(prHeaders), PR_FIELD_ALIASES.pr_id);
    const prId = prIdIndex == null ? '' : normalizeCell_(sheet.getRange(targetRow, prIdIndex + 1).getDisplayValue());

    if (prId) {
      const targetsSheet = ss.getSheetByName('app_pr_targets');
      if (targetsSheet) {
        const targetValues = targetsSheet.getDataRange().getDisplayValues();
        if (targetValues.length >= 2) {
          const targetHeaders = targetValues[0].map(h => String(h || '').trim());
          const targetPrIdIndex = firstExistingHeaderIndex_(buildHeaderMap_(targetHeaders), PR_FIELD_ALIASES.pr_id);
          if (targetPrIdIndex != null) {
            for (let r = targetValues.length; r >= 2; r--) {
              const rowPrId = normalizeCell_(targetValues[r - 1][targetPrIdIndex]);
              if (rowPrId && rowPrId === prId) targetsSheet.deleteRow(r);
            }
          }
        }
      }
    }
  }

  sheet.deleteRow(targetRow);
  invalidateInitialDataCaches_(safeSheetName === 'app_pr' ? ['app_pr', 'app_pr_targets'] : [safeSheetName]);
  return { success: true, action: 'delete', rowNumber: targetRow };
}

function backupAndLockTwoWeeksAgo() {
  if (!WEEKLY_ARCHIVE_ENABLED) {
    return { success: true, skipped: true, reason: 'Realtime confirmation archive is enabled; weekly archive is disabled.' };
  }

  const ss = getSourceSpreadsheet_();
  const masterSheet = ss.getSheetByName(SCHEDULE_SHEET_NAME);
  if (!masterSheet) throw new Error(`Sheet not found: ${SCHEDULE_SHEET_NAME}`);

  const refreshedValues = masterSheet.getDataRange().getValues();
  if (!refreshedValues.length) return { success: true, archived: 0, fixed_occurrences: 0 };

  const refreshedHeaders = refreshedValues[0].map(header => String(header || '').trim());
  const backupSheet = getOrCreateArchiveSheet_(ss, refreshedHeaders);
  const cutoffWeek = getTwoWeeksAgoTuesdayToMonday_();
  const scanStart = getArchiveScanStartWeek_(refreshedHeaders, refreshedValues, backupSheet, cutoffWeek.start);
  const existingArchiveKeys = getExistingArchiveKeys_(backupSheet);

  const archiveRows = [];
  let fixedCount = 0;

  for (let weekStart = new Date(scanStart); weekStart <= cutoffWeek.start; weekStart.setDate(weekStart.getDate() + 7)) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    for (let rowIndex = 1; rowIndex < refreshedValues.length; rowIndex++) {
      const row = refreshedValues[rowIndex];
      if (!isScheduleRowInWeek_(refreshedHeaders, row, weekStart, weekEnd)) continue;

      const sourceRow = rowIndex + 1;
      const archiveKey = buildArchiveKey_(sourceRow, weekStart);
      if (existingArchiveKeys.has(archiveKey)) continue;

      archiveRows.push([
        new Date(),
        formatDate_(weekStart),
        formatDate_(weekEnd),
        sourceRow
      ].concat(row.slice(0, refreshedHeaders.length)));
      existingArchiveKeys.add(archiveKey);
      fixedCount++;
    }
  }

  if (archiveRows.length) {
    backupSheet.getRange(backupSheet.getLastRow() + 1, 1, archiveRows.length, archiveRows[0].length).setValues(archiveRows);
  }

  return {
    success: true,
    archive_start: formatDate_(scanStart),
    cutoff_week_start: formatDate_(cutoffWeek.start),
    cutoff_week_end: formatDate_(cutoffWeek.end),
    archived: archiveRows.length,
    fixed_occurrences: fixedCount
  };
}

function clearScheduleFixedFlags() {
  const ss = getSourceSpreadsheet_();
  const sheet = ss.getSheetByName(SCHEDULE_SHEET_NAME);
  if (!sheet) throw new Error(`Sheet not found: ${SCHEDULE_SHEET_NAME}`);

  const values = sheet.getDataRange().getValues();
  if (!values.length) return { success: true, cleared: 0 };

  const headers = values[0].map(header => String(header || '').trim());
  const fixedIndex = firstExistingHeaderIndex_(buildHeaderMap_(headers), SCHEDULE_FIELD_ALIASES.is_fixed);
  if (fixedIndex == null) return { success: true, cleared: 0 };

  let cleared = 0;
  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    if (values[rowIndex][fixedIndex] !== '') {
      values[rowIndex][fixedIndex] = '';
      cleared++;
    }
  }

  if (cleared) sheet.getDataRange().setValues(values);
  return { success: true, cleared };
}

function setupWeeklyBackupTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'backupAndLockTwoWeeksAgo')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  if (!WEEKLY_ARCHIVE_ENABLED) {
    return { success: true, handler: 'backupAndLockTwoWeeksAgo', disabled: true, reason: 'Realtime confirmation archive is enabled.' };
  }

  ScriptApp.newTrigger('backupAndLockTwoWeeksAgo')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.TUESDAY)
    .atHour(4)
    .create();

  return { success: true, handler: 'backupAndLockTwoWeeksAgo', weekday: 'TUESDAY', hour: 4 };
}

function migrateLegacyIdsToEnglish(dryRun) {
  const ss = getSourceSpreadsheet_();
  const result = {
    dryRun: dryRun !== false,
    schedule: {},
    pr: {}
  };

  result.schedule = migrateSheetIds_(ss, 'app_schedule', ['schedule_id', 'id'], 'SCH', result.dryRun);
  result.pr = migrateSheetIds_(ss, 'app_pr', ['pr_id', 'PR', 'id'], 'PR', result.dryRun);

  if (!result.dryRun) {
    updateReferenceIds_(ss, COMMENTS_SHEET_NAME, ['schedule_id'], result.schedule.idMap);
    updateReferenceIds_(ss, 'app_pr_targets', ['pr_id', 'PR', 'pr', 'id'], result.pr.idMap);
  }

  return result;
}

function saveComment(scheduleId, commentText, targetDate, user) {
  return withScriptLock_(() => saveCommentUnlocked_(scheduleId, commentText, targetDate, user));
}

function saveCommentUnlocked_(scheduleId, commentText, targetDate, user) {
  const safeScheduleId = normalizeCell_(scheduleId);
  const safeCommentText = normalizeCell_(commentText);
  const safeTargetDate = normalizeCommentTargetDate_(targetDate);
  if (!safeScheduleId) throw new Error('schedule_id is required');
  if (!safeTargetDate) throw new Error('target_date is required');
  if (!safeCommentText) throw new Error('comment_text is required');

  const sheet = getCommentsSheet_();
  const headers = getCommentHeaders_(sheet);
  const timestamp = new Date();
  const commenter = normalizeCell_(user) || getCurrentUserLabel_();
  const row = headers.map(header => {
    switch (header) {
      case 'schedule_id':
        return safeScheduleId;
      case 'timestamp':
        return timestamp;
      case 'user':
        return commenter;
      case 'comment_text':
        return safeCommentText;
      case 'target_date':
        return safeTargetDate;
      default:
        return '';
    }
  });
  sheet.appendRow(row);
  invalidateCommentCaches_(safeScheduleId, safeTargetDate);

  return {
    success: true,
    schedule_id: safeScheduleId,
    target_date: safeTargetDate,
    timestamp: Utilities.formatDate(timestamp, Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy/MM/dd HH:mm'),
    user: commenter,
    comment_text: safeCommentText
  };
}

function getCommentsByScheduleId(scheduleId, targetDate) {
  const safeScheduleId = normalizeCell_(scheduleId);
  const safeTargetDate = normalizeCommentTargetDate_(targetDate);
  if (!safeScheduleId) return [];

  const cache = CacheService.getScriptCache();
  const cacheKey = buildCommentsCacheKey_(safeScheduleId, safeTargetDate);
  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      // ignore cache parse errors
    }
  }

  const sheet = getCommentsSheet_();
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return [];

  const headers = values[0].map(header => String(header || '').trim());
  const scheduleIndex = headers.indexOf('schedule_id');
  const dateIndex = headers.indexOf('target_date');
  const timestampIndex = headers.indexOf('timestamp');
  const userIndex = headers.indexOf('user');
  const textIndex = headers.indexOf('comment_text');
  if (scheduleIndex < 0 || dateIndex < 0) return [];

  const results = [];
  values.slice(1).forEach(row => {
    if (normalizeCell_(row[scheduleIndex]) !== safeScheduleId) return;
    const rowDate = normalizeCommentTargetDate_(row[dateIndex]);
    if (safeTargetDate && rowDate !== safeTargetDate) return;
    results.push({
      schedule_id: safeScheduleId,
      target_date: rowDate,
      timestamp: timestampIndex >= 0 ? normalizeCell_(row[timestampIndex]) : '',
      user: userIndex >= 0 ? normalizeCell_(row[userIndex]) : '',
      comment_text: textIndex >= 0 ? normalizeCell_(row[textIndex]) : ''
    });
  });
  results.sort((a, b) => getCommentTime_(a.timestamp) - getCommentTime_(b.timestamp));

  // 1件あたりが小さい想定なので短めにキャッシュ（最新投稿はUI側でも即時反映する）
  try {
    cache.put(cacheKey, JSON.stringify(results), 300);
  } catch (error) {
    // ignore cache errors (size limits etc.)
  }
  return results;
}

function isStopped(scheduleId, targetDate) {
  const key = buildStoppedOccurrenceKey_(scheduleId, targetDate);
  if (!key) return false;
  return !!getStoppedOccurrences_()[key];
}

function stopDelivery(scheduleId, targetDate) {
  return withScriptLock_(() => stopDeliveryUnlocked_(scheduleId, targetDate));
}

function stopDeliveryUnlocked_(scheduleId, targetDate) {
  const safeScheduleId = normalizeCell_(scheduleId);
  const safeTargetDate = normalizeCommentTargetDate_(targetDate);
  if (!safeScheduleId) throw new Error('schedule_id is required');
  if (!safeTargetDate) throw new Error('target_date is required');
  if (isScheduleOccurrenceFixedById_(safeScheduleId, safeTargetDate)) {
    throw new Error('確定済みの配信日は停止できません');
  }
  
  const existing = getStoppedOccurrences_();
  if (existing[buildStoppedOccurrenceKey_(safeScheduleId, safeTargetDate)]) {
    return { success: true, action: 'already_stopped' };
  }

  const sheet = getExceptionsSheet_();
  const headers = getExceptionHeaders_(sheet);
  const row = headers.map(header => {
    switch (header) {
      case 'schedule_id': return safeScheduleId;
      case 'target_date': return safeTargetDate;
      case 'status': return 'stopped';
      default: return '';
    }
  });
  sheet.appendRow(row);
  return { success: true, action: 'stopped' };
}

function resumeDelivery(scheduleId, targetDate) {
  return withScriptLock_(() => resumeDeliveryUnlocked_(scheduleId, targetDate));
}

function stopAllDeliveriesForDay(dateStr, scheduleIds) {
  return withScriptLock_(() => {
    const safeDateStr = normalizeCommentTargetDate_(dateStr);
    if (!safeDateStr) throw new Error('日付が指定されていません');
    if (!Array.isArray(scheduleIds) || scheduleIds.length === 0) return { success: true, count: 0 };

    const sheet = getExceptionsSheet_();
    const headers = getExceptionHeaders_(sheet);

    // 既存の停止レコード（当日分）を一度だけ読み、重複書き込みを避ける
    const existingStoppedForDay = new Set();
    const existingValues = sheet.getDataRange().getValues();
    if (existingValues.length >= 2) {
      const sheetHeaders = existingValues[0].map(header => String(header || '').trim());
      const scheduleIndex = sheetHeaders.indexOf('schedule_id');
      const dateIndex = sheetHeaders.indexOf('target_date');
      const statusIndex = sheetHeaders.indexOf('status');
      if (scheduleIndex >= 0 && dateIndex >= 0) {
        existingValues.slice(1).forEach(row => {
          const rowDate = normalizeCommentTargetDate_(row[dateIndex]);
          if (rowDate !== safeDateStr) return;
          const rowStatus = statusIndex >= 0 ? normalizeCell_(row[statusIndex]) : 'stopped';
          if (rowStatus && rowStatus !== 'stopped') return;
          const scheduleId = normalizeCell_(row[scheduleIndex]);
          if (scheduleId) existingStoppedForDay.add(scheduleId);
        });
      }
    }

    // 確定済み（固定）判定を一括化して、IDごとのスプレッドシート走査を避ける
    const fixedScheduleIdsForDay = buildFixedScheduleIdsForDate_(safeDateStr, scheduleIds);

    const uniqueScheduleIds = Array.from(new Set(scheduleIds.map(id => normalizeCell_(id)).filter(Boolean)));
    const rowsToAppend = [];
    const results = [];
    uniqueScheduleIds.forEach(scheduleId => {
      if (existingStoppedForDay.has(scheduleId)) return;
      if (fixedScheduleIdsForDay.has(scheduleId)) return;

      const row = headers.map(header => {
        switch (header) {
          case 'schedule_id': return scheduleId;
          case 'target_date': return safeDateStr;
          case 'status': return 'stopped';
          default: return '';
        }
      });
      rowsToAppend.push(row);
      results.push(scheduleId);
    });

    if (rowsToAppend.length) {
      const startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
    }

    return { success: true, stoppedIds: results, count: results.length };
  });
}

function resumeAllDeliveriesForDay(dateStr) {
  return withScriptLock_(() => {
    const safeDateStr = normalizeCommentTargetDate_(dateStr);
    if (!safeDateStr) throw new Error('日付が指定されていません');

    const sheet = getExceptionsSheet_();
    const values = sheet.getDataRange().getValues();
    if (values.length < 2) return { success: true, deleted: 0 };

    const headers = values[0].map(header => String(header || '').trim());
    const dateIndex = headers.indexOf('target_date');
    const statusIndex = headers.indexOf('status');
    const scheduleIndex = headers.indexOf('schedule_id');

    if (dateIndex < 0) return { success: true, deleted: 0 };

    // 対象日の停止レコードだけ抽出し、確定済みは残す（固定判定も一括化）
    const candidateScheduleIds = [];
    for (let index = 1; index < values.length; index++) {
      const row = values[index];
      const rowStatus = statusIndex >= 0 ? normalizeCell_(row[statusIndex]) : 'stopped';
      const rowDate = normalizeCommentTargetDate_(row[dateIndex]);
      if (rowDate !== safeDateStr) continue;
      if (rowStatus && rowStatus !== 'stopped') continue;
      const safeScheduleId = scheduleIndex >= 0 ? normalizeCell_(row[scheduleIndex]) : '';
      if (safeScheduleId) candidateScheduleIds.push(safeScheduleId);
    }
    const fixedScheduleIdsForDay = buildFixedScheduleIdsForDate_(safeDateStr, candidateScheduleIds);

    const newValues = [values[0]];
    let deleted = 0;
    for (let index = 1; index < values.length; index++) {
      const row = values[index];
      const rowStatus = statusIndex >= 0 ? normalizeCell_(row[statusIndex]) : 'stopped';
      const rowDate = normalizeCommentTargetDate_(row[dateIndex]);
      const safeScheduleId = scheduleIndex >= 0 ? normalizeCell_(row[scheduleIndex]) : '';
      const isTarget = rowDate === safeDateStr && (!rowStatus || rowStatus === 'stopped');

      if (isTarget && safeScheduleId && !fixedScheduleIdsForDay.has(safeScheduleId)) {
        deleted++;
        continue;
      }
      newValues.push(row);
    }

    // 書き戻し（deleteRowループを避ける）
    sheet.clearContents();
    sheet.getRange(1, 1, newValues.length, headers.length).setValues(newValues);
    return { success: true, deleted };
  });
}

function buildFixedScheduleIdsForDate_(targetDateStr, scheduleIds) {
  const fixed = new Set();
  const safeDateStr = normalizeCommentTargetDate_(targetDateStr);
  if (!safeDateStr) return fixed;

  const uniqueScheduleIds = Array.from(new Set((scheduleIds || []).map(id => normalizeCell_(id)).filter(Boolean)));
  if (!uniqueScheduleIds.length) return fixed;

  const targetDate = parseScheduleDate_(safeDateStr);
  if (!targetDate) return fixed;
  const day = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const dateRange = { start: day, end: day };

  const fixedOccurrences = getFixedOccurrences_(dateRange);
  if (!fixedOccurrences || Object.keys(fixedOccurrences).length === 0) return fixed;

  const scheduleIdToSourceRow = buildSourceRowMapForScheduleIds_(uniqueScheduleIds);
  uniqueScheduleIds.forEach(scheduleId => {
    const sourceRow = scheduleIdToSourceRow[scheduleId];
    if (!sourceRow) return;
    if (fixedOccurrences[buildFixedOccurrenceKey_(sourceRow, safeDateStr)]) {
      fixed.add(scheduleId);
    }
  });
  return fixed;
}

function buildSourceRowMapForScheduleIds_(scheduleIds) {
  const map = {};
  const uniqueScheduleIds = Array.from(new Set((scheduleIds || []).map(id => normalizeCell_(id)).filter(Boolean)));
  if (!uniqueScheduleIds.length) return map;

  // "app_schedule:123" の形式は即決
  uniqueScheduleIds.forEach(scheduleId => {
    const match = scheduleId.match(/^app_schedule:(\\d+)$/);
    if (match) map[scheduleId] = match[1];
  });

  const unresolved = uniqueScheduleIds.filter(id => !map[id]);
  if (!unresolved.length) return map;

  const ss = getSourceSpreadsheet_();
  const sheet = ss.getSheetByName(SCHEDULE_SHEET_NAME);
  if (!sheet) return map;

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return map;

  const headers = values[0].map(header => String(header || '').trim());
  const idIndex = firstExistingHeaderIndex_(buildHeaderMap_(headers), SCHEDULE_FIELD_ALIASES.schedule_id);
  if (idIndex == null) return map;

  const unresolvedSet = new Set(unresolved);
  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const scheduleId = normalizeCell_(values[rowIndex][idIndex]);
    if (!scheduleId || !unresolvedSet.has(scheduleId)) continue;
    map[scheduleId] = String(rowIndex + 1);
    unresolvedSet.delete(scheduleId);
    if (unresolvedSet.size === 0) break;
  }
  return map;
}

function resumeDeliveryUnlocked_(scheduleId, targetDate) {
  const safeScheduleId = normalizeCell_(scheduleId);
  const safeTargetDate = normalizeCommentTargetDate_(targetDate);
  if (!safeScheduleId) throw new Error('schedule_id is required');
  if (!safeTargetDate) throw new Error('target_date is required');
  if (isScheduleOccurrenceFixedById_(safeScheduleId, safeTargetDate)) {
    throw new Error('確定済みの配信日は再開できません');
  }

  const sheet = getExceptionsSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { success: true, action: 'resumed', deleted: 0 };

  const headers = values[0].map(header => String(header || '').trim());
  const scheduleIndex = headers.indexOf('schedule_id');
  const dateIndex = headers.indexOf('target_date');
  const statusIndex = headers.indexOf('status');
  if (scheduleIndex < 0 || dateIndex < 0) return { success: true, action: 'resumed', deleted: 0 };

  let deleted = 0;
  for (let index = values.length - 1; index >= 1; index--) {
    const row = values[index];
    const rowStatus = statusIndex >= 0 ? normalizeCell_(row[statusIndex]) : 'stopped';
    if (
      normalizeCell_(row[scheduleIndex]) === safeScheduleId &&
      normalizeCommentTargetDate_(row[dateIndex]) === safeTargetDate &&
      (!rowStatus || rowStatus === 'stopped')
    ) {
      sheet.deleteRow(index + 1);
      deleted++;
    }
  }

  return { success: true, action: 'resumed', deleted };
}

/**
 * ドラッグ＆ドロップによる配信日時更新（個別発生分のみの移動）
 * app_schedule は更新せず、app_check_status に移動先日時を記録する
 */
function updateItemDate(scheduleId, oldDate, newDateStr, newHour) {
  return withScriptLock_(() => updateItemDateUnlocked_(scheduleId, oldDate, newDateStr, newHour));
}

function updateItemDateUnlocked_(scheduleId, oldDate, newDateStr, newHour) {
  const safeScheduleId = normalizeScheduleIdForMove_(scheduleId);
  const safeOldDate = normalizeCommentTargetDate_(oldDate);
  const safeDate = normalizeCommentTargetDate_(newDateStr);
  const safeHour = normalizeCell_(newHour);
  if (!safeScheduleId || !safeOldDate || !safeDate || !safeHour) throw new Error('scheduleId, oldDate, newDate, and newHour are required');

  const sourceRow = getSourceRowByScheduleId_(safeScheduleId);
  if (!sourceRow) throw new Error(`Schedule row not found for ID: ${safeScheduleId}`);

  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  const checkStatusSheet = getCheckStatusSheet_();
  const csHeaders = getCheckStatusHeaders_(checkStatusSheet);
  
  const logPayload = {
    schedule_id: safeScheduleId,
    delivery_date: safeDate,
    hour: safeHour,
    original_date: safeOldDate,
    mail_name: '(移動による自動更新)',
    confirmed_by: 'System (DnD)',
    confirmed_at: timestamp
  };
  
  const itemId = `${safeScheduleId}|${safeOldDate}`;
  const logRow = buildCheckStatusRow_(csHeaders, itemId, 'move_override', true, logPayload, timestamp);
  const values = checkStatusSheet.getDataRange().getValues();
  const itemIdIndex = csHeaders.indexOf('item_id');
  const fieldIndex = csHeaders.indexOf('field');
  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    if (normalizeCell_(row[itemIdIndex]) === itemId && normalizeCell_(row[fieldIndex]) === 'move_override') {
      checkStatusSheet.getRange(rowIndex + 1, 1, 1, csHeaders.length).setValues([mergeCheckStatusRow_(csHeaders, row, logRow)]);
      return { success: true, schedule_id: safeScheduleId, original_date: safeOldDate, delivery_date: safeDate, hour: safeHour };
    }
  }

  checkStatusSheet.appendRow(logRow);

  return { success: true, schedule_id: safeScheduleId, original_date: safeOldDate, delivery_date: safeDate, hour: safeHour };
}

/**
 * PRマスタとPRターゲット設定を統合保存する (最適化版)
 */
function savePRData(prPayload, targetNewsletters) {
  return withScriptLock_(() => savePRDataUnlocked_(prPayload, targetNewsletters));
}

function savePRDataUnlocked_(prPayload, targetNewsletters) {
  const ss = getSourceSpreadsheet_();
  
  // 1. app_pr マスタの保存
  const savedPr = saveMasterDataUnlocked_('app_pr', prPayload);
  const prId = normalizeCell_(prPayload.pr_id) || normalizeCell_(savedPr.id);
  if (!prId) throw new Error('pr_id is required');
  
  // 2. app_pr_targets の一括更新
  const targetsSheet = ss.getSheetByName('app_pr_targets');
  if (!targetsSheet) throw new Error('Sheet not found: app_pr_targets');
  
  const range = targetsSheet.getDataRange();
  const values = range.getValues();
  const headers = values[0].map(h => String(h).trim());
  const prIdIndex = headers.indexOf('pr_id');
  const mailNameIndex = headers.indexOf('mail_name');
  const sourceRowIndex = headers.indexOf('source_row');
  const targetIndexIndex = headers.indexOf('target_index');
  if (prIdIndex < 0 || mailNameIndex < 0) {
    throw new Error('app_pr_targets must have pr_id and mail_name headers');
  }
  
  // 該当する pr_id 以外を残す形でフィルタリングし、一括でセットする
  const remainingRows = values.slice(1).filter(row => String(row[prIdIndex]).trim() !== String(prId));
  
  const newRows = (targetNewsletters || []).map((nl, index) => {
    const row = new Array(headers.length).fill('');
    row[prIdIndex] = prId;
    row[mailNameIndex] = nl.mail_name;
    if (sourceRowIndex >= 0) row[sourceRowIndex] = nl.source_row;
    if (targetIndexIndex >= 0) row[targetIndexIndex] = index + 1;
    return row;
  });
  
  const finalValues = [headers].concat(remainingRows).concat(newRows);
  
  // シートをクリアして一括書き込み
  targetsSheet.clearContents();
  targetsSheet.getRange(1, 1, finalValues.length, headers.length).setValues(finalValues);
  invalidateInitialDataCaches_(['app_pr', 'app_pr_targets']);
  
  return { success: true };
}

function saveCheckStatus(itemId, field, active, payload) {
  return withScriptLock_(() => saveCheckStatusUnlocked_(itemId, field, active, payload));
}

function saveCheckStatuses(updates) {
  return withScriptLock_(() => {
    const rows = Array.isArray(updates) ? updates : [];
    return rows.map(update => saveCheckStatusUnlocked_(
      update && update.itemId,
      update && update.field,
      update && update.active,
      update && update.payload
    ));
  });
}

function saveCheckStatusUnlocked_(itemId, field, active, payload) {
  const safeItemId = normalizeCell_(itemId);
  const safeField = normalizeCell_(field);
  const safePayload = payload || {};
  const deliveryDate = parseScheduleDate_(safePayload.delivery_date);
  
  if (!safeItemId) throw new Error('item_id is required');
  if (!safeField) throw new Error('field is required');

  // 14日前より古いデータは更新不可
  if (deliveryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = (today.getTime() - deliveryDate.getTime()) / (24 * 60 * 60 * 1000);
    if (diff >= 14) {
      throw new Error('過去14日以上前のデータは更新できません');
    }
  }

  const sheet = getCheckStatusSheet_();
  const headers = getCheckStatusHeaders_(sheet);
  const values = sheet.getDataRange().getValues();
  const itemIdIndex = headers.indexOf('item_id');
  const fieldIndex = headers.indexOf('field');
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  const activeValue = active === true || String(active).toLowerCase() === 'true';
  const rowValues = buildCheckStatusRow_(headers, safeItemId, safeField, activeValue, payload, timestamp);

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    if (normalizeCell_(row[itemIdIndex]) === safeItemId && normalizeCell_(row[fieldIndex]) === safeField) {
      sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([mergeCheckStatusRow_(headers, row, rowValues)]);
      const archive = archiveOccurrenceIfBothChecksActive_(safeItemId, safeField, activeValue, safePayload);
      return { success: true, item_id: safeItemId, field: safeField, active: activeValue, updated_at: timestamp, archive };
    }
  }

  sheet.appendRow(rowValues);
  const archive = archiveOccurrenceIfBothChecksActive_(safeItemId, safeField, activeValue, safePayload);
  return { success: true, item_id: safeItemId, field: safeField, active: activeValue, updated_at: timestamp, archive };
}

function archiveOccurrenceIfBothChecksActive_(itemId, changedField, active, payload) {
  if (changedField !== 'setter' && changedField !== 'checker') return { archived: 0, skipped: 'not_confirmation_field' };

  const safePayload = payload || {};
  const scheduleId = normalizeScheduleIdForMove_(safePayload.schedule_id || String(itemId).split('|')[0]);
  const targetDate = normalizeCommentTargetDate_(safePayload.delivery_date || String(itemId).split('|')[1]);
  if (!scheduleId || !targetDate) return { archived: 0, deleted: 0, skipped: 'missing_schedule_or_date' };

  const sourceRow = getSourceRowByScheduleId_(scheduleId);
  if (!sourceRow) return { archived: 0, deleted: 0, skipped: 'source_row_not_found' };

  const isRAssignee = normalizeCell_(safePayload.assignee) === 'R';

  if (!active) {
    if (isRAssignee && changedField === 'checker') {
      return { archived: 0, deleted: 0, skipped: 'r_assignee_checker_not_required' };
    }
    return deleteSingleDayArchive_(sourceRow, targetDate);
  }

  const statusMap = getCheckStatusActiveMap_(itemId);
  if (!statusMap.setter || (!statusMap.checker && !isRAssignee)) return { archived: 0, skipped: 'waiting_for_required_checks' };

  if (isArchivedOccurrenceFixed_(sourceRow, targetDate)) return { archived: 0, skipped: 'already_archived' };

  const ss = getSourceSpreadsheet_();
  const sheet = ss.getSheetByName(SCHEDULE_SHEET_NAME);
  if (!sheet) throw new Error(`Sheet not found: ${SCHEDULE_SHEET_NAME}`);

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { archived: 0, skipped: 'empty_schedule' };

  const headers = values[0].map(header => String(header || '').trim());
  const rowIndex = Number(sourceRow);
  if (rowIndex < 2 || rowIndex > values.length) return { archived: 0, skipped: 'source_row_out_of_range' };

  const row = values[rowIndex - 1].slice();
  applyOccurrenceOverrideToArchiveRow_(row, headers, itemId);

  const archiveSheet = getOrCreateArchiveSheet_(ss, headers);
  archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, 1, headers.length + 4).setValues([[
    new Date(),
    targetDate,
    targetDate,
    sourceRow
  ].concat(row.slice(0, headers.length))]);

  return { archived: 1, source_row: sourceRow, target_date: targetDate };
}

function deleteSingleDayArchive_(sourceRow, targetDate) {
  const ss = getSourceSpreadsheet_();
  const archiveSheet = ss.getSheetByName(SCHEDULE_ARCHIVE_SHEET_NAME);
  if (!archiveSheet || archiveSheet.getLastRow() < 2) return { archived: 0, deleted: 0, skipped: 'archive_not_found' };

  const values = archiveSheet.getDataRange().getDisplayValues();
  const headers = values[0].map(header => String(header || '').trim());
  const sourceRowIndex = headers.indexOf('source_row');
  const weekStartIndex = headers.indexOf('fixed_week_start');
  const weekEndIndex = headers.indexOf('fixed_week_end');
  if (sourceRowIndex < 0 || weekStartIndex < 0 || weekEndIndex < 0) {
    return { archived: 0, deleted: 0, skipped: 'archive_headers_missing' };
  }

  let deleted = 0;
  for (let rowIndex = values.length - 1; rowIndex >= 1; rowIndex--) {
    const row = values[rowIndex];
    const rowSource = normalizeCell_(row[sourceRowIndex]);
    const start = normalizeCommentTargetDate_(row[weekStartIndex]);
    const end = normalizeCommentTargetDate_(row[weekEndIndex]);

    if (
      rowSource === normalizeCell_(sourceRow) &&
      start === targetDate &&
      end === targetDate
    ) {
      archiveSheet.deleteRow(rowIndex + 1);
      deleted++;
    }
  }

  return { archived: 0, deleted, source_row: sourceRow, target_date: targetDate };
}

function getCheckStatusActiveMap_(itemId) {
  const result = { setter: false, checker: false };
  const sheet = getCheckStatusSheet_();
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return result;

  const headers = values[0].map(header => String(header || '').trim());
  const itemIdIndex = headers.indexOf('item_id');
  const fieldIndex = headers.indexOf('field');
  const activeIndex = headers.indexOf('is_active');
  if (itemIdIndex < 0 || fieldIndex < 0 || activeIndex < 0) return result;

  values.slice(1).forEach(row => {
    if (normalizeCell_(row[itemIdIndex]) !== itemId) return;
    const field = normalizeCell_(row[fieldIndex]);
    if (field === 'setter' || field === 'checker') result[field] = isTruthy_(row[activeIndex]);
  });
  return result;
}

function applyOccurrenceOverrideToArchiveRow_(row, scheduleHeaders, itemId) {
  const override = getOccurrenceOverrideForArchive_(itemId);
  if (!override || !override.fields.length) return;

  const headerMap = buildHeaderMap_(scheduleHeaders);
  override.fields.forEach(key => {
    const aliases = SCHEDULE_FIELD_ALIASES[key] || [key];
    const index = firstExistingHeaderIndex_(headerMap, aliases);
    if (index == null) return;
    row[index] = override.values[key];
  });
}

function getOccurrenceOverrideForArchive_(itemId) {
  const sheet = getCheckStatusSheet_();
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return null;

  const headers = values[0].map(header => String(header || '').trim());
  const itemIdIndex = headers.indexOf('item_id');
  const fieldIndex = headers.indexOf('field');
  const activeIndex = headers.indexOf('is_active');
  const overrideFieldsIndex = headers.indexOf('override_fields');
  if (itemIdIndex < 0 || fieldIndex < 0 || activeIndex < 0 || overrideFieldsIndex < 0) return null;

  for (let rowIndex = values.length - 1; rowIndex >= 1; rowIndex--) {
    const row = values[rowIndex];
    if (normalizeCell_(row[itemIdIndex]) !== itemId) continue;
    if (normalizeCell_(row[fieldIndex]) !== 'occurrence_override') continue;
    if (!isTruthy_(row[activeIndex])) continue;

    const fields = normalizeCell_(row[overrideFieldsIndex])
      .split(',')
      .map(value => normalizeCell_(value))
      .filter(Boolean);
    const fieldValues = {};
    fields.forEach(key => {
      const index = headers.indexOf(key);
      if (index >= 0) fieldValues[key] = normalizeCell_(row[index]);
    });
    return { fields, values: fieldValues };
  }
  return null;
}

function buildCheckStatusRow_(headers, itemId, field, active, payload, timestamp) {
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  const isCheckerConfirmation = field === 'checker' && active;
  const confirmedBy = isCheckerConfirmation ? getCurrentUserLabel_() : '';
  const confirmedAt = isCheckerConfirmation ? timestamp : '';

  return headers.map(header => {
    switch (header) {
      case 'item_id':
        return itemId;
      case 'field':
        return field;
      case 'is_active':
        return active;
      case 'updated_at':
        return timestamp;
      case 'schedule_id':
        return normalizeScheduleIdForMove_(safePayload.schedule_id || itemId);
      case 'original_date':
        return normalizeCommentTargetDate_(safePayload.original_date);
      case 'delivery_date':
        return normalizeCommentTargetDate_(safePayload.delivery_date);
      case 'hour':
        return normalizeCell_(safePayload.hour);
      case 'weekday':
        return normalizeCell_(safePayload.weekday);
      case 'start_date':
        return normalizeCell_(safePayload.start_date);
      case 'end_date':
        return normalizeCell_(safePayload.end_date);
      case 'cycle':
        return normalizeCell_(safePayload.cycle);
      case 'mail_name':
        return normalizeCell_(safePayload.mail_name);
      case 'job_url':
        return normalizeCell_(safePayload.job_url);
      case 'auto_job_feature_id':
        return normalizeCell_(safePayload.auto_job_feature_id);
      case 'target_age':
        return normalizeCell_(safePayload.target_age);
      case 'target_address':
        return normalizeCell_(safePayload.target_address);
      case 'new_flag':
        return normalizeCell_(safePayload.new_flag);
      case 'current_job_count':
        return normalizeCell_(safePayload.current_job_count);
      case 'override_fields':
        return normalizeCell_(safePayload.override_fields);
      case 'delivery_count':
        return normalizeCell_(safePayload.delivery_count);
      case 'assignee':
        return normalizeCell_(safePayload.assignee);
      case 'reviewer':
        return normalizeCell_(safePayload.reviewer);
      case 'notes':
        return normalizeCell_(safePayload.notes);
      case 'category':
        return normalizeCell_(safePayload.category);
      case 'sub_category':
        return normalizeCell_(safePayload.sub_category);
      case 'format':
        return normalizeCell_(safePayload.format);
      case 'pr':
        return normalizeCell_(safePayload.pr);
      case 'confirmed_by':
        return confirmedBy;
      case 'confirmed_at':
        return confirmedAt;
      default:
        return '';
    }
  });
}

function mergeCheckStatusRow_(headers, existingRow, nextRow) {
  return headers.map((header, index) => {
    if ((header === 'confirmed_by' || header === 'confirmed_at') && !nextRow[index]) {
      return existingRow[index] || '';
    }
    return nextRow[index];
  });
}

function fetchJobCountFromUrl(url) {
  const safeUrl = normalizeCell_(url);
  if (!safeUrl) return null;

  try {
    const response = UrlFetchApp.fetch(safeUrl, {
      muteHttpExceptions: true,
      followRedirects: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MailMagazineMaker/1.0)'
      }
    });
    const status = response.getResponseCode();
    if (status < 200 || status >= 300) return null;

    return extractJobCountFromHtml_(response.getContentText('UTF-8'));
  } catch (error) {
    return null;
  }
}

function extractJobCountFromHtml_(html) {
  const source = String(html || '');
  const xpathText = extractTextByJobCountXPath_(source);
  if (xpathText) {
    const xpathCount = parseJobCountText_(xpathText, true);
    if (xpathCount != null) return xpathCount;
  }

  const normalized = source
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x2F;/g, '/')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ');

  return parseJobCountText_(stripHtml_(normalized), false);
}

function extractTextByJobCountXPath_(html) {
  const form = getFirstTagBlock_(html, 'form');
  const formDiv1 = getNthDirectChildTagBlock_(form, 'div', 1);
  const formDiv1Div3 = getNthDirectChildTagBlock_(formDiv1, 'div', 3);
  const main = getFirstTagBlock_(formDiv1Div3, 'main');
  const mainDiv1 = getNthDirectChildTagBlock_(main, 'div', 1);
  const mainDiv1Div1 = getNthDirectChildTagBlock_(mainDiv1, 'div', 1);
  const mainDiv1Div1Div2 = getNthDirectChildTagBlock_(mainDiv1Div1, 'div', 2);
  const targetDiv = getNthDirectChildTagBlock_(mainDiv1Div1Div2, 'div', 1);
  const span = getNthDirectChildTagBlock_(targetDiv, 'span', 1);
  return stripHtml_(span);
}

function getFirstTagBlock_(html, tagName) {
  return getNthTagBlock_(html, tagName, 1);
}

function getNthDirectChildTagBlock_(html, tagName, targetIndex) {
  if (!html) return '';
  const searchHtml = getInnerHtml_(html) || html;

  let depth = 0;
  let count = 0;
  const tagPattern = new RegExp(`<\\/?([a-zA-Z0-9]+)\\b[^>]*>`, 'g');
  let match;
  while ((match = tagPattern.exec(searchHtml)) !== null) {
    const fullTag = match[0];
    const name = match[1].toLowerCase();
    const isClosing = fullTag.indexOf('</') === 0;
    const isSelfClosing = /\/>$/.test(fullTag);

    if (!isClosing && depth === 0 && name === tagName.toLowerCase()) {
      count++;
      if (count === targetIndex) {
        const block = readTagBlockFrom_(searchHtml, match.index, tagName);
        return block;
      }
    }

    if (isClosing) {
      depth = Math.max(0, depth - 1);
    } else if (!isSelfClosing) {
      depth++;
    }
  }
  return '';
}

function getInnerHtml_(html) {
  const text = String(html || '');
  const openEnd = text.indexOf('>');
  const closeStart = text.lastIndexOf('</');
  if (openEnd < 0 || closeStart <= openEnd) return '';
  return text.slice(openEnd + 1, closeStart);
}

function getNthTagBlock_(html, tagName, targetIndex) {
  if (!html) return '';

  const pattern = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  let match;
  let count = 0;
  while ((match = pattern.exec(html)) !== null) {
    count++;
    if (count === targetIndex) return readTagBlockFrom_(html, match.index, tagName);
  }
  return '';
}

function readTagBlockFrom_(html, startIndex, tagName) {
  const pattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  pattern.lastIndex = startIndex;

  let depth = 0;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const fullTag = match[0];
    const isClosing = fullTag.indexOf('</') === 0;
    const isSelfClosing = /\/>$/.test(fullTag);

    if (isClosing) {
      depth--;
      if (depth === 0) return html.slice(startIndex, pattern.lastIndex);
    } else if (!isSelfClosing) {
      depth++;
    }
  }
  return '';
}

function parseJobCountText_(text, allowBareCount) {
  const pattern = allowBareCount ? /(?:全\s*)?([\d,]+)\s*件?/ : /全\s*([\d,]+)\s*件/;
  const match = String(text || '').match(pattern);
  if (!match) return null;

  const count = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(count) ? count : null;
}

function stripHtml_(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function updateAllJobCounts() {
  return withScriptLock_(() => updateAllJobCountsUnlocked_());
}

function updateAllJobCountsUnlocked_() {
  const ss = getSourceSpreadsheet_();
  const sheet = ss.getSheetByName(SCHEDULE_SHEET_NAME);
  if (!sheet) throw new Error(`Sheet not found: ${SCHEDULE_SHEET_NAME}`);

  const range = sheet.getDataRange();
  const values = range.getValues();
  if (!values.length) return { success: true, updated: 0, failed: 0, skipped: 0 };

  const headers = values[0].map(header => String(header || '').trim());
  const jobUrlIndex = ensureHeaderAtMinColumn_(sheet, headers, 'job_url', 15);
  const jobCountIndex = ensureHeaderAtMinColumn_(sheet, headers, 'current_job_count', 16);
  const jobCountUpdatedAtIndex = ensureHeaderAtMinColumn_(sheet, headers, 'job_count_updated_at', 17);
  const refreshedValues = sheet.getDataRange().getValues();
  const fetchedAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (let rowIndex = 1; rowIndex < refreshedValues.length; rowIndex++) {
    const row = refreshedValues[rowIndex];
    const url = normalizeCell_(row[jobUrlIndex]);

    if (!url) {
      skipped++;
      continue;
    }
    if (!shouldRefreshJobCount_(row[jobCountUpdatedAtIndex], JOB_COUNT_REFRESH_INTERVAL_HOURS)) {
      skipped++;
      continue;
    }

    const count = fetchJobCountFromUrl(url);
    if (count == null) {
      failed++;
      continue;
    }

    sheet.getRange(rowIndex + 1, jobCountIndex + 1).setValue(count);
    sheet.getRange(rowIndex + 1, jobCountUpdatedAtIndex + 1).setValue(fetchedAt);
    updated++;
  }

  return { success: true, updated, failed, skipped };
}

function updateJobCountForRowUnlocked_(sheet, rowNumber, force) {
  if (!sheet || rowNumber < 2) return { success: true, updated: 0, skipped: 1 };

  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 18)).getValues()[0].map(header => String(header || '').trim());
  const jobUrlIndex = ensureHeaderAtMinColumn_(sheet, headers, 'job_url', 15);
  const jobCountIndex = ensureHeaderAtMinColumn_(sheet, headers, 'current_job_count', 16);
  const jobCountUpdatedAtIndex = ensureHeaderAtMinColumn_(sheet, headers, 'job_count_updated_at', 17);
  const row = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
  const url = normalizeCell_(row[jobUrlIndex]);
  if (!url) return { success: true, updated: 0, skipped: 1 };
  if (!force && !shouldRefreshJobCount_(row[jobCountUpdatedAtIndex], JOB_COUNT_REFRESH_INTERVAL_HOURS)) {
    return { success: true, updated: 0, skipped: 1 };
  }

  const count = fetchJobCountFromUrl(url);
  if (count == null) return { success: false, updated: 0, failed: 1 };

  const fetchedAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  sheet.getRange(rowNumber, jobCountIndex + 1).setValue(count);
  sheet.getRange(rowNumber, jobCountUpdatedAtIndex + 1).setValue(fetchedAt);
  return { success: true, updated: 1, skipped: 0 };
}

function shouldRefreshJobCount_(updatedAt, intervalHours) {
  const intervalMs = Number(intervalHours || JOB_COUNT_REFRESH_INTERVAL_HOURS) * 60 * 60 * 1000;
  const lastUpdated = parseDateTime_(updatedAt);
  if (!lastUpdated) return true;
  return new Date().getTime() - lastUpdated.getTime() >= intervalMs;
}

function setupWeeklyJobCountTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'updateAllJobCounts')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('updateAllJobCounts')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.TUESDAY)
    .atHour(4)
    .create();

  return { success: true, handler: 'updateAllJobCounts', weekday: 'TUESDAY', hour: 4 };
}

function setupHourlyJobCountTrigger() {
  return setupWeeklyJobCountTrigger();
}

function archiveOldOperationalLogs(retentionDays) {
  return withScriptLock_(() => {
    const days = Number(retentionDays || LOG_ARCHIVE_RETENTION_DAYS);
    const safeDays = Number.isFinite(days) && days > 0 ? days : LOG_ARCHIVE_RETENTION_DAYS;
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - safeDays);

    const ss = getSourceSpreadsheet_();
    const targets = [
      { sheetName: CHECK_STATUS_SHEET_NAME, dateHeaders: ['delivery_date', 'original_date', 'updated_at'] },
      { sheetName: COMMENTS_SHEET_NAME, dateHeaders: ['target_date', 'timestamp'] },
      { sheetName: EXCEPTIONS_SHEET_NAME, dateHeaders: ['target_date'] }
    ];

    const result = {
      success: true,
      retention_days: safeDays,
      cutoff_date: formatDate_(cutoff),
      sheets: {}
    };

    targets.forEach(target => {
      result.sheets[target.sheetName] = archiveOldRowsByDate_(ss, target.sheetName, target.dateHeaders, cutoff);
    });

    return result;
  });
}

function setupMonthlyLogArchiveTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'archiveOldOperationalLogs')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger('archiveOldOperationalLogs')
    .timeBased()
    .onMonthDay(1)
    .atHour(3)
    .create();

  return { success: true, handler: 'archiveOldOperationalLogs', day: 1, hour: 3, retention_days: LOG_ARCHIVE_RETENTION_DAYS };
}

function archiveOldRowsByDate_(ss, sheetName, dateHeaders, cutoff) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) {
    return { archived: 0, skipped: sheet ? sheet.getLastRow() - 1 : 0, reason: sheet ? 'no_data' : 'missing_sheet' };
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(header => String(header || '').trim());
  const dateIndexes = dateHeaders
    .map(header => headers.indexOf(header))
    .filter(index => index >= 0);

  if (!dateIndexes.length) {
    return { archived: 0, skipped: Math.max(values.length - 1, 0), reason: 'date_header_missing' };
  }

  const archiveRows = [];
  const deleteRowNumbers = [];

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    const rowDate = getArchiveCandidateDate_(row, dateIndexes);
    if (!rowDate || rowDate >= cutoff) continue;
    archiveRows.push([new Date()].concat(row.slice(0, headers.length)));
    deleteRowNumbers.push(rowIndex + 1);
  }

  if (!archiveRows.length) {
    return { archived: 0, skipped: Math.max(values.length - 1, 0), reason: 'no_old_rows' };
  }

  const archiveSheet = getOrCreateLogArchiveSheet_(ss, sheetName, headers);
  archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, archiveRows.length, archiveRows[0].length).setValues(archiveRows);
  deleteRowNumbers.reverse().forEach(rowNumber => sheet.deleteRow(rowNumber));

  return { archived: archiveRows.length, remaining: sheet.getLastRow() - 1, archive_sheet: archiveSheet.getName() };
}

function getArchiveCandidateDate_(row, dateIndexes) {
  const dates = dateIndexes
    .map(index => parseScheduleDate_(row[index]))
    .filter(Boolean)
    .map(date => new Date(date.getFullYear(), date.getMonth(), date.getDate()));
  if (!dates.length) return null;
  return new Date(Math.max.apply(null, dates.map(date => date.getTime())));
}

function getOrCreateLogArchiveSheet_(ss, sourceSheetName, sourceHeaders) {
  const archiveSheetName = `${sourceSheetName}_archive`;
  const archiveHeaders = ['archived_at'].concat(sourceHeaders);
  let sheet = ss.getSheetByName(archiveSheetName);
  if (!sheet) sheet = ss.insertSheet(archiveSheetName);

  const currentHeaders = sheet.getLastColumn()
    ? sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), archiveHeaders.length)).getValues()[0].map(header => String(header || '').trim())
    : [];

  if (!currentHeaders.some(Boolean)) {
    sheet.getRange(1, 1, 1, archiveHeaders.length).setValues([archiveHeaders]);
  } else if (currentHeaders.slice(0, archiveHeaders.length).join('\t') !== archiveHeaders.join('\t')) {
    sheet.getRange(1, 1, 1, archiveHeaders.length).setValues([archiveHeaders]);
  }

  return sheet;
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

function getCommentCounts_(dateRange) {
  const cache = CacheService.getScriptCache();
  const cacheKey = buildCommentCountsCacheKey_(dateRange);
  if (cacheKey) {
    const cached = cache.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch (error) {
        // ignore cache parse errors
      }
    }
  }

  const counts = {};
  const sheet = getCommentsSheet_();
  const values = sheet.getDataRange().getDisplayValues();
  if (values.length < 2) return counts;

  const headers = values[0].map(header => String(header || '').trim());
  const scheduleIndex = headers.indexOf('schedule_id');
  const dateIndex = headers.indexOf('target_date');
  if (scheduleIndex < 0 || dateIndex < 0) return counts;

  values.slice(1).forEach(row => {
    const scheduleId = normalizeCell_(row[scheduleIndex]);
    const targetDate = normalizeCommentTargetDate_(row[dateIndex]);
    if (!isDateInOperationalRange_(targetDate, dateRange)) return;
    if (!scheduleId || !targetDate) return;
    const key = buildCommentKey_(scheduleId, targetDate);
    counts[key] = (counts[key] || 0) + 1;
  });

  if (cacheKey) {
    try {
      cache.put(cacheKey, JSON.stringify(counts), 300);
    } catch (error) {
      // ignore cache errors
    }
  }
  return counts;
}

function getStoppedOccurrences_(dateRange) {
  const stopped = {};
  getSheetObjects_(EXCEPTIONS_SHEET_NAME, true).forEach(exception => {
    const scheduleId = normalizeCell_(exception.schedule_id);
    const targetDate = normalizeCommentTargetDate_(exception.target_date);
    if (!isDateInOperationalRange_(targetDate, dateRange)) return;
    const status = normalizeCell_(exception.status) || 'stopped';
    if (!scheduleId || !targetDate || status !== 'stopped') return;
    stopped[buildStoppedOccurrenceKey_(scheduleId, targetDate)] = true;
  });
  return stopped;
}

function getCheckStatuses_(dateRange) {
  const statuses = {};
  getSheetObjects_(CHECK_STATUS_SHEET_NAME, true).forEach(status => {
    const itemId = normalizeCell_(status.item_id);
    const field = normalizeCell_(status.field);
    if (!itemId || !field) return;
    const deliveryDate = normalizeCommentTargetDate_(status.delivery_date);
    const originalDate = normalizeCommentTargetDate_(status.original_date);
    if (
      dateRange &&
      !isDateInOperationalRange_(deliveryDate, dateRange) &&
      !isDateInOperationalRange_(originalDate, dateRange)
    ) {
      return;
    }
    const key = buildCheckStatusKey_(itemId, field);
    if (field === 'move_override' && isTruthy_(status.is_active)) {
      statuses[key] = {
        item_id: itemId,
        field,
        schedule_id: normalizeScheduleIdForMove_(status.schedule_id || itemId),
        original_date: normalizeCommentTargetDate_(status.original_date),
        delivery_date: normalizeCommentTargetDate_(status.delivery_date),
        hour: normalizeCell_(status.hour),
        is_active: true
      };
    } else if (field === 'occurrence_override' && isTruthy_(status.is_active)) {
      const overrideFields = normalizeCell_(status.override_fields)
        .split(',')
        .map(v => String(v || '').trim())
        .filter(Boolean);
      const obj = {
        item_id: itemId,
        field,
        schedule_id: normalizeScheduleIdForMove_(status.schedule_id || itemId),
        original_date: normalizeCommentTargetDate_(status.original_date),
        delivery_date: normalizeCommentTargetDate_(status.delivery_date),
        hour: normalizeCell_(status.hour),
        mail_name: normalizeCell_(status.mail_name),
        is_active: true,
        override_fields: overrideFields
      };
      overrideFields.forEach(k => {
        obj[k] = normalizeCell_(status[k]);
      });
      statuses[key] = obj;
    } else {
      statuses[key] = isTruthy_(status.is_active);
    }
  });
  return statuses;
}

function getCommentsSheet_() {
  const ss = getSourceSpreadsheet_();
  const sheet = ss.getSheetByName(COMMENTS_SHEET_NAME);
  if (!sheet) throw new Error(`Sheet not found: ${COMMENTS_SHEET_NAME}`);
  getCommentHeaders_(sheet);
  return sheet;
}

function getCommentHeaders_(sheet) {
  const requiredHeaders = ['schedule_id', 'timestamp', 'user', 'comment_text', 'target_date'];
  const lastColumn = Math.max(sheet.getLastColumn(), requiredHeaders.length);
  let headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(header => String(header || '').trim());

  if (!headers.some(Boolean)) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    return requiredHeaders;
  }

  requiredHeaders.forEach(header => {
    if (headers.indexOf(header) !== -1) return;
    headers.push(header);
    sheet.getRange(1, headers.length).setValue(header);
  });

  return headers;
}

function buildCommentKey_(scheduleId, targetDate) {
  return `${normalizeCell_(scheduleId)}|${normalizeCommentTargetDate_(targetDate)}`;
}

function getExceptionsSheet_() {
  const ss = getSourceSpreadsheet_();
  let sheet = ss.getSheetByName(EXCEPTIONS_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(EXCEPTIONS_SHEET_NAME);
  getExceptionHeaders_(sheet);
  return sheet;
}

function getExceptionHeaders_(sheet) {
  const requiredHeaders = ['schedule_id', 'target_date', 'status'];
  const lastColumn = Math.max(sheet.getLastColumn(), requiredHeaders.length);
  let headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(header => String(header || '').trim());

  if (!headers.some(Boolean)) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    return requiredHeaders;
  }

  requiredHeaders.forEach(header => {
    if (headers.indexOf(header) !== -1) return;
    headers.push(header);
    sheet.getRange(1, headers.length).setValue(header);
  });

  return headers;
}

function buildStoppedOccurrenceKey_(scheduleId, targetDate) {
  const safeScheduleId = normalizeCell_(scheduleId);
  const safeTargetDate = normalizeCommentTargetDate_(targetDate);
  return safeScheduleId && safeTargetDate ? `${safeScheduleId}|${safeTargetDate}` : '';
}

function getCheckStatusSheet_() {
  const ss = getSourceSpreadsheet_();
  const sheet = ss.getSheetByName(CHECK_STATUS_SHEET_NAME) || ss.insertSheet(CHECK_STATUS_SHEET_NAME);
  getCheckStatusHeaders_(sheet);
  return sheet;
}

function getCheckStatusHeaders_(sheet) {
  const requiredHeaders = [
    'item_id',
    'field',
    'is_active',
    'updated_at',
    'schedule_id',
    'original_date',
    'delivery_date',
    'hour',
    'weekday',
    'start_date',
    'end_date',
    'cycle',
    'mail_name',
    'job_url',
    'auto_job_feature_id',
    'target_age',
    'target_address',
    'new_flag',
    'current_job_count',
    'override_fields',
    'delivery_count',
    'assignee',
    'reviewer',
    'notes',
    'category',
    'sub_category',
    'format',
    'pr',
    'confirmed_by',
    'confirmed_at'
  ];
  const lastColumn = Math.max(sheet.getLastColumn(), requiredHeaders.length);
  let headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(header => String(header || '').trim());

  if (!headers.some(Boolean)) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    return requiredHeaders;
  }

  requiredHeaders.forEach(header => {
    if (headers.indexOf(header) !== -1) return;
    headers.push(header);
    sheet.getRange(1, headers.length).setValue(header);
  });

  return headers;
}

function buildCheckStatusKey_(itemId, field) {
  return `${normalizeCell_(itemId)}|${normalizeCell_(field)}`;
}

function normalizeCommentTargetDate_(value) {
  const date = parseScheduleDate_(value);
  return date ? formatDate_(date) : normalizeCell_(value);
}

function getCommentTime_(value) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

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

function migrateSheetIds_(ss, sheetName, idAliases, prefix, dryRun) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { sheetName, changed: 0, idMap: {}, skipped: true };

  const range = sheet.getDataRange();
  const values = range.getValues();
  if (!values.length) return { sheetName, changed: 0, idMap: {} };

  const headers = values[0].map(header => String(header || '').trim());
  const idIndex = firstExistingHeaderIndex_(buildHeaderMap_(headers), idAliases);
  if (idIndex == null) return { sheetName, changed: 0, idMap: {}, skipped: true };

  const idMap = {};
  const usedNumbers = new Set();
  const englishPattern = new RegExp(`^${prefix}_(\\d+)$`);

  values.slice(1).forEach(row => {
    const currentId = normalizeCell_(row[idIndex]);
    const match = currentId.match(englishPattern);
    if (match) usedNumbers.add(Number(match[1]));
  });

  let nextNumber = 1;
  const nextId = () => {
    while (usedNumbers.has(nextNumber)) nextNumber++;
    usedNumbers.add(nextNumber);
    return `${prefix}_${String(nextNumber).padStart(3, '0')}`;
  };

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const currentId = normalizeCell_(values[rowIndex][idIndex]);
    if (!currentId || englishPattern.test(currentId)) continue;

    const newId = nextId();
    idMap[currentId] = newId;
    values[rowIndex][idIndex] = newId;
  }

  if (!dryRun && Object.keys(idMap).length) {
    range.setValues(values);
  }

  return { sheetName, changed: Object.keys(idMap).length, idMap };
}

function updateReferenceIds_(ss, sheetName, idAliases, idMap) {
  if (!idMap || !Object.keys(idMap).length) return;

  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  const range = sheet.getDataRange();
  const values = range.getValues();
  if (!values.length) return;

  const headers = values[0].map(header => String(header || '').trim());
  const idIndex = firstExistingHeaderIndex_(buildHeaderMap_(headers), idAliases);
  if (idIndex == null) return;

  let changed = false;
  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const currentId = normalizeCell_(values[rowIndex][idIndex]);
    if (Object.prototype.hasOwnProperty.call(idMap, currentId)) {
      values[rowIndex][idIndex] = idMap[currentId];
      changed = true;
    }
  }

  if (changed) range.setValues(values);
}

function getOrCreateArchiveSheet_(ss, scheduleHeaders) {
  const sheet = ss.getSheetByName(SCHEDULE_ARCHIVE_SHEET_NAME) || ss.insertSheet(SCHEDULE_ARCHIVE_SHEET_NAME);
  const archiveHeaders = ['archived_at', 'fixed_week_start', 'fixed_week_end', 'source_row'].concat(scheduleHeaders);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, archiveHeaders.length).setValues([archiveHeaders]);
  } else {
    const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), archiveHeaders.length)).getValues()[0];
    if (!currentHeaders[0]) {
      sheet.getRange(1, 1, 1, archiveHeaders.length).setValues([archiveHeaders]);
    } else {
      const currentSet = new Set(currentHeaders.map(header => String(header || '').trim()).filter(Boolean));
      let nextHeaders = currentHeaders.map(header => String(header || '').trim());
      archiveHeaders.forEach(header => {
        if (!currentSet.has(header)) nextHeaders.push(header);
      });
      if (nextHeaders.length !== currentHeaders.length) {
        sheet.getRange(1, 1, 1, nextHeaders.length).setValues([nextHeaders]);
      }
    }
  }

  return sheet;
}

function getExistingArchiveKeys_(archiveSheet) {
  const keys = new Set();
  if (archiveSheet.getLastRow() < 2) return keys;

  const values = archiveSheet.getDataRange().getDisplayValues();
  const headers = values[0].map(header => String(header || '').trim());
  const weekStartIndex = headers.indexOf('fixed_week_start');
  const sourceRowIndex = headers.indexOf('source_row');
  if (weekStartIndex < 0 || sourceRowIndex < 0) return keys;

  values.slice(1).forEach(row => {
    keys.add(`${row[sourceRowIndex]}|${row[weekStartIndex]}`);
  });
  return keys;
}

function getFixedOccurrences_(dateRange) {
  const ss = getSourceSpreadsheet_();
  const archiveSheet = ss.getSheetByName(SCHEDULE_ARCHIVE_SHEET_NAME);
  const fixedOccurrences = {};
  if (!archiveSheet || archiveSheet.getLastRow() < 2) return fixedOccurrences;

  const values = archiveSheet.getDataRange().getDisplayValues();
  const headers = values[0].map(header => String(header || '').trim());
  const sourceRowIndex = headers.indexOf('source_row');
  const weekStartIndex = headers.indexOf('fixed_week_start');
  const weekEndIndex = headers.indexOf('fixed_week_end');
  if (sourceRowIndex < 0 || weekStartIndex < 0 || weekEndIndex < 0) return fixedOccurrences;

  values.slice(1).forEach(row => {
    const sourceRow = normalizeCell_(row[sourceRowIndex]);
    const start = parseScheduleDate_(row[weekStartIndex]);
    const end = parseScheduleDate_(row[weekEndIndex]);
    if (!sourceRow || !start || !end) return;
    if (dateRange && (end < dateRange.start || start > dateRange.end)) return;

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      if (!isDateInOperationalRange_(formatDate_(date), dateRange)) continue;
      fixedOccurrences[buildFixedOccurrenceKey_(sourceRow, formatDate_(date))] = true;
    }
  });

  return fixedOccurrences;
}

function isArchivedOccurrenceFixed_(sourceRow, targetDate) {
  const fixedOccurrences = getFixedOccurrences_();
  return !!fixedOccurrences[buildFixedOccurrenceKey_(sourceRow, normalizeCell_(targetDate))];
}

function isScheduleOccurrenceFixedById_(scheduleId, targetDate) {
  const sourceRow = getSourceRowByScheduleId_(scheduleId);
  return sourceRow ? isArchivedOccurrenceFixed_(sourceRow, targetDate) : false;
}

function buildFixedOccurrenceKey_(sourceRow, targetDate) {
  return `${normalizeCell_(sourceRow)}|${normalizeCell_(targetDate)}`;
}

function buildArchiveKey_(sourceRow, weekStart) {
  return `${sourceRow}|${formatDate_(weekStart)}`;
}

function getArchiveScanStartWeek_(headers, values, archiveSheet, fallbackStart) {
  const dates = [];
  const headerMap = buildHeaderMap_(headers);
  const startIndex = firstExistingHeaderIndex_(headerMap, SCHEDULE_FIELD_ALIASES.start_date);
  const endIndex = firstExistingHeaderIndex_(headerMap, SCHEDULE_FIELD_ALIASES.end_date);

  values.slice(1).forEach(row => {
    if (startIndex != null) {
      const start = parseScheduleDate_(row[startIndex]);
      if (start) dates.push(start);
    }
    if (endIndex != null) {
      const end = parseScheduleDate_(row[endIndex]);
      if (end) dates.push(end);
    }
  });

  const archivedStart = getEarliestArchiveWeekStart_(archiveSheet);
  if (archivedStart) dates.push(archivedStart);

  const earliest = dates.length
    ? new Date(Math.min.apply(null, dates.map(date => date.getTime())))
    : fallbackStart;
  return getTuesdayWeekStart_(earliest);
}

function getEarliestArchiveWeekStart_(archiveSheet) {
  if (!archiveSheet || archiveSheet.getLastRow() < 2) return null;

  const values = archiveSheet.getDataRange().getDisplayValues();
  const headers = values[0].map(header => String(header || '').trim());
  const weekStartIndex = headers.indexOf('fixed_week_start');
  if (weekStartIndex < 0) return null;

  const dates = values
    .slice(1)
    .map(row => parseScheduleDate_(row[weekStartIndex]))
    .filter(Boolean);
  if (!dates.length) return null;

  return new Date(Math.min.apply(null, dates.map(date => date.getTime())));
}

function getTuesdayWeekStart_(date) {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffToTuesday = (base.getDay() + 5) % 7;
  base.setDate(base.getDate() - diffToTuesday);
  return base;
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

function getTwoWeeksAgoTuesdayToMonday_() {
  const today = new Date();
  const current = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffToTuesday = (current.getDay() + 5) % 7;
  const start = new Date(current);
  start.setDate(current.getDate() - diffToTuesday - 14);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start, end };
}

function isScheduleRowInWeek_(headers, row, weekStart, weekEnd) {
  const inactive = getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.is_inactive);
  const currentWeekInactive = getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.current_week_inactive);
  if (isTruthy_(inactive) || isTruthy_(currentWeekInactive)) return false;

  const weekday = normalizeWeekdayForBackup_(getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.weekday) || row[3]);
  if (!weekday) return false;

  const occurrenceDate = findDateInWeekByWeekday_(weekStart, weekday);
  if (!occurrenceDate) return false;

  const startDate = parseScheduleDate_(getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.start_date));
  const endDate = parseScheduleDate_(getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.end_date));
  if (startDate && occurrenceDate < startDate) return false;
  if (endDate && occurrenceDate > endDate) return false;
  if (!isScheduleCycleActiveOnDate_(headers, row, occurrenceDate)) return false;

  return occurrenceDate >= weekStart && occurrenceDate <= weekEnd;
}

function isScheduleCycleActiveOnDate_(headers, row, date) {
  const category = normalizeCell_(getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.category));
  if (category.indexOf('毎月') !== -1 && !getMonthEndInfo_(date).isInWindow) return false;

  const rowCycle = normalizeCycleLabelForBackup_(getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.cycle));
  const rowCycleNum = extractCycleNumberForBackup_(rowCycle);

  if (rowCycle === 'A' || rowCycle === 'B') {
    return rowCycle === getCycleForScheduleRow_(headers, row, date);
  }
  if (rowCycleNum != null) {
    const expectedCycle = getCycleForScheduleRow_(headers, row, date);
    if (typeof expectedCycle !== 'number') return false;
    return cycleContainsForBackup_(getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.cycle), expectedCycle);
  }
  return !rowCycle || rowCycle === '毎週';
}

function isPositionMatchForBackup_(headers, row) {
  const text = [
    getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.category),
    getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.mail_name),
    getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.notes)
  ].map(value => normalizeCell_(value)).join(' ');
  return text.indexOf('ポジションマッチ') !== -1;
}

function normalizeCycleLabelForBackup_(value) {
  const text = normalizeCell_(value);
  if (!text || text === '毎週') return '';
  if (text.indexOf('隔週A') !== -1 || text === 'A') return 'A';
  if (text.indexOf('隔週B') !== -1 || text === 'B') return 'B';
  const match = text.match(/(\d+)/);
  return match ? String(Number(match[1])) : text;
}

function extractCycleNumberForBackup_(value) {
  const text = normalizeCell_(value);
  const match = text.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function getCycleInfoForBackup_(date) {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffWeeks = getDiffWeeksForBackup_(target);
  const positionMatchCycle = getPositionMatchCycleForBackup_(target);
  return {
    weekGroup: getBiweeklyCycleForBackup_(diffWeeks),
    threeWeekNum: positionMatchCycle,
    positionMatchCycle
  };
}

function getCycleForScheduleRow_(headers, row, targetDate) {
  const internalCycle = extractCycleNumberForBackup_(getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.current_week_cycle));
  if (internalCycle != null) return internalCycle;

  const diffWeeks = getDiffWeeksForBackup_(targetDate);
  if (isPositionMatchForBackup_(headers, row)) {
    return ((diffWeeks % 3) + 3) % 3 + 1;
  }
  return getBiweeklyCycleForBackup_(diffWeeks);
}

function cycleContainsForBackup_(cycleValue, targetCycle) {
  return normalizeCell_(cycleValue).indexOf(String(targetCycle)) !== -1;
}

function getDiffWeeksForBackup_(targetDate) {
  const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const base = new Date(CYCLE_BASE_DATE.getFullYear(), CYCLE_BASE_DATE.getMonth(), CYCLE_BASE_DATE.getDate());
  return Math.floor((target.getTime() - base.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function getBiweeklyCycleForBackup_(diffWeeks) {
  return ((diffWeeks % 2) + 2) % 2 === 0 ? 'A' : 'B';
}

function getPositionMatchCycleForBackup_(targetDate) {
  const diffWeeks = getDiffWeeksForBackup_(targetDate);
  return ((diffWeeks % 3) + 3) % 3 + 1;
}

function getMonthEndInfo_(date) {
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const windowStart = new Date(monthEnd);
  windowStart.setDate(monthEnd.getDate() - 6);
  return {
    isInWindow: target.getTime() >= windowStart.getTime() && target.getTime() <= monthEnd.getTime()
  };
}

function findDateInWeekByWeekday_(weekStart, weekday) {
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  for (let offset = 0; offset < 7; offset++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + offset);
    if (weekdays[date.getDay()] === weekday) return date;
  }
  return null;
}

function normalizeWeekdayForBackup_(value) {
  const text = normalizeCell_(value);
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
    thursday: '木',
    '木': '木',
    fri: '金',
    friday: '金',
    '金': '金',
    sat: '土',
    saturday: '土',
    '土': '土'
  };
  return map[text.toLowerCase()] || map[text] || '';
}

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

function isScheduleRowFixed_(sheet, rowNumber) {
  const values = sheet.getDataRange().getValues();
  if (!values.length || rowNumber < 2 || rowNumber > values.length) return false;
  const headers = values[0].map(header => String(header || '').trim());
  return isRowFixedByHeaders_(headers, values[rowNumber - 1]);
}

function isRowFixedByHeaders_(headers, row) {
  return isTruthy_(getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.is_fixed));
}

function isTruthy_(value) {
  const text = normalizeCell_(value).toLowerCase();
  return ['true', 'yes', '1', '確定済', 'fixed', 'lock', 'locked'].indexOf(text) !== -1 || value === true;
}

function getMasterIdIndex_(sheetName, headers) {
  const config = MASTER_ID_CONFIG[sheetName];
  if (!config) return null;
  return firstExistingHeaderIndex_(buildHeaderMap_(headers), config.aliases);
}

function generateNextMasterId_(sheetName, values, idIndex) {
  const config = MASTER_ID_CONFIG[sheetName];
  if (!config) return '';

  let maxNumber = 0;
  const pattern = new RegExp(`^${config.prefix}_(\\d+)$`);
  values.slice(1).forEach(row => {
    const value = normalizeCell_(row[idIndex]);
    const match = value.match(pattern);
    if (match) maxNumber = Math.max(maxNumber, Number(match[1]));
  });

  return `${config.prefix}_${String(maxNumber + 1).padStart(3, '0')}`;
}

function getScheduleRows_(ss) {
  const sheet = ss.getSheetByName(SCHEDULE_SHEET_NAME);
  if (!sheet) throw new Error(`Sheet not found: ${SCHEDULE_SHEET_NAME}`);

  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) return [];

  const headers = values[0].map(header => String(header || '').trim());
  return values
    .slice(1)
    .filter(row => row.some(v => v !== ''))
    .map((row, index) => normalizeScheduleRow_(SCHEDULE_SHEET_NAME, index + 2, headers, row))
    .filter(Boolean);
}

function getScheduleRowsCached_(ss) {
  const cacheKey = 'initialData:scheduleRows';
  const cached = getJsonCache_(cacheKey);
  if (Array.isArray(cached)) return cached;

  const rows = getScheduleRows_(ss);
  putJsonCache_(cacheKey, rows, INITIAL_DATA_CACHE_TTL_SECONDS);
  return rows;
}

function getSheetHeadersCached_(ss, sheetName) {
  const cacheKey = `initialData:headers:${sheetName}`;
  const cached = getJsonCache_(cacheKey);
  if (Array.isArray(cached)) return cached;

  const headers = getSheetHeaders_(ss, sheetName);
  putJsonCache_(cacheKey, headers, INITIAL_DATA_CACHE_TTL_SECONDS);
  return headers;
}

function normalizeScheduleRow_(sheetName, rowNumber, headers, row) {
  const record = {
    schedule_id: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.schedule_id) || `${sheetName}:${rowNumber}`,
    source_sheet: sheetName,
    source_row: String(rowNumber),
    category: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.category) || normalizeCell_(row[1]),
    // sub_category は必ず sub_category 列（ヘッダー別名含む）からのみ取得する
    sub_category: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.sub_category),
    cycle: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.cycle) || normalizeCell_(row[2]),
    weekday: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.weekday) || normalizeCell_(row[3]),
    hour: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.hour) || normalizeCell_(row[4]),
    // mail_name も必ず mail_name 列（ヘッダー別名含む）からのみ取得する
    mail_name: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.mail_name),
    format: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.format),
    delivery_count: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.delivery_count),
    assignee: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.assignee),
    reviewer: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.reviewer),
    start_date: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.start_date),
    end_date: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.end_date),
    pr: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.pr),
    notes: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.notes),
    job_url: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.job_url),
    auto_job_feature_id: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.auto_job_feature_id),
    target_age: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.target_age),
    target_address: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.target_address),
    new_flag: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.new_flag),
    current_job_count: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.current_job_count),
    job_count_updated_at: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.job_count_updated_at),
    current_week_cycle: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.current_week_cycle),
    current_week_inactive: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.current_week_inactive),
    is_inactive: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.is_inactive),
    is_fixed: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.is_fixed)
  };
  headers.forEach((header, index) => {
    if (!header || Object.prototype.hasOwnProperty.call(record, header)) return;
    record[header] = normalizeCell_(row[index]);
  });
  record.sub_category_class = getSubCategoryClass_(record.sub_category);

  if (!record.mail_name) return null;
  return record;
}

function getSubCategoryClass_(value) {
  const text = normalizeCell_(value);
  if (text.indexOf('特殊') !== -1) return 'is-special';
  if (text.indexOf('商品') !== -1) return 'is-product';
  if (text.indexOf('その他') !== -1 || text.indexOf('他部署') !== -1) return 'is-others';
  return text ? 'is-others' : '';
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

function getSheetObjectsCached_(sheetName, allowMissing = false) {
  const cacheKey = `initialData:objects:${sheetName}`;
  const cached = getJsonCache_(cacheKey);
  if (Array.isArray(cached)) return cached;

  const rows = getSheetObjects_(sheetName, allowMissing);
  putJsonCache_(cacheKey, rows, INITIAL_DATA_CACHE_TTL_SECONDS);
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
  return values
    .slice(1)
    .filter(row => row.some(v => v !== ''))
    .map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = normalizeCell_(row[index]);
      });
      return obj;
    });
}

function upsertScheduleData(data) {
  return withScriptLock_(() => upsertScheduleDataUnlocked_(data));
}

function upsertScheduleDataUnlocked_(data) {
  if (data && isScheduleEditTargetFixed_(data)) {
    throw new Error('確定済みの配信日は編集できません');
  }
  if (data && isStopped(data.schedule_id, data.target_date)) {
    throw new Error('配信停止中の配信日は編集できません');
  }

  const payload = normalizePayload_(data);
  const scheduleId = String(payload.schedule_id || '').trim();
  if (!scheduleId) throw new Error('schedule_id is required');

  const ss = getSourceSpreadsheet_();
  const sheet = ss.getSheetByName(SCHEDULE_SHEET_NAME);
  if (!sheet) throw new Error(`Sheet not found: ${SCHEDULE_SHEET_NAME}`);

  const values = sheet.getDataRange().getValues();
  if (!values.length) throw new Error(`${SCHEDULE_SHEET_NAME} is empty`);

  const headers = values[0].map(header => String(header || '').trim());
  const headerMap = buildHeaderMap_(headers);
  const idIndex = firstExistingHeaderIndex_(headerMap, SCHEDULE_FIELD_ALIASES.schedule_id);

  let rowIndex = -1;
  if (idIndex != null) {
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][idIndex]).trim() === scheduleId) {
        rowIndex = i + 1;
        break;
      }
    }
  } else {
    rowIndex = getRowIndexFromScheduleId_(scheduleId);
  }

  if (rowIndex < 2 || rowIndex > values.length) {
    throw new Error(`Schedule row not found for schedule_id: ${scheduleId}`);
  }

  const row = values[rowIndex - 1].slice();
  applyPayloadToRow_(row, payload, headerMap);
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
  invalidateInitialDataCaches_([SCHEDULE_SHEET_NAME]);
  return { success: true, action: 'update', schedule_id: scheduleId };
}

function isScheduleEditTargetFixed_(data) {
  const targetDate = data && data.target_date;
  if (!targetDate) return false;
  if (data.source_row && isArchivedOccurrenceFixed_(data.source_row, targetDate)) return true;
  return data.schedule_id ? isScheduleOccurrenceFixedById_(data.schedule_id, targetDate) : false;
}

function applyPayloadToRow_(row, payload, headerMap) {
  Object.keys(payload).forEach(key => {
    if (key === 'schedule_id') return;
    const aliases = SCHEDULE_FIELD_ALIASES[key];
    if (!aliases) return;

    const headerIndex = firstExistingHeaderIndex_(headerMap, aliases);
    if (headerIndex == null) return;
    row[headerIndex] = payload[key];
  });
}

function normalizePayload_(data) {
  const payload = {};
  if (!data || typeof data !== 'object') return payload;

  Object.keys(SCHEDULE_FIELD_ALIASES).forEach(key => {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      payload[key] = normalizeCell_(data[key]);
    }
  });

  return payload;
}

function getRowIndexFromScheduleId_(scheduleId) {
  const match = String(scheduleId || '').match(/^app_schedule:(\d+)$/);
  return match ? Number(match[1]) : -1;
}

function getSourceRowByScheduleId_(scheduleId) {
  const safeScheduleId = normalizeScheduleIdForMove_(scheduleId);
  if (!safeScheduleId) return '';

  // "app_schedule:123" 形式からの行番号解決
  const match = safeScheduleId.match(/^app_schedule:(\d+)$/);
  if (match) return match[1];

  const ss = getSourceSpreadsheet_();
  const sheet = ss.getSheetByName(SCHEDULE_SHEET_NAME);
  if (!sheet) return '';

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return '';

  const headers = values[0].map(header => String(header || '').trim());
  const idIndex = firstExistingHeaderIndex_(buildHeaderMap_(headers), SCHEDULE_FIELD_ALIASES.schedule_id);
  if (idIndex == null) return '';

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    // データ行は rowIndex + 1 (1-based)
    if (normalizeCell_(values[rowIndex][idIndex]) === safeScheduleId) {
      return String(rowIndex + 1);
    }
  }
  return '';
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

function buildHeaderMap_(headers) {
  return new Map(headers.map((header, index) => [String(header).trim(), index]));
}

function firstExistingHeaderIndex_(headerMap, aliases) {
  for (const alias of aliases) {
    const index = headerMap.get(alias);
    if (index != null) return index;
  }
  return null;
}

function getFieldByAliases_(headers, row, aliases) {
  for (const alias of aliases) {
    const index = headers.indexOf(alias);
    if (index >= 0) {
      const value = normalizeCell_(row[index]);
      if (value !== '') return value;
    }
  }
  return '';
}

function normalizeCell_(value) {
  if (value == null) return '';
  const text = String(value).trim();
  return text === '#REF!' || text === '#VALUE!' ? '' : text;
}

function buildCommentsCacheKey_(scheduleId, targetDate) {
  const safeScheduleId = normalizeCell_(scheduleId);
  const safeTargetDate = normalizeCommentTargetDate_(targetDate) || '';
  if (!safeScheduleId) return '';
  return `comments:${safeScheduleId}:${safeTargetDate || '*'}`;
}

function buildCommentCountsCacheKey_(dateRange) {
  if (!dateRange || !dateRange.start || !dateRange.end) return '';
  const start = formatDate_(dateRange.start);
  const end = formatDate_(dateRange.end);
  if (!start || !end) return '';
  return `commentCounts:${start}:${end}`;
}

function invalidateCommentCaches_(scheduleId, targetDate) {
  try {
    const cache = CacheService.getScriptCache();
    const keys = [];
    const safeScheduleId = normalizeCell_(scheduleId);
    const safeTargetDate = normalizeCommentTargetDate_(targetDate);
    if (safeScheduleId) {
      keys.push(buildCommentsCacheKey_(safeScheduleId, safeTargetDate));
      keys.push(buildCommentsCacheKey_(safeScheduleId, '')); // schedule_idのみの一覧も想定
    }
    if (keys.length) cache.removeAll(keys);
    // commentCounts は範囲キーなので特定できない。短TTL(5分)で自然更新させる。
  } catch (error) {
    // ignore cache errors
  }
}

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

function withScriptLock_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function getSourceSpreadsheet_() {
  return SpreadsheetApp.openById(SOURCE_SPREADSHEET_ID);
}
