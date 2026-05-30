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
    adminMaster: getAdminList(),
    prefMaster: getPrefMaster(),
    jobMaster: getJobMaster(),
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
      // 有効/無効フラグを「日本語/英語」形式ヘッダーも考慮して判定
      const activeKeys = ['is_active', 'active', '有効', 'enabled', 'enable'];
      const inactiveKeys = ['is_deleted', 'deleted', '無効', 'inactive'];
      for (const key of activeKeys) {
        const val = getObjectFieldByAliasesSegment_(row, [key]);
        if (val !== '') return isTruthy_(val);
      }
      for (const key of inactiveKeys) {
        const val = getObjectFieldByAliasesSegment_(row, [key]);
        if (val !== '') return !isTruthy_(val);
      }
      return true;
    })
    .map(row => {
      // 各フィールドを「日本語/英語」形式ヘッダーも考慮して取得
      const name = getObjectFieldByAliasesSegment_(row, ['name', '氏名', '名前', 'initial', '略称', 'abbreviation', 'Abbreviation']);
      if (!name) return null;
      return {
        name,
        full_name: getObjectFieldByAliasesSegment_(row, ['full_name', 'fullName', '氏名', '名前']) || name,
        initial: getObjectFieldByAliasesSegment_(row, ['abbreviation', 'Abbreviation', 'initial', '略称']) || name
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
// 地域系・職種系 参照マスタ（JOB_/USER_ 項目のプルダウン複数選択用）
//   app_pref_master: 並び順 / 地域_大分類 / 地域_中分類
//   app_job_master : 並び順 / 職種大分類 / 職種小分類
// クライアントは中分類(value)を大分類(group)でグルーピングして
// 複数選択ドロップダウンを生成する。SPEC §0.7 / §3 参照。
// ============================================================

function getPrefMaster() {
  return getCategoryMasterOptions_(
    'app_pref_master',
    ['region_major', '地域_大分類', '地域大分類', '大分類', 'major'],
    ['region_minor', '地域_中分類', '地域中分類', '中分類', 'minor', 'name']
  );
}

function getJobMaster() {
  return getCategoryMasterOptions_(
    'app_job_master',
    ['job_category_major', '職種大分類', '職種_大分類', '大分類', 'major'],
    ['job_category_minor', '職種小分類', '職種_小分類', '小分類', 'minor', 'name']
  );
}

/**
 * 「並び順 / 大分類 / 小(中)分類」構造のマスタを
 * [{ group: 大分類, value: 小分類, sort: 並び順 }] へ正規化して返す。
 * 値が空の行・重複(group+value)は除外。並び順→出現順で安定ソート。
 */
function getCategoryMasterOptions_(sheetName, majorAliases, minorAliases) {
  const rows = getSheetObjectsCached_(sheetName, true);
  if (!Array.isArray(rows)) return [];
  const sortAliases = ['sort_order', '並び順', 'sort', 'order', 'no'];
  const seen = {};
  const options = [];
  rows.forEach((row, index) => {
    const group = getObjectFieldByAliasesSegment_(row, majorAliases);
    const value = getObjectFieldByAliasesSegment_(row, minorAliases);
    if (!value) return;
    const dedupeKey = group + '' + value;
    if (seen[dedupeKey]) return;
    seen[dedupeKey] = true;
    const sortRaw = getObjectFieldByAliasesSegment_(row, sortAliases);
    const sortNum = sortRaw === '' ? Number.MAX_SAFE_INTEGER : Number(sortRaw);
    options.push({
      group: group || '',
      value: value,
      sort: isNaN(sortNum) ? Number.MAX_SAFE_INTEGER : sortNum,
      _index: index
    });
  });
  options.sort((left, right) => (left.sort - right.sort) || (left._index - right._index));
  return options.map(option => ({ group: option.group, value: option.value, sort: option.sort }));
}
