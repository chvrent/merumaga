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
  const itemIdIndex = findHeaderIndex_(csHeaders, 'item_id');
  const fieldIndex = findHeaderIndex_(csHeaders, 'field');
  const deliveryDateIndex = findHeaderIndex_(csHeaders, 'delivery_date');

  const { moveOverrideRows, occurrenceOverrideRows } = collectCheckStatusRows_(values, itemIdIndex, fieldIndex, itemId);
  const mergedMoveRow = moveOverrideRows.length > 0
    ? mergeCheckStatusRow_(csHeaders, moveOverrideRows[0].row, logRow)
    : logRow;
  const updatedOccRow = buildUpdatedOccurrenceOverrideRow_(occurrenceOverrideRows, deliveryDateIndex, safeDate);

  deleteRowsDescending_(checkStatusSheet, moveOverrideRows.concat(occurrenceOverrideRows));

  if (isBackToOriginalSlot) {
    if (updatedOccRow) checkStatusSheet.appendRow(updatedOccRow);
    return { success: true, schedule_id: safeScheduleId, original_date: safeOldDate, delivery_date: safeDate, hour: safeHour, cleared: true };
  }

  checkStatusSheet.appendRow(mergedMoveRow);
  if (updatedOccRow) checkStatusSheet.appendRow(updatedOccRow);

  return { success: true, schedule_id: safeScheduleId, original_date: safeOldDate, delivery_date: safeDate, hour: safeHour };
}

function collectCheckStatusRows_(values, itemIdIndex, fieldIndex, itemId) {
  const moveOverrideRows = [];
  const occurrenceOverrideRows = [];

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    if (normalizeCell_(row[itemIdIndex]) !== itemId) continue;
    const rowField = normalizeCell_(row[fieldIndex]);
    if (rowField === 'move_override') moveOverrideRows.push({ rowIndex, row });
    else if (rowField === 'occurrence_override') occurrenceOverrideRows.push({ rowIndex, row });
  }

  return { moveOverrideRows, occurrenceOverrideRows };
}

function buildUpdatedOccurrenceOverrideRow_(occurrenceOverrideRows, deliveryDateIndex, safeDate) {
  if (occurrenceOverrideRows.length === 0 || deliveryDateIndex < 0) return null;
  const updatedOccRow = occurrenceOverrideRows[0].row.slice();
  updatedOccRow[deliveryDateIndex] = safeDate;
  return updatedOccRow;
}

function deleteRowsDescending_(sheet, rowEntries) {
  rowEntries
    .slice()
    .sort((a, b) => b.rowIndex - a.rowIndex)
    .forEach(({ rowIndex }) => sheet.deleteRow(rowIndex + 1));
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

  const normalizedPrPayload = normalizePrEndStatePayload_(prPayload);
  const savedPr = saveMasterDataUnlocked_('app_pr', normalizedPrPayload);
  const prId = normalizeIdKey_(getObjectFieldByAliases_(normalizedPrPayload, PR_FIELD_ALIASES.pr_id) || normalizeCell_(savedPr.id));
  if (!prId) throw new Error('pr_id is required');

  const targetsSheetData = getSheetValuesAndHeaders_(ss.getSheetByName('app_pr_targets'));
  if (!targetsSheetData) throw new Error('Sheet not found: app_pr_targets');

  const targetHeaderMap = buildHeaderMap_(targetsSheetData.headers);
  const prIdIndex = firstExistingHeaderIndex_(targetHeaderMap, PR_TARGET_FIELD_ALIASES.pr_id);
  const mailNameIndex = firstExistingHeaderIndex_(targetHeaderMap, PR_TARGET_FIELD_ALIASES.mail_name);
  if (prIdIndex == null || mailNameIndex == null) {
    throw new Error('app_pr_targets must have PR ID/pr_id and メルマガ名/mail_name headers');
  }

  const selectedMailNames = getNormalizedMailNames_(targetNewsletters);
  const preservedRows = getPreservedPrTargetRows_(targetsSheetData.values, targetsSheetData.headers.length, prIdIndex, prId);
  const newRows = buildPrTargetRows_(selectedMailNames, targetsSheetData.headers.length, prIdIndex, mailNameIndex, prId);

  const finalValues = [targetsSheetData.headers].concat(preservedRows, newRows);
  targetsSheetData.sheet.clearContents();
  targetsSheetData.range.getSheet().getRange(1, 1, finalValues.length, targetsSheetData.headers.length).setValues(finalValues);
  invalidateInitialDataCaches_(['app_pr', 'app_pr_targets']);

  return { success: true };
}

