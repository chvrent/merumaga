const fs = require('fs');
const path = require('path');
const XLSX = require('../node_modules/xlsx');

const workbookPath = path.resolve(__dirname, '..', '【ウキ】新メルマガスケジュール(作成中).xlsx');
const backupPath = path.resolve(__dirname, '..', '【ウキ】新メルマガスケジュール(作成中).backup-before-formula-fix.xlsx');
const sheetName = '26414_編集版';
const WEEKLY_BASE_DATE_FORMULA = 'DATE(2026,4,14)';

const DAY_START_COLS = [3, 8, 13, 18, 23, 28, 33]; // C,H,M,R,W,AB,AG
const SECTION_WEEKLY = '毎週';
const SECTION_IRREGULAR = '新規';

if (!fs.existsSync(workbookPath)) {
  throw new Error(`Workbook not found: ${workbookPath}`);
}

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(workbookPath, backupPath);
}

const workbook = XLSX.readFile(workbookPath, { cellFormula: true, cellNF: true, cellStyles: true });
const worksheet = workbook.Sheets[sheetName];

if (!worksheet) {
  throw new Error(`Sheet not found: ${sheetName}`);
}

const range = XLSX.utils.decode_range(worksheet['!ref']);

let currentSection = '';
let currentTime = '';
let currentTimeRow = null;
let blockStartRow = null;
let updatedCount = 0;

for (let row = 2; row <= range.e.r; row++) {
  const rowNumber = row + 1;
  const timeValue = getDisplayValue(row, 0);
  const sectionValue = getDisplayValue(row, 1);

  if (timeValue) {
    currentTime = String(timeValue).trim();
    currentTimeRow = rowNumber;
    currentSection = '';
    blockStartRow = null;
  }

  if (sectionValue === SECTION_WEEKLY || sectionValue === SECTION_IRREGULAR || sectionValue === '特殊') {
    currentSection = sectionValue;
    blockStartRow = rowNumber;
  }

  if (!currentTime || !blockStartRow) {
    continue;
  }

  if (currentSection !== SECTION_WEEKLY && currentSection !== SECTION_IRREGULAR && currentSection !== '特殊') {
    continue;
  }
  const titleStartRow = blockStartRow;
  const itemIndex = rowNumber - titleStartRow + 1;

  DAY_START_COLS.forEach((titleCol) => {
    const titleRef = a1(rowNumber, titleCol);
    const dateRef = `${columnName(titleCol)}$1`;
    const timeRef = currentTimeRow ? `$A$${currentTimeRow}` : `$A$${blockStartRow}`;

    if (currentSection === SECTION_WEEKLY || currentSection === SECTION_IRREGULAR) {
      const sourceSheet = currentSection === SECTION_WEEKLY ? 'リスト' : '新規';
      setFormula(rowNumber, titleCol, buildTitleFormula(currentSection, sourceSheet, dateRef, timeRef, itemIndex));
      setFormula(rowNumber, titleCol + 1, `IF(${titleRef}="","",IFERROR(XLOOKUP(${titleRef},'${sourceSheet}'!$C:$C,'${sourceSheet}'!$D:$D,""),""))`);
      setFormula(rowNumber, titleCol + 3, `IF(${titleRef}="","",IFERROR(XLOOKUP(${titleRef},'${sourceSheet}'!$C:$C,'${sourceSheet}'!$M:$M,""),""))`);
      setFormula(rowNumber, titleCol + 4, `IF(${titleRef}="","",IFERROR(XLOOKUP(${titleRef},'${sourceSheet}'!$C:$C,'${sourceSheet}'!$N:$N,""),""))`);
      updatedCount += 4;
    } else if (currentSection === '特殊') {
      setFormula(rowNumber, titleCol, buildSpecialTitleFormula(dateRef, timeRef, itemIndex));
      setFormula(rowNumber, titleCol + 1, buildSpecialMetaFormula(dateRef, timeRef, itemIndex, 'volume'));
      setFormula(rowNumber, titleCol + 2, '=""');
      setFormula(rowNumber, titleCol + 3, buildSpecialMetaFormula(dateRef, timeRef, itemIndex, 'setup'));
      setFormula(rowNumber, titleCol + 4, buildSpecialMetaFormula(dateRef, timeRef, itemIndex, 'check'));
      updatedCount += 5;
    }
  });
}

