const path = require('path')
const dotenv = require('dotenv')
dotenv.config({ path: path.join(__dirname, '.env') })
const express = require('express')
const corsMiddleware = require('./middleware/cors')
const errorHandler = require('./middleware/errorHandler')
const { pingDb } = require('./utils/db')
const { ensureDir } = require('./utils/fileStore')
const { REPORTS_DIR, TASKS_DIR, CACHE_DIR, UPLOADS_DIR } = require('./utils/paths')
const apiRouter = require('./routes')

ensureDir(REPORTS_DIR)
ensureDir(TASKS_DIR)
ensureDir(CACHE_DIR)
ensureDir(UPLOADS_DIR)

const app = express()
const PORT = Number(process.env.PORT || 3000)

app.use(corsMiddleware)
app.use(express.json({ limit: '2mb' }))
app.use('/api', apiRouter)
app.use(errorHandler)

async function start() {
  try {
    await pingDb()
  } catch (err) {
    console.error('[backend] MySQL 连接失败：检查 .env 中 MYSQL_*，并先运行 npm run db:init')
    console.error(err.message)
    process.exit(1)
  }
  const server = app.listen(PORT, () => {
    console.log(`[backend] listening on http://localhost:${PORT}`)
  })
  server.timeout = 0
  server.headersTimeout = 0
  server.requestTimeout = 0
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[backend] 端口 ${PORT} 已被占用：关掉其它 node 窗口后再 npm run dev`)
      process.exit(1)
    }
    throw err
  })
}

start()
