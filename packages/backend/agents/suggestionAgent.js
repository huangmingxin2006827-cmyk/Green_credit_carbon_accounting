const { loadAgentConfig } = require('../utils/agentConfig')
const { completeApp, unwrapAnswer } = require('./bailianClient')

function looksLikeScratch(text) {
  return /Let me |Key data points|Internal |I'll |I will |process this data|我来分析|数据清洗/i.test(
    String(text || ''),
  )
}

function looksLikePlaceholder(text) {
  const s = String(text || '').trim()
  if (!s) return true
  if (/^[\.…·•\-\s]+$/u.test(s)) return true
  if (/^(待补充|暂无|省略|内容省略|TBD|N\/A|TODO)$/i.test(s)) return true
  if (s.length < 24) return true
  return false
}

function extractArray(raw) {
  const text = String(raw || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
  const decoded = unwrapAnswer(text)
  if (Array.isArray(decoded)) return decoded
  if (decoded && typeof decoded === 'object') {
    const nested = decoded.suggestions || decoded.data || decoded.items || decoded.result
    if (Array.isArray(nested)) return nested
    if (decoded.title || decoded.detail) return [decoded]
  }
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1))
      if (Array.isArray(parsed)) return parsed
    } catch {
      /* 继续扫片段 */
    }
  }
  const blocks = text.match(/\[[\s\S]*?\]/g) || []
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block)
      if (Array.isArray(parsed) && parsed.some((x) => x && (x.title || x.detail))) return parsed
    } catch {
      /* 下一段 */
    }
  }
  return null
}

function fallbackSuggestions(calculation, parsed) {
  const kwh = Number(calculation?.totalElectricityKwh || 0)
  const emit = Number(calculation?.totalEmissionTCO2e || 0)
  const factor = Number(calculation?.emissionFactor || 0.57)
  const name = parsed?.enterprise?.name || '该企业'
  const pvKwh = Math.round(kwh * 0.22)
  const pvCut = Math.round(pvKwh * factor) / 1000
  const peakCut = Math.round(emit * 0.08 * 100) / 100
  const motorCut = Math.round(emit * 0.12 * 100) / 100
  return [
    {
      title: '错峰用电与负荷调度',
      detail: `${name}年用电约${Math.round(kwh).toLocaleString()} kWh、排放约${emit} tCO2e。将高耗能设备尽量安排在低谷时段运行，预估年减排${peakCut} tCO2e；预估投入8万元，回收期1.5年，实施难度低，优先级高，建议完成时限3个月。`,
    },
    {
      title: '生产设备能效改造',
      detail: `生产设备用电占比最高，对电机、空压机做变频与淘汰更新，预估年减排${motorCut} tCO2e；预估投入25万元，回收期3年，实施难度中，优先级高，建议完成时限6个月。`,
    },
    {
      title: '屋顶分布式光伏',
      detail: `按年用电规模估算光伏可替代约${pvKwh.toLocaleString()} kWh外购电，预估年减排${Math.round(pvCut * 100) / 100} tCO2e；预估投入40万元，回收期3年，实施难度中，优先级中，建议完成时限9个月。`,
    },
  ]
}

function normalizeItems(arr, calculation, parsed) {
  const fallback = fallbackSuggestions(calculation, parsed)
  const cleaned = (arr || [])
    .map((item, i) => ({
      title: String(item?.title || '').trim() || fallback[i]?.title || `减排建议 ${i + 1}`,
      detail: String(item?.detail || item?.content || '').trim(),
    }))
    .filter(
      (item) =>
        item.detail &&
        !looksLikeScratch(item.title) &&
        !looksLikeScratch(item.detail) &&
        !looksLikePlaceholder(item.detail),
    )
    .slice(0, 3)
  if (cleaned.length >= 3) return cleaned.slice(0, 3)
  const used = new Set(cleaned.map((x) => x.title))
  for (const item of fallback) {
    if (cleaned.length >= 3) break
    if (used.has(item.title)) continue
    cleaned.push(item)
  }
  return cleaned.slice(0, 3)
}

async function generateSuggestions({ reportContent, parsed, calculation } = {}) {
  const { apps } = loadAgentConfig()
  const context =
    reportContent && String(reportContent).trim()
      ? reportContent
      : JSON.stringify(
          {
            enterprise: parsed?.enterprise || null,
            monthly: parsed?.monthly || null,
            calculation: calculation
              ? {
                  totalElectricityKwh: calculation.totalElectricityKwh,
                  totalEmissionTCO2e: calculation.totalEmissionTCO2e,
                  emissionFactor: calculation.emissionFactor,
                  carbonIntensity: calculation.carbonIntensity,
                  monthlyElectricity: calculation.monthlyElectricity,
                }
              : null,
            benchmark: calculation?.factorBenchmark || null,
          },
          null,
          2,
        )
  const messages = [
    {
      role: 'user',
      content: [
        '# 碳核算上下文（可与报告同时生成，以核算数据为准）',
        context,
        '',
        '# 输出',
        '只输出 JSON 数组，恰好 3 条，每项仅 title 与 detail。禁止思考过程、英文分析、Markdown 围栏。',
      ].join('\n'),
    },
  ]
  const raw = await completeApp({
    appId: apps.suggestion,
    messages,
    incremental: false,
  })
  const arr = extractArray(raw)
  return normalizeItems(arr, calculation, parsed)
}

async function enrichTask({ suggestion, today }) {
  const { apps } = loadAgentConfig()
  const messages = [
    {
      role: 'user',
      content: `# 输入\n${JSON.stringify({ today, suggestion })}`,
    },
  ]
  const raw = await completeApp({
    appId: apps.suggestion,
    messages,
    incremental: false,
  })
  const parsed = unwrapAnswer(raw)
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed
  }
  return null
}

module.exports = {
  generateSuggestions,
  enrichTask,
  normalizeItems,
  looksLikeScratch,
  looksLikePlaceholder,
}
