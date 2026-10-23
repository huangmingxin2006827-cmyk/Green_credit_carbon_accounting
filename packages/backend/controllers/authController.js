const bcrypt = require('bcryptjs')
const { query, queryOne } = require('../utils/db')
const { ok, fail } = require('../utils/response')
const { signUser } = require('../middleware/auth')

function tokenPayload(row) {
  return { id: row.id, username: row.username, displayName: row.display_name }
}

async function login(req, res, next) {
  try {
    const username = String(req.body.username || '').trim()
    const password = String(req.body.password || '')
    if (!username || !password) throw fail('AI_ERROR', '请输入用户名和密码', 400)
    const row = await queryOne('SELECT id, username, password_hash, display_name FROM users WHERE username = ?', [
      username,
    ])
    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      throw fail('UNAUTHORIZED', '用户名或密码错误', 401)
    }
    const user = tokenPayload(row)
    res.json(ok({ token: signUser(user), user }))
  } catch (err) {
    next(err)
  }
}

async function register(req, res, next) {
  try {
    const username = String(req.body.username || '').trim()
    const password = String(req.body.password || '')
    const displayName = String(req.body.displayName || '').trim() || username
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
      throw fail('AI_ERROR', '用户名为 3～32 位字母、数字或下划线', 400)
    }
    if (password.length < 6) throw fail('AI_ERROR', '密码至少 6 位', 400)
    const exists = await queryOne('SELECT id FROM users WHERE username = ?', [username])
    if (exists) throw fail('AI_ERROR', '用户名已被注册', 409)
    const hash = bcrypt.hashSync(password, 10)
    const result = await query(
      'INSERT INTO users (username, password_hash, display_name) VALUES (?,?,?)',
      [username, hash, displayName],
    )
    const user = { id: result.insertId, username, displayName }
    res.json(ok({ token: signUser(user), user }))
  } catch (err) {
    next(err)
  }
}

function me(req, res) {
  res.json(ok({ user: req.user }))
}

module.exports = { login, register, me }
