const jwt = require('jsonwebtoken')
const { fail } = require('../utils/response')

function signUser(user) {
  const secret = process.env.JWT_SECRET || 'green-credit-dev-secret'
  return jwt.sign(
    { id: user.id, username: user.username, displayName: user.displayName },
    secret,
    { expiresIn: '7d' },
  )
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) {
    next(fail('UNAUTHORIZED', '请先登录', 401))
    return
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'green-credit-dev-secret')
    req.user = {
      id: payload.id,
      username: payload.username,
      displayName: payload.displayName,
    }
    next()
  } catch {
    next(fail('UNAUTHORIZED', '登录已过期，请重新登录', 401))
  }
}

module.exports = { signUser, requireAuth }
