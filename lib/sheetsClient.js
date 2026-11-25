const { TAB_HEADERS } = require('./sheetsSchema');

const FORMULA_PREFIX_REGEX = /^[=+\-@]/;
const CACHE_TTL_MS = 30000;
const readCache = new Map();
let tabsVerifiedInMemory = false;

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

function invalidateCache(tabName) {
  if (tabName) {
    readCache.delete(tabName);
  } else {
    readCache.clear();
  }
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
      } catch {
        throw new Error(
          'Apps Script returned HTML instead of JSON. Ensure Apps Script deployment has "Who has access: Anyone".'
        );
      }

      if (!result.success) {
        throw new Error(result.error || 'Apps Script error');
      }

      return result.data;
    } catch (error) {
      attempt += 1;
      if (
        attempt >= maxRetries ||
        error.message.includes('DUPLICATE_RECORD') ||
        error.message.includes('Apps Script returned HTML') ||
        error.message.includes('Unsupported action') ||
        error.message.includes('Formula injection')
      ) {
        throw error;
      }
      await sleep(200 * attempt);
    }
  }
}

async function ensureAllTabs(force = false) {
  if (tabsVerifiedInMemory && !force) {
    return { cached: true };
  }
  const data = await callAppsScript({
    action: 'ensureTabs',
    schema: TAB_HEADERS,
  });
  tabsVerifiedInMemory = true;
  return data;
}

async function getTabRows(tabName, options = {}) {
  const useCache = Boolean(options.useCache);
  if (useCache) {
    const cached = readCache.get(tabName);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.rows;
    }
  }

  const rows = await callAppsScript({
    action: 'getRows',
    tabName,
  });
  const normalized = Array.isArray(rows) ? rows : [];
  readCache.set(tabName, {
    rows: normalized,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return normalized;
}

async function appendTabRow(tabName, values) {
  const safeValues = sanitizeRowValues(values);
  invalidateCache(tabName);
  try {
    return await callAppsScript({
      action: 'appendRow',
      tabName,
      values: safeValues,
    });
  } catch (err) {
    if (err.message && err.message.includes('Tab not found')) {
      await ensureAllTabs(true);
      return callAppsScript({
        action: 'appendRow',
        tabName,
        values: safeValues,
      });
    }
    throw err;
  }
}

async function batchAppendTabRows(entries) {
  const prepared = entries.map((entry) => {
    invalidateCache(entry.tabName);
    return {
      tabName: entry.tabName,
      values: sanitizeRowValues(entry.values),
    };
  });

  try {
    return await callAppsScript({
      action: 'batchAppend',
      entries: prepared,
    });
  } catch (err) {
    if (err.message && err.message.includes('Unsupported action')) {
      return Promise.all(prepared.map((entry) => appendTabRow(entry.tabName, entry.values)));
    }
    if (err.message && err.message.includes('Tab not found')) {
      await ensureAllTabs(true);
      return callAppsScript({
        action: 'batchAppend',
        entries: prepared,
      });
    }
    throw err;
  }
}

async function createIfUnique(uniqueTab, uniqueColIndex, uniqueValue, entries) {
  const prepared = entries.map((entry) => {
    invalidateCache(entry.tabName);
    return {
      tabName: entry.tabName,
      values: sanitizeRowValues(entry.values),
    };
  });

  try {
    return await callAppsScript({
      action: 'createIfUnique',
      uniqueTab,
      uniqueColIndex,
      uniqueValue,
      entries: prepared,
    });
  } catch (err) {
    if (err.message && err.message.includes('Tab not found')) {
      await ensureAllTabs(true);
      return callAppsScript({
        action: 'createIfUnique',
        uniqueTab,
        uniqueColIndex,
        uniqueValue,
        entries: prepared,
      });
    }
    throw err;
  }
}

async function updateTabRow(tabName, rowNumber, values) {
  const safeValues = sanitizeRowValues(values);
  invalidateCache(tabName);
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
  invalidateCache,
  ensureAllTabs,
  getTabRows,
  appendTabRow,
  batchAppendTabRows,
  createIfUnique,
  updateTabRow,
};
