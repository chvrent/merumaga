/**
 * DataCheckStatus.gs
 * チェックステータス読み書き
 *
 * - saveCheckStatus / saveDailyArchiveDiffs (エントリーポイント)
 * - チェックステータス行のビルド・マージ
 * - チェックステータスシートの取得・ヘッダー管理
 * - 確定発生分との照合キー生成
 */

// ============================================================
// チェックステータス
// ============================================================

function saveCheckStatus(itemId, field, active, payload) {
  return withScriptLock_(() => saveCheckStatusUnlocked_(itemId, field, active, payload));
}

function saveDailyArchiveDiffs(updates) {
  return withScriptLock_(() => saveDailyArchiveDiffsUnlocked_(updates));
}

function saveDailyArchiveDiffsUnlocked_(updates) {
  const rows = Array.isArray(updates) ? updates : [];
  if (!rows.length) return [];

  const ss = getSourceSpreadsheet_();
  const scheduleSheet = ss.getSheetByName(SCHEDULE_SHEET_NAME);
  if (!scheduleSheet) throw new Error(`Sheet not found: ${SCHEDULE_SHEET_NAME}`);

  const scheduleValues = scheduleSheet.getDataRange().getValues();
  if (scheduleValues.length < 2) return [];
  const scheduleHeaders = scheduleValues[0].map(header => String(header || '').trim());
  const archiveDataHeaders = scheduleHeaders.concat(ARCHIVE_DIFF_HEADERS);
  const archiveSheet = getOrCreateArchiveSheet_(ss, archiveDataHeaders);
  const archiveValues = archiveSheet.getDataRange().getValues();
  const archiveHeaders = archiveValues[0].map(header => String(header || '').trim());
  const archiveHeaderMap = buildHeaderMap_(archiveHeaders);
  const scheduleHeaderMap = buildHeaderMap_(scheduleHeaders);
  const sourceRowIndex = findHeaderIndex_(archiveHeaders, 'source_row');
  const startIndex = findHeaderIndex_(archiveHeaders, 'fixed_week_start');
  const endIndex = findHeaderIndex_(archiveHeaders, 'fixed_week_end');
  if (sourceRowIndex < 0 || startIndex < 0 || endIndex < 0) {
    throw new Error(`${SCHEDULE_ARCHIVE_SHEET_NAME} must have source_row and fixed_week_start headers`);
  }

  const grouped = {};
  rows.forEach(update => {
    const itemId = normalizeCell_(update && update.itemId);
    const field = normalizeCell_(update && update.field);
    if (field !== 'setter' && field !== 'checker') return;
    const payload = update && update.payload || {};
    validateCheckStatusUpdate_(itemId, field, payload);
    const scheduleId = normalizeScheduleIdForMove_(payload.schedule_id || itemId);
    const targetDate = normalizeCommentTargetDate_(payload.delivery_date || String(itemId).split('|')[1]);
    if (!scheduleId || !targetDate) return;
    const key = `${scheduleId}|${targetDate}`;
    if (!grouped[key]) grouped[key] = { itemId, scheduleId, targetDate, payload, fields: {} };
    grouped[key].fields[field] = update && (update.active === true || String(update.active).toLowerCase() === 'true');
  });

  const archiveRowByKey = {};
  for (let rowIndex = 1; rowIndex < archiveValues.length; rowIndex++) {
    const row = archiveValues[rowIndex];
    const sourceRow = normalizeCell_(row[sourceRowIndex]);
    const start = normalizeCommentTargetDate_(row[startIndex]);
    const end = normalizeCommentTargetDate_(row[endIndex]);
    const scheduleId = getArchiveScheduleId_(archiveHeaders, row);
    const archiveKey = buildFixedOccurrenceKey_(scheduleId || sourceRow, start);
    if ((scheduleId || sourceRow) && start && start === end) archiveRowByKey[archiveKey] = rowIndex;
  }

  const timestamp = new Date();
  const timestampText = Utilities.formatDate(timestamp, Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  const touchedIndexes = new Set();
  const appendRows = [];
  const results = [];

  Object.keys(grouped).forEach(key => {
    const change = grouped[key];
    const sourceRow = getSourceRowByScheduleId_(change.scheduleId);
    if (!sourceRow) return;
    const sourceRowNumber = Number(sourceRow);
    if (sourceRowNumber < 2 || sourceRowNumber > scheduleValues.length) return;

    const archiveKey = buildFixedOccurrenceKey_(change.scheduleId || sourceRow, change.targetDate);
    const existingIndex = archiveRowByKey[archiveKey];
    const nextRow = existingIndex != null
      ? archiveValues[existingIndex].slice(0, archiveHeaders.length)
      : new Array(archiveHeaders.length).fill('');

    nextRow[0] = timestamp;
    nextRow[startIndex] = change.targetDate;
    nextRow[endIndex] = change.targetDate;
    nextRow[sourceRowIndex] = sourceRow;

    const scheduleRow = scheduleValues[sourceRowNumber - 1];
    scheduleHeaders.forEach(header => {
      const archiveIndex = archiveHeaderMap.get(header);
      const scheduleIndex = scheduleHeaderMap.get(header);
      if (archiveIndex == null || scheduleIndex == null) return;
      nextRow[archiveIndex] = scheduleRow[scheduleIndex];
    });

    if (Object.prototype.hasOwnProperty.call(change.fields, 'setter')) {
      const index = resolveHeaderIndex_(archiveHeaderMap, 'check_setter_active');
      if (index != null) nextRow[index] = change.fields.setter;
    }
    if (Object.prototype.hasOwnProperty.call(change.fields, 'checker')) {
      const index = resolveHeaderIndex_(archiveHeaderMap, 'check_checker_active');
      if (index != null) nextRow[index] = change.fields.checker;
    }
    ['assignee', 'reviewer'].forEach(k => {
      if (!Object.prototype.hasOwnProperty.call(change.payload || {}, k)) return;
      const archiveIndex = firstExistingHeaderIndex_(archiveHeaderMap, SCHEDULE_FIELD_ALIASES[k]);
      if (archiveIndex != null) nextRow[archiveIndex] = normalizeCell_(change.payload[k]);
    });

    const confirmed = isArchiveDiffConfirmed_(archiveHeaders, nextRow);
    if (!confirmed && existingIndex == null) {
      Object.keys(change.fields).forEach(field => {
        results.push({
          success: true,
          item_id: change.itemId,
          field,
          active: change.fields[field],
          updated_at: timestampText,
          archive: { archived: 0, schedule_id: change.scheduleId, source_row: sourceRow, target_date: change.targetDate, skipped: 'not_confirmed' }
        });
      });
      return;
    }

    if (existingIndex != null) {
      archiveValues[existingIndex] = nextRow;
      touchedIndexes.add(existingIndex);
    } else {
      appendRows.push(nextRow);
    }

    Object.keys(change.fields).forEach(field => {
      results.push({
        success: true,
        item_id: change.itemId,
        field,
        active: change.fields[field],
        updated_at: timestampText,
        archive: {
          archived: confirmed ? 1 : 0,
          schedule_id: change.scheduleId,
          source_row: sourceRow,
          target_date: change.targetDate,
          upserted: true,
          confirmed
        }
      });
    });
  });

  if (touchedIndexes.size) {
    const sortedIndexes = Array.from(touchedIndexes).sort((a, b) => a - b);
    let groupStart = sortedIndexes[0];
    let previous = sortedIndexes[0];
    for (let index = 1; index <= sortedIndexes.length; index++) {
      const current = sortedIndexes[index];
      if (current === previous + 1) {
        previous = current;
        continue;
      }
      const groupRows = archiveValues.slice(groupStart, previous + 1).map(row => row.slice(0, archiveHeaders.length));
      archiveSheet.getRange(groupStart + 1, 1, groupRows.length, archiveHeaders.length).setValues(groupRows);
      groupStart = current;
      previous = current;
    }
  }
  if (appendRows.length) {
    archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, appendRows.length, archiveHeaders.length).setValues(appendRows);
  }

  return results;
}

