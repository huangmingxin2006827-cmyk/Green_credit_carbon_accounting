const { ok } = require('../utils/response')
const { setupSse, writeSse, endSse } = require('../utils/sse')
const { generateReport, latestReport, readReport, saveReportContent } = require('../services/reportService')
const { generateAndStoreSuggestions } = require('../services/suggestionService')
const { upsertReport } = require('../services/reportStore')
const { getCharts } = require('../services/chartService')
const { exportReport } = require('../services/exportService')
const fs = require('fs')

function kickoffSuggestions(reportId, userId) {
  generateAndStoreSuggestions(reportId, userId)
    .then(async () => {
      const latest = await readReport(reportId, userId)
      latest.status = 'suggestion_done'
      await upsertReport(latest)
    })
    .catch((err) => console.error('[suggestion auto]', err.message))
}

async function generate(req, res, next) {
  const wantsStream =
    req.headers.accept?.includes('text/event-stream') || req.query.stream === '1' || req.body?.stream !== false
  const userId = req.user.id
  try {
    if (wantsStream) {
      setupSse(res)
      req.setTimeout(0)
      res.setTimeout(0)
      const beat = setInterval(() => {
        if (!res.writableEnded) res.write(': ping\n\n')
      }, 10000)
      try {
        const report = await generateReport(
          { fileId: req.body.fileId, requirement: req.body.requirement, userId },
          {
            onReady: (meta) => {
              writeSse(res, { ready: true, ...meta })
              kickoffSuggestions(meta.reportId, userId)
            },
            onText: (text) => writeSse(res, { text }),
          },
        )
        endSse(res, { done: true, reportId: report.reportId })
      } catch (err) {
        if (!res.writableEnded) {
          writeSse(res, { error: err.message || '报告生成失败', code: err.bizCode || 'AI_ERROR' })
          endSse(res)
        }
      } finally {
        clearInterval(beat)
      }
      return
    }
    const report = await generateReport(
      { fileId: req.body.fileId, requirement: req.body.requirement, userId },
      {
        onReady: (meta) => kickoffSuggestions(meta.reportId, userId),
      },
    )
    res.json(ok(report))
  } catch (err) {
    if (res.headersSent) {
      writeSse(res, { error: err.message, code: err.bizCode || 'AI_ERROR' })
      res.end()
      return
    }
    next(err)
  }
}

async function latest(req, res, next) {
  try {
    res.json(ok(await latestReport(req.user.id)))
  } catch (err) {
    next(err)
  }
}

async function getOne(req, res, next) {
  try {
    res.json(ok(await readReport(req.params.id, req.user.id)))
  } catch (err) {
    next(err)
  }
}

async function patchOne(req, res, next) {
  try {
    res.json(ok(await saveReportContent(req.params.id, req.body.content, req.user.id)))
  } catch (err) {
    next(err)
  }
}

async function charts(req, res, next) {
  try {
    const data = await getCharts(req.params.id, req.user.id)
    if (!data) {
      const err = new Error('图表尚未生成')
      err.bizCode = 'REPORT_NOT_FOUND'
      err.httpStatus = 404
      throw err
    }
    res.json(ok(data))
  } catch (err) {
    next(err)
  }
}

async function exportOne(req, res, next) {
  try {
    const format = req.query.format || 'pdf'
    const result = await exportReport(req.params.id, format, req.user.id)
    res.setHeader('Content-Type', result.mime)
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(result.filename)}"; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
    )
    fs.createReadStream(result.dest).pipe(res)
  } catch (err) {
    next(err)
  }
}

module.exports = { generate, latest, getOne, patchOne, charts, exportOne }
