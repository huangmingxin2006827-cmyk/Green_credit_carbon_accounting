const { ok } = require('../utils/response')
const { loadHistory, saveHistory, clearHistory } = require('../services/chatHistoryService')

async function history(req, res, next) {
  try {
    res.json(ok(await loadHistory(req.user.id)))
  } catch (err) {
    next(err)
  }
}

async function save(req, res, next) {
  try {
    res.json(ok(await saveHistory(req.user.id, req.body || {})))
  } catch (err) {
    next(err)
  }
}

async function clear(req, res, next) {
  try {
    res.json(ok(await clearHistory(req.user.id)))
  } catch (err) {
    next(err)
  }
}

module.exports = { history, save, clear }
