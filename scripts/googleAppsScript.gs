// MANUAL EDIT: paste this entire file into Extensions -> Apps Script inside your Google Sheet
const EXPECTED_SECRET = 'SWE_Project_CareerNest';
const EXPECTED_SHEET_ID = '1PTMuWdtfNj-fb7N0tYoxB8U-tZOxIa7dDyJV2QDHbbQ';

function sanitizeCell(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (/^[=+\-@]/.test(str)) {
    throw new Error('Formula injection attempt blocked');
  }
  return str;
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ success: false, error: 'Missing request payload' });
    }

    const body = JSON.parse(e.postData.contents);

    if (body.secret !== EXPECTED_SECRET || body.sheetId !== EXPECTED_SHEET_ID) {
      return jsonResponse({ success: false, error: 'Unauthorized bridge access' });
    }

    const ss = SpreadsheetApp.openById(EXPECTED_SHEET_ID);
    const action = body.action;

    if (action === 'ensureTabs') {
      const schema = body.schema || {};
      const tabNames = Object.keys(schema);
      for (let i = 0; i < tabNames.length; i++) {
        const tabName = tabNames[i];
        const headers = schema[tabName];
        let sheet = ss.getSheetByName(tabName);
        if (!sheet) {
          sheet = ss.insertSheet(tabName);
        }
        const firstRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
        const hasHeaders = firstRow.some(function (cell) {
          return String(cell).trim() !== '';
        });
        if (!hasHeaders) {
          const range = sheet.getRange(1, 1, 1, headers.length);
          range.setNumberFormat('@');
          range.setValues([headers]);
        }
      }
      return jsonResponse({ success: true, data: { initialized: tabNames } });
    }

    if (action === 'getRows') {
      const sheet = ss.getSheetByName(body.tabName);
      if (!sheet) {
        return jsonResponse({ success: true, data: [] });
      }
      const values = sheet.getDataRange().getDisplayValues();
      return jsonResponse({ success: true, data: values });
    }

    if (action === 'appendRow') {
      const sheet = ss.getSheetByName(body.tabName);
      if (!sheet) {
        return jsonResponse({ success: false, error: 'Tab not found: ' + body.tabName });
      }
      const rowValues = (body.values || []).map(sanitizeCell);
      const nextRow = sheet.getLastRow() + 1;
      const range = sheet.getRange(nextRow, 1, 1, rowValues.length);
      range.setNumberFormat('@');
      range.setValues([rowValues]);
      return jsonResponse({ success: true, data: { rowNumber: nextRow } });
    }

    if (action === 'updateRow') {
      const sheet = ss.getSheetByName(body.tabName);
      if (!sheet) {
        return jsonResponse({ success: false, error: 'Tab not found: ' + body.tabName });
      }
      const rowNumber = Number(body.rowNumber);
      const rowValues = (body.values || []).map(sanitizeCell);
      const range = sheet.getRange(rowNumber, 1, 1, rowValues.length);
      range.setNumberFormat('@');
      range.setValues([rowValues]);
      return jsonResponse({ success: true, data: { rowNumber: rowNumber } });
    }

    return jsonResponse({ success: false, error: 'Unsupported action: ' + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message || 'Apps Script error' });
  } finally {
    lock.releaseLock();
  }
}
