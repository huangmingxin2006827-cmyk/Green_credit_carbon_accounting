const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const envPath = path.join(__dirname, '..', '.env')

function parseArgs(argv) {
  const out = {}
  for (const raw of argv) {
    const i = raw.indexOf('=')
    if (i <= 0) continue
    const key = raw.slice(0, i).trim()
    let val = raw.slice(i + 1)
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (key) out[key] = val
  }
  return out
}

function upsertEnv(content, updates) {
  const lines = String(content || '').replace(/\r\n/g, '\n').split('\n')
  const seen = new Set()
  const next = lines.map((line) => {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!m) return line
    const key = m[1]
    if (!(key in updates)) return line
    seen.add(key)
    return `${key}=${updates[key]}`
  })
  for (const [key, val] of Object.entries(updates)) {
    if (!seen.has(key)) next.push(`${key}=${val}`)
  }
  let text = next.join('\n')
  if (!text.endsWith('\n')) text += '\n'
  return text
}

function main() {
  const updates = parseArgs(process.argv.slice(2))
  if (!Object.keys(updates).length) {
    console.error('usage: node patch-env.js KEY=value [KEY=value ...]')
    process.exit(1)
  }

  if (updates.JWT_SECRET === '__RANDOM__') {
    updates.JWT_SECRET = crypto.randomBytes(24).toString('hex')
  }

  if (!fs.existsSync(envPath)) {
    console.error('.env not found:', envPath)
    process.exit(1)
  }

  const prev = fs.readFileSync(envPath, 'utf8')
  const next = upsertEnv(prev, updates)
  fs.writeFileSync(envPath, next, 'utf8')
  console.log('updated', Object.keys(updates).join(', '))
}

main()
