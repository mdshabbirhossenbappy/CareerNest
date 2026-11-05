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
  const bridgeUrl =
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    'https://script.google.com/macros/s/AKfycbxy060NWgx6iNPWR8hZIgH20pMP2tMWLLMb4E8iHPvBKhfvRCWENZnE3hbEYJ2IhJttXA/exec';
  const bridgeSecret = process.env.GOOGLE_PRIVATE_KEY || 'SWE_Project_CareerNest';
  const sheetId =
    process.env.GOOGLE_SHEET_ID || '1PTMuWdtfNj-fb7N0tYoxB8U-tZOxIa7dDyJV2QDHbbQ';

  return {
    bridgeUrl: bridgeUrl.trim(),
    bridgeSecret: bridgeSecret.trim(),
    sheetId: sheetId.trim(),
  };
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callAppsScript(payload, maxRetries = 3) {
  const { bridgeUrl, bridgeSecret, sheetId } = getBridgeConfig();
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const bodyString = JSON.stringify({
        ...payload,
        secret: bridgeSecret,
        sheetId,
      });

      let response = await fetch(bridgeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'manual',
        body: bodyString,
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const redirectUrl = response.headers.get('location');
        if (redirectUrl) {
          response = await fetch(redirectUrl, {
            method: 'GET',
            redirect: 'follow',
          });
        }
      }

      const rawText = await response.text();
      let result;
      try {
        result = JSON.parse(rawText);
      } catch (_err) {
        throw new Error(
          'Apps Script returned HTML instead of JSON. In Google Sheet -> Extensions -> Apps Script -> Deploy -> Manage deployments -> Edit -> set Who has access to Anyone.'
        );
      }

      if (!result.success) {
        throw new Error(result.error || 'Apps Script error');
      }

      return result.data;
    } catch (error) {
      attempt += 1;
      if (attempt >= maxRetries || error.message.includes('Apps Script returned HTML')) {
        throw error;
      }
      await sleep(250 * attempt);
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
