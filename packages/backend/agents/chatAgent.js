const { loadAgentConfig } = require('../utils/agentConfig')
const {
  completeApp,
  unwrapAnswer,
  peekAnswer,
  normalizeAnswerText,
  looksLikeAnswerShell,
} = require('./bailianClient')

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

function escapeNoise(s) {
  return (String(s || '').match(/\\/g) || []).length
}

function pickFinalAnswer(shown, unwrapped, rawText) {
  const shownClean = normalizeAnswerText(shown || '')
  if (typeof unwrapped !== 'string') return shownClean

  const trimmed = String(rawText || '').trim()
  const extracted =
    unwrapped !== trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('```'))
  const clean = normalizeAnswerText(unwrapped)

  // 拆壳失败仍像 JSON 外壳 → 沿用流式正文
  if (!extracted || looksLikeAnswerShell(clean)) return shownClean || clean

  // 拆壳成功：优先更干净（反斜杠更少）的正文
  if (!shownClean) return clean
  if (escapeNoise(clean) < escapeNoise(shownClean)) return clean
  if (clean === shownClean || clean.startsWith(shownClean)) return clean
  // 流式稿与终稿不一致时，终稿通常更完整正确
  return clean
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
      } else if (visible !== shown && visible.length > 0 && escapeNoise(visible) < escapeNoise(shown)) {
        // 转义被进一步规范后，允许用更干净的全文替换观感（前端以 done.answer 为准）
        shown = visible
      }
    },
  })

  const answer = pickFinalAnswer(shown, unwrapAnswer(raw), raw)

  // 仅追加「终稿相对已展示」的延长；整段替换交给 done.answer
  if (answer.startsWith(shown) && answer.length > shown.length) {
    await onText?.(answer.slice(shown.length))
  } else if (!shown && answer) {
    await onText?.(answer)
  }
  return answer
}

module.exports = { streamChat, buildMessages }