function normalizePrEndStatePayload_(prPayload) {
  const payload = Object.assign({}, prPayload || {});
  if (PR_FIELD_ALIASES.end_date.some(key => Object.prototype.hasOwnProperty.call(payload, key))) {
    const endDateValue = getObjectFieldByAliases_(payload, PR_FIELD_ALIASES.end_date);
    const endDate = parseScheduleDate_(endDateValue);
    const today = parseScheduleDate_(formatDate_(new Date()));
    payload.is_inactive = endDate && today && endDate < today ? 'TRUE' : 'FALSE';
  }
  return payload;
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

  const sheetData = getSheetValuesAndHeaders_(sheet);
  if (!sheetData || !sheetData.values.length) throw new Error(`${SCHEDULE_SHEET_NAME} is empty`);

  const headerMap = buildHeaderMap_(sheetData.headers);
  const idIndex = firstExistingHeaderIndex_(headerMap, SCHEDULE_FIELD_ALIASES.schedule_id);
  const rowIndex = resolveScheduleRowIndex_(sheetData.values, idIndex, scheduleId);

  if (rowIndex < 2 || rowIndex > sheetData.values.length) {
    throw new Error(`Schedule row not found for schedule_id: ${scheduleId}`);
  }

  const row = sheetData.values[rowIndex - 1].slice();
  archivePastOccurrencesForScheduleRow_(ss, sheetData.headers, sheetData.values[rowIndex - 1], rowIndex);
  applyPayloadToRow_(row, payload, headerMap);
  sheet.getRange(rowIndex, 1, 1, sheetData.headers.length).setValues([row]);
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

function resolveScheduleRowIndex_(values, idIndex, scheduleId) {
  if (idIndex != null) {
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][idIndex]).trim() === scheduleId) {
        return i + 1;
      }
    }
  }
  return getRowIndexFromScheduleId_(scheduleId);
}

function getNormalizedMailNames_(targetNewsletters) {
  return (targetNewsletters || [])
    .map(nl => normalizeCell_(nl && nl.mail_name))
    .filter(Boolean);
}

function getPreservedPrTargetRows_(values, headerCount, prIdIndex, prId) {
  return values.slice(1)
    .map(row => row.slice(0, headerCount))
    .filter(row => normalizeIdKey_(row[prIdIndex]) !== prId);
}

function buildPrTargetRows_(selectedMailNames, headerCount, prIdIndex, mailNameIndex, prId) {
  return selectedMailNames.map(mailName => {
    const row = new Array(headerCount).fill('');
    row[prIdIndex] = prId;
    row[mailNameIndex] = mailName;
    return row;
  });
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
  const cacheKey = 'initialData:scheduleRows';
  const cached = getJsonCache_(cacheKey);
  if (Array.isArray(cached)) return cached;

  const sheet = ss.getSheetByName(SCHEDULE_SHEET_NAME);
  if (!sheet) throw new Error(`Sheet not found: ${SCHEDULE_SHEET_NAME}`);

  const values = sheet.getDataRange().getDisplayValues();
  if (!values.length) return [];

  const headers = values[0].map(header => String(header || '').trim());
  const headerMap = buildHeaderMap_(headers);

  // SCHEDULE_FIELD_ALIASES の列インデックスをヘッダー一覧から1回だけ解決する。
  // 日本語/英語 形式のヘッダーに対して行ごとに O(n) スキャンが走るのを防ぐ。
  const fieldIdx = {};
  Object.keys(SCHEDULE_FIELD_ALIASES).forEach(key => {
    const idx = firstExistingHeaderIndex_(headerMap, SCHEDULE_FIELD_ALIASES[key]);
    fieldIdx[key] = idx != null ? idx : -1;
  });

  const rows = values
    .slice(1)
    .filter(row => row.some(v => v !== ''))
    .map((row, index) => normalizeScheduleRow_(SCHEDULE_SHEET_NAME, index + 2, row, fieldIdx))
    .filter(Boolean);

  // ScriptCache に保存（95KB 超過時は putJsonCache_ が自動スキップ）。
  // 無効化は invalidateInitialDataCaches_([SCHEDULE_SHEET_NAME]) が担う。
  putJsonCache_(cacheKey, rows, INITIAL_DATA_CACHE_TTL_SECONDS);
  return rows;
}

