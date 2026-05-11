const fs = require('fs');
const path = require('path');
const XLSX = require('../node_modules/xlsx');

const workbookPath = path.resolve(__dirname, '..', '【ウキ】新メルマガスケジュール(作成中).xlsx');
const backupPath = path.resolve(
  __dirname,
  '..',
  '【ウキ】新メルマガスケジュール(作成中).backup-before-normalize-special-master.xlsx'
);

const sourceSheetName = '特殊配信マスタ';
const targetSheetName = '特殊配信マスタ_v2';
const headerRowNumber = 2; // 2行目がヘッダー
const dataStartRowNumber = 3;

if (!fs.existsSync(workbookPath)) {
  throw new Error(`Workbook not found: ${workbookPath}`);
}

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(workbookPath, backupPath);
}

const workbook = XLSX.readFile(workbookPath, { cellFormula: true, cellNF: true, cellStyles: true });
const sourceSheet = workbook.Sheets[sourceSheetName];
if (!sourceSheet) {
  throw new Error(`Sheet not found: ${sourceSheetName}`);
}

const sourceRange = XLSX.utils.decode_range(sourceSheet['!ref']);
const header = readRow_(sourceSheet, sourceRange, headerRowNumber);
const headerIndex = indexHeader_(header);

const required = ['曜日', '時間', 'サイクル', '通数', '種別', 'PR', '形式', '備考', '新規', '設定者', '確認者', '配信停止'];
required.forEach((h) => {
  if (headerIndex[h] === undefined) throw new Error(`Header not found: ${h}`);
});

const titleCols = [
  { key: 'メルマガ内容(メイン)', name: 'メルマガ内容(メイン)' },
  { key: 'メルマガ内容(2)', name: 'メルマガ内容(2)' },
  { key: '関西(3のみ)', name: '関西(3のみ)' },
  { key: '関西(3のみ),', name: '関西(3のみ),' },
];

const outputHeader = [
  '曜日',
  '時間',
  'サイクル',
  'メルマガ内容',
  '通数',
  '種別',
  'PR',
  '形式',
  '備考',
  '新規',
  '設定者',
  '確認者',
  '配信停止',
];

const outRows = [];

for (let r = dataStartRowNumber; r <= sourceRange.e.r + 1; r++) {
  const row = readRow_(sourceSheet, sourceRange, r);
  if (row.every((v) => String(v || '').trim() === '')) continue;

  const day = get_(row, headerIndex, '曜日');
  const time = get_(row, headerIndex, '時間');
  const cycle = get_(row, headerIndex, 'サイクル');
  const volume = get_(row, headerIndex, '通数');
  const media = get_(row, headerIndex, '種別');
  const pr = get_(row, headerIndex, 'PR');
  const format = get_(row, headerIndex, '形式');
  const notes = get_(row, headerIndex, '備考');
  const isNew = get_(row, headerIndex, '新規');
  const setup = get_(row, headerIndex, '設定者');
  const check = get_(row, headerIndex, '確認者');
  const stopped = get_(row, headerIndex, '配信停止');

  const titles = [];
  titleCols.forEach((tc) => {
    const idx = headerIndex[tc.name];
    if (idx === undefined) return;
    const t = String(row[idx] || '').trim();
    if (t) titles.push(t);
  });

  // If there are no titles, keep nothing.
  titles.forEach((title) => {
    outRows.push([
      day,
      time,
      cycle,
      title,
      volume,
      media,
      pr,
      format,
      notes,
      isNew,
      setup,
      check,
      stopped,
    ]);
  });
}

if (workbook.Sheets[targetSheetName]) {
  delete workbook.Sheets[targetSheetName];
  workbook.SheetNames = workbook.SheetNames.filter((n) => n !== targetSheetName);
}

const aoa = [];
aoa.push([]); // 1行目は空でOK（元シートと同じく）
aoa.push(outputHeader); // 2行目がヘッダー
outRows.forEach((r) => aoa.push(r));

const targetSheet = XLSX.utils.aoa_to_sheet(aoa);
targetSheet['!ref'] = XLSX.utils.encode_range({
  s: { r: 0, c: 0 },
  e: { r: Math.max(aoa.length - 1, 1), c: outputHeader.length - 1 },
});

workbook.Sheets[targetSheetName] = targetSheet;
workbook.SheetNames.push(targetSheetName);

XLSX.writeFile(workbook, workbookPath);

console.log(`Wrote normalized sheet: ${targetSheetName}`);
console.log(`Rows: ${outRows.length}`);
console.log(`Backup: ${backupPath}`);

function readRow_(ws, range, rowNumber) {
  const r = rowNumber - 1;
  const out = [];
  for (let c = 0; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell = ws[addr];
    out.push(cell ? String(cell.w ?? cell.v ?? '').trim() : '');
  }
  return out;
}

function indexHeader_(headerRow) {
  const idx = {};
  headerRow.forEach((h, i) => {
    const key = String(h || '').trim();
    if (!key) return;
    idx[key] = i;
  });
  return idx;
}

function get_(row, index, headerName) {
  const i = index[headerName];
  return i === undefined ? '' : row[i];
}

