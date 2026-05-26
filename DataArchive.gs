/**
 * DataArchive.gs
 * アーカイブ操作・サイクル判定ロジック
 *
 * - アーカイブシートの取得・作成
 * - 確定発生分の読み書き
 * - 過去発生分の自動アーカイブ
 * - サイクル（隔週A/B・毎月・月末・単発等）判定
 */

// ============================================================
// アーカイブ操作
// ============================================================

const ARCHIVE_SPECIFIC_KEYS_ = ['archived_at', 'fixed_week_start', 'fixed_week_end', 'source_row', 'check_setter_active', 'check_checker_active'];

function isArchiveSpecificHeader_(header) {
  return ARCHIVE_SPECIFIC_KEYS_.some(key => matchesAlias_(header, key));
}

function matchesAlias_(header, alias) {
  if (header === alias) return true;
  return header.includes('/') && header.split('/').map(s => s.trim()).includes(alias);
}

function matchArchiveHeaderToScheduleIndex_(schedHeaderMap, archiveHeader) {
  const exact = schedHeaderMap.get(archiveHeader);
  if (exact != null) return exact;
  const segments = archiveHeader.includes('/') ? archiveHeader.split('/').map(s => s.trim()) : [archiveHeader];
  for (const seg of segments) {
    const idx = resolveHeaderIndex_(schedHeaderMap, seg);
    if (idx != null) return idx;
  }
  return null;
}

function getOrCreateArchiveSheet_(ss, scheduleHeaders) {
  const sheet = ss.getSheetByName(SCHEDULE_ARCHIVE_SHEET_NAME) || ss.insertSheet(SCHEDULE_ARCHIVE_SHEET_NAME);
  const wantedHeaders = ['archived_at', 'fixed_week_start', 'fixed_week_end', 'source_row'].concat(scheduleHeaders);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, wantedHeaders.length).setValues([wantedHeaders]);
    return sheet;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), wantedHeaders.length)).getValues()[0]
    .map(h => String(h || '').trim());
  if (!currentHeaders[0]) {
    sheet.getRange(1, 1, 1, wantedHeaders.length).setValues([wantedHeaders]);
    return sheet;
  }

  let nextHeaders = currentHeaders.slice();
  wantedHeaders.forEach(header => {
    if (!headerExists_(nextHeaders, header)) nextHeaders.push(header);
  });
  if (nextHeaders.length !== currentHeaders.length) {
    sheet.getRange(1, 1, 1, nextHeaders.length).setValues([nextHeaders]);
  }

  return sheet;
}

