const xlsx = require('xlsx')

function cell(row, keys) {
  for (const key of Object.keys(row)) {
    const n = String(key).replace(/\s/g, '')
    if (keys.some((k) => n.includes(k))) {
      const v = row[key]
      if (v !== undefined && v !== null && String(v).trim() !== '') return v
    }
  }
  return null
}

function toNumber(v) {
  if (v === null || v === undefined || v === '') return 0
  const n = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function parseExcelBuffer(buffer) {
  const wb = xlsx.read(buffer, { type: 'buffer' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: null })
  if (!rows.length) {
    const err = new Error('Excel 无有效数据行')
    err.bizCode = 'AI_ERROR'
    err.httpStatus = 400
    throw err
  }

  const first = rows[0]
  const enterpriseName = cell(first, ['企业名称', '企业', '公司']) || '示例企业'
  const industry = cell(first, ['行业']) || '电力消费'
  const region = cell(first, ['地区', '省份', '省', '区域']) || ''
  const valueAddedRaw = cell(first, [
    '年工业增加值',
    '工业增加值万元',
    '工业增加值',
    '增加值万元',
    '增加值',
  ])
  const annualValueAddedWanYuan = toNumber(valueAddedRaw) || null

  const monthly = rows.map((row, idx) => {
    const monthRaw = cell(row, ['月份', '月', '期间', 'month'])
    const month =
      monthRaw != null
        ? String(monthRaw)
        : `M${String(idx + 1).padStart(2, '0')}`
    const equipment = toNumber(cell(row, ['生产设备']))
    const ac = toNumber(cell(row, ['空调']))
    const light = toNumber(cell(row, ['照明']))
    const office = toNumber(cell(row, ['办公']))
    const composed = equipment + ac + light + office
    const electricityKwh = toNumber(cell(row, ['用电量', '电量', 'kWh', 'kwh'])) || composed
    return {
      month,
      electricityKwh,
      equipmentKwh: equipment,
      acKwh: ac,
      lightingKwh: light,
      officeKwh: office,
    }
  })

  return {
    enterprise: {
      name: String(enterpriseName),
      industry: String(industry),
      region: String(region),
      annualValueAddedWanYuan,
      annualOutputValueWanYuan: annualValueAddedWanYuan,
    },
    monthly,
  }
}

module.exports = { parseExcelBuffer }
