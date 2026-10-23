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
  const rawText = String(raw || '')
  const unwrapped = unwrapAnswer(raw)
  let answer
  if (typeof unwrapped === 'string') {
    const trimmed = rawText.trim()
    // unwrap 成功会得到与原始 JSON 不同的正文；失败则退回整段原始串
    const extracted =
      unwrapped !== trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('```'))
    answer = extracted ? unwrapped : shown || unwrapped
  } else {
    // 非字符串（少见）时不要 JSON.stringify 回灌到对话里
    answer = shown || peekAnswer(rawText) || ''
  }

  // 仅当最终正文是已展示内容的前缀延长时才补推，避免把 JSON 尾巴（如 }）拼上去
  if (answer.startsWith(shown) && answer.length > shown.length) {
    await onText?.(answer.slice(shown.length))
  } else if (!shown && answer) {
    await onText?.(answer)
  } else if (shown && !answer.startsWith(shown)) {
    answer = shown
  }
  return answer
}

module.exports = { streamChat, buildMessages }
