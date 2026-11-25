// MANUAL EDIT: paste this into Extensions -> Apps Script inside your Google Sheet and deploy as Web App (Who has access: Anyone)
const EXPECTED_SECRET = 'SWE_Project_CareerNest';
const EXPECTED_SHEET_ID = '1PTMuWdtfNj-fb7N0tYoxB8U-tZOxIa7dDyJV2QDHbbQ';
const SCRIPT_CACHE_SECONDS = 120;

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

function getCachedRows(tabName) {
  try {
    const raw = CacheService.getScriptCache().get('tab_' + tabName);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {}
  return null;
}

function setCachedRows(tabName, values) {
  try {
    const serialized = JSON.stringify(values);
    if (serialized.length < 95000) {
      CacheService.getScriptCache().put('tab_' + tabName, serialized, SCRIPT_CACHE_SECONDS);
    }
  } catch (e) {}
}

function clearCachedTab(tabName) {
  try {
    CacheService.getScriptCache().remove('tab_' + tabName);
  } catch (e) {}
}

function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return jsonResponse({ success: false, error: 'Missing request payload' });
  }

  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonResponse({ success: false, error: 'Invalid JSON payload' });
  }

  if (body.secret !== EXPECTED_SECRET || body.sheetId !== EXPECTED_SHEET_ID) {
    return jsonResponse({ success: false, error: 'Unauthorized bridge access' });
  }

  const action = body.action;

  if (action === 'getRows') {
    const cached = getCachedRows(body.tabName);
    if (cached !== null) {
      return jsonResponse({ success: true, data: cached });
    }
    const ss = SpreadsheetApp.openById(EXPECTED_SHEET_ID);
    const sheet = ss.getSheetByName(body.tabName);
    if (!sheet || sheet.getLastRow() === 0) {
      return jsonResponse({ success: true, data: [] });
    }
    const values = sheet.getDataRange().getDisplayValues();
    setCachedRows(body.tabName, values);
    return jsonResponse({ success: true, data: values });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(25000);

  try {
    const ss = SpreadsheetApp.openById(EXPECTED_SHEET_ID);

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
        if (sheet.getLastRow() === 0) {
          const range = sheet.getRange(1, 1, 1, headers.length);
          range.setNumberFormat('@');
          range.setValues([headers]);
        }
        clearCachedTab(tabName);
      }
      return jsonResponse({ success: true, data: { initialized: tabNames } });
    }

    if (action === 'createIfUnique') {
      const uniqueTab = body.uniqueTab;
      const colIndex = Number(body.uniqueColIndex);
      const uniqueVal = String(body.uniqueValue || '').toLowerCase();
      const checkSheet = ss.getSheetByName(uniqueTab);

      if (!checkSheet) {
        return jsonResponse({ success: false, error: 'Tab not found: ' + uniqueTab });
      }

      if (checkSheet.getLastRow() > 1) {
        const colValues = checkSheet
          .getRange(2, colIndex + 1, checkSheet.getLastRow() - 1, 1)
          .getDisplayValues();
        for (let r = 0; r < colValues.length; r++) {
          if (String(colValues[r][0]).toLowerCase() === uniqueVal) {
            return jsonResponse({ success: false, error: 'DUPLICATE_RECORD' });
          }
        }
      }

      const entries = body.entries || [];
      const results = [];
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const sheet = ss.getSheetByName(entry.tabName);
        if (!sheet) {
          return jsonResponse({ success: false, error: 'Tab not found: ' + entry.tabName });
        }
        const rowValues = (entry.values || []).map(sanitizeCell);
        const nextRow = sheet.getLastRow() + 1;
        const range = sheet.getRange(nextRow, 1, 1, rowValues.length);
        range.setNumberFormat('@');
        range.setValues([rowValues]);
        clearCachedTab(entry.tabName);
        results.push({ tabName: entry.tabName, rowNumber: nextRow });
      }
      return jsonResponse({ success: true, data: results });
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
      clearCachedTab(body.tabName);
      return jsonResponse({ success: true, data: { rowNumber: nextRow } });
    }

    if (action === 'batchAppend') {
      const entries = body.entries || [];
      const results = [];
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const sheet = ss.getSheetByName(entry.tabName);
        if (!sheet) {
          return jsonResponse({ success: false, error: 'Tab not found: ' + entry.tabName });
        }
        const rowValues = (entry.values || []).map(sanitizeCell);
        const nextRow = sheet.getLastRow() + 1;
        const range = sheet.getRange(nextRow, 1, 1, rowValues.length);
        range.setNumberFormat('@');
        range.setValues([rowValues]);
        clearCachedTab(entry.tabName);
        results.push({ tabName: entry.tabName, rowNumber: nextRow });
      }
      return jsonResponse({ success: true, data: results });
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
      clearCachedTab(body.tabName);
      return jsonResponse({ success: true, data: { rowNumber: rowNumber } });
    }

    return jsonResponse({ success: false, error: 'Unsupported action: ' + action });
  } catch (err) {
    return jsonResponse({ success: false, error: err.message || 'Apps Script error' });
  } finally {
    lock.releaseLock();
  }
}
