const KEY = 'carbon_auth'

function store() {
  return typeof sessionStorage !== 'undefined' ? sessionStorage : null
}

export function loadAuth() {
  try {
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
    const raw = store()?.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveAuth(payload) {
  store()?.setItem(KEY, JSON.stringify(payload))
}

export function clearAuth() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  store()?.removeItem(KEY)
}

export function getToken() {
  return loadAuth()?.token || ''
}
