function setupSse(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()
}

function writeSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
  if (typeof res.flush === 'function') res.flush()
}

async function writeSseChars(res, text) {
  for (const ch of String(text || '')) {
    if (res.writableEnded) return
    writeSse(res, { text: ch })
    await new Promise((r) => setImmediate(r))
  }
}

function endSse(res, payload) {
  if (payload) writeSse(res, payload)
  res.write('data: [DONE]\n\n')
  res.end()
}

module.exports = { setupSse, writeSse, writeSseChars, endSse }
