export function createCharPump(onText, intervalMs = 28) {
  const queue = []
  let full = ''
  let running = false
  const idleWaiters = []

  function notifyIdle() {
    if (queue.length || running) return
    const waiters = idleWaiters.splice(0, idleWaiters.length)
    waiters.forEach((fn) => fn())
  }

  function tick() {
    if (!queue.length) {
      running = false
      notifyIdle()
      return
    }
    const ch = queue.shift()
    full += ch
    onText?.(ch, full)
    setTimeout(tick, intervalMs)
  }

  return {
    push(text) {
      const s = String(text || '')
      if (!s) return
      for (const ch of s) queue.push(ch)
      if (!running) {
        running = true
        setTimeout(tick, intervalMs)
      }
    },
    getFull() {
      return full
    },
    waitIdle() {
      if (!queue.length && !running) return Promise.resolve()
      return new Promise((resolve) => idleWaiters.push(resolve))
    },
  }
}
