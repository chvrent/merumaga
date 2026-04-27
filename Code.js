/**
 * スプレッドシートからデータを取得し、行ごとの詳細（設定・確認）を含めて返す
 */
function getCalendarEvents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const allEvents = [];
  const now = new Date();
  
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
      pic: findCol(["担当"]),
      setup: findCol(["設定"]),
      check: findCol(["確認"])
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
        time: idx.time !== -1 ? String(row[idx.time]) : "0",
        media: idx.media !== -1 ? String(row[idx.media]) : mediaDefault,
        title: title,
        color: idx.title !== -1 ? backgrounds[i][idx.title] : "#007bff",
        target: idx.target !== -1 ? String(row[idx.target]) : "",
        pic: idx.pic !== -1 ? String(row[idx.pic]) : "",
        setup: idx.setup !== -1 ? String(row[idx.setup]) : "未",
        check: idx.check !== -1 ? String(row[idx.check]) : "未"
      });
    }
  };

  processSheetByName("新規", "新規");
  processSheetByName("リスト", "定常");
  
  return JSON.stringify(allEvents);
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
