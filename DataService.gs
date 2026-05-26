/**
 * DataService.gs
 * エントリーポイント
 *
 * 定数                → DataConstants.gs
 * ユーティリティ      → DataUtils.gs
 * シートアクセス      → DataSheetAccess.gs
 * メンテナンス        → DataMaintenance.gs
 * アーカイブ・サイクル → DataArchive.gs
 * チェックステータス  → DataCheckStatus.gs
 * マスターCRUD        → DataMasterCRUD.gs
 * コメント            → DataCommentService.gs
 * 配信停止/再開       → DataExceptionService.gs
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
