/**
 * 全てのデータソースを統合し、色情報を含めてGitHubへ送信
 */
function finalizeAndPushToGitHub() {
  const ui = SpreadsheetApp.getUi();
  
  if (typeof GITHUB_TOKEN === 'undefined' || GITHUB_TOKEN.indexOf("ここに") === 0) {
    ui.alert("GITHUB_TOKEN が設定されていません。Config.gs を確認してください。");
    return;
  }

  const response = ui.alert('Webサイト更新', '最新データをGitHubへ反映しますか？', ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) return;

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const allEvents = [];
    const now = new Date();
    
    // PR管理
    const prMap = {};
    const prSheet = ss.getSheetByName("PR管理");
    if (prSheet) {
      const prData = prSheet.getDataRange().getValues();
      for (let i = 1; i < prData.length; i++) {
        if (prData[i][0]) prMap[String(prData[i][0]).trim()] = String(prData[i][1]).trim();
      }
    }

    const processSheetByName = (name, mediaDefault) => {
      const sheet = ss.getSheetByName(name);
      if (!sheet) return;
      
      const data = sheet.getDataRange().getValues();
      const backgrounds = sheet.getDataRange().getBackgrounds();
      const headers = data[0].map(h => String(h).trim());
      
      const findCol = (keywords) => headers.findIndex(h => keywords.some(k => h.indexOf(k) !== -1));
      
      const idx = {
        date: findCol(["日"]),
        time: findCol(["時間", "時"]),
        title: findCol(["内容", "件名", "メルマガ"]),
        media: findCol(["媒体", "種別"]),
        target: findCol(["ターゲット", "対象"]),
        pic: findCol(["担当"])
      };

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        let dateVal = idx.date !== -1 ? row[idx.date] : "";
        if (!dateVal) continue;

        if (name === "リスト") {
          dateVal = getDateFromDayName(String(dateVal), now);
        }

        const title = idx.title !== -1 ? String(row[idx.title]) : "";
        if (!title || title === "undefined") continue;

        allEvents.push({
          date: formatDate(dateVal),
          time: idx.time !== -1 ? String(row[idx.time]) : "",
          media: idx.media !== -1 ? String(row[idx.media]) : mediaDefault,
          title: title,
          pr: fetchPRContent(title, prMap),
          color: idx.title !== -1 ? backgrounds[i][idx.title] : "#ffffff",
          target: idx.target !== -1 ? String(row[idx.target]) : "",
          pic: idx.pic !== -1 ? String(row[idx.pic]) : ""
        });
      }
    };

    processSheetByName("新規", "新規");
    processSheetByName("リスト", "定常");

    const jsonString = JSON.stringify(allEvents, null, 2);
    const blob = Utilities.newBlob(jsonString, "application/json", "data.json");
    const payload = {
      message: "Update calendar data",
      content: Utilities.base64Encode(blob.getBytes()),
      sha: getSha("data.json")
    };

    const url = "https://api.github.com/repos/" + REPO_OWNER + "/" + REPO_NAME + "/contents/data.json";
    UrlFetchApp.fetch(url, {
      method: "put",
      headers: { "Authorization": "token " + GITHUB_TOKEN },
      payload: JSON.stringify(payload),
      contentType: "application/json"
    });

    ui.alert('更新完了！カレンダーが反映されます。');
  } catch (e) {
    ui.alert('エラー: ' + e.message);
  }
}

function getSha(path) {
  const url = "https://api.github.com/repos/" + REPO_OWNER + "/" + REPO_NAME + "/contents/" + path;
  const res = UrlFetchApp.fetch(url, { headers: { "Authorization": "token " + GITHUB_TOKEN }, muteHttpExceptions: true });
  return res.getResponseCode() === 200 ? JSON.parse(res.getContentText()).sha : "";
}

function fetchPRContent(text, prMap) {
  const match = text.match(/PR\d+/);
  if (match && prMap[match[0]]) return prMap[match[0]];
  return "";
}

function formatDate(date) {
  if (!(date instanceof Date)) {
    const d = new Date(date);
    if (isNaN(d.getTime())) return String(date);
    date = d;
  }
  return Utilities.formatDate(date, "JST", "yyyy/MM/dd");
}

function getDateFromDayName(dayName, baseDate) {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const cleanDay = dayName.replace(/曜/g, "").trim();
  const targetDay = days.indexOf(cleanDay);
  if (targetDay === -1) return baseDate;
  const currentDay = baseDate.getDay();
  let diff = targetDay - currentDay;
  const result = new Date(baseDate);
  result.setDate(baseDate.getDate() + diff);
  return result;
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('★管理メニュー')
    .addItem('Webサイトを更新（最終安定版）', 'finalizeAndPushToGitHub')
    .addToUi();
}

function doGet() {
  return HtmlService.createTemplateFromFile('Calendar')
      .evaluate()
      .setTitle('メルマガ配信カレンダー')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
