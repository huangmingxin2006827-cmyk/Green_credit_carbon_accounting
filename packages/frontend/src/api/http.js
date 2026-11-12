import { createCharPump } from '../utils/streamPump'
import { clearAuth, getToken } from '../utils/auth'

const BASE = import.meta.env.VITE_API_BASE || '/api'

function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function rejectUnauthorized(res, json) {
  if (res.status !== 401) return
  clearAuth()
  if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
    window.location.href = '/login'
  }
  const err = new Error(json?.message || '请先登录')
  err.code = json?.code || 'UNAUTHORIZED'
  throw err
}

function unwrap(json) {
  if (!json || (json.code !== 'OK' && json.code !== 0 && json.success !== true)) {
    const err = new Error(json?.message || '请求失败')
    err.code = json?.code
    throw err
  }
  return json.data
}

export async function apiJson(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...authHeaders(),
      ...(options.headers || {}),
    },
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    rejectUnauthorized(res, json)
    const err = new Error(json?.message || `HTTP ${res.status}`)
    err.code = json?.code
    throw err
  }
  return unwrap(json)
}

export async function consumeSse(path, body, { onText, onDone, onError, onReady } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok || !res.body) {
    const json = await res.json().catch(() => null)
    rejectUnauthorized(res, json)
    const err = new Error(json?.message || `HTTP ${res.status}`)
    err.code = json?.code
    onError?.(err)
    throw err
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buf = ''
  const pump = createCharPump(onText, 16)
  let sawDone = false
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const chunks = buf.split('\n\n')
      buf = chunks.pop() || ''
      for (const chunk of chunks) {
        const line = chunk
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trim())
          .join('\n')
        if (!line || line === '[DONE]') continue
        let payload
        try {
          payload = JSON.parse(line)
        } catch {
          continue
        }
        if (payload.error) {
          const err = new Error(payload.error)
          err.code = payload.code
          onError?.(err)
          throw err
        }
        if (payload.ready && payload.reportId) {
          onReady?.(payload)
        }
        if (payload.text) {
          pump.push(payload.text)
        }
        if (payload.done) {
          sawDone = true
          // 后端终稿 answer 优先（已拆 JSON / 去转义），避免沿用带 \ 的流式半成品
          const finalText =
            typeof payload.answer === 'string' && payload.answer.length
              ? payload.answer
              : pump.getFull()
          if (!pump.getFull() && finalText) {
            pump.push(finalText)
          }
          await pump.waitIdle()
          onDone?.(payload, finalText)
        }
      }
    }
    await pump.waitIdle()
    if (!sawDone && pump.getFull()) {
      onDone?.({ done: true }, pump.getFull())
    }
  } catch (err) {
    if (err?.name === 'AbortError' || /abort/i.test(err?.message || '')) {
      const wrapped = new Error('生成连接被中断（后端热重启或代理超时）。请重启前后端后再试一次。')
      onError?.(wrapped)
      throw wrapped
    }
    onError?.(err)
    throw err
  }
  return pump.getFull()
}

export function login(username, password) {
  return apiJson('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function register(username, password, displayName) {
  return apiJson('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, displayName }),
  })
}

export function fetchMe() {
  return apiJson('/auth/me')
}

export async function changePassword(oldPassword, newPassword) {
  const res = await fetch(`${BASE}/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: JSON.stringify({ oldPassword, newPassword }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401) {
      // 旧密码错误等：跳登录前写入提示，登录页用 ElMessage 展示（无确认按钮）
      try {
        sessionStorage.setItem('auth_flash', '原密码错误，请重新登录')
      } catch {
        /* ignore */
      }
      clearAuth()
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
        window.location.href = '/login'
      }
      const err = new Error(json?.message || '原密码错误，请重新登录')
      err.code = json?.code || 'UNAUTHORIZED'
      throw err
    }
    const err = new Error(json?.message || `HTTP ${res.status}`)
    err.code = json?.code
    throw err
  }
  return unwrap(json)
}

export function getChatHistory() {
  return apiJson('/chat/history')
}

export function saveChatHistory(payload) {
  return apiJson('/chat/history', { method: 'PUT', body: JSON.stringify(payload) })
}

export function clearChatHistory() {
  return apiJson('/chat/history', { method: 'DELETE' })
}

export function uploadFile(file) {
  const form = new FormData()
  form.append('file', file)
  return apiJson('/upload', { method: 'POST', body: form })
}

export function generateReport(payload, handlers) {
  return consumeSse('/report/generate', payload, handlers)
}

export function getLatestReport() {
  return apiJson('/report/latest')
}

export function getReport(id) {
  return apiJson(`/report/${id}`)
}

export function patchReport(id, content) {
  return apiJson(`/report/${id}`, { method: 'PATCH', body: JSON.stringify({ content }) })
}

export function getCharts(id) {
  return apiJson(`/report/${id}/charts`)
}

export function getLatestSuggestions() {
  return apiJson('/suggestion/latest')
}

export function generateSuggestions(reportId) {
  return apiJson('/suggestion/generate', {
    method: 'POST',
    body: JSON.stringify({ reportId }),
  })
}

export function suggestionAction(id, action, detail) {
  return apiJson(`/suggestion/${id}/action`, {
    method: 'POST',
    body: JSON.stringify({ action, detail }),
  })
}

export function listTasks() {
  return apiJson('/tasks')
}

export function patchTaskStatus(id, status) {
  return apiJson(`/tasks/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function patchChecklist(id, index, done) {
  return apiJson(`/tasks/${id}/checklist`, {
    method: 'PATCH',
    body: JSON.stringify({ index, done }),
  })
}

export function deleteTask(id) {
  return apiJson(`/tasks/${id}`, { method: 'DELETE' })
}

export function clearTasks() {
  return apiJson('/tasks', { method: 'DELETE' })
}

export function chatKnowledge(payload, handlers) {
  return consumeSse('/chat', payload, handlers)
}

export function chatReport(reportId, payload, handlers) {
  return consumeSse(`/report/${reportId}/question`, payload, handlers)
}

export function exportUrl(reportId, format) {
  return `${BASE}/report/${reportId}/export?format=${encodeURIComponent(format)}`
}
