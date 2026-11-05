const { v4: uuidv4 } = require('uuid');
const { TAB_HEADERS } = require('./sheetsSchema');
const sheetsClient = require('./sheetsClient');

class BaseRepository {
  constructor(tabName, client = sheetsClient) {
    if (!TAB_HEADERS[tabName]) {
      throw new Error(`Unknown sheet tab: ${tabName}`);
    }
    this.tabName = tabName;
    this.headers = TAB_HEADERS[tabName];
    this.client = client;
  }

  rowToObject(row, rowNumber) {
    const record = {};
    this.headers.forEach((header, index) => {
      record[header] = row[index] !== undefined ? String(row[index]) : '';
    });
    Object.defineProperty(record, '_rowNumber', {
      value: rowNumber,
      enumerable: false,
      writable: true,
    });
    return record;
  }

  objectToRow(record) {
    return this.headers.map((header) => {
      const val = record[header];
      return val === undefined || val === null ? '' : String(val);
    });
  }

  async findAll(includeDeleted = false) {
    const rows = await this.client.getTabRows(this.tabName);
    if (!rows || rows.length <= 1) {
      await this.client.ensureAllTabs();
      return [];
    }

    const records = [];
    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i];
      if (!row || !row[0]) {
        continue;
      }
      const obj = this.rowToObject(row, i + 1);
      if (!includeDeleted && obj.status === 'DELETED') {
        continue;
      }
      records.push(obj);
    }
    return records;
  }

  async findById(id) {
    const all = await this.findAll(false);
    return all.find((item) => item.id === id) || null;
  }

  async findWhere(predicateObj) {
    const all = await this.findAll(false);
    const entries = Object.entries(predicateObj);
    return all.filter((item) =>
      entries.every(([key, expected]) => String(item[key]) === String(expected))
    );
  }

  async create(data) {
    const now = new Date().toISOString();
    const record = {
      ...data,
      id: data.id || uuidv4(),
    };
    if (this.headers.includes('createdAt') && !record.createdAt) {
      record.createdAt = now;
    }
    if (this.headers.includes('updatedAt') && !record.updatedAt) {
      record.updatedAt = now;
    }

    const rowValues = this.objectToRow(record);
    await this.client.appendTabRow(this.tabName, rowValues);
    return record;
  }

  async update(id, patch) {
    const rows = await this.client.getTabRows(this.tabName);
    for (let i = 1; i < rows.length; i += 1) {
      if (rows[i] && rows[i][0] === id) {
        const existing = this.rowToObject(rows[i], i + 1);
        const updated = {
          ...existing,
          ...patch,
          id: existing.id,
        };
        if (this.headers.includes('updatedAt')) {
          updated.updatedAt = new Date().toISOString();
        }
        const rowValues = this.objectToRow(updated);
        await this.client.updateTabRow(this.tabName, i + 1, rowValues);
        return updated;
      }
    }
    return null;
  }

  async softDelete(id) {
    return this.update(id, { status: 'DELETED' });
  }
}

module.exports = BaseRepository;
