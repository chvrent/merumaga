/**
 * DataService.gs
 * エントリーポイント・マスターCRUD・スケジュール操作・チェックステータス
 *
 * 定数              → DataConstants.gs
 * ユーティリティ    → DataUtils.gs
 * シートアクセス    → DataSheetAccess.gs
 * メンテナンス      → DataMaintenance.gs
 * アーカイブ・サイクル → DataArchive.gs
 * コメント          → DataCommentService.gs
 * 配信停止/再開      → DataExceptionService.gs
 */

// ============================================================
// エントリーポイント
// ============================================================

function getInitialData(options) {
  const ss = getSourceSpreadsheet_();
  const dateRange = buildOperationalDateRange_(options);
  return Object.assign({
    schedule: getScheduleRows_(ss),
    scheduleHeaders: getSheetHeaders_(ss, SCHEDULE_SHEET_NAME),
    pr: getSheetObjectsCached_('app_pr'),
    prTargets: getSheetObjectsCached_('app_pr_targets', true),
    holidays: getSheetObjectsCached_('app_holidays', true),
    japaneseHolidays: getJapaneseHolidays_(),
    readme: getSheetObjectsCached_('app_readme', true),
    adminMaster: getSheetObjectsCached_('app_admin_master', true),
    inputControls: getInputControlRows_()
  }, getOperationalDataForRange_(dateRange));
}

function getOperationalData(options) {
  return getOperationalDataForRange_(buildOperationalDateRange_(options));
}

function getOperationalDataForRange_(dateRange) {
  return {
    commentCounts: getCommentCounts_(dateRange),
    fixedOccurrences: getFixedOccurrences_(dateRange),
    archivedOccurrences: getArchivedOccurrenceRows_(dateRange),
    stoppedOccurrences: getStoppedOccurrences_(dateRange),
    checkStatuses: getCheckStatuses_(dateRange)
  };
}

function getAdminList() {
  const rows = getSheetObjectsCached_('app_admin_master', true);
  return rows
    .filter(row => {
      const activeKeys = ['is_active', 'active', '有効', 'enabled', 'enable'];
      const inactiveKeys = ['is_deleted', 'deleted', '無効', 'inactive'];
      for (const key of activeKeys) {
        if (Object.prototype.hasOwnProperty.call(row, key)) {
          return isTruthy_(row[key]);
        }
      }
      for (const key of inactiveKeys) {
        if (Object.prototype.hasOwnProperty.call(row, key)) {
          return !isTruthy_(row[key]);
        }
      }
      return true;
    })
    .map(row => {
      const name = normalizeCell_(row.name || row['氏名'] || row['名前'] || row.initial || row['略称']);
      if (!name) return null;
      return {
        name,
        full_name: normalizeCell_(row.full_name || row.fullName || row['氏名'] || row['名前'] || name),
        initial: normalizeCell_(row.initial || row['略称'] || name)
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      const leftText = String(left.initial || left.name || '').toLowerCase();
      const rightText = String(right.initial || right.name || '').toLowerCase();
      return leftText.localeCompare(rightText, 'ja');
    });
}

// ============================================================
// マスターデータ CRUD
// ============================================================

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
  const visibleHeaders = headers.filter(header => !isDeprecatedScheduleHeader_(safeSheetName, header));
  const rows = values
    .slice(1)
    .map((row, index) => {
      const obj = { __rowNumber: String(index + 2) };
      headers.forEach((header, columnIndex) => {
        if (isDeprecatedScheduleHeader_(safeSheetName, header)) return;
        obj[header || `column_${columnIndex + 1}`] = normalizeCell_(row[columnIndex]);
      });
      addCanonicalMasterFields_(safeSheetName, headers, row, obj);
      return obj;
    })
    .filter(row => Object.keys(row).some(key => key !== '__rowNumber' && row[key] !== ''));

  return { sheetName: safeSheetName, headers: visibleHeaders, rows };
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
    if (isMasterObjectInactive_(row, PR_TARGET_FIELD_ALIASES.is_inactive)) return;
    const prId = getPrLinkIdFromTargetRow_(row);
    const mailName = getObjectFieldByAliases_(row, PR_TARGET_FIELD_ALIASES.mail_name);
    if (prId && mailName) {
      if (!targetMap[prId]) targetMap[prId] = [];
      targetMap[prId].push(mailName);
    }
  });

  prMaster.rows = prMaster.rows.filter(row => !isMasterObjectInactive_(row, PR_FIELD_ALIASES.is_inactive));
  prMaster.rows.forEach(row => {
    const prId = getPrLinkIdFromMasterRow_(row);
    const mailNames = Array.from(new Set((targetMap[prId] || []).filter(Boolean)));
    row.target_mails = mailNames.length > 0 ? mailNames.join(', ') : '(未設定)';
  });

  if (!prMaster.headers.includes('target_mails')) {
    prMaster.headers.push('target_mails');
  }

  return prMaster;
}