function validateCheckStatusUpdate_(itemId, field, payload) {
  if (!itemId) throw new Error('item_id is required');
  if (!field) throw new Error('field is required');

  const deliveryDate = parseScheduleDate_(payload && payload.delivery_date);
  if (!deliveryDate) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = (today.getTime() - deliveryDate.getTime()) / (24 * 60 * 60 * 1000);
  if (diff >= 14) {
    throw new Error('過去14日以前のデータは更新できません');
  }
}

function saveCheckStatusUnlocked_(itemId, field, active, payload) {
  const safeItemId = normalizeCell_(itemId);
  const safeField = normalizeCell_(field);
  const safePayload = payload || {};
  const deliveryDate = parseScheduleDate_(safePayload.delivery_date);

  if (!safeItemId) throw new Error('item_id is required');
  if (!safeField) throw new Error('field is required');

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
  const itemIdIndex = findHeaderIndex_(headers, 'item_id');
  const fieldIndex = findHeaderIndex_(headers, 'field');
  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  const activeValue = active === true || String(active).toLowerCase() === 'true';
  if (!activeValue && (safeField === 'move_override' || safeField === 'occurrence_override')) {
    for (let rowIndex = values.length - 1; rowIndex >= 1; rowIndex--) {
      const row = values[rowIndex];
      if (normalizeCell_(row[itemIdIndex]) === safeItemId && normalizeCell_(row[fieldIndex]) === safeField) {
        sheet.deleteRow(rowIndex + 1);
        return { success: true, item_id: safeItemId, field: safeField, active: false, updated_at: timestamp, deleted: true };
      }
    }
    return { success: true, item_id: safeItemId, field: safeField, active: false, updated_at: timestamp, deleted: false };
  }
  const rowValues = buildCheckStatusRow_(headers, safeItemId, safeField, activeValue, payload, timestamp);

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];
    if (normalizeCell_(row[itemIdIndex]) === safeItemId && normalizeCell_(row[fieldIndex]) === safeField) {
      sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([mergeCheckStatusRow_(headers, row, rowValues)]);
      return { success: true, item_id: safeItemId, field: safeField, active: activeValue, updated_at: timestamp };
    }
  }

  sheet.appendRow(rowValues);
  return { success: true, item_id: safeItemId, field: safeField, active: activeValue, updated_at: timestamp };
}

