const { loadAgentConfig } = require('../utils/agentConfig')
const {
  completeApp,
  unwrapAnswer,
  peekAnswer,
  normalizeAnswerText,
  looksLikeAnswerShell,
} = require('./bailianClient')

const MAX_ROUNDS = 10

const FORMAT_HINT = [
  '# 输出格式',
  '先写结论与对照分析正文；涉及标准、排放因子、法规或知识库依据时，不要把长出处嵌进正文句子。',
  '正文只写结论与对照数据，禁止出现「未标年份」「核对红头文件」「正式引用前」等免责套话。',
  '列举标准分类（如 GHG Protocol 范围 1/2/3 及范围 3 的 15 类）时，只写类别序号与规范名称。',
  '禁止括号内教学解释、定义展开，以及「区别于第×类」「即…」「又称…」等夹注。',
  '需要对照本企业时，分类列表写完后另起一段写核算范围结论，不要把解释塞进条目括号。',
  '文末单独用 Markdown 引用块列出出处，固定形态：',
  '> **数据出处**',
  '> - 碳强度基准：…；来源：…',
  '> - 电力排放因子：…；来源：…',
  '数据出处只写指标名、数值、单位、文献名（及因子年份），不要重复上述免责声明。',
  '无出处可引时省略该引用块。',
].join('\n')

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
  messages.push({
    role: 'user',
    content: `${contextBlock}用户问题：${question}\n\n${FORMAT_HINT}`,
  })
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
