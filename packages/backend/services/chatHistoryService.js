const { query } = require('../utils/db')

function toMsg(row) {
  return {
    id: row.msg_id,
    role: row.role,
    content: row.content || '',
    streaming: false,
  }
}

async function loadHistory(userId) {
  const rows = await query(
    'SELECT * FROM chat_messages WHERE user_id = ? ORDER BY id ASC',
    [userId],
  )
  const knowledge = rows.filter((r) => r.channel === 'knowledge').map(toMsg)
  const followup = rows.filter((r) => r.channel === 'followup').map(toMsg)
  return { knowledge, followup }
}

async function saveHistory(userId, { knowledge = [], followup = [] }) {
  await query('DELETE FROM chat_messages WHERE user_id = ?', [userId])
  const packs = [
    ...knowledge.map((m) => ['knowledge', m]),
    ...followup.map((m) => ['followup', m]),
  ]
  for (const [channel, m] of packs) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue
    await query(
      `INSERT INTO chat_messages (user_id, channel, msg_id, role, content, report_id)
       VALUES (?,?,?,?,?,?)`,
      [userId, channel, m.id || `${Date.now()}`, m.role, m.content || '', m.reportId || null],
    )
  }
  return loadHistory(userId)
}

async function clearHistory(userId) {
  await query('DELETE FROM chat_messages WHERE user_id = ?', [userId])
  return { knowledge: [], followup: [] }
}

module.exports = { loadHistory, saveHistory, clearHistory }