function buildCheckStatusRow_(headers, itemId, field, active, payload, timestamp) {
  const safePayload = payload && typeof payload === 'object' ? payload : {};

  return headers.map(header => {
    const key = getCheckStatusCanonicalKey_(header);
    switch (key) {
      case 'item_id': return itemId;
      case 'field': return field;
      case 'is_active': return active;
      case 'updated_at': return timestamp;
      case 'schedule_id': return normalizeScheduleIdForMove_(safePayload.schedule_id || itemId);
      case 'original_date': return normalizeCommentTargetDate_(safePayload.original_date);
      case 'delivery_date': return normalizeCommentTargetDate_(safePayload.delivery_date);
      case 'hour': return normalizeCell_(safePayload.hour);
      case 'weekday': return normalizeCell_(safePayload.weekday);
      case 'start_date': return normalizeCell_(safePayload.start_date);
      case 'end_date': return normalizeCell_(safePayload.end_date);
      case 'cycle': return normalizeCell_(safePayload.cycle);
      case 'mail_name': return normalizeCell_(safePayload.mail_name);
      case 'mail_content_extract': return normalizeCell_(safePayload.mail_content_extract);
      case 'mail_content_free': return normalizeCell_(safePayload.mail_content_free);
      case 'job_url': return normalizeCell_(safePayload.job_url);
      case 'auto_job_feature_id': return normalizeCell_(safePayload.auto_job_feature_id);
      case 'target_age': return normalizeCell_(safePayload.target_age);
      case 'target_address': return normalizeCell_(safePayload.target_address);
      case 'user_desired_location': return normalizeCell_(safePayload.user_desired_location);
      case 'user_experience_job': return normalizeCell_(safePayload.user_experience_job);
      case 'user_desired_job': return normalizeCell_(safePayload.user_desired_job);
      case 'user_other_condition': return normalizeCell_(safePayload.user_other_condition);
      case 'parameter': return normalizeCell_(safePayload.parameter);
      case 'job_location': return normalizeCell_(safePayload.job_location);
      case 'job_type': return normalizeCell_(safePayload.job_type);
      case 'job_keyword': return normalizeCell_(safePayload.job_keyword);
      case 'is_new': return normalizeCell_(safePayload.is_new);
      case 'current_job_count': return normalizeCell_(safePayload.current_job_count);
      case 'auto_job_other_condition': return normalizeCell_(safePayload.auto_job_other_condition);
      case 'override_fields': return normalizeCell_(safePayload.override_fields);
      case 'delivery_count': return normalizeCell_(safePayload.delivery_count);
      case 'assignee': return normalizeCell_(safePayload.assignee);
      case 'reviewer': return normalizeCell_(safePayload.reviewer);
      case 'notes': return normalizeCell_(safePayload.notes);
      case 'category': return normalizeCell_(safePayload.mail_type || safePayload.category);
      case 'sub_category': return normalizeCell_(safePayload.sub_category);
      case 'format': return normalizeCell_(safePayload.format);
      case 'pr': return normalizeCell_(safePayload.pr);
      default:
        return Object.prototype.hasOwnProperty.call(safePayload, header)
          ? normalizeCell_(safePayload[header])
          : '';
    }
  });
}

