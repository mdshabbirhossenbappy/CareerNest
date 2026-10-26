module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      success: false,
      data: null,
      error: 'Method not allowed',
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'CareerNest',
    },
    error: null,
  });
};
