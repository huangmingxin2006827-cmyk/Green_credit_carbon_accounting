const { ok } = require('../utils/response')
const {
  listTasks,
  updateStatus,
  completeTask,
  toggleChecklist,
  removeTask,
  clearTasks,
} = require('../services/taskService')

async function list(req, res, next) {
  try {
    res.json(ok(await listTasks({ ...req.query, userId: req.user.id })))
  } catch (err) {
    next(err)
  }
}

async function patchStatus(req, res, next) {
  try {
    res.json(ok(await updateStatus(req.params.id, req.body.status, req.user.id)))
  } catch (err) {
    next(err)
  }
}

async function complete(req, res, next) {
  try {
    res.json(ok(await completeTask(req.params.id, req.user.id)))
  } catch (err) {
    next(err)
  }
}

async function checklist(req, res, next) {
  try {
    res.json(ok(await toggleChecklist(req.params.id, Number(req.body.index), req.body.done, req.user.id)))
  } catch (err) {
    next(err)
  }
}

async function remove(req, res, next) {
  try {
    res.json(ok(await removeTask(req.params.id, req.user.id)))
  } catch (err) {
    next(err)
  }
}

async function clear(req, res, next) {
  try {
    res.json(ok(await clearTasks(req.user.id)))
  } catch (err) {
    next(err)
  }
}

module.exports = { list, patchStatus, complete, checklist, remove, clear }
