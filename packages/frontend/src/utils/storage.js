const KEY = 'carbon_chat_session'
const TTL_MS = 30 * 60 * 1000
const MAX = 50

export function loadChatSession() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > TTL_MS) {
      localStorage.removeItem(KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function saveChatSession(payload) {
  const knowledge = (payload.knowledge || []).slice(-MAX)
  const followup = (payload.followup || []).slice(-MAX)
  localStorage.setItem(
    KEY,
    JSON.stringify({
      knowledge,
      followup,
      language: payload.language || 'zh',
      savedAt: Date.now(),
    }),
  )
}

export function clearChatSession() {
  localStorage.removeItem(KEY)
}

export function touchChatSession() {
  const cur = loadChatSession()
  if (cur) saveChatSession(cur)
}
