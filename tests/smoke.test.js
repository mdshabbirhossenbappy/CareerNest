const healthHandler = require('../api/health');

describe('Health Endpoint Smoke Test', () => {
  test('GET /api/health returns 200', async () => {
    const req = { method: 'GET', headers: {} };
    const res = {
      statusCode: 200,
      headers: {},
      body: null,
      setHeader(k, v) {
        this.headers[k] = v;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };

    await healthHandler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('POST /api/health returns 405', async () => {
    const req = { method: 'POST', headers: {} };
    const res = {
      statusCode: 200,
      headers: {},
      body: null,
      setHeader(k, v) {
        this.headers[k] = v;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };

    await healthHandler(req, res);
    expect(res.statusCode).toBe(405);
    expect(res.body.success).toBe(false);
  });
});
