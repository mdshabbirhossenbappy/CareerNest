const healthHandler = require('../api/health');

describe('Part 0 Smoke Test', () => {
  test('GET /api/health returns 200 and standardized JSON envelope', async () => {
    const req = {
      method: 'GET',
      headers: {},
    };
    const res = {
      statusCode: 200,
      headers: {},
      body: null,
      setHeader(key, value) {
        this.headers[key] = value;
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
    expect(res.body).toEqual({
      success: true,
      data: { status: 'ok', service: 'CareerNest' },
      error: null,
    });
  });

  test('POST /api/health returns 405 Method Not Allowed', async () => {
    const req = {
      method: 'POST',
      headers: {},
    };
    const res = {
      statusCode: 200,
      headers: {},
      body: null,
      setHeader(key, value) {
        this.headers[key] = value;
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
    expect(res.body.error).toBe('Method not allowed');
  });
});
