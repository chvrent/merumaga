/**
 * DataMasterCRUD.gs
 * マスターデータCRUD
 *
 * - マスターデータ取得・保存・削除・停止・再開
 */

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
  const rows = mapDisplayValuesToMasterRows_(safeSheetName, values, {
    withRowNumber: true,
    filterEmptyObjects: true
  });

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

function copyPayloadAlias_(payload, sourceKey, targetKey) {
  if (Object.prototype.hasOwnProperty.call(payload, sourceKey) && !Object.prototype.hasOwnProperty.call(payload, targetKey)) {
    payload[targetKey] = payload[sourceKey];
  }
}

function clearBooleanTextPayloadKeys_(payload, keys) {
  keys.forEach(function(key) {
    if (Object.prototype.hasOwnProperty.call(payload, key) && isBooleanText_(payload[key])) {
      payload[key] = '';
    }
  });
}

function normalizeBooleanStringPayloadKeys_(payload, keys) {
  keys.forEach(function(key) {
    if (Object.prototype.hasOwnProperty.call(payload, key)) {
      payload[key] = isTruthy_(payload[key]) ? 'TRUE' : 'FALSE';
    }
  });
}

function getSheetTrimmedHeaders_(sheet, minColumns = 0) {
  const lastCol = Math.max(sheet.getLastColumn(), minColumns);
  if (lastCol <= 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0].map(h => String(h || '').trim());
}

function getSheetHeaderMap_(sheet, minColumns = 0) {
  return buildHeaderMap_(getSheetTrimmedHeaders_(sheet, minColumns));
}

function saveMasterData(sheetName, payload) {
  return withScriptLock_(() => {
    const result = saveMasterDataUnlocked_(sheetName, payload);
    // ⑩ 新規作成・下書き保存時にコメント自動投稿
    if (result && result.action === 'insert' && result.id && sheetName === SCHEDULE_SHEET_NAME) {
      try {
        const isDraft = isTruthy_(payload && payload.is_draft);
        const commentText = isDraft ? 'メルマガを下書き保存しました' : 'メルマガを新規作成しました';
        const targetDate = normalizeCommentTargetDate_(payload && (payload.start_date || payload.delivery_date))
          || Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Tokyo', 'yyyy-MM-dd');
        saveCommentUnlocked_(result.id, commentText, targetDate || '');
      } catch (e) {
        // コメント投稿失敗はメルマガ保存自体をエラーにしない
        console.error('Auto-comment failed: ' + (e && e.message ? e.message : e));
      }
    }
    return result;
  });
}

