/**
 * PR管理シートと連携し、全データを統合してGitHubへ送信
 */
function finalizeAndPushToGitHub() {
  const ui = SpreadsheetApp.getUi();
  
  if (typeof GITHUB_TOKEN === 'undefined' || GITHUB_TOKEN.indexOf("ここに") === 0) {
    ui.alert("GITHUB_TOKEN が設定されていません。Config.gs ファイルを確認してください。");
    return;
  }

  const response = ui.alert('Webサイト更新', 'PR管理シートと連携して全データを反映しますか？', ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) return;

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const allEvents = [];
    const now = new Date();
    
    // --- 0. PR管理シートの読み込み (マッピング作成) ---
    const prMap = {};
    const prSheet = ss.getSheetByName("PR管理");
    if (prSheet) {
      const prData = prSheet.getDataRange().getValues();
      for (let i = 1; i < prData.length; i++) {
        const prCode = String(prData[i][0]); // A列: PR番号 (PR128など)
        const prContent = String(prData[i][1]); // B列: 内容
        if (prCode) prMap[prCode] = prContent;
      }
    }

    // --- 1. 「新規」シート ---
    const newSheet = ss.getSheetByName("新規");
    if (newSheet) {
      const range = newSheet.getDataRange();
      const data = range.getValues();
      const backgrounds = range.getBackgrounds();
      for (let i = 1; i < data.length; i++) {
        if (!data[i][0]) continue;
        let title = String(data[i][2]);
        let prInfo = fetchPRContent(title, prMap); // PR内容を検索
        
        allEvents.push({
          date: formatDate(data[i][0]),
          time: data[i][1],
          media: "新規",
          title: title,
          pr: prInfo, // PR内容を格納
          color: backgrounds[i][2],
          target: data[i][7],
          pic: "未定"
        });
      }
    }

    // --- 2. 「リスト」シート ---
    const listSheet = ss.getSheetByName("リスト");
    if (listSheet) {
      const range = listSheet.getDataRange();
      const data = range.getValues();
      const backgrounds = range.getBackgrounds();
      for (let i = 1; i < data.length; i++) {
        if (!data[i][0]) continue;
        const targetDate = getDateFromDayName(data[i][0], now);
        let title = String(data[i][2]);
        let prInfo = fetchPRContent(title, prMap);

        allEvents.push({
          date: formatDate(targetDate),
          time: data[i][1],
          media: "リスト",
          title: title,
          pr: prInfo,
          color: backgrounds[i][2],
          target: data[i][7],
          pic: "定常"
        });
      }
    }

    const path = "data.json";
    const url = "https://api.github.com/repos/" + REPO_OWNER + "/" + REPO_NAME + "/contents/" + path;
    const getRes = UrlFetchApp.fetch(url, { headers: { "Authorization": "token " + GITHUB_TOKEN }, muteHttpExceptions: true });
    let sha = getRes.getResponseCode() === 200 ? JSON.parse(getRes.getContentText()).sha : "";

    const payload = {
      message: "Update calendar data with PR content",
      content: Utilities.base64Encode(JSON.stringify(allEvents, null, 2), Utilities.Charset.UTF_8),
      sha: sha
    };

    UrlFetchApp.fetch(url, {
      method: "put",
      headers: { "Authorization": "token " + GITHUB_TOKEN },
      payload: JSON.stringify(payload),
      contentType: "application/json"
    });

    ui.alert('更新完了！PR文章を含めて反映しました。');
  } catch (e) {
    ui.alert('エラー: ' + e.message);
  }
}

/**
 * タイトルからPRXXX形式を探し、マッピングから内容を返す
 */
function fetchPRContent(text, prMap) {
  const match = text.match(/PR\d+/);
  if (match && prMap[match[0]]) {
    return prMap[match[0]];
  }
  return "";
}

function formatDate(date) {
  if (!(date instanceof Date)) date = new Date(date);
  return Utilities.formatDate(date, "JST", "yyyy/MM/dd");
}

function getDateFromDayName(dayName, baseDate) {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const targetDay = days.indexOf(dayName.replace(/曜/g, ""));
  if (targetDay === -1) return baseDate;
  const currentDay = baseDate.getDay();
  const diff = targetDay - currentDay;
  const result = new Date(baseDate);
  result.setDate(baseDate.getDate() + diff);
  return result;
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('★管理メニュー')
    .addItem('Webサイトを更新（PR紐付け対応）', 'finalizeAndPushToGitHub')
    .addToUi();
}
