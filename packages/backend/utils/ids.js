function nowId(prefix) {
  const t = new Date()
  const stamp = t.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, '').replace('T', '_')
  const rand = Math.random().toString(36).slice(2, 6)
  return `${prefix}_${stamp}_${rand}`
}

module.exports = { nowId }