function getExistingArchiveKeys_(archiveSheet) {
  const keys = new Set();
  if (archiveSheet.getLastRow() < 2) return keys;

  const values = archiveSheet.getDataRange().getDisplayValues();
  const headers = values[0].map(header => String(header || '').trim());
  const weekStartIndex = findHeaderIndex_(headers, 'fixed_week_start');
  const sourceRowIndex = findHeaderIndex_(headers, 'source_row');
  if (weekStartIndex < 0 || sourceRowIndex < 0) return keys;

  values.slice(1).forEach(row => {
    const scheduleId = getArchiveScheduleId_(headers, row);
    keys.add(buildFixedOccurrenceKey_(scheduleId || row[sourceRowIndex], row[weekStartIndex]));
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
  const sourceRowIndex = findHeaderIndex_(headers, 'source_row');
  const weekStartIndex = findHeaderIndex_(headers, 'fixed_week_start');
  const weekEndIndex = findHeaderIndex_(headers, 'fixed_week_end');
  if (sourceRowIndex < 0 || weekStartIndex < 0 || weekEndIndex < 0) return fixedOccurrences;

  values.slice(1).forEach(row => {
    const sourceRow = normalizeCell_(row[sourceRowIndex]);
    const start = parseScheduleDate_(row[weekStartIndex]);
    const end = parseScheduleDate_(row[weekEndIndex]);
    if (!sourceRow || !start || !end) return;
    if (dateRange && (end < dateRange.start || start > dateRange.end)) return;
    if (!isArchiveDiffConfirmed_(headers, row)) return;

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      if (!isDateInOperationalRange_(formatDate_(date), dateRange)) continue;
      const scheduleId = getArchiveScheduleId_(headers, row);
      fixedOccurrences[buildFixedOccurrenceKey_(scheduleId || sourceRow, formatDate_(date))] = true;
    }
  });

  return fixedOccurrences;
}

function isArchiveDiffConfirmed_(headers, row) {
  const setterIndex = findHeaderIndex_(headers, 'check_setter_active');
  const checkerIndex = findHeaderIndex_(headers, 'check_checker_active');
  const hasCheckColumns = setterIndex >= 0 || checkerIndex >= 0;
  const hasCheckValues = (setterIndex >= 0 && normalizeCell_(row[setterIndex]) !== '') ||
    (checkerIndex >= 0 && normalizeCell_(row[checkerIndex]) !== '');
  if (!hasCheckColumns) return true;
  if (!hasCheckValues) return false;

  const assigneeIndex = firstExistingHeaderIndex_(buildHeaderMap_(headers), SCHEDULE_FIELD_ALIASES.assignee);
  const assignee = assigneeIndex == null ? '' : normalizeCell_(row[assigneeIndex]);
  if (assignee === 'R') return setterIndex >= 0 && isTruthy_(row[setterIndex]);
  return checkerIndex >= 0 && isTruthy_(row[checkerIndex]);
}

function getArchivedOccurrenceRows_(dateRange) {
  const ss = getSourceSpreadsheet_();
  const archiveSheet = ss.getSheetByName(SCHEDULE_ARCHIVE_SHEET_NAME);
  const archived = {};
  if (!archiveSheet || archiveSheet.getLastRow() < 2) return archived;

  const values = archiveSheet.getDataRange().getDisplayValues();
  const headers = values[0].map(header => String(header || '').trim());
  const sourceRowIndex = findHeaderIndex_(headers, 'source_row');
  const weekStartIndex = findHeaderIndex_(headers, 'fixed_week_start');
  const weekEndIndex = findHeaderIndex_(headers, 'fixed_week_end');
  if (sourceRowIndex < 0 || weekStartIndex < 0 || weekEndIndex < 0) return archived;

  const scheduleColumnIndices = [];
  const scheduleHeaders = [];
  headers.forEach((h, i) => {
    if (!isArchiveSpecificHeader_(h)) {
      scheduleColumnIndices.push(i);
      scheduleHeaders.push(h);
    }
  });

  values.slice(1).forEach(row => {
    const sourceRow = normalizeCell_(row[sourceRowIndex]);
    const start = parseScheduleDate_(row[weekStartIndex]);
    const end = parseScheduleDate_(row[weekEndIndex]);
    if (!sourceRow || !start || !end) return;
    if (dateRange && (end < dateRange.start || start > dateRange.end)) return;

    const scheduleRow = scheduleColumnIndices.map(i => row[i]);
    const isSingleDayArchive = formatDate_(start) === formatDate_(end);
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dateStr = formatDate_(date);
      if (!isDateInOperationalRange_(dateStr, dateRange)) continue;
      if (!isSingleDayArchive && !isScheduleRowActiveOnDate_(scheduleHeaders, scheduleRow, date)) continue;
      const record = normalizeScheduleRow_(SCHEDULE_SHEET_NAME, Number(sourceRow), scheduleHeaders, scheduleRow);
      if (!record) continue;
      record.source_row = sourceRow;
      record.target_date = dateStr;
      record.is_archived_occurrence = true;
      archived[buildFixedOccurrenceKey_(record.schedule_id || sourceRow, dateStr)] = record;
    }
  });

  return archived;
}

function archivePastOccurrencesForScheduleRow_(ss, headers, row, sourceRow) {
  if (!row || sourceRow < 2) return { archived: 0, skipped: 'invalid_row' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const startDate = parseScheduleDate_(getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.start_date)) || CYCLE_BASE_DATE;
  const endDate = parseScheduleDate_(getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.end_date)) || yesterday;
  const scanStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const scanEnd = new Date(Math.min(endDate.getTime(), yesterday.getTime()));
  if (scanStart > scanEnd) return { archived: 0, skipped: 'no_past_occurrences' };

  const archiveSheet = getOrCreateArchiveSheet_(ss, headers);
  const existingKeys = getExistingArchiveKeys_(archiveSheet);
  const scheduleId = getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.schedule_id);

  const archiveHeaders = archiveSheet.getRange(1, 1, 1, archiveSheet.getLastColumn()).getValues()[0]
    .map(h => String(h || '').trim());
  const schedHeaderMap = new Map();
  headers.forEach((h, i) => schedHeaderMap.set(h, i));

  const archiveRows = [];
  for (let date = new Date(scanStart); date <= scanEnd; date.setDate(date.getDate() + 1)) {
    if (!isScheduleRowActiveOnDate_(headers, row, date)) continue;
    const dateStr = formatDate_(date);
    const archiveKey = buildFixedOccurrenceKey_(scheduleId || sourceRow, dateStr);
    if (existingKeys.has(archiveKey)) continue;

    const archiveRow = archiveHeaders.map(archiveHeader => {
      if (matchesAlias_(archiveHeader, 'archived_at')) return new Date();
      if (matchesAlias_(archiveHeader, 'fixed_week_start')) return dateStr;
      if (matchesAlias_(archiveHeader, 'fixed_week_end')) return dateStr;
      if (matchesAlias_(archiveHeader, 'source_row')) return sourceRow;
      const schedIdx = matchArchiveHeaderToScheduleIndex_(schedHeaderMap, archiveHeader);
      return schedIdx != null ? row[schedIdx] : '';
    });
    archiveRows.push(archiveRow);
    existingKeys.add(archiveKey);
  }

  if (archiveRows.length) {
    archiveSheet.getRange(archiveSheet.getLastRow() + 1, 1, archiveRows.length, archiveRows[0].length).setValues(archiveRows);
  }
  return { archived: archiveRows.length };
}

