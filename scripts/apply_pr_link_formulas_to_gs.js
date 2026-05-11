const fs = require('fs');
const path = require('path');

// Applies PR-link helper formulas to the live Google Spreadsheet via Sheets API.
// Goal:
// - PR管理: create an internal vertical mapping table [mail_name, pr_id] that automatically
//   expands when PR管理の「メルマガ名」列が増えても追従する。
// - リスト: PR列は helper 列位置がズレてもヘッダー名で追従する（完全一致）。
//
// Usage:
//   node scripts/apply_pr_link_formulas_to_gs.js
//
// Auth:
// - Prefer env GS_ACCESS_TOKEN
// - Fallback: read ~/.clasprc.json and refresh access token

const SPREADSHEET_ID = '1kasTxYtoIUDTd7AUG-bb4n12XH8n8kueLvsHMIci5hA';

const SHEET_PR = 'PR管理';
const SHEET_LIST = 'リスト';

// We assume PR管理 has headers on row 3 and data starts at row 4.
const PR_HEADER_ROW = 3;
const PR_DATA_START_ROW = 4;

// "PRが入るメルマガ" columns start at G in the current layout. We keep G as the start,
// and compute the end dynamically in formulas (based on the check column header).
const PR_TARGETS_START_COL_A1 = 'G';

const CHECK_HEADER = '完全一致チェック(リスト未登録)';
const HELPER_MAIL_HEADER = 'PR_TARGET_MAIL(内部)';
const HELPER_PR_HEADER = 'PR_TARGET_PR(内部)';

main().catch((err) => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});

async function main() {
  const accessToken = process.env.GS_ACCESS_TOKEN || await getAccessTokenFromClasp();
  if (!accessToken) throw new Error('GS_ACCESS_TOKEN is required');

  // 1) Inspect PR管理 header row to find:
  // - check column index (for dynamic range end)
  // - first empty column to place helper headers/formulas
  const prHeader = await getRowValues_(accessToken, `${SHEET_PR}!A${PR_HEADER_ROW}:ZZ${PR_HEADER_ROW}`);
  const prHeaderVals = (prHeader[0] || []).map((v) => (v == null ? '' : String(v)));

  const checkColIndex1 = indexOf_(prHeaderVals, CHECK_HEADER);
  if (!checkColIndex1) {
    throw new Error(`PR管理 header row ${PR_HEADER_ROW} is missing "${CHECK_HEADER}".`);
  }

  const firstEmptyColIndex1 = findFirstEmptyColIndex1_(prHeaderVals);
  const helperMailColIndex1 = firstEmptyColIndex1;
  const helperPrColIndex1 = firstEmptyColIndex1 + 1;

  // 2) Write helper headers
  await batchUpdateValues_(accessToken, [
    {
      range: `${SHEET_PR}!${a1col_(helperMailColIndex1)}${PR_HEADER_ROW}`,
      values: [[HELPER_MAIL_HEADER]],
    },
    {
      range: `${SHEET_PR}!${a1col_(helperPrColIndex1)}${PR_HEADER_ROW}`,
      values: [[HELPER_PR_HEADER]],
    },
  ]);

  // 3) Helper mapping formula: dynamic end column is (check header col - 1)
  // Build target range using INDIRECT so it follows when columns are inserted.
  const helper2colFormula = [
    '=ARRAYFORMULA(',
    'QUERY(',
    'SPLIT(',
    'FLATTEN(',
    'IF(',
    `INDIRECT(\"${PR_TARGETS_START_COL_A1}${PR_DATA_START_ROW}:\"&ADDRESS(9999,MATCH(\\\"${CHECK_HEADER}\\\",${PR_HEADER_ROW}:${PR_HEADER_ROW},0)-1,4))<>\"\",`,
    `INDIRECT(\"${PR_TARGETS_START_COL_A1}${PR_DATA_START_ROW}:\"&ADDRESS(9999,MATCH(\\\"${CHECK_HEADER}\\\",${PR_HEADER_ROW}:${PR_HEADER_ROW},0)-1,4))&\"♦\"&$A$${PR_DATA_START_ROW}:$A,`,
    '),',
    '),',
    '\"♦\"',
    '),',
    '\"where Col1 is not null\",',
    '0',
    ')',
    ')',
  ].join('');

  // Put the single formula in the mail helper column; it spills into 2 columns.
  await batchUpdateValues_(accessToken, [
    {
      range: `${SHEET_PR}!${a1col_(helperMailColIndex1)}${PR_DATA_START_ROW}`,
      values: [[helper2colFormula]],
    },
  ]);

  // 4) リスト!PR (F2): header-based range so helper columns can move.
  // This supports only 1 PR per mail (VLOOKUP first match). If multiple PRs are needed, we can extend later.
  const listPrFormula = [
    '=ARRAYFORMULA(',
    'IF(',
    '$C2:$C=\"\",',
    '\"\",',
    'IFERROR(',
    'VLOOKUP(',
    '$C2:$C,',
    `INDIRECT(\"'${SHEET_PR}'!\"&ADDRESS(${PR_DATA_START_ROW},MATCH(\\\"${HELPER_MAIL_HEADER}\\\",'${SHEET_PR}'!${PR_HEADER_ROW}:${PR_HEADER_ROW},0),4)&\":\"&ADDRESS(9999,MATCH(\\\"${HELPER_PR_HEADER}\\\",'${SHEET_PR}'!${PR_HEADER_ROW}:${PR_HEADER_ROW},0),4)),`,
    '2,',
    'FALSE',
    '),',
    '\"\"',
    ')',
    ')',
    ')',
  ].join('');

  await batchUpdateValues_(accessToken, [
    { range: `${SHEET_LIST}!F2`, values: [[listPrFormula]] },
  ]);

  console.log(JSON.stringify({
    ok: true,
    pr: {
      checkCol: a1col_(checkColIndex1),
      helperMailCol: a1col_(helperMailColIndex1),
      helperPrCol: a1col_(helperPrColIndex1),
    },
  }, null, 2));
}

function indexOf_(arr, exact) {
  const idx0 = arr.findIndex((v) => String(v).trim() === exact);
  return idx0 >= 0 ? idx0 + 1 : 0;
}

function findFirstEmptyColIndex1_(rowVals) {
  for (let i = 0; i < rowVals.length; i++) {
    if (String(rowVals[i] || '').trim() === '') return i + 1;
  }
  return rowVals.length + 1;
}

async function getRowValues_(accessToken, rangeA1) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(rangeA1)}?majorDimension=ROWS`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const json = await res.json();
  if (!res.ok) throw new Error(`Sheets API error: ${JSON.stringify(json)}`);
  return json.values || [];
}

async function batchUpdateValues_(accessToken, data) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchUpdate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Sheets API error: ${JSON.stringify(json)}`);
  return json;
}

function a1col_(index1) {
  let n = index1;
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

async function getAccessTokenFromClasp() {
  const rcPath = path.join(process.env.USERPROFILE || '', '.clasprc.json');
  const rc = JSON.parse(fs.readFileSync(rcPath, 'utf8'));
  const token = rc.tokens && rc.tokens.default;
  if (!token || !token.client_id || !token.client_secret || !token.refresh_token) {
    return token && token.access_token ? token.access_token : '';
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: token.client_id,
      client_secret: token.client_secret,
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json.access_token || token.access_token || '';
}

