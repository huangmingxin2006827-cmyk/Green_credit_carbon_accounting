const { setupSse, writeSse, writeSseChars, endSse } = require('../utils/sse')
const { knowledgeChat, reportQuestion } = require('../services/chatService')
const { ok } = require('../utils/response')

async function handleStream(req, res, runner) {
  setupSse(res)
  req.setTimeout(0)
  res.setTimeout(0)
  const answer = await runner((text) => writeSseChars(res, text))
  endSse(res, { done: true, answer })
}

async function chat(req, res, next) {
  const stream = req.headers.accept?.includes('text/event-stream') || req.body?.stream !== false
  try {
    if (stream) {
      await handleStream(req, res, (onText) =>
        knowledgeChat({ message: req.body.message, history: req.body.history, onText }),
      )
      return
    }
    const answer = await knowledgeChat({ message: req.body.message, history: req.body.history })
    res.json(ok({ answer }))
  } catch (err) {
    if (res.headersSent) {
      writeSse(res, { error: err.message, code: err.bizCode || 'AI_ERROR' })
      res.end()
      return
    }
    next(err)
  }
}

async function question(req, res, next) {
  const stream = req.headers.accept?.includes('text/event-stream') || req.body?.stream !== false
  try {
    if (stream) {
      await handleStream(req, res, (onText) =>
        reportQuestion({
          reportId: req.params.reportId,
          question: req.body.question,
          history: req.body.history,
          userId: req.user.id,
          onText,
        }),
      )
      return
    }
    const answer = await reportQuestion({
      reportId: req.params.reportId,
      question: req.body.question,
      history: req.body.history,
      userId: req.user.id,
    })
    res.json(ok({ answer }))
  } catch (err) {
    if (res.headersSent) {
      writeSse(res, { error: err.message, code: err.bizCode || 'AI_ERROR' })
      res.end()
      return
    }
    next(err)
  }
}

module.exports = { chat, question }
