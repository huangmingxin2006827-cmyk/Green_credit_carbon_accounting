const fs = require('fs')
const path = require('path')
const { readJson } = require('../utils/fileStore')
const { BENCHMARKS } = require('../utils/paths')

const INTENSITY_CSV = path.join(__dirname, '..', '..', '..', '行业碳强度对标_单位工业增加值口径.csv')

/** Excel / colloquial industry name → CSV industry key */
const INDUSTRY_ALIASES = {
  纺织: '印染/纺织',
  纺织业: '印染/纺织',
  棉纺织: '印染/纺织',
  印染: '印染/纺织',
  印染纺织: '印染/纺织',
  火电: '火电',
  电力: '火电',
  电力生产: '火电',
  钢铁: '钢铁',
  钢铁业: '钢铁',
  石化: '石化',
  石油化工: '石化',
  造纸: '造纸',
  造纸业: '造纸',
  建材: '建材',
  建筑材料: '建材',
  化工: '化工',
  化学原料: '化工',
  化纤: '化纤',
  化学纤维: '化纤',
  有色: '有色',
  有色金属: '有色',
}

let intensityCache = null

function parseCsvLine(line) {
  const cells = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur)
  return cells
}

function loadIntensityRows() {
  if (intensityCache) return intensityCache
  if (!fs.existsSync(INTENSITY_CSV)) {
    console.warn('[INTENSITY_CSV_MISSING]', INTENSITY_CSV)
    intensityCache = []
    return intensityCache
  }
  const text = fs.readFileSync(INTENSITY_CSV, 'utf8').replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) {
    intensityCache = []
    return intensityCache
  }
  const headers = parseCsvLine(lines[0]).map((h) => h.trim())
  intensityCache = lines.slice(1).map((line) => {
    const cols = parseCsvLine(line)
    const row = {}
    headers.forEach((h, i) => {
      row[h] = (cols[i] ?? '').trim()
    })
    return {
      industry: row.industry || '',
      metric: row.metric || '单位工业增加值碳排放',
      value: Number(row.value),
      unit: row.unit || 'tCO2e/万元增加值',
      year: row.year || '',
      source: row.source || '',
    }
  }).filter((r) => r.industry && Number.isFinite(r.value))
  return intensityCache
}

function normalizeIndustryKey(raw) {
  const s = String(raw || '')
    .replace(/\s+/g, '')
    .replace(/行业$/g, '')
    .trim()
  if (!s) return ''
  if (INDUSTRY_ALIASES[s]) return INDUSTRY_ALIASES[s]
  for (const [alias, key] of Object.entries(INDUSTRY_ALIASES)) {
    if (s.includes(alias) || alias.includes(s)) return key
  }
  return s
}

function normalizeRegion(raw) {
  if (!raw) return ''
  return String(raw)
    .replace(/省|市|自治区|壮族|回族|维吾尔|特别行政区/g, '')
    .trim()
}

function getBenchmark(industry, metric, region) {
  const rows = readJson(BENCHMARKS, [])
  const regionKey = normalizeRegion(region)
  let hit = null
  if (regionKey) {
    hit = rows.find((row) => normalizeRegion(row.region) === regionKey)
    if (!hit) {
      hit = rows.find((row) => regionKey.includes(normalizeRegion(row.region)))
    }
  }
  if (!hit) {
    hit = rows.find((row) => row.benchmarkId === 'BENCH_CN_ELEC_AVG_2023')
  }
  if (!hit) {
    console.warn('[BENCHMARK_MISSING]', { industry, metric, region })
    return null
  }
  return {
    benchmarkId: hit.benchmarkId,
    industry: hit.industry,
    metric: hit.factorType || hit.metric,
    value: Number(hit.value),
    unit: hit.unit,
    source: hit.source,
    year: String(hit.year),
    region: hit.region,
  }
}

/**
 * Industry carbon-intensity benchmark (tCO2e per 万元 industrial value-added).
 * Prefer exact / alias match on subdivided industries; skip provincial/institution rows unless no hit.
 */
function getIntensityBenchmark(industry) {
  const rows = loadIntensityRows()
  const key = normalizeIndustryKey(industry)
  if (!key) {
    console.warn('[INTENSITY_MISSING]', { industry })
    return null
  }

  const primary = rows.filter(
    (r) => !/省级|机构测算|准入线/.test(r.industry),
  )
  let hit =
    primary.find((r) => r.industry === key) ||
    primary.find((r) => r.industry.includes(key) || key.includes(r.industry))

  if (!hit) {
    hit =
      rows.find((r) => r.industry === key) ||
      rows.find((r) => r.industry.includes(key) || key.includes(r.industry))
  }

  if (!hit) {
    console.warn('[INTENSITY_MISSING]', { industry, key })
    return null
  }

  return {
    industry: hit.industry,
    metric: hit.metric,
    value: Number(hit.value),
    unit: hit.unit,
    source: hit.source,
    year: hit.year ? String(hit.year) : '',
    matchedFrom: String(industry || ''),
  }
}

function reloadIntensityCache() {
  intensityCache = null
  return loadIntensityRows()
}

module.exports = {
  getBenchmark,
  getIntensityBenchmark,
  normalizeRegion,
  normalizeIndustryKey,
  reloadIntensityCache,
}