XLSX.writeFile(workbook, workbookPath);
console.log(`Updated formulas: ${updatedCount}`);
console.log(`Backup: ${backupPath}`);

function buildTitleFormula(section, sourceSheet, dateRef, timeRef, itemIndex) {
  if (section === SECTION_WEEKLY) {
    return [
      'IFERROR(',
      'INDEX(',
      `FILTER('${sourceSheet}'!$C$2:$C$400,`,
      `('${sourceSheet}'!$A$2:$A$400=CHOOSE(WEEKDAY(${dateRef}),"日","月","火","水","木","金","土"))*`,
       `('${sourceSheet}'!$B$2:$B$400=${timeRef})*`,
      '(',
      `('${sourceSheet}'!$E$2:$E$400="毎週配信")+`,
      `('${sourceSheet}'!$E$2:$E$400="毎週")+`,
      `('${sourceSheet}'!$E$2:$E$400="隔週A")*(MOD(INT((${dateRef}-${WEEKLY_BASE_DATE_FORMULA})/7),2)=0)+`,
      `('${sourceSheet}'!$E$2:$E$400="隔週B")*(MOD(INT((${dateRef}-${WEEKLY_BASE_DATE_FORMULA})/7),2)<>0)`,
      ')',
      `),${itemIndex}),`,
      '""',
      ')',
    ].join('');
  }

  return [
    'IFERROR(',
    'INDEX(',
    `FILTER('${sourceSheet}'!$C$2:$C$400,`,
    '(',
    `('${sourceSheet}'!$A$2:$A$400=TEXT(${dateRef},"ddd"))+`,
    `('${sourceSheet}'!$A$2:$A$400=TEXT(${dateRef},"yyyy/mm/dd"))+`,
    `('${sourceSheet}'!$A$2:$A$400=CHOOSE(WEEKDAY(${dateRef}),"日","月","火","水","木","金","土"))`,
    ')*',
     `('${sourceSheet}'!$B$2:$B$400=${timeRef})*`,
    '(',
    `NOT(REGEXMATCH('${sourceSheet}'!$C$2:$C$400,"IT派遣"))+`,
    `REGEXMATCH('${sourceSheet}'!$C$2:$C$400,"IT派遣")*(WEEKDAY(${dateRef})=1)*(((DAY(${dateRef})>=8)*(DAY(${dateRef})<=14))+((DAY(${dateRef})>=22)*(DAY(${dateRef})<=28)))`,
    ')',
    `),${itemIndex}),`,
    '""',
    ')',
  ].join('');
}

function buildSpecialTitleFormula(dateRef, timeRef, itemIndex) {
  // Prefer normalized layout: 1 row = 1 mail, column is "メルマガ内容".
  // If the sheet hasn't renamed yet, accept "メルマガ内容(メイン)" as the title column too.
  const titleRange = `IFERROR(${specialColRange('メルマガ内容')},${specialColRange('メルマガ内容(メイン)')})`;
  const normalized = `IFERROR(INDEX(FILTER(${titleRange},${buildSpecialMatchCondition(dateRef, timeRef)}*(${titleRange}<>\"\")),${itemIndex}),\"\")`;

  // Backward compatible: legacy "横持ち3列" layout.
  const legacyMain = `IFERROR(INDEX(FILTER('特殊配信マスタ'!$C$3:$C$217,${buildSpecialMatchCondition(dateRef, timeRef)}*('特殊配信マスタ'!$C$3:$C$217<>\"\")),1),\"\")`;
  const legacySecond = `IFERROR(INDEX(FILTER('特殊配信マスタ'!$D$3:$D$217,${buildSpecialMatchCondition(dateRef, timeRef)}*('特殊配信マスタ'!$D$3:$D$217<>\"\")),1),\"\")`;
  const legacyKansai = `IF(MOD(INT((${dateRef}-${WEEKLY_BASE_DATE_FORMULA})/7),3)+1<>3,\"\",IFERROR(INDEX(FILTER('特殊配信マスタ'!$E$3:$E$217,${buildSpecialMatchCondition(dateRef, timeRef)}*('特殊配信マスタ'!$E$3:$E$217<>\"\")),1),\"\"))`;

  // In legacy, itemIndex is 1..3 mapped to columns C/D/E. In normalized, any itemIndex is valid.
  return `IFERROR(${normalized},IF(${itemIndex}=1,${legacyMain},IF(${itemIndex}=2,${legacySecond},IF(${itemIndex}=3,${legacyKansai},\"\"))))`;
}