function mergeCheckStatusRow_(headers, existingRow, nextRow) {
  const existingOverrideFields = new Set();
  const nextOverrideFields = new Set();
  const overrideFieldsIndex = findHeaderIndex_(headers, 'override_fields');

  if (overrideFieldsIndex >= 0) {
    normalizeCell_(existingRow[overrideFieldsIndex]).split(',').forEach(f => {
      const field = f.trim();
      if (field) existingOverrideFields.add(field);
    });
    normalizeCell_(nextRow[overrideFieldsIndex]).split(',').forEach(f => {
      const field = f.trim();
      if (field) nextOverrideFields.add(field);
    });
  }

  const mergedOverrideFields = new Set([...existingOverrideFields, ...nextOverrideFields]);

  return headers.map((header, index) => {
    const key = getCheckStatusCanonicalKey_(header);

    // override_fields はマージしたものを返す
    if (key === 'override_fields') {
      return Array.from(mergedOverrideFields).join(',');
    }

    // 発生分上書き対象のフィールド
    // 新しい値があればそれを使い、なければ（今回の編集対象外で）既存の上書き値があれば維持する
    if (mergedOverrideFields.has(key)) {
      return normalizeCell_(nextRow[index]) || existingRow[index] || '';
    }

    return nextRow[index];
  });
}

