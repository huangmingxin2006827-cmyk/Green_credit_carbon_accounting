const { loadAgentConfig } = require('../utils/agentConfig')
const { completeApp } = require('./bailianClient')
const { fail } = require('../utils/response')

function buildReportUserMessage({ parsed, calculation, benchmark, requirement }) {
  const today = new Date().toISOString().slice(0, 10)
  const payload = {
    enterprise: parsed.enterprise,
    benchmarkId: parsed.benchmarkId || null,
    benchmark,
    emissionFactorTco2PerMwh: calculation.emissionFactor,
    monthly: parsed.monthly,
    calculation,
  }
  return [
    '# 任务',
    '依据已配置的系统提示词，输出该企业碳足迹分析报告的 Markdown 正文（仅正文，无围栏，四章，不含减排建议）。',
    '',
    '# 今日日期',
    today,
    '',
    '# 用户要求(requirement)',
    requirement || '无额外要求',
    '',
    '# 输入数据',
    JSON.stringify(payload),
  ].join('\n')
}

function stripCotPrefix(text) {
  const raw = String(text || '')
  const titled = raw.search(/#\s*[^\n]*碳足迹分析报告/)
  if (titled >= 0) return raw.slice(titled)
  const heading = raw.search(/^#\s+\S/m)
  if (heading >= 0) return raw.slice(heading)
  return ''
}

async function generateReportStream({ parsed, calculation, benchmark, requirement, onText }) {
  const { apps } = loadAgentConfig()
  const messages = [
    {
      role: 'user',
      content: buildReportUserMessage({ parsed, calculation, benchmark, requirement }),
    },
  ]
  let raw = ''
  let sent = ''
  const emitted = await completeApp({
    appId: apps.report,
    messages,
    incremental: true,
    onText: async (delta) => {
      raw += delta
      const body = stripCotPrefix(raw)
      if (!body) return
      if (body.startsWith(sent)) {
        const extra = body.slice(sent.length)
        sent = body
        if (extra) await onText?.(extra)
        return
      }
      sent = body
      await onText?.(body)
    },
  })
  const body = sent || stripCotPrefix(emitted || raw)
  if (!body) {
    const err = fail('AI_ERROR', '报告未形成正式 Markdown 正文（模型输出了演算草稿）', 502)
    err.partial = raw || emitted
    throw err
  }
  return body
}

module.exports = { generateReportStream, buildReportUserMessage, stripCotPrefix }
