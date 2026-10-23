const { ok } = require('../utils/response')
const { generateAndStoreSuggestions, latestSuggestions, applyAction } = require('../services/suggestionService')

async function generate(req, res, next) {
  try {
    const reportId = req.body.reportId
    if (!reportId) {
      const err = new Error('缺少 reportId')
      err.bizCode = 'AI_ERROR'
      err.httpStatus = 400
      throw err
    }
    const data = await generateAndStoreSuggestions(reportId, req.user.id)
    res.json(ok(data))
  } catch (err) {
    next(err)
  }
}

async function latest(req, res, next) {
  try {
    res.json(ok(await latestSuggestions(req.user.id)))
  } catch (err) {
    next(err)
  }
}

async function action(req, res, next) {
  try {
    const data = await applyAction(req.params.id, req.body.action, req.body.detail, req.user.id)
    res.json(ok(data))
  } catch (err) {
    next(err)
  }
}

module.exports = { generate, latest, action }