function getPrLinkIdFromMasterRow_(row) {
  return normalizeIdKey_(getObjectFieldByAliases_(row, ['pr_id', 'PR ID', 'ＰＲ ID', 'PR_ID', 'PRID', 'PR', 'ID', 'id']));
}

function getPrLinkIdFromTargetRow_(row) {
  return normalizeIdKey_(getObjectFieldByAliases_(row, ['pr_id', 'PR ID', 'ＰＲ ID', 'PR_ID', 'PRID', 'PR']));
}

function saveMasterData(sheetName, payload) {
  return withScriptLock_(() => saveMasterDataUnlocked_(sheetName, payload));
}

function saveMasterDataUnlocked_(sheetName, payload) {
  const safeSheetName = assertEditableSheet_(sheetName);
  if (!payload || typeof payload !== 'object') throw new Error('payload is required');

  const normalizedPayload = Object.assign({}, payload);
  if (Object.prototype.hasOwnProperty.call(normalizedPayload, 'setter') && !Object.prototype.hasOwnProperty.call(normalizedPayload, 'assignee')) {
    normalizedPayload.assignee = normalizedPayload.setter;
  }
  if (Object.prototype.hasOwnProperty.call(normalizedPayload, 'checker') && !Object.prototype.hasOwnProperty.call(normalizedPayload, 'reviewer')) {
    normalizedPayload.reviewer = normalizedPayload.checker;
  }
  ['assignee', 'reviewer'].forEach(function(key) {
    if (Object.prototype.hasOwnProperty.call(normalizedPayload, key) && isBooleanText_(normalizedPayload[key])) {
      normalizedPayload[key] = '';
    }
  });
  if (Object.prototype.hasOwnProperty.call(normalizedPayload, 'mail_type') && !Object.prototype.hasOwnProperty.call(normalizedPayload, 'category')) {
    normalizedPayload.category = normalizedPayload.mail_type;
  }
  if (Object.prototype.hasOwnProperty.call(normalizedPayload, 'category') && !Object.prototype.hasOwnProperty.call(normalizedPayload, 'mail_type')) {
    normalizedPayload.mail_type = normalizedPayload.category;
  }
  if (Object.prototype.hasOwnProperty.call(normalizedPayload, 'new_flag') && !Object.prototype.hasOwnProperty.call(normalizedPayload, 'is_new')) {
    normalizedPayload.is_new = normalizedPayload.new_flag;
  }
  if (Object.prototype.hasOwnProperty.call(normalizedPayload, 'is_new')) {
    normalizedPayload.is_new = isTruthy_(normalizedPayload.is_new) ? 'TRUE' : 'FALSE';
    delete normalizedPayload.new_flag;
  }
  if (Object.prototype.hasOwnProperty.call(normalizedPayload, 'verifying_flag') && !Object.prototype.hasOwnProperty.call(normalizedPayload, 'is_verifying')) {
    normalizedPayload.is_verifying = normalizedPayload.verifying_flag;
  }
  if (Object.prototype.hasOwnProperty.call(normalizedPayload, 'is_verifying')) {
    normalizedPayload.is_verifying = isTruthy_(normalizedPayload.is_verifying) ? 'TRUE' : 'FALSE';
    delete normalizedPayload.verifying_flag;
  }
  if (Object.prototype.hasOwnProperty.call(normalizedPayload, 'is_draft')) {
    normalizedPayload.is_draft = isTruthy_(normalizedPayload.is_draft) ? 'TRUE' : 'FALSE';
  }
  ['is_fixed', 'is_inactive'].forEach(function(key) {
    if (Object.prototype.hasOwnProperty.call(normalizedPayload, key)) {
      normalizedPayload[key] = isTruthy_(normalizedPayload[key]) ? 'TRUE' : 'FALSE';
    }
  });
  applySingleDeliveryPayloadRule_(normalizedPayload);

  const ss = getSourceSpreadsheet_();
  const sheet = ss.getSheetByName(safeSheetName);
  if (!sheet) throw new Error(`Sheet not found: ${safeSheetName}`);

  const values = sheet.getDataRange().getValues();
  if (!values.length) throw new Error(`${safeSheetName} is empty`);

  const headers = values[0].map(header => String(header || '').trim());
  ensureOptionalMasterPayloadHeaders_(sheet, headers, safeSheetName, normalizedPayload);
  const rowNumber = Number(payload.__rowNumber || 0);
  const idIndex = getMasterIdIndex_(safeSheetName, headers);
  const row = rowNumber >= 2 && rowNumber <= sheet.getLastRow()
    ? values[rowNumber - 1].slice(0, headers.length)
    : headers.map(() => '');

  headers.forEach((header, index) => {
    const canonicalKey = getCanonicalKeyForHeader_(safeSheetName, header);
    if (Object.prototype.hasOwnProperty.call(normalizedPayload, header)) {
      row[index] = normalizeCell_(normalizedPayload[header]);
    } else if (canonicalKey && Object.prototype.hasOwnProperty.call(normalizedPayload, canonicalKey)) {
      row[index] = normalizeCell_(normalizedPayload[canonicalKey]);
    }
  });

  if (idIndex != null && !normalizeCell_(row[idIndex])) {
    row[idIndex] = generateNextMasterId_(safeSheetName, values, idIndex);
  }

  if (rowNumber >= 2 && rowNumber <= sheet.getMaxRows()) {
    if (safeSheetName === SCHEDULE_SHEET_NAME) {
      archivePastOccurrencesForScheduleRow_(ss, headers, values[rowNumber - 1], rowNumber);
    }
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

function ensureOptionalMasterPayloadHeaders_(sheet, headers, sheetName, payload) {
  if (!payload || typeof payload !== 'object') return;
  const optionalHeaders = [];
  if (Object.prototype.hasOwnProperty.call(payload, 'is_draft')) optionalHeaders.push('is_draft');
  if (Object.prototype.hasOwnProperty.call(payload, 'is_verifying')) optionalHeaders.push('is_verifying');
  optionalHeaders.forEach(header => {
    if (headers.indexOf(header) >= 0) return;
    headers.push(header);
    sheet.getRange(1, headers.length).setValue(header);
  });
}

function applySingleDeliveryPayloadRule_(payload) {
  if (!payload || typeof payload !== 'object') return;
  const cycle = normalizeCycleLabelForBackup_(payload.cycle);
  if (cycle !== '単発') return;
  const startDate = normalizeCommentTargetDate_(payload.start_date);
  if (startDate) payload.end_date = startDate;
}

function deleteMasterData(sheetName, rowNumber) {
  return withScriptLock_(() => deleteMasterDataUnlocked_(sheetName, rowNumber));
}

function stopMasterData(sheetName, rowNumber) {
  return withScriptLock_(() => stopMasterDataUnlocked_(sheetName, rowNumber));
}

function resumeMasterData(sheetName, rowNumber) {
  return withScriptLock_(() => resumeMasterDataUnlocked_(sheetName, rowNumber));
}

function deleteMasterDataUnlocked_(sheetName, rowNumber) {
  const safeSheetName = assertEditableSheet_(sheetName);
  const targetRow = Number(rowNumber || 0);
  if (targetRow < 2) throw new Error('Invalid row number');

  const ss = getSourceSpreadsheet_();
  const sheet = ss.getSheetByName(safeSheetName);
  if (!sheet) throw new Error(`Sheet not found: ${safeSheetName}`);
  if (targetRow > sheet.getLastRow()) throw new Error('Row not found');

  if (safeSheetName === SCHEDULE_SHEET_NAME) {
    const values = sheet.getDataRange().getValues();
    const headers = values[0].map(header => String(header || '').trim());
    archivePastOccurrencesForScheduleRow_(ss, headers, values[targetRow - 1], targetRow);
  }

  let deletedPrId = '';
  if (safeSheetName === 'app_pr') {
    const lastCol = sheet.getLastColumn();
    const prHeaders = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(h => String(h || '').trim());
    const prIdIndex = firstExistingHeaderIndex_(buildHeaderMap_(prHeaders), PR_FIELD_ALIASES.pr_id);
    deletedPrId = prIdIndex == null ? '' : normalizeCell_(sheet.getRange(targetRow, prIdIndex + 1).getDisplayValue());
  }

  sheet.deleteRow(targetRow);

  if (safeSheetName === 'app_pr' && deletedPrId) {
    deletePrTargetRowsByPrId_(ss, deletedPrId);
  }

  invalidateInitialDataCaches_(safeSheetName === 'app_pr' ? ['app_pr', 'app_pr_targets'] : [safeSheetName]);
  return { success: true, action: 'delete', rowNumber: targetRow };
}

function stopMasterDataUnlocked_(sheetName, rowNumber) {
  const safeSheetName = assertEditableSheet_(sheetName);
  const targetRow = Number(rowNumber || 0);
  if (targetRow < 2) throw new Error('Invalid row number');

  const ss = getSourceSpreadsheet_();
  const sheet = ss.getSheetByName(safeSheetName);
  if (!sheet) throw new Error(`Sheet not found: ${safeSheetName}`);
  if (targetRow > sheet.getLastRow()) throw new Error('Row not found');

  stopMasterRow_(sheet, safeSheetName, targetRow);

  if (safeSheetName === 'app_pr') {
    const lastCol = sheet.getLastColumn();
    const prHeaders = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(h => String(h || '').trim());
    const prIdIndex = firstExistingHeaderIndex_(buildHeaderMap_(prHeaders), PR_FIELD_ALIASES.pr_id);
    const prId = prIdIndex == null ? '' : normalizeCell_(sheet.getRange(targetRow, prIdIndex + 1).getDisplayValue());

    if (prId) {
      const targetsSheet = ss.getSheetByName('app_pr_targets');
      if (targetsSheet) {
        const targetInactiveIndex = getOrCreateInactiveColumn_(targetsSheet, PR_TARGET_FIELD_ALIASES.is_inactive);
        const targetValues = targetsSheet.getDataRange().getDisplayValues();
        if (targetValues.length >= 2) {
          const targetHeaders = targetValues[0].map(h => String(h || '').trim());
          const targetPrIdIndex = firstExistingHeaderIndex_(buildHeaderMap_(targetHeaders), PR_TARGET_FIELD_ALIASES.pr_id);
          if (targetPrIdIndex != null) {
            for (let r = 2; r <= targetValues.length; r++) {
              const rowPrId = normalizeCell_(targetValues[r - 1][targetPrIdIndex]);
              if (rowPrId && normalizeIdKey_(rowPrId) === normalizeIdKey_(prId)) {
                targetsSheet.getRange(r, targetInactiveIndex + 1).setValue(true);
              }
            }
          }
        }
      }
    }
  }

  invalidateInitialDataCaches_(safeSheetName === 'app_pr' ? ['app_pr', 'app_pr_targets'] : [safeSheetName]);
  return { success: true, action: 'stop', rowNumber: targetRow };
}

function resumeMasterDataUnlocked_(sheetName, rowNumber) {
  const safeSheetName = assertEditableSheet_(sheetName);
  const targetRow = Number(rowNumber || 0);
  if (targetRow < 2) throw new Error('Invalid row number');

  const ss = getSourceSpreadsheet_();
  const sheet = ss.getSheetByName(safeSheetName);
  if (!sheet) throw new Error(`Sheet not found: ${safeSheetName}`);
  if (targetRow > sheet.getLastRow()) throw new Error('Row not found');

  resumeMasterRow_(sheet, safeSheetName, targetRow);
  invalidateInitialDataCaches_([safeSheetName]);
  return { success: true, action: 'resume', rowNumber: targetRow };
}

function deletePrTargetRowsByPrId_(ss, prId) {
  const targetsSheet = ss.getSheetByName('app_pr_targets');
  if (!targetsSheet) return;
  const targetValues = targetsSheet.getDataRange().getDisplayValues();
  if (targetValues.length < 2) return;
  const targetHeaders = targetValues[0].map(h => String(h || '').trim());
  const targetPrIdIndex = firstExistingHeaderIndex_(buildHeaderMap_(targetHeaders), PR_TARGET_FIELD_ALIASES.pr_id);
  if (targetPrIdIndex == null) return;
  const rowsToDelete = [];
  for (let r = 2; r <= targetValues.length; r++) {
    const rowPrId = normalizeCell_(targetValues[r - 1][targetPrIdIndex]);
    if (rowPrId && normalizeIdKey_(rowPrId) === normalizeIdKey_(prId)) {
      rowsToDelete.push(r);
    }
  }
  rowsToDelete.reverse().forEach(rowNumber => targetsSheet.deleteRow(rowNumber));
}

function stopMasterRow_(sheet, sheetName, rowNumber) {
  const inactiveIndex = getOrCreateInactiveColumn_(sheet, getInactiveAliasesForMasterSheet_(sheetName));
  sheet.getRange(rowNumber, inactiveIndex + 1).setValue(true);
}

function resumeMasterRow_(sheet, sheetName, rowNumber) {
  const aliases = getInactiveAliasesForMasterSheet_(sheetName);
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(h => String(h || '').trim());
  const inactiveIndex = firstExistingHeaderIndex_(buildHeaderMap_(headers), aliases);
  if (inactiveIndex == null) return;
  sheet.getRange(rowNumber, inactiveIndex + 1).clearContent();
}

function getOrCreateInactiveColumn_(sheet, aliases) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(h => String(h || '').trim());
  const inactiveIndex = firstExistingHeaderIndex_(buildHeaderMap_(headers), aliases);
  if (inactiveIndex != null) return inactiveIndex;

  const nextColumn = lastColumn + 1;
  sheet.getRange(1, nextColumn).setValue('配信停止');
  return nextColumn - 1;
}

function getInactiveAliasesForMasterSheet_(sheetName) {
  switch (String(sheetName || '').trim()) {
    case SCHEDULE_SHEET_NAME:
      return SCHEDULE_FIELD_ALIASES.is_inactive;
    case 'app_pr':
      return PR_FIELD_ALIASES.is_inactive;
    case 'app_pr_targets':
      return PR_TARGET_FIELD_ALIASES.is_inactive;
    default:
      return ['is_inactive', '配信停止', '停止', '無効'];
  }
}

// ============================================================
// 配信日別操作・スケジュール upsert
// ============================================================

/**
 * ドラッグ＆ドロップによる配信日時更新（個別発生分のみ）
 */
function updateItemDate(scheduleId, oldDate, newDateStr, newHour) {
  return withScriptLock_(() => updateItemDateUnlocked_(scheduleId, oldDate, newDateStr, newHour));
}

function saveScheduleFromDate(scheduleId, effectiveDate, payload) {
  return withScriptLock_(() => saveScheduleFromDateUnlocked_(scheduleId, effectiveDate, payload));
}

function saveScheduleFromDateUnlocked_(scheduleId, effectiveDate, payload) {
  const safeScheduleId = normalizeScheduleIdForMove_(scheduleId);
  const safeDate = normalizeCommentTargetDate_(effectiveDate);
  if (!safeScheduleId || !safeDate) throw new Error('scheduleId and effectiveDate are required');

  const sourceRow = getSourceRowByScheduleId_(safeScheduleId);
  if (!sourceRow) throw new Error(`Schedule row not found for ID: ${safeScheduleId}`);

  const updatePayload = Object.assign({}, payload || {}, {
    __rowNumber: sourceRow,
    schedule_id: safeScheduleId,
    start_date: safeDate
  });
  delete updatePayload.item_id;
  delete updatePayload.original_date;
  delete updatePayload.delivery_date;
  delete updatePayload.override_fields;
  applySingleDeliveryPayloadRule_(updatePayload);
  const result = saveMasterDataUnlocked_(SCHEDULE_SHEET_NAME, updatePayload);
  const originalDate = normalizeCommentTargetDate_(payload && payload.original_date) || safeDate;
  saveCheckStatusUnlocked_(`${safeScheduleId}|${originalDate}`, 'occurrence_override', false, {
    schedule_id: safeScheduleId,
    original_date: originalDate,
    delivery_date: safeDate
  });
  return result;
}

function updateItemDateUnlocked_(scheduleId, oldDate, newDateStr, newHour) {
  const safeScheduleId = normalizeScheduleIdForMove_(scheduleId);
  const safeOldDate = normalizeCommentTargetDate_(oldDate);
  const safeDate = normalizeCommentTargetDate_(newDateStr);
  const safeHour = normalizeCell_(newHour);
  if (!safeScheduleId || !safeOldDate || !safeDate || !safeHour) throw new Error('scheduleId, oldDate, newDate, and newHour are required');

  const sourceRow = getSourceRowByScheduleId_(safeScheduleId);
  if (!sourceRow) throw new Error(`Schedule row not found for ID: ${safeScheduleId}`);

  const scheduleSheet = getSourceSpreadsheet_().getSheetByName(SCHEDULE_SHEET_NAME);
  const scheduleValues = scheduleSheet ? scheduleSheet.getDataRange().getValues() : [];
  const scheduleHeaders = scheduleValues.length ? scheduleValues[0].map(header => String(header || '').trim()) : [];
  const scheduleRow = scheduleValues[Number(sourceRow) - 1] || [];
  const originalHour = getFieldByAliases_(scheduleHeaders, scheduleRow, SCHEDULE_FIELD_ALIASES.hour);
  const isBackToOriginalSlot = safeDate === safeOldDate && normalizeHourForMoveCompare_(safeHour) === normalizeHourForMoveCompare_(originalHour);

  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  const checkStatusSheet = getCheckStatusSheet_();
  const csHeaders = getCheckStatusHeaders_(checkStatusSheet);

  const logPayload = {
    schedule_id: safeScheduleId,
    delivery_date: safeDate,
    hour: safeHour,
    weekday: getWeekdayLabelForDate_(safeDate),
    original_date: safeOldDate,
    mail_name: '(移動による自動更新)',
    confirmed_by: 'System (DnD)',
    confirmed_at: timestamp
  };

  const itemId = `${safeScheduleId}|${safeOldDate}`;
  const logRow = buildCheckStatusRow_(csHeaders, itemId, 'move_override', !isBackToOriginalSlot, logPayload, timestamp);
  const values = checkStatusSheet.getDataRange().getValues();
  const itemIdIndex = csHeaders.indexOf('item_id');
  const fieldIndex = csHeaders.indexOf('field');
  if (isBackToOriginalSlot) {
    for (let rowIndex = values.length - 1; rowIndex >= 1; rowIndex--) {
      const row = values[rowIndex];
      if (normalizeCell_(row[itemIdIndex]) === itemId && normalizeCell_(row[fieldIndex]) === 'move_override') {
        checkStatusSheet.deleteRow(rowIndex + 1);
        return { success: true, schedule_id: safeScheduleId, original_date: safeOldDate, delivery_date: safeDate, hour: safeHour, cleared: true };
      }
    }
    return { success: true, schedule_id: safeScheduleId, original_date: safeOldDate, delivery_date: safeDate, hour: safeHour, cleared: true };
  }
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

function normalizeHourForMoveCompare_(value) {
  const text = normalizeCell_(value);
  const match = text.match(/^(\d{1,2})(?::\d{1,2})?/);
  if (!match) return text;
  return String(Number(match[1]));
}

/**
 * PRマスタとPRターゲット設定を統合保存する
 */
function savePRData(prPayload, targetNewsletters) {
  return withScriptLock_(() => savePRDataUnlocked_(prPayload, targetNewsletters));
}

function savePRDataUnlocked_(prPayload, targetNewsletters) {
  const ss = getSourceSpreadsheet_();

  const savedPr = saveMasterDataUnlocked_('app_pr', prPayload);
  const prId = normalizeIdKey_(getObjectFieldByAliases_(prPayload, PR_FIELD_ALIASES.pr_id) || normalizeCell_(savedPr.id));
  if (!prId) throw new Error('pr_id is required');

  const targetsSheet = ss.getSheetByName('app_pr_targets');
  if (!targetsSheet) throw new Error('Sheet not found: app_pr_targets');

  getOrCreateInactiveColumn_(targetsSheet, PR_TARGET_FIELD_ALIASES.is_inactive);
  const range = targetsSheet.getDataRange();
  const values = range.getValues();
  const headers = values[0].map(h => String(h).trim());
  const targetHeaderMap = buildHeaderMap_(headers);
  const prIdIndex = firstExistingHeaderIndex_(targetHeaderMap, PR_TARGET_FIELD_ALIASES.pr_id);
  const mailNameIndex = firstExistingHeaderIndex_(targetHeaderMap, PR_TARGET_FIELD_ALIASES.mail_name);
  const sourceRowIndex = firstExistingHeaderIndex_(targetHeaderMap, PR_TARGET_FIELD_ALIASES.source_row);
  const targetIndexIndex = firstExistingHeaderIndex_(targetHeaderMap, PR_TARGET_FIELD_ALIASES.target_index);
  const inactiveIndex = firstExistingHeaderIndex_(targetHeaderMap, PR_TARGET_FIELD_ALIASES.is_inactive);
  if (prIdIndex == null || mailNameIndex == null) {
    throw new Error('app_pr_targets must have PR ID/pr_id and メルマガ名/mail_name headers');
  }

  const selectedRows = (targetNewsletters || []).map((nl, index) => ({
    mailName: normalizeCell_(nl && nl.mail_name),
    sourceRow: normalizeCell_(nl && nl.source_row),
    targetIndex: index + 1
  })).filter(row => row.mailName);
  const selectedByMail = new Map(selectedRows.map(row => [row.mailName, row]));
  const usedSelected = new Set();
  const bodyRows = values.slice(1).map(row => row.slice(0, headers.length));

  bodyRows.forEach(row => {
    if (normalizeIdKey_(row[prIdIndex]) !== prId) return;
    const mailName = normalizeCell_(row[mailNameIndex]);
    const selected = selectedByMail.get(mailName);
    if (selected) {
      row[prIdIndex] = prId;
      row[mailNameIndex] = selected.mailName;
      if (sourceRowIndex != null) row[sourceRowIndex] = selected.sourceRow;
      if (targetIndexIndex != null) row[targetIndexIndex] = selected.targetIndex;
      if (inactiveIndex != null) row[inactiveIndex] = false;
      usedSelected.add(mailName);
    } else if (inactiveIndex != null) {
      row[inactiveIndex] = true;
    }
  });

  selectedRows.forEach(rowInfo => {
    if (usedSelected.has(rowInfo.mailName)) return;
    const row = new Array(headers.length).fill('');
    row[prIdIndex] = prId;
    row[mailNameIndex] = rowInfo.mailName;
    if (sourceRowIndex != null) row[sourceRowIndex] = rowInfo.sourceRow;
    if (targetIndexIndex != null) row[targetIndexIndex] = rowInfo.targetIndex;
    if (inactiveIndex != null) row[inactiveIndex] = false;
    bodyRows.push(row);
  });

  const finalValues = [headers].concat(bodyRows);
  targetsSheet.clearContents();
  targetsSheet.getRange(1, 1, finalValues.length, headers.length).setValues(finalValues);
  invalidateInitialDataCaches_(['app_pr', 'app_pr_targets']);

  return { success: true };
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
  archivePastOccurrencesForScheduleRow_(ss, headers, values[rowIndex - 1], rowIndex);
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
    if (normalizeCell_(values[rowIndex][idIndex]) === safeScheduleId) {
      return String(rowIndex + 1);
    }
  }
  return '';
}

// ============================================================
// スケジュール行の正規化・取得
// ============================================================

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

function normalizeScheduleRow_(sheetName, rowNumber, headers, row) {
  const record = {
    schedule_id: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.schedule_id) || `${sheetName}:${rowNumber}`,
    source_sheet: sheetName,
    source_row: String(rowNumber),
    mail_type: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.mail_type) || normalizeCell_(row[1]),
    category: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.mail_type) || normalizeCell_(row[1]),
    sub_category: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.sub_category),
    cycle: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.cycle) || normalizeCell_(row[2]),
    weekday: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.weekday) || normalizeCell_(row[3]),
    hour: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.hour) || normalizeCell_(row[4]),
    mail_name: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.mail_name),
    mail_content: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.mail_content),
    mail_content_extract: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.mail_content_extract),
    mail_content_free: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.mail_content_free),
    format: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.format),
    delivery_count: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.delivery_count),
    assignee: getPersonFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.assignee),
    reviewer: getPersonFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.reviewer),
    start_date: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.start_date),
    end_date: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.end_date),
    pr: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.pr),
    notes: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.notes),
    job_url: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.job_url),
    auto_job_feature_id: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.auto_job_feature_id),
    target_age: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.target_age),
    target_address: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.target_address),
    user_desired_location: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.user_desired_location),
    user_experience_job: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.user_experience_job),
    user_desired_job: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.user_desired_job),
    user_other_condition: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.user_other_condition),
    parameter: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.parameter),
    job_location: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.job_location),
    job_type: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.job_type),
    job_keyword: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.job_keyword),
    is_new: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.is_new),
    is_verifying: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.is_verifying),
    current_job_count: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.current_job_count),
    auto_job_other_condition: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.auto_job_other_condition),
    current_week_cycle: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.current_week_cycle),
    current_week_inactive: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.current_week_inactive),
    is_inactive: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.is_inactive),
    is_draft: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.is_draft),
    is_fixed: getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.is_fixed)
  };
  headers.forEach((header, index) => {
    if (isDeprecatedScheduleHeader_(sheetName, header)) return;
    if (!header || Object.prototype.hasOwnProperty.call(record, header)) return;
    record[header] = normalizeCell_(row[index]);
  });
  record.sub_category_class = getSubCategoryClass_(record.sub_category, record.mail_type);

  if (!record.mail_name) return null;
  return record;
}

// チェックステータス → DataCheckStatus.gs

// アーカイブ操作・サイクル判定ロジック → DataArchive.gs
