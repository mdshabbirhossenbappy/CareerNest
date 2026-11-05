const { TAB_HEADERS } = require('./sheetsSchema');

const FORMULA_PREFIX_REGEX = /^[=+\-@]/;

function assertSafeValue(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (FORMULA_PREFIX_REGEX.test(str)) {
    throw new Error('Potential formula injection blocked');
  }
  return str;
}

function sanitizeRowValues(values) {
  return values.map((val) => assertSafeValue(val));
}

function getBridgeConfig() {
  const bridgeUrl = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const bridgeSecret = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = process.env.GOOGLE_SHEET_ID;

  if (!bridgeUrl || !bridgeSecret || !sheetId) {
    throw new Error('Missing Google Sheets environment configuration');
  }

  return { bridgeUrl: bridgeUrl.trim(), bridgeSecret: bridgeSecret.trim(), sheetId: sheetId.trim() };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callAppsScript(payload, maxRetries = 3) {
  const { bridgeUrl, bridgeSecret, sheetId } = getBridgeConfig();
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const response = await fetch(bridgeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        redirect: 'follow',
        body: JSON.stringify({
          ...payload,
          secret: bridgeSecret,
          sheetId,
        }),
      });

      if (response.status === 429 || response.status >= 500) {
        throw new Error(`Transient HTTP status ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Apps Script operation failed');
      }

      return result.data;
    } catch (error) {
      attempt += 1;
      if (attempt >= maxRetries || error.message.includes('Formula injection')) {
        throw error;
      }
      await sleep(200 * Math.pow(2, attempt));
    }
  }
}

async function ensureAllTabs() {
  return callAppsScript({
    action: 'ensureTabs',
    schema: TAB_HEADERS,
  });
}

async function getTabRows(tabName) {
  const rows = await callAppsScript({
    action: 'getRows',
    tabName,
  });
  return Array.isArray(rows) ? rows : [];
}

async function appendTabRow(tabName, values) {
  const safeValues = sanitizeRowValues(values);
  return callAppsScript({
    action: 'appendRow',
    tabName,
    values: safeValues,
  });
}

async function updateTabRow(tabName, rowNumber, values) {
  const safeValues = sanitizeRowValues(values);
  return callAppsScript({
    action: 'updateRow',
    tabName,
    rowNumber,
    values: safeValues,
  });
}

module.exports = {
  assertSafeValue,
  sanitizeRowValues,
  ensureAllTabs,
  getTabRows,
  appendTabRow,
  updateTabRow,
};
