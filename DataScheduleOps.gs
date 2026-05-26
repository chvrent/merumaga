/**
 * DataScheduleOps.gs
 * スケジュール操作・行正規化
 *
 * - D&Dによる配信日時移動（updateItemDate）
 * - 日付指定での保存（saveScheduleFromDate）
 * - PR統合保存（savePRData）
 * - スケジュールupsert（upsertScheduleData）
 * - スケジュール行の取得・正規化（getScheduleRows_, normalizeScheduleRow_）
 */

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
