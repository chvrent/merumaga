/**
 * Code.gs
 */
function doGet(e) {
  let template;
  try {
    template = HtmlService.createTemplateFromFile('Index');
  } catch (error) {
    template = HtmlService.createTemplateFromFile('index');
  }
  return template.evaluate()
    .setTitle('メルマガ配信マスタ')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function saveDailyCheckStatuses(updates) {
  return saveDailyArchiveDiffs(updates);
}
