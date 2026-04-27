/**
 * スプレッドシートからデータを取得してカレンダー用JSONを返す
 */
function getCalendarEvents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const allEvents = [];
  const now = new Date();
  
  // PR管理用マップ
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
  
  return JSON.stringify(allEvents);
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

function doGet() {
  return HtmlService.createTemplateFromFile('Calendar')
      .evaluate()
      .setTitle('メルマガ配信カレンダー')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