function buildSpecialMetaFormula(dateRef, timeRef, itemIndex, type) {
  // Prefer normalized layout (header based). For legacy layout, keep the old fixed columns.
  const header = type === 'volume' ? '通数' : type === 'setup' ? '設定者' : '確認者';
  const normalized = `IFERROR(INDEX(FILTER(${specialColRange(header)},${buildSpecialMatchCondition(dateRef, timeRef)}),${itemIndex}),\"\")`;

  const targetCol = type === 'volume' ? 'G' : type === 'setup' ? 'M' : 'N';
  const legacy = `IFERROR(INDEX(FILTER('特殊配信マスタ'!$${targetCol}$3:$${targetCol}$217,${buildSpecialMatchCondition(dateRef, timeRef)}),1),\"\")`;

  // Legacy only had meta on the 1st item row.
  return `IFERROR(${normalized},IF(${itemIndex}<>1,\"\",${legacy}))`;
}

function buildSpecialMatchCondition(dateRef, timeRef) {
  const weekday = `CHOOSE(WEEKDAY(${dateRef}),"日","月","火","水","木","金","土")`;
  const cycle = `MOD(INT((${dateRef}-${WEEKLY_BASE_DATE_FORMULA})/7),3)+1`;

  const normalized = [
    `(${specialColRange('曜日')}=${weekday})`,
    `(${specialColRange('時間')}=${timeRef})`,
    `(${specialColRange('サイクル')}=${cycle})`,
  ].join('*');

  const legacy = [
    `('特殊配信マスタ'!$A$3:$A$217=${weekday})`,
    `('特殊配信マスタ'!$B$3:$B$217=${timeRef})`,
    `('特殊配信マスタ'!$F$3:$F$217=${cycle})`,
  ].join('*');

  // If headers don't exist (MATCH fails), fallback to legacy condition.
  return `IFERROR(${normalized},${legacy})`;
}

function specialColRange(headerName) {
  // Header row is row 2 (row 1 is date labels). Data starts at row 3.
  return `INDEX('特殊配信マスタ'!$A$3:$Z$217,,MATCH(\"${headerName}\",'特殊配信マスタ'!$A$2:$Z$2,0))`;
}

function setFormula(rowNumber, colNumber, formula) {
  const addr = a1(rowNumber, colNumber);
  const cell = worksheet[addr] || {};
  // Keep a concrete type so the cell is preserved by the writer.
  // (If omitted, some cells may be dropped depending on the library.)
  if (!cell.t) cell.t = 'n';
  cell.f = formula;
  // Ensure the cell exists in the serialized sheet even before Excel recalculates.
  if (cell.v === undefined) cell.v = 0;
  delete cell.w;
  delete cell.F;
  delete cell.r;
  delete cell.h;
  worksheet[addr] = cell;
}

function getDisplayValue(row, col) {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  const cell = worksheet[addr];
  if (!cell) return '';
  if (cell.w !== undefined) return cell.w;
  if (cell.v !== undefined) return cell.v;
  return '';
}

function a1(rowNumber, colNumber) {
  return `${columnName(colNumber)}${rowNumber}`;
}

function columnName(colNumber) {
  let n = colNumber;
  let name = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}