function getCheckStatuses_(dateRange) {
  const statuses = {};
  getSheetObjects_(CHECK_STATUS_SHEET_NAME, true).forEach(status => {
    addCanonicalObjectFields_(CHECK_STATUS_FIELD_ALIASES, status);
    const itemId = normalizeCell_(status.item_id);
    const field = normalizeCell_(status.field);
    if (!itemId || !field) return;
    if (field === 'setter' || field === 'checker') return;
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
        updated_at: normalizeCell_(status.updated_at),
        schedule_id: normalizeScheduleIdForMove_(status.schedule_id || itemId),
        original_date: normalizeCommentTargetDate_(status.original_date),
        delivery_date: normalizeCommentTargetDate_(status.delivery_date),
        hour: normalizeCell_(status.hour),
        weekday: normalizeCell_(status.weekday),
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
        updated_at: normalizeCell_(status.updated_at),
        schedule_id: normalizeScheduleIdForMove_(status.schedule_id || itemId),
        original_date: normalizeCommentTargetDate_(status.original_date),
        delivery_date: normalizeCommentTargetDate_(status.delivery_date),
        hour: normalizeCell_(status.hour),
        weekday: normalizeCell_(status.weekday),
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

function getCheckStatusSheet_() {
  const ss = getSourceSpreadsheet_();
  const sheet = ss.getSheetByName(CHECK_STATUS_SHEET_NAME) || ss.insertSheet(CHECK_STATUS_SHEET_NAME);
  getCheckStatusHeaders_(sheet);
  return sheet;
}

function getCheckStatusHeaders_(sheet) {
  // システムメタデータ列（固定順・日本語/英語形式）
  const systemHeaders = [
    '項目ID/item_id',
    'ID/schedule_id',
    'フィールド/field',
    '有効/is_active',
    '更新日時/updated_at',
    '元の日付/original_date',
    '配信日/delivery_date',
    '上書きフィールド/override_fields'
  ];

  // app_schedule の全ヘッダーを取得（メタデータと重複するID系やアーカイブ固有列、廃止列は除外）
  const scheduleHeaders = getSheetHeaders_(getSourceSpreadsheet_(), SCHEDULE_SHEET_NAME)
    .filter(header => {
      const key = getCanonicalKeyFromAliases_(SCHEDULE_FIELD_ALIASES, header) || String(header || '').trim();
      return key &&
        ['schedule_id', 'id', 'source_sheet', 'source_row', 'is_fixed'].indexOf(key) === -1 &&
        !isDeprecatedScheduleHeader_(SCHEDULE_SHEET_NAME, header);
    });

  // 常にシステム列を先頭に、その後にマスタ列を並べる
  const requiredHeaders = systemHeaders.concat(scheduleHeaders);

  // 現在のシートのヘッダーを取得
  const lastCol = sheet.getLastColumn();
  let headers = [];
  if (lastCol > 0) {
    headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h || '').trim());
  }

  // 【重要】末尾の空要素（空列）を削除して、無駄な右側への挿入を防ぐ
  while (headers.length > 0 && headers[headers.length - 1] === '') {
    headers.pop();
  }

  // シートが空なら初期設定
  if (headers.length === 0) {
    if (requiredHeaders.length > 0) {
      sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    }
    return requiredHeaders;
  }

  // 足りないヘッダーを順次追加
  requiredHeaders.forEach(header => {
    const canonicalKey = getCheckStatusCanonicalKey_(header);
    // すでに同じ意味の列が存在するか（内部キーで照合）
    const alreadyExists = headers.some(current => getCheckStatusCanonicalKey_(current) === canonicalKey);
    
    if (!alreadyExists) {
      headers.push(header);
      sheet.getRange(1, headers.length).setValue(header);
    }
  });

  return headers;
}

function buildCheckStatusKey_(itemId, field) {
  return `${normalizeCell_(itemId)}|${normalizeCell_(field)}`;
}

/**
 * 配信停止時に setter・checker 両方を自動確認済みにする（日付バリデーションなし）。
 * saveDailyArchiveDiffs 実行後にアーカイブへ反映される。
 */
function autoConfirmOccurrences_(pairs) {
  if (!pairs || !pairs.length) return;

  const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  const sheet = getCheckStatusSheet_();
  const headers = getCheckStatusHeaders_(sheet);
  const values = sheet.getDataRange().getValues();
  const itemIdIndex = findHeaderIndex_(headers, 'item_id');
  const fieldIndex = findHeaderIndex_(headers, 'field');

  // 既存行をキーで引けるマップ
  const existingMap = {};
  for (let i = 1; i < values.length; i++) {
    const key = `${normalizeCell_(values[i][itemIdIndex])}|${normalizeCell_(values[i][fieldIndex])}`;
    existingMap[key] = i;
  }

  const rowsToAppend = [];
  const rowsToUpdate = [];

  pairs.forEach(pair => {
    const safeScheduleId = normalizeCell_(pair.scheduleId);
    const safeTargetDate = normalizeCommentTargetDate_(pair.targetDate);
    if (!safeScheduleId || !safeTargetDate) return;

    const itemId = `${safeScheduleId}|${safeTargetDate}`;
    const payload = { schedule_id: safeScheduleId, delivery_date: safeTargetDate };

    ['setter', 'checker'].forEach(field => {
      const rowValues = buildCheckStatusRow_(headers, itemId, field, true, payload, timestamp);
      const key = `${itemId}|${field}`;
      if (existingMap[key] !== undefined) {
        const existingRowIndex = existingMap[key];
        rowsToUpdate.push({ rowIndex: existingRowIndex + 1, values: [mergeCheckStatusRow_(headers, values[existingRowIndex], rowValues)] });
      } else {
        rowsToAppend.push(rowValues);
      }
    });
  });

  rowsToUpdate.forEach(update => {
    sheet.getRange(update.rowIndex, 1, 1, headers.length).setValues(update.values);
  });
  if (rowsToAppend.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
  }
}

/**
 * 配信再開時に autoConfirmOccurrences_ で書いた setter・checker エントリを削除する。
 * アーカイブ前（saveDailyArchiveDiffs 未実行）であれば確認状態をリセットできる。
 */
function clearOccurrenceCheckStatus_(scheduleId, targetDate) {
  const safeScheduleId = normalizeCell_(scheduleId);
  const safeTargetDate = normalizeCommentTargetDate_(targetDate);
  if (!safeScheduleId || !safeTargetDate) return;

  const itemId = `${safeScheduleId}|${safeTargetDate}`;
  const sheet = getCheckStatusSheet_();
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return;

  const headers = values[0].map(h => String(h || '').trim());
  const itemIdIndex = findHeaderIndex_(headers, 'item_id');
  const fieldIndex = findHeaderIndex_(headers, 'field');
  if (itemIdIndex < 0 || fieldIndex < 0) return;

  for (let i = values.length - 1; i >= 1; i--) {
    if (normalizeCell_(values[i][itemIdIndex]) !== itemId) continue;
    const field = normalizeCell_(values[i][fieldIndex]);
    if (field === 'setter' || field === 'checker') sheet.deleteRow(i + 1);
  }
}
