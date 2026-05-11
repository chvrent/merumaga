/**
 * メルマガスケジュール管理システム：運用版
 * 最終更新: 2026-05-08
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('📅 スケジュール管理')
    .addItem('マスタの色を編集版に同期', 'syncBackgroundColors')
    .addItem('確定版を作成（空行のみ削除）', 'createFinalVersion')
    .addToUi();
}

// ============================================================
// 1. 背景色同期・配信停止グレーアウト
// ============================================================

/**
 * マスタの背景色を編集版のタイトルセルに同期し、停止案件をグレーアウトする
 */
function syncBackgroundColors() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const dateCols = ["C", "H", "M", "R", "W", "AB", "AG"];
  
  const getColorMap = (name, mailCol) => {
    const s = ss.getSheetByName(name);
    if (!s) return {};
    const d = s.getDataRange().getValues();
    const b = s.getDataRange().getBackgrounds();
    const map = {};
    for (let i = 1; i < d.length; i++) {
      const name = String(d[i][mailCol-1]).trim();
      if (name) map[name] = b[i][mailCol-1];
    }
    return map;
  };
  
  const colorMaps = {
    LIST: getColorMap("リスト", 3),
    NEW: getColorMap("新規", 3),
    SPECIAL: getColorMap("特殊配信マスタ", 6),
    MA: getColorMap("MA等", 3)
  };

  const range = sheet.getRange(3, 1, 215, 35);
  const values = range.getValues();
  const backgrounds = range.getBackgrounds();
  
  let currentKey = "";
  for (let i = 0; i < values.length; i++) {
    const valB = values[i][1];
    if (valB === "毎週") currentKey = "LIST";
    else if (valB === "新規") currentKey = "NEW";
    else if (valB === "特殊") currentKey = "SPECIAL";
    else if (valB === "MA等") currentKey = "MA";
    
    if (!currentKey) continue;
    
    dateCols.forEach(col => {
      const colIdx = col.charCodeAt(0) - 65;
      const mailName = String(values[i][colIdx]).trim();
      if (mailName && colorMaps[currentKey][mailName]) {
        backgrounds[i][colIdx] = colorMaps[currentKey][mailName];
      } else if (mailName) {
        backgrounds[i][colIdx] = "#ffffff";
      }
    });
  }
  range.setBackgrounds(backgrounds);
  
  applyEditSheetStopGrayRule();
  SpreadsheetApp.getUi().alert("背景色の同期とグレーアウトを完了しました。");
}

/**
 * 配信停止案件をグレーアウトする (内部用)
 */
function applyEditSheetStopGrayRule() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const dateCols = ["C", "H", "M", "R", "W", "AB", "AG"];
  
  const getStopMap = (name, mailCol, stopColHeader) => {
    const s = ss.getSheetByName(name);
    if (!s) return {};
    const d = s.getDataRange().getValues();
    const headers = d[1] || d[0]; // 2行目または1行目
    let stopIdx = headers.indexOf(stopColHeader);
    if (stopIdx === -1 && name === "リスト") stopIdx = 14; // O列
    if (stopIdx === -1 && name === "新規") stopIdx = 14;   // O列
    
    const map = {};
    if (stopIdx === -1) return map;

    for (let i = 2; i < d.length; i++) {
      if (d[i][stopIdx] === true || d[i][stopIdx] === "TRUE") {
        map[String(d[i][mailCol-1]).trim()] = true;
      }
    }
    return map;
  };
  
  const stopMaps = {
    LIST: getStopMap("リスト", 3, "配信停止"),
    NEW: getStopMap("新規", 3, "配信停止"),
    SPECIAL: getStopMap("特殊配信マスタ", 6, "配信停止"),
    MA: getStopMap("MA等", 3, "配信停止")
  };

  const range = sheet.getRange(3, 1, 215, 35);
  const values = range.getValues();
  const backgrounds = range.getBackgrounds();
  
  let currentKey = "";
  for (let i = 0; i < values.length; i++) {
    const valB = values[i][1];
    if (valB === "毎週") currentKey = "LIST";
    else if (valB === "新規") currentKey = "NEW";
    else if (valB === "特殊") currentKey = "SPECIAL";
    else if (valB === "MA等") currentKey = "MA";
    
    if (!currentKey) continue;
    
    dateCols.forEach(col => {
      const colIdx = col.charCodeAt(0) - 65;
      const mailName = String(values[i][colIdx]).trim();
      if (mailName && stopMaps[currentKey][mailName]) {
        for (let j = 0; j < 5; j++) {
          backgrounds[i][colIdx + j] = "#cccccc";
        }
      }
    });
  }
  range.setBackgrounds(backgrounds);
}

