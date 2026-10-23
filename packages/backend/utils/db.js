const mysql = require('mysql2/promise')
const { fail } = require('./response')

let pool

function getPool() {
  if (!pool) {
    if (process.env.MYSQL_PASSWORD == null || !process.env.MYSQL_USER) {
      throw fail('AI_ERROR', '未配置 MYSQL_USER / MYSQL_PASSWORD', 500)
    }
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || '127.0.0.1',
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE || 'green_credit',
      waitForConnections: true,
      connectionLimit: 10,
      charset: 'utf8mb4',
    })
  }
  return pool
}

async function pingDb() {
  const [rows] = await getPool().query('SELECT 1 AS ok')
  return rows[0]
}

async function query(sql, params = []) {
  const [rows] = await getPool().query(sql, params)
  return rows
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params)
  return rows[0] || null
}

function asJson(value) {
  if (value == null) return null
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

module.exports = { getPool, pingDb, query, queryOne, asJson }
