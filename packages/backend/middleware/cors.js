function corsMiddleware(req, res, next) {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept')
  res.header('Access-Control-Expose-Headers', 'Content-Type')
  res.header('Vary', 'Origin')
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  next()
}

module.exports = corsMiddleware
