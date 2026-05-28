/**
 * DataExceptionService.gs
 * 配信停止・再開機能
 *
 * - 個別発生分の停止・再開
 * - 指定日の一括停止・一括再開
 * - 停止発生分の読み込み
 * - 例外シートのヘッダー管理
 */
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
  // 配信停止と同時に setter・checker を自動確認済みにする（次回アーカイブ時に記録される）
  autoConfirmOccurrences_([{ scheduleId: safeScheduleId, targetDate: safeTargetDate }]);
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

    // 停止した分を一括で自動確認済みにする
    if (results.length) {
      autoConfirmOccurrences_(results.map(id => ({ scheduleId: id, targetDate: safeDateStr })));
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
    const dateIndex = findHeaderIndex_(headers, 'target_date');
    const statusIndex = findHeaderIndex_(headers, 'status');
    const scheduleIndex = findHeaderIndex_(headers, 'schedule_id');

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
    if (fixedOccurrences[buildFixedOccurrenceKey_(scheduleId, safeDateStr)] ||
        fixedOccurrences[buildFixedOccurrenceKey_(sourceRow, safeDateStr)]) {
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
    const match = scheduleId.match(/^app_schedule:(\d+)$/);
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
  const scheduleIndex = findHeaderIndex_(headers, 'schedule_id');
  const dateIndex = findHeaderIndex_(headers, 'target_date');
  const statusIndex = findHeaderIndex_(headers, 'status');
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

  if (deleted > 0) {
    // 停止時に自動確認済みにしたエントリを削除（アーカイブ前であれば取り消し可能）
    clearOccurrenceCheckStatus_(safeScheduleId, safeTargetDate);
  }
  return { success: true, action: 'resumed', deleted };
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

function getExceptionsSheet_() {
  const ss = getSourceSpreadsheet_();
  let sheet = ss.getSheetByName(EXCEPTIONS_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(EXCEPTIONS_SHEET_NAME);
  getExceptionHeaders_(sheet);
  return sheet;
}

function getExceptionHeaders_(sheet) {
  const requiredHeaders = ['schedule_id', 'target_date', 'status'];
  let headers = getSheetTrimmedHeaders_(sheet, requiredHeaders.length);

  // 末尾の空要素をトリムして無駄な右側への挿入を防ぐ
  trimTrailingEmptyHeaders_(headers);

  if (!headers.some(Boolean)) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    return requiredHeaders;
  }

  // 必要ヘッダーをまとめて保証
  ensureHeaders_(sheet, headers, requiredHeaders);

  return headers;
}

function buildStoppedOccurrenceKey_(scheduleId, targetDate) {
  const safeScheduleId = normalizeCell_(scheduleId);
  const safeTargetDate = normalizeCommentTargetDate_(targetDate);
  return safeScheduleId && safeTargetDate ? `${safeScheduleId}|${safeTargetDate}` : '';
}
