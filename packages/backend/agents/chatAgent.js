const { loadAgentConfig } = require('../utils/agentConfig')
const { completeApp, unwrapAnswer, peekAnswer } = require('./bailianClient')

const MAX_ROUNDS = 10

function buildMessages(question, history, report, benchmark) {
  const recent = (history || []).slice(-MAX_ROUNDS)
  const contextBlock = report
    ? `报告上下文：\n${JSON.stringify({
        reportId: report.reportId,
        content: report.content,
        calculation: report.calculation,
      })}\n\n行业基准：\n${benchmark ? JSON.stringify(benchmark) : 'null'}\n\n`
    : ''
  const messages = recent.map((m) => ({ role: m.role, content: m.content }))
  messages.push({ role: 'user', content: `${contextBlock}用户问题：${question}` })
  return messages
}

async function streamChat({ question, history, report, benchmark, onText }) {
  const { apps } = loadAgentConfig()
  const messages = buildMessages(question, history, report || null, benchmark || null)
  let acc = ''
  let shown = ''
  const raw = await completeApp({
    appId: apps.chat,
    messages,
    incremental: true,
    onText: async (chunk) => {
      acc += chunk
      const visible = peekAnswer(acc)
      if (visible.length > shown.length) {
        const delta = visible.slice(shown.length)
        shown = visible
        await onText?.(delta)
      }
    },
  })
  const unwrapped = unwrapAnswer(raw)
  const answer = typeof unwrapped === 'string' ? unwrapped : JSON.stringify(unwrapped)
  if (answer.length > shown.length) {
    await onText?.(answer.slice(shown.length))
  }
  return answer
}

module.exports = { streamChat, buildMessages }
