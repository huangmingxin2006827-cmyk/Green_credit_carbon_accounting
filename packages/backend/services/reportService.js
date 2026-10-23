const { loadUploadCache, createDraft, upsertReport, getReport, getLatest, patchContent } = require('./reportStore')
const { buildCalculation } = require('./calculationService')
const { buildCharts } = require('./chartService')
const { generateReportStream } = require('../agents/reportAgent')
const { fail } = require('../utils/response')

async function generateReport({ fileId, requirement, userId }, { onText, onReady } = {}) {
  if (!fileId) throw fail('AI_ERROR', '缺少 fileId', 400)
  const cached = await loadUploadCache(fileId, userId)
  const parsed = cached.parsed
  const calculation = buildCalculation(parsed)
  const factorBenchmark = calculation.factorBenchmark
  const report = await createDraft({
    userId,
    fileId,
    fileName: cached.fileName,
    parsed,
    calculation,
    benchmark: factorBenchmark,
  })
  await buildCharts(report.reportId, parsed, calculation)
  onReady?.({ reportId: report.reportId })

  let content = ''
  try {
    content = await generateReportStream({
      parsed,
      calculation,
      benchmark: factorBenchmark,
      requirement,
      onText,
    })
  } catch (err) {
    if (err.partial) {
      report.content = err.partial
      report.status = 'draft'
      await upsertReport(report)
    }
    throw err
  }

  report.content = content
  report.status = 'confirmed'
  report.confirmed = true
  report.version = 1
  await upsertReport(report)
  return getReport(report.reportId, userId)
}

function withLiveCalculation(report) {
  if (!report?.parsed) return report
  const calculation = buildCalculation(report.parsed)
  return {
    ...report,
    calculation: {
      ...(report.calculation || {}),
      ...calculation,
    },
    calculationExtra: calculation,
    benchmark: calculation.factorBenchmark || report.benchmark,
  }
}

async function latestReport(userId) {
  return withLiveCalculation(await getLatest(userId))
}

async function readReport(reportId, userId) {
  return withLiveCalculation(await getReport(reportId, userId))
}

function saveReportContent(reportId, content, userId) {
  if (typeof content !== 'string') throw fail('AI_ERROR', 'content 必须为字符串', 400)
  return patchContent(reportId, content, userId)
}

module.exports = { generateReport, latestReport, readReport, saveReportContent }
