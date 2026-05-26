/**
 * DataMaintenance.gs
 * メンテナンス・管理ツール群
 *
 * - スケジュールバックアップ・確定フラグクリア
 * - 求人数自動更新
 * - ログアーカイブ
 * - ID移行・参照更新
 * - トリガー設定
 */

// ---- バックアップ・確定ロック ----

function backupAndLockTwoWeeksAgo() {
  return { success: true, skipped: true, disabled: true, reason: 'Daily archive diffs are used instead of weekly backup.' };
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

  return { success: true, handler: 'backupAndLockTwoWeeksAgo', disabled: true, deleted_existing_triggers: true };
}

// ---- ID移行 ----

function migrateLegacyIdsToEnglish(dryRun) {
  const ss = getSourceSpreadsheet_();
  const result = {
    dryRun: dryRun !== false,
    schedule: {},
    pr: {}
  };

  result.schedule = migrateSheetIds_(ss, 'app_schedule', SCHEDULE_FIELD_ALIASES.schedule_id, 'SCH', result.dryRun);
  result.pr = { skipped: true, reason: 'PR ID is an operational numeric ID and is not migrated' };

  if (!result.dryRun) {
    updateReferenceIds_(ss, COMMENTS_SHEET_NAME, ['schedule_id', 'ID', 'id'], result.schedule.idMap);
    updateReferenceIds_(ss, EXCEPTIONS_SHEET_NAME, ['schedule_id', 'ID', 'id'], result.schedule.idMap);
    updateReferenceIds_(ss, CHECK_STATUS_SHEET_NAME, CHECK_STATUS_FIELD_ALIASES.schedule_id, result.schedule.idMap);
    updateItemIdReferences_(ss, CHECK_STATUS_SHEET_NAME, ['item_id'], result.schedule.idMap);
    updateReferenceIds_(ss, SCHEDULE_ARCHIVE_SHEET_NAME, SCHEDULE_FIELD_ALIASES.schedule_id, result.schedule.idMap);
  }

  return result;
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

function updateItemIdReferences_(ss, sheetName, itemIdAliases, idMap) {
  if (!idMap || !Object.keys(idMap).length) return;

  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  const range = sheet.getDataRange();
  const values = range.getValues();
  if (!values.length) return;

  const headers = values[0].map(header => String(header || '').trim());
  const itemIdIndex = firstExistingHeaderIndex_(buildHeaderMap_(headers), itemIdAliases);
  if (itemIdIndex == null) return;

  let changed = false;
  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const currentValue = normalizeCell_(values[rowIndex][itemIdIndex]);
    const parts = currentValue.split('|');
    const currentId = parts[0];
    if (Object.prototype.hasOwnProperty.call(idMap, currentId)) {
      parts[0] = idMap[currentId];
      values[rowIndex][itemIdIndex] = parts.join('|');
      changed = true;
    }
  }

  if (changed) range.setValues(values);
}

// ---- 求人数自動更新 ----

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
  let updated = 0;
  let skipped = 0;

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    if (isAutoJobFeatureRow_(headers, row)) {
      if (applyAutoJobCountFormulaForRow_(sheet, headers, rowIndex + 1)) updated++;
      else skipped++;
    } else {
      skipped++;
    }
  }

  return { success: true, updated, failed: 0, skipped };
}

function updateJobCountForRowUnlocked_(sheet, rowNumber, force) {
  if (!sheet || rowNumber < 2) return { success: true, updated: 0, skipped: 1 };

  const headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 18)).getValues()[0].map(header => String(header || '').trim());
  const row = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (isAutoJobFeatureRow_(headers, row)) {
    const formulaResult = applyAutoJobCountFormulaForRow_(sheet, headers, rowNumber);
    return formulaResult ? { success: true, updated: 1, skipped: 0 } : { success: true, updated: 0, skipped: 1 };
  }
  return { success: true, updated: 0, skipped: 1 };
}

function isAutoJobFeatureRow_(headers, row) {
  return normalizeCell_(getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.format)) === '自動求人特集';
}

function applyAutoJobCountFormulaForRow_(sheet, headers, rowNumber) {
  const headerMap = buildHeaderMap_(headers);
  const formatIndex = firstExistingHeaderIndex_(headerMap, SCHEDULE_FIELD_ALIASES.format);
  const jobUrlIndex = firstExistingHeaderIndex_(headerMap, SCHEDULE_FIELD_ALIASES.job_url);
  const jobCountIndex = firstExistingHeaderIndex_(headerMap, SCHEDULE_FIELD_ALIASES.current_job_count);
  if (formatIndex == null || jobUrlIndex == null || jobCountIndex == null) return false;

  const formatValue = normalizeCell_(sheet.getRange(rowNumber, formatIndex + 1).getDisplayValue());
  if (formatValue !== '自動求人特集') return false;

  const url = normalizeCell_(sheet.getRange(rowNumber, jobUrlIndex + 1).getDisplayValue());
  const countCell = sheet.getRange(rowNumber, jobCountIndex + 1);
  if (!url) {
    countCell.clearContent();
    return true;
  }

  const urlRef = `${columnToLetter_(jobUrlIndex + 1)}${rowNumber}`;
  const formula = `=IFERROR(IMPORTXML(${urlRef}, "/html/body/form/div[1]/div[3]/main/div/div/div[2]/div/span[1]"))`;
  countCell.setFormula(formula);
  return true;
}

function columnToLetter_(columnNumber) {
  let number = Number(columnNumber || 0);
  let letters = '';
  while (number > 0) {
    const remainder = (number - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    number = Math.floor((number - 1) / 26);
  }
  return letters;
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

// ---- ログアーカイブ ----

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
