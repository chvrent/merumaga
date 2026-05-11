const XLSX = require('../node_modules/xlsx');
const fs = require('fs');
const path = require('path');

const SPREADSHEET_ID = '1kasTxYtoIUDTd7AUG-bb4n12XH8n8kueLvsHMIci5hA';
const SHEET_ID = 0;
const LOCAL_FILE = 'C:/Users/ayana.yokoo/Desktop/mail-magazine-maker/【ウキ】新メルマガスケジュール(作成中).xlsx';
const SHEET_NAME = '26505_編集版';
const START_COL = 3; // C
const END_COL = 37; // AK

const workbook = XLSX.readFile(LOCAL_FILE, { cellFormula: true, cellStyles: true });
const worksheet = workbook.Sheets[SHEET_NAME];

if (!worksheet) {
  throw new Error(`Sheet not found in local workbook: ${SHEET_NAME}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

async function main() {
  const accessToken = process.env.GS_ACCESS_TOKEN || await getAccessTokenFromClasp();
  if (!accessToken) {
    throw new Error('GS_ACCESS_TOKEN is required');
  }

  const blockStarts = [];
  for (let row = 1; row <= 217; row++) {
    const a = getCellValue(`A${row}`);
    const b = getCellValue(`B${row}`);
    if (a !== '' || b !== '') {
      blockStarts.push(row);
    }
  }

  const requests = [];
  for (let i = 0; i < blockStarts.length; i++) {
    const startRow = blockStarts[i];
    if (startRow < 3) continue;
    const endRow = (i + 1 < blockStarts.length ? blockStarts[i + 1] - 1 : 217);
    const data = buildTsv(startRow, endRow, START_COL, END_COL);
    requests.push({
      pasteData: {
        coordinate: {
          sheetId: SHEET_ID,
          rowIndex: startRow - 1,
          columnIndex: START_COL - 1,
        },
        data,
        type: 'PASTE_NORMAL',
        delimiter: '\t',
      },
    });
  }

  const payload = { requests };

  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  console.log(text);
}

function buildTsv(startRow, endRow, startCol, endCol) {
  const lines = [];
  for (let row = startRow; row <= endRow; row++) {
    const values = [];
    for (let col = startCol; col <= endCol; col++) {
      values.push(serializeCell(a1(row, col)));
    }
    lines.push(values.join('\t'));
  }
  return lines.join('\n');
}

function serializeCell(addr) {
  const cell = worksheet[addr];
  if (!cell) return '';
  if (cell.f) return `=${cell.f}`;
  const value = getCellValue(addr);
  return value === undefined || value === null ? '' : String(value);
}

function getCellValue(addr) {
  const cell = worksheet[addr];
  if (!cell) return '';
  if (cell.w !== undefined) return cell.w;
  if (cell.v !== undefined) return cell.v;
  return '';
}

function a1(row, col) {
  return `${columnName(col)}${row}`;
}

function columnName(col) {
  let n = col;
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
  if (!res.ok) {
    throw new Error(JSON.stringify(json));
  }
  return json.access_token || token.access_token || '';
}
