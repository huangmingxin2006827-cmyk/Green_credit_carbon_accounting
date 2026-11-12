const { nowId } = require('../utils/ids')
const { query, queryOne, asJson } = require('../utils/db')
const { fail } = require('../utils/response')

function toTask(row) {
  if (!row) return null
  return {
    taskId: row.task_id,
    userId: row.user_id,
    reportId: row.report_id,
    suggestionId: row.suggestion_id,
    title: row.title,
    source: row.source,
    priority: row.priority,
    suggestedDueDate: row.suggested_due_date,
    detail: row.suggestion_detail || row.detail || '',
    checklist: asJson(row.checklist_json) || [],
    checklistDone: asJson(row.checklist_done_json) || [],
    approvalFlow: asJson(row.approval_flow_json) || [],
    status: row.status,
    syncStatus: row.sync_status,
    createdAt: row.created_at,
  }
}

const TASK_SELECT = `SELECT t.*, s.detail AS suggestion_detail
  FROM tasks t
  LEFT JOIN suggestions s ON s.suggestion_id = t.suggestion_id AND s.user_id = t.user_id`

function sortTasks(list) {
  return [...list].sort((a, b) => {
    const rank = (s) => (s === 'done' ? 1 : 0)
    const d = rank(a.status) - rank(b.status)
    if (d) return d
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  })
}

async function listTasks(queryFilter = {}) {
  const params = [queryFilter.userId]
  let sql = `${TASK_SELECT} WHERE t.user_id = ?`
  if (queryFilter.reportId) {
    sql += ' AND t.report_id = ?'
    params.push(queryFilter.reportId)
  }
  if (queryFilter.status) {
    sql += ' AND t.status = ?'
    params.push(queryFilter.status)
  }
  sql += ' ORDER BY t.created_at DESC'
  const rows = await query(sql, params)
  return sortTasks(rows.map(toTask))
}

async function getTask(taskId, userId) {
  const row = await queryOne(`${TASK_SELECT} WHERE t.task_id = ? AND t.user_id = ?`, [taskId, userId])
  if (!row) throw fail('REPORT_NOT_FOUND', '任务不存在', 404)
  return toTask(row)
}

async function saveTask(task) {
  await query(
    `INSERT INTO tasks (
      task_id, user_id, report_id, suggestion_id, title, source, priority, suggested_due_date,
      checklist_json, checklist_done_json, approval_flow_json, status, sync_status
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      source = VALUES(source),
      priority = VALUES(priority),
      suggested_due_date = VALUES(suggested_due_date),
      checklist_json = VALUES(checklist_json),
      checklist_done_json = VALUES(checklist_done_json),
      approval_flow_json = VALUES(approval_flow_json),
      status = VALUES(status),
      sync_status = VALUES(sync_status)`,
    [
      task.taskId,
      task.userId,
      task.reportId || null,
      task.suggestionId || null,
      task.title,
      task.source || null,
      task.priority || null,
      task.suggestedDueDate || null,
      JSON.stringify(task.checklist || []),
      JSON.stringify(task.checklistDone || []),
      JSON.stringify(task.approvalFlow || []),
      task.status,
      task.syncStatus || 'done',
    ],
  )
  return task
}

async function createTaskFromSuggestion(suggestion, enriched) {
  const checklist = Array.isArray(enriched.checklist) ? enriched.checklist : []
  const task = {
    taskId: nowId('t'),
    userId: suggestion.userId,
    reportId: suggestion.reportId,
    suggestionId: suggestion.suggestionId,
    title: enriched.title || `审批任务：${suggestion.title}`,
    source: enriched.source || '减排建议采纳',
    priority: enriched.priority || '中',
    suggestedDueDate: enriched.suggestedDueDate || null,
    checklist,
    checklistDone: checklist.map(() => false),
    approvalFlow: Array.isArray(enriched.approvalFlow) ? enriched.approvalFlow : [],
    detail: suggestion.detail || '',
    status: 'inProgress',
    syncStatus: 'done',
    createdAt: new Date().toISOString(),
  }
  await saveTask(task)
  return task
}

async function updateStatus(taskId, status, userId) {
  const task = await getTask(taskId, userId)
  task.status = status === 'completed' ? 'done' : status
  if (task.status === 'done') {
    task.checklistDone = (task.checklistDone || []).map(() => true)
  }
  await saveTask(task)
  return task
}

async function toggleChecklist(taskId, index, done, userId) {
  const task = await getTask(taskId, userId)
  if (!task.checklistDone) task.checklistDone = (task.checklist || []).map(() => false)
  task.checklistDone[index] = Boolean(done)
  if (task.checklistDone.length && task.checklistDone.every(Boolean)) {
    task.status = 'done'
  }
  await saveTask(task)
  return task
}

function completeTask(taskId, userId) {
  return updateStatus(taskId, 'done', userId)
}

async function removeTask(taskId, userId) {
  const task = await getTask(taskId, userId)
  await query('DELETE FROM tasks WHERE task_id = ? AND user_id = ?', [taskId, userId])
  return task
}

async function clearTasks(userId) {
  const result = await query('DELETE FROM tasks WHERE user_id = ?', [userId])
  return { cleared: result?.affectedRows ?? 0 }
}

module.exports = {
  listTasks,
  getTask,
  createTaskFromSuggestion,
  updateStatus,
  toggleChecklist,
  completeTask,
  removeTask,
  clearTasks,
  sortTasks,
}