// ============================================================
// 2. 確定版生成
// ============================================================

/**
 * 確定版を作成：編集版をコピーし、数式を値に変換、空行を削除する
 */
function createFinalVersion() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getActiveSheet();
  const sheetName = activeSheet.getName();
  
  if (sheetName.indexOf("編集版") === -1) {
    SpreadsheetApp.getUi().alert("編集版シートを開いた状態で実行してください。");
    return;
  }
  
  const finalName = sheetName.replace("編集版", "確定版");
  let finalSheet = ss.getSheetByName(finalName);
  if (finalSheet) {
    const res = SpreadsheetApp.getUi().alert("確認", "既に「" + finalName + "」が存在します。上書きしますか？", SpreadsheetApp.getUi().ButtonSet.YES_NO);
    if (res !== SpreadsheetApp.getUi().Button.YES) return;
    ss.deleteSheet(finalSheet);
  }
  
  finalSheet = activeSheet.copyTo(ss).setName(finalName);
  
  // 数式を値に変換
  const range = finalSheet.getDataRange();
  range.setValues(range.getValues());
  
  // 空行の削除 (火〜月の全スロットが空の行)
  const lastRow = finalSheet.getLastRow();
  const dateColIndices = [3, 8, 13, 18, 23, 28, 33]; // C, H, M, R, W, AB, AG (1-based)
  
  for (let i = lastRow; i >= 3; i--) { 
    let hasContent = false;
    for (let j = 0; j < dateColIndices.length; j++) {
      if (finalSheet.getRange(i, dateColIndices[j]).getValue() !== "") {
        hasContent = true;
        break;
      }
    }
    
    const valA = finalSheet.getRange(i, 1).getValue();
    const valB = finalSheet.getRange(i, 2).getValue();
    
    if (!hasContent && valA !== "" && valB === "") {
      finalSheet.deleteRow(i);
    }
  }
  
  ss.setActiveSheet(finalSheet);
  SpreadsheetApp.getUi().alert("確定版「" + finalName + "」を作成しました。");
}

// ============================================================
// 3. Webアプリ用API (イメージ.txt に基づく)
// ============================================================

/**
 * Webアプリの起動
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('メルマガスケジュール作成メーカー')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * 全シートのヘッダー情報とデータを取得する (Roadmap Step 1)
 */
function getSpreadsheetData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  
  // アプリに表示・編集させるマスタのリスト
  const includeSheets = [
    "リスト", 
    "新規", 
    "特殊配信マスタ", 
    "自動求人特集", 
    "月末増発", 
    "MA等", 
    "PR管理"
  ];
  
  const result = {
    sheets: [],
    prMap: {} // PR紐付け用のデータ
  };
  
  sheets.forEach(sheet => {
    const name = sheet.getName();
    if (includeSheets.indexOf(name) !== -1) {
      const range = sheet.getDataRange();
      const values = range.getValues();
      
      // シートごとのヘッダー開始行の調整
      let headerRow = 0;
      if (name === "リスト" || name === "特殊配信マスタ" || name === "自動求人特集") headerRow = 1;
      if (name === "PR管理") headerRow = 2;
      
      const headers = values[headerRow] || [];
      const data = values.slice(headerRow + 1);
      
      result.sheets.push({
        name: name,
        headers: headers,
        data: data
      });
      
      // PR管理シートからマッピングを作成
      if (name === "PR管理") {
        data.forEach(row => {
          const prId = row[0];
          const prContent = row[4];
          const targetMails = row.slice(6); // G列以降
          if (prId && prContent) {
            targetMails.forEach(mailName => {
              if (mailName && typeof mailName === 'string') {
                const cleanName = mailName.trim();
                if (cleanName && cleanName !== "#REF!" && cleanName !== "#VALUE!") {
                  result.prMap[cleanName] = { id: prId, content: prContent };
                }
              }
            });
          }
        });
      }
    }
  });
  
  return result;
}

/**
 * データの更新・追加 (Roadmap Step Sync)
 */
function upsertData(sheetName, rowData, keyColumnIndex, keyValue) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error("Sheet not found: " + sheetName);
  
  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;
  
  // キー照合
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][keyColumnIndex]) === String(keyValue)) {
      rowIndex = i + 1;
      break;
    }
  }
  
  if (rowIndex !== -1) {
    // 更新 (Update)
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    // 追加 (Insert)
    sheet.appendRow(rowData);
  }
  
  return { success: true, action: rowIndex !== -1 ? "update" : "insert" };
}

