const { nowId } = require('../utils/ids')
const { query, queryOne } = require('../utils/db')
const { getReport } = require('./reportStore')
const {
  generateSuggestions,
  normalizeItems,
  looksLikeScratch,
  looksLikePlaceholder,
} = require('../agents/suggestionAgent')
const { createTaskFromSuggestion } = require('./taskService')
const { fail } = require('../utils/response')

function toSuggestion(row) {
  return {
    suggestionId: row.suggestion_id,
    reportId: row.report_id,
    userId: row.user_id,
    title: row.title,
    detail: row.detail,
    status: row.status,
  }
}

async function generateAndStoreSuggestions(reportId, userId) {
  const report = await getReport(reportId, userId)
  const items = await generateSuggestions({
    reportContent: '',
    parsed: report.parsed,
    calculation: report.calculationExtra || report.calculation,
  })
  await query('DELETE FROM suggestions WHERE report_id = ? AND user_id = ?', [reportId, report.userId])
  const suggestions = []
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]
    const suggestion = {
      suggestionId: `s_${reportId}_${i + 1}`,
      reportId,
      userId: report.userId,
      title: item.title,
      detail: item.detail,
      status: 'pending',
    }
    await query(
      `INSERT INTO suggestions (suggestion_id, report_id, user_id, title, detail, status)
       VALUES (?,?,?,?,?,?)`,
      [suggestion.suggestionId, suggestion.reportId, suggestion.userId, suggestion.title, suggestion.detail, suggestion.status],
    )
    suggestions.push(suggestion)
  }
  return { reportId, suggestions }
}

async function latestSuggestions(userId) {
  const last = await queryOne(
    'SELECT report_id FROM suggestions WHERE user_id = ? ORDER BY created_at DESC, suggestion_id DESC LIMIT 1',
    [userId],
  )
  if (!last) return { reportId: null, suggestions: [] }
  const rows = await query(
    'SELECT * FROM suggestions WHERE user_id = ? AND report_id = ? ORDER BY suggestion_id',
    [userId, last.report_id],
  )
  const list = rows.map(toSuggestion)
  const broken =
    list.length !== 3 ||
    list.some(
      (s) => looksLikeScratch(s.detail) || looksLikeScratch(s.title) || looksLikePlaceholder(s.detail),
    )
  if (!broken) return { reportId: last.report_id, suggestions: list }
  const report = await getReport(last.report_id, userId)
  const items = normalizeItems(
    list.filter((s) => !looksLikePlaceholder(s.detail) && !looksLikeScratch(s.detail)),
    report.calculationExtra || report.calculation,
    report.parsed,
  )
  await query('DELETE FROM suggestions WHERE report_id = ? AND user_id = ?', [last.report_id, userId])
  const suggestions = []
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]
    const prev = list.find((s) => s.title === item.title) || list[i]
    const suggestion = {
      suggestionId: prev?.suggestionId || `s_${last.report_id}_${i + 1}`,
      reportId: last.report_id,
      userId,
      title: item.title,
      detail: item.detail,
      status: prev?.status || 'pending',
    }
    await query(
      `INSERT INTO suggestions (suggestion_id, report_id, user_id, title, detail, status)
       VALUES (?,?,?,?,?,?)`,
      [suggestion.suggestionId, suggestion.reportId, suggestion.userId, suggestion.title, suggestion.detail, suggestion.status],
    )
    suggestions.push(suggestion)
  }
  return { reportId: last.report_id, suggestions }
}

async function getSuggestion(id, userId) {
  const row = await queryOne('SELECT * FROM suggestions WHERE suggestion_id = ? AND user_id = ?', [id, userId])
  if (!row) throw fail('REPORT_NOT_FOUND', '建议不存在', 404)
  return toSuggestion(row)
}

function fallbackTask(suggestion) {
  const today = new Date()
  const due = new Date(today)
  due.setMonth(due.getMonth() + 3)
  return {
    title: `审批任务：${suggestion.title}`,
    source: '减排建议采纳',
    priority: '中',
    suggestedDueDate: due.toISOString().slice(0, 10),
    checklist: ['现场评估', '方案编制', '立项审批', '实施验收'],
    approvalFlow: ['支行客户经理发起', '绿色金融部审核', '分行风控复核', '分管行长终审'],
  }
}

async function applyAction(suggestionId, action, detail, userId) {
  const suggestion = await getSuggestion(suggestionId, userId)
  const settled = suggestion.status === 'accepted' || suggestion.status === 'edited' || suggestion.status === 'rejected'
  if (settled && (action === 'accept' || action === 'edit' || action === 'reject')) {
    return { suggestion, task: null }
  }
  if (action === 'reject') {
    suggestion.status = 'rejected'
    await query('UPDATE suggestions SET status = ? WHERE suggestion_id = ? AND user_id = ?', [
      suggestion.status,
      suggestionId,
      userId,
    ])
    return { suggestion, task: null }
  }
  if (action === 'edit' && detail) {
    suggestion.detail = detail
  }
  suggestion.status = action === 'edit' ? 'edited' : 'accepted'
  await query('UPDATE suggestions SET status = ?, detail = ? WHERE suggestion_id = ? AND user_id = ?', [
    suggestion.status,
    suggestion.detail,
    suggestionId,
    userId,
  ])
  const task = await createTaskFromSuggestion(suggestion, fallbackTask(suggestion))
  return { suggestion, task }
}

module.exports = {
  generateAndStoreSuggestions,
  latestSuggestions,
  applyAction,
  nowId,
}
