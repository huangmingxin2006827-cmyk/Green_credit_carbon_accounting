const { loadAgentConfig } = require('../utils/agentConfig')
const { fail } = require('../utils/response')

const BAILIAN_URL = 'https://dashscope.aliyuncs.com/api/v1/apps'

function parseSseBuffer(buffer, onEvent) {
  const parts = buffer.split('\n\n')
  const rest = parts.pop() || ''
  for (const part of parts) {
    const dataLines = part
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter(Boolean)
    if (!dataLines.length) continue
    const raw = dataLines.join('\n')
    if (raw === '[DONE]') continue
    try {
      onEvent(JSON.parse(raw))
    } catch {
      onEvent({ output: { text: raw } })
    }
  }
  return rest
}

function extractOutputText(event) {
  if (!event || typeof event !== 'object') return ''
  return (
    event.output?.text ||
    event.output?.choices?.[0]?.message?.content ||
    event.output?.choices?.[0]?.delta?.content ||
    ''
  )
}

function looksLikeReportMarkdown(text) {
  const s = String(text || '')
  return /#\s*[^\n]*碳足迹分析报告/.test(s) || /^#\s+\S/m.test(s)
}

function looksLikeScratch(text) {
  const s = String(text || '')
  return /Let me |Internal calculations|process this data internally|我来分析输入|数据清洗：/i.test(s)
}

function toDelta(prev, text) {
  if (!text) return { delta: '', next: prev }
  if (prev && text.startsWith(prev)) {
    return { delta: text.slice(prev.length), next: text }
  }
  if (prev && prev.startsWith(text) && text.length < prev.length) {
    return { delta: '', next: prev }
  }
  if (looksLikeReportMarkdown(text) && (!prev || looksLikeScratch(prev) || !text.startsWith(prev.slice(0, Math.min(40, prev.length))))) {
    return { delta: text, next: text }
  }
  return { delta: text, next: prev + text }
}

async function completeApp({ appId, messages, incremental, onText }) {
  const cfg = loadAgentConfig()
  if (!cfg.apiKey || cfg.apiKey === 'YOUR_API_KEY_HERE') {
    throw fail('AI_ERROR', '未配置 DASHSCOPE_API_KEY', 500)
  }
  if (!appId) {
    throw fail('AI_ERROR', '未配置对应 Agent 的 app_id', 500)
  }

  const controller = new AbortController()
  let timer
  const armTimer = () => {
    clearTimeout(timer)
    timer = setTimeout(() => controller.abort(), cfg.timeoutMs)
  }
  armTimer()

  const headers = {
    Authorization: `Bearer ${cfg.apiKey}`,
    'Content-Type': 'application/json',
  }
  if (incremental) headers['X-DashScope-SSE'] = 'enable'

  let response
  try {
    response = await fetch(`${BAILIAN_URL}/${appId}/completion`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        input: { messages },
        parameters: { incremental_output: Boolean(incremental) },
        debug: {},
      }),
    })
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') {
      throw fail('AI_TIMEOUT', 'AI 服务超时', 504)
    }
    throw fail('AI_ERROR', err.message || 'AI 服务异常', 502)
  }

  if (!response.ok) {
    clearTimeout(timer)
    const body = await response.text().catch(() => '')
    throw fail('AI_ERROR', body.slice(0, 400) || `百炼 HTTP ${response.status}`, 502)
  }

  if (!incremental) {
    clearTimeout(timer)
    const json = await response.json()
    const text = extractOutputText(json)
    if (text) await onText?.(text)
    return text
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buf = ''
  let emitted = ''
  const pending = []
  const pushEvent = (event) => {
    const text = extractOutputText(event)
    if (!text) return
    const { delta, next } = toDelta(emitted, text)
    emitted = next
    if (delta) pending.push(delta)
  }

  async function flushPending() {
    while (pending.length) {
      const delta = pending.shift()
      armTimer()
      await onText?.(delta)
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      armTimer()
      buf += decoder.decode(value, { stream: true })
      buf = parseSseBuffer(buf, pushEvent)
      await flushPending()
    }
    if (buf.trim()) {
      parseSseBuffer(`${buf}\n\n`, pushEvent)
      await flushPending()
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      const wrapped = fail('AI_TIMEOUT', '报告生成超时，请重试', 504)
      wrapped.partial = emitted
      throw wrapped
    }
    err.partial = emitted
    throw err
  } finally {
    clearTimeout(timer)
  }
  return emitted
}

function unwrapAnswer(raw) {
  const text = String(raw || '').trim()
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = fenced ? fenced[1].trim() : text
  try {
    const parsed = JSON.parse(candidate)
    if (parsed && typeof parsed.answer === 'string') return parsed.answer
    if (Array.isArray(parsed)) return parsed
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
  }
  return candidate
}

function peekAnswer(raw) {
  const text = String(raw || '')
  const parsed = unwrapAnswer(text)
  if (typeof parsed === 'string' && parsed !== text.trim()) return parsed
  try {
    const obj = JSON.parse(text.trim())
    if (obj && typeof obj.answer === 'string') return obj.answer
  } catch {
    /* partial json */
  }
  const match = text.match(/"answer"\s*:\s*"/)
  if (!match) {
    if (text.trim().startsWith('{') || text.trim().startsWith('```')) return ''
    return text
  }
  let out = ''
  for (let i = match.index + match[0].length; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '\\' && i + 1 < text.length) {
      const n = text[i + 1]
      const map = { n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\' }
      out += map[n] !== undefined ? map[n] : n
      i += 1
      continue
    }
    if (ch === '"') break
    out += ch
  }
  return out
}

module.exports = { completeApp, unwrapAnswer, peekAnswer }
