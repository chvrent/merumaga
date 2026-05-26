/**
 * DataCommentService.gs
 * コメント機能
 *
 * - コメント保存・取得
 * - コメント件数集計（日付範囲フィルタ対応）
 * - コメントシートのヘッダー管理
 * - コメントキャッシュの無効化
 */

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
  const scheduleIndex = findHeaderIndex_(headers, 'schedule_id');
  const dateIndex = findHeaderIndex_(headers, 'target_date');
  const timestampIndex = findHeaderIndex_(headers, 'timestamp');
  const userIndex = findHeaderIndex_(headers, 'user');
  const textIndex = findHeaderIndex_(headers, 'comment_text');
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
  const scheduleIndex = findHeaderIndex_(headers, 'schedule_id');
  const dateIndex = findHeaderIndex_(headers, 'target_date');
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
    if (headerExists_(headers, header)) return;
    headers.push(header);
    sheet.getRange(1, headers.length).setValue(header);
  });

  return headers;
}

function buildCommentKey_(scheduleId, targetDate) {
  return `${normalizeCell_(scheduleId)}|${normalizeCommentTargetDate_(targetDate)}`;
}

function normalizeCommentTargetDate_(value) {
  const date = parseScheduleDate_(value);
  return date ? formatDate_(date) : normalizeCell_(value);
}

function getCommentTime_(value) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
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
