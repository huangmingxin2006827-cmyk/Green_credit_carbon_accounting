const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')
const mysql = require('mysql2/promise')
const dotenv = require('dotenv')

dotenv.config({ path: path.join(__dirname, '..', '.env') })

const HOST = process.env.MYSQL_HOST || '127.0.0.1'
const PORT = Number(process.env.MYSQL_PORT || 3306)
const USER = process.env.MYSQL_USER || 'root'
const PASSWORD = process.env.MYSQL_PASSWORD || ''
const DATABASE = process.env.MYSQL_DATABASE || 'green_credit'

const DEMO_USERS = [
  { username: 'zhang', displayName: '张经理', password: '123456' },
  { username: 'li', displayName: '李经理', password: '123456' },
  { username: 'wang', displayName: '王经理', password: '123456' },
]

async function main() {
  const admin = await mysql.createConnection({
    host: HOST,
    port: PORT,
    user: USER,
    password: PASSWORD,
    multipleStatements: true,
  })
  await admin.query(
    `CREATE DATABASE IF NOT EXISTS \`${DATABASE}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  )
  await admin.end()

  const db = await mysql.createConnection({
    host: HOST,
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: DATABASE,
    multipleStatements: true,
  })
  const schema = fs.readFileSync(path.join(__dirname, '..', 'sql', 'schema.sql'), 'utf8')
  await db.query(schema)

  for (const u of DEMO_USERS) {
    const hash = bcrypt.hashSync(u.password, 10)
    await db.query(
      `INSERT INTO users (username, password_hash, display_name)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), password_hash = VALUES(password_hash)`,
      [u.username, hash, u.displayName],
    )
  }
  await db.end()
  console.log(`[db] ${DATABASE} ready. demo users: zhang / li / wang  password: 123456`)
}

main().catch((err) => {
  console.error('[db] init failed:', err.message)
  process.exit(1)
})