function isScheduleRowActiveOnDate_(headers, row, date) {
  const inactive = getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.is_inactive);
  const draft = getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.is_draft);
  const currentWeekInactive = getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.current_week_inactive);
  if (isTruthy_(inactive) || isTruthy_(draft) || isTruthy_(currentWeekInactive)) return false;

  const weekday = normalizeWeekdayForBackup_(getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.weekday) || row[3]);
  if (!weekday) return false;
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  if (weekdays[date.getDay()] !== weekday) return false;

  const startDate = parseScheduleDate_(getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.start_date));
  const endDate = parseScheduleDate_(getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.end_date));
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  return isScheduleCycleActiveOnDate_(headers, row, date);
}

function isArchivedOccurrenceFixed_(sourceKey, targetDate) {
  const fixedOccurrences = getFixedOccurrences_();
  return !!fixedOccurrences[buildFixedOccurrenceKey_(sourceKey, normalizeCell_(targetDate))];
}

function isScheduleOccurrenceFixedById_(scheduleId, targetDate) {
  const sourceRow = getSourceRowByScheduleId_(scheduleId);
  return isArchivedOccurrenceFixed_(scheduleId, targetDate) ||
    (sourceRow ? isArchivedOccurrenceFixed_(sourceRow, targetDate) : false);
}

function buildFixedOccurrenceKey_(sourceKey, targetDate) {
  return `${normalizeCell_(sourceKey)}|${normalizeCell_(targetDate)}`;
}

function getArchiveScheduleId_(headers, row) {
  const index = firstExistingHeaderIndex_(buildHeaderMap_(headers), SCHEDULE_FIELD_ALIASES.schedule_id);
  return index == null ? '' : normalizeCell_(row[index]);
}

function buildArchiveKey_(sourceRow, weekStart) {
  return `${sourceRow}|${formatDate_(weekStart)}`;
}

// ============================================================
// サイクル判定ロジック
// ============================================================

function isScheduleCycleActiveOnDate_(headers, row, date) {
  const category = normalizeCell_(getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.category));
  const cycleValue = getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.cycle);
  const rowCycle = normalizeCycleLabelForBackup_(cycleValue);
  const startDate = normalizeCommentTargetDate_(getFieldByAliases_(headers, row, SCHEDULE_FIELD_ALIASES.start_date));

  if (rowCycle === '単発') return !!startDate && startDate === formatDate_(date);
  if (rowCycle === '毎日') return true;
  if (rowCycle === '毎月') return isMonthlyCycleDateForBackup_(startDate, date);
  if (rowCycle === '月末') return getMonthEndInfo_(date).isInWindow;
  if (rowCycle === 'A' || rowCycle === 'B') {
    return rowCycle === getCycleForScheduleRow_(headers, row, date);
  }
  const rowCycleNum = extractCycleNumberForBackup_(rowCycle);
  if (rowCycleNum != null) {
    const expectedCycle = getCycleForScheduleRow_(headers, row, date);
    if (typeof expectedCycle !== 'number') return false;
    return cycleContainsForBackup_(cycleValue, expectedCycle);
  }

  // 旧データ互換: 種別で運用していた周期情報を読み取る
  if (category.indexOf('月末') !== -1) return getMonthEndInfo_(date).isInWindow;
  if (category.indexOf('毎月') !== -1 && !getMonthEndInfo_(date).isInWindow) return false;
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
  if (!text || text === '毎週' || text === '毎週配信') return '';
  if (text === '単発') return text;
  if (text === '毎日' || text === '毎日配信') return '毎日';
  if (text === '毎月' || text === '毎月配信') return '毎月';
  if (text === '月末' || text === '月末増発') return '月末';
  if (text.indexOf('隔週配信A') !== -1 || text.indexOf('隔週A') !== -1 || text === 'A') return 'A';
  if (text.indexOf('隔週配信B') !== -1 || text.indexOf('隔週B') !== -1 || text === 'B') return 'B';
  const match = text.match(/(\d+)/);
  return match ? String(Number(match[1])) : text;
}

function isMonthlyCycleDateForBackup_(startDate, date) {
  if (!startDate) return false;
  const day = Number(String(startDate).slice(8, 10));
  return Number.isFinite(day) && day > 0 && date.getDate() === day;
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

function normalizeWeekdayForBackup_(value) {
  const text = normalizeCell_(value);
  const map = {
    sun: '日', sunday: '日', '日': '日',
    mon: '月', monday: '月', '月': '月',
    tue: '火', tues: '火', tuesday: '火', '火': '火',
    wed: '水', wednesday: '水', '水': '水',
    thu: '木', thursday: '木', '木': '木',
    fri: '金', friday: '金', '金': '金',
    sat: '土', saturday: '土', '土': '土'
  };
  return map[text.toLowerCase()] || map[text] || '';
}