function saveMasterDataUnlocked_(sheetName, payload) {
  const safeSheetName = assertEditableSheet_(sheetName);
  if (!payload || typeof payload !== 'object') throw new Error('payload is required');

  const normalizedPayload = Object.assign({}, payload);
  copyPayloadAlias_(normalizedPayload, 'setter', 'assignee');
  copyPayloadAlias_(normalizedPayload, 'checker', 'reviewer');
  clearBooleanTextPayloadKeys_(normalizedPayload, ['assignee', 'reviewer']);
  copyPayloadAlias_(normalizedPayload, 'mail_type', 'category');
  copyPayloadAlias_(normalizedPayload, 'category', 'mail_type');
  copyPayloadAlias_(normalizedPayload, 'new_flag', 'is_new');
  if (Object.prototype.hasOwnProperty.call(normalizedPayload, 'is_new')) {
    normalizedPayload.is_new = isTruthy_(normalizedPayload.is_new) ? 'TRUE' : 'FALSE';
    delete normalizedPayload.new_flag;
  }
  copyPayloadAlias_(normalizedPayload, 'verifying_flag', 'is_verifying');
  if (Object.prototype.hasOwnProperty.call(normalizedPayload, 'is_verifying')) {
    normalizedPayload.is_verifying = isTruthy_(normalizedPayload.is_verifying) ? 'TRUE' : 'FALSE';
    delete normalizedPayload.verifying_flag;
  }
  if (Object.prototype.hasOwnProperty.call(normalizedPayload, 'is_draft')) {
    normalizedPayload.is_draft = isTruthy_(normalizedPayload.is_draft) ? 'TRUE' : 'FALSE';
  }
  normalizeBooleanStringPayloadKeys_(normalizedPayload, ['is_fixed', 'is_inactive']);
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

  const headerCanonicalKeys = headers.map(header => getCanonicalKeyForHeader_(safeSheetName, header));
  headers.forEach((header, index) => {
    const canonicalKey = headerCanonicalKeys[index];
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

  // 末尾の空要素を共通ユーティリティでトリム
  trimTrailingEmptyHeaders_(headers);

  // シートごとに必要なオプションヘッダーを定義
  const optionalHeadersMap = {
    [SCHEDULE_SHEET_NAME]: ['is_draft', 'is_verifying']
  };

  const allowedOptional = optionalHeadersMap[sheetName] || [];
  
  // payload に含まれる optional ヘッダーのみを追加（内部キーで照合）
  const neededOptional = allowedOptional.filter(header => Object.prototype.hasOwnProperty.call(payload, header));
  if (neededOptional.length) {
    ensureCanonicalHeaders_(sheet, headers, neededOptional, function(h) {
      return getCanonicalKeyForHeader_(sheetName, h) || String(h || '').trim();
    });
  }
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
    const prIdIndex = firstExistingHeaderIndex_(getSheetHeaderMap_(sheet), PR_FIELD_ALIASES.pr_id);
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

  if (safeSheetName === SCHEDULE_SHEET_NAME) {
    // app_schedule: end_date = today で翌日以降をカレンダーから除外
    const headerMap = getSheetHeaderMap_(sheet);
    let endDateIndex = firstExistingHeaderIndex_(headerMap, SCHEDULE_FIELD_ALIASES.end_date);
    if (endDateIndex == null) {
      const lastCol = sheet.getLastColumn();
      endDateIndex = lastCol;
      sheet.getRange(1, endDateIndex + 1).setValue('end_date');
    }
    sheet.getRange(targetRow, endDateIndex + 1).setValue(formatDate_(new Date()));
  } else {
    // app_pr 等: 従来通り is_inactive フラグ
    stopMasterRow_(sheet, safeSheetName, targetRow);
    if (safeSheetName === 'app_pr') {
      const prIdIndex = firstExistingHeaderIndex_(getSheetHeaderMap_(sheet), PR_FIELD_ALIASES.pr_id);
      const prId = prIdIndex == null ? '' : normalizeCell_(sheet.getRange(targetRow, prIdIndex + 1).getDisplayValue());
      if (prId) {
        const targetsSheet = ss.getSheetByName('app_pr_targets');
        if (targetsSheet) {
          const targetInactiveIndex = getOrCreateInactiveColumn_(targetsSheet, PR_TARGET_FIELD_ALIASES.is_inactive);
          const targetValues = targetsSheet.getDataRange().getDisplayValues();
          if (targetValues.length >= 2) {
            const targetPrIdIndex = firstExistingHeaderIndex_(getSheetHeaderMap_(targetsSheet), PR_TARGET_FIELD_ALIASES.pr_id);
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

  if (safeSheetName === SCHEDULE_SHEET_NAME) {
    // app_schedule: end_date をクリア、start_date = 再開日
    const headerMap = getSheetHeaderMap_(sheet);
    const endDateIndex = firstExistingHeaderIndex_(headerMap, SCHEDULE_FIELD_ALIASES.end_date);
    if (endDateIndex != null) sheet.getRange(targetRow, endDateIndex + 1).clearContent();
    const startDateIndex = firstExistingHeaderIndex_(headerMap, SCHEDULE_FIELD_ALIASES.start_date);
    if (startDateIndex != null) sheet.getRange(targetRow, startDateIndex + 1).setValue(formatDate_(new Date()));
  } else {
    resumeMasterRow_(sheet, safeSheetName, targetRow);
  }

  invalidateInitialDataCaches_([safeSheetName]);
  return { success: true, action: 'resume', rowNumber: targetRow };
}

function deletePrTargetRowsByPrId_(ss, prId) {
  const targetsSheet = ss.getSheetByName('app_pr_targets');
  if (!targetsSheet) return;
  const targetValues = targetsSheet.getDataRange().getDisplayValues();
  if (targetValues.length < 2) return;
  const targetPrIdIndex = firstExistingHeaderIndex_(getSheetHeaderMap_(targetsSheet), PR_TARGET_FIELD_ALIASES.pr_id);
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
  const inactiveIndex = firstExistingHeaderIndex_(getSheetHeaderMap_(sheet), aliases);
  if (inactiveIndex == null) return;
  sheet.getRange(rowNumber, inactiveIndex + 1).clearContent();
}

function getOrCreateInactiveColumn_(sheet, aliases) {
  const inactiveIndex = firstExistingHeaderIndex_(getSheetHeaderMap_(sheet), aliases);
  if (inactiveIndex != null) return inactiveIndex;

  const nextColumn = Math.max(sheet.getLastColumn(), 0) + 1;
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

// 配信日別操作・スケジュール操作・行正規化 → DataScheduleOps.gs