function normalizeScheduleRow_(sheetName, rowNumber, row, fieldIdx) {
  const getValue = key => getScheduleFieldValue_(row, fieldIdx, key);
  const getPersonValue = key => getSchedulePersonFieldValue_(row, fieldIdx, key);

  const mailType = getValue('mail_type') || normalizeCell_(row[1]);
  const record = buildScheduleRecord_(sheetName, rowNumber, row, mailType, getValue, getPersonValue);
  record.sub_category_class = getSubCategoryClass_(record.sub_category, record.mail_type);

  if (!record.mail_name) return null;
  return record;
}

function getScheduleFieldValue_(row, fieldIdx, key) {
  const idx = fieldIdx[key];
  return idx >= 0 ? normalizeCell_(row[idx]) : '';
}

function getSchedulePersonFieldValue_(row, fieldIdx, key) {
  const value = getScheduleFieldValue_(row, fieldIdx, key);
  return isBooleanText_(value) ? '' : value;
}

function buildScheduleRecord_(sheetName, rowNumber, row, mailType, getValue, getPersonValue) {
  return {
    schedule_id: getValue('schedule_id') || `${sheetName}:${rowNumber}`,
    source_sheet: sheetName,
    source_row: String(rowNumber),
    mail_type: mailType,
    category: mailType,
    sub_category: getValue('sub_category'),
    cycle: getValue('cycle') || normalizeCell_(row[2]),
    weekday: getValue('weekday') || normalizeCell_(row[3]),
    hour: getValue('hour') || normalizeCell_(row[4]),
    mail_name: getValue('mail_name'),
    mail_content: getValue('mail_content'),
    mail_content_extract: getValue('mail_content_extract'),
    mail_content_free: getValue('mail_content_free'),
    format: getValue('format'),
    delivery_count: getValue('delivery_count'),
    assignee: getPersonValue('assignee'),
    reviewer: getPersonValue('reviewer'),
    start_date: getValue('start_date'),
    end_date: getValue('end_date'),
    pr: getValue('pr'),
    notes: getValue('notes'),
    job_url: getValue('job_url'),
    auto_job_feature_id: getValue('auto_job_feature_id'),
    target_age: getValue('target_age'),
    target_address: getValue('target_address'),
    user_desired_location: getValue('user_desired_location'),
    user_experience_job: getValue('user_experience_job'),
    user_desired_job: getValue('user_desired_job'),
    user_other_condition: getValue('user_other_condition'),
    parameter: getValue('parameter'),
    job_location: getValue('job_location'),
    job_type: getValue('job_type'),
    job_keyword: getValue('job_keyword'),
    is_new: getValue('is_new'),
    is_verifying: getValue('is_verifying'),
    current_job_count: getValue('current_job_count'),
    auto_job_other_condition: getValue('auto_job_other_condition'),
    current_week_cycle: getValue('current_week_cycle'),
    current_week_inactive: getValue('current_week_inactive'),
    is_inactive: getValue('is_inactive'),
    is_draft: getValue('is_draft'),
    is_fixed: getValue('is_fixed')
  };
}
