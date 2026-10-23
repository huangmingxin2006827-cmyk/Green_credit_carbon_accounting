const { getBenchmark, getIntensityBenchmark } = require('./benchmarkService')

function round2(n) {
  return Math.round(Number(n) * 100) / 100
}

function buildCalculation(parsed) {
  const region = parsed.enterprise?.region
  const industry = parsed.enterprise?.industry
  const factorRow = getBenchmark(industry, '电力排放因子', region)
  const emissionFactor = factorRow ? Number(factorRow.value) : 0.5306
  const monthlyElectricity = parsed.monthly.map((m) => Number(m.electricityKwh) || 0)
  const totalElectricityKwh = monthlyElectricity.reduce((a, b) => a + b, 0)
  const monthlyEmission = monthlyElectricity.map((kwh) => round2((kwh / 1000) * emissionFactor))
  const totalEmissionTCO2e = round2(monthlyEmission.reduce((a, b) => a + b, 0))

  const intensityBench = getIntensityBenchmark(industry)
  const annualValueAddedWanYuan = Number(parsed.enterprise?.annualValueAddedWanYuan) || 0
  const monthCount = monthlyElectricity.length || 12
  const valueAddedPerMonth = annualValueAddedWanYuan > 0 ? annualValueAddedWanYuan / monthCount : null

  const monthlyIntensity = monthlyEmission.map((e) =>
    valueAddedPerMonth ? round2(e / valueAddedPerMonth) : null,
  )
  const carbonIntensity =
    annualValueAddedWanYuan > 0 ? round2(totalEmissionTCO2e / annualValueAddedWanYuan) : null

  if (annualValueAddedWanYuan > 0) {
    parsed.enterprise.annualValueAddedWanYuan = annualValueAddedWanYuan
    parsed.enterprise.annualOutputValueWanYuan = annualValueAddedWanYuan
  }
  parsed.benchmarkId = factorRow?.benchmarkId || 'BENCH_CN_ELEC_AVG_2023'

  const equipment = { 生产设备: 0, 空调: 0, 照明: 0, 办公用电: 0 }
  for (const m of parsed.monthly) {
    equipment['生产设备'] += Number(m.equipmentKwh) || 0
    equipment['空调'] += Number(m.acKwh) || 0
    equipment['照明'] += Number(m.lightingKwh) || 0
    equipment['办公用电'] += Number(m.officeKwh) || 0
  }

  return {
    totalElectricityKwh: round2(totalElectricityKwh),
    totalEmissionTCO2e,
    emissionFactor,
    carbonIntensity,
    monthlyElectricity,
    monthlyEmission,
    monthlyIntensity,
    annualValueAddedWanYuan: annualValueAddedWanYuan || null,
    annualOutputValueWanYuan: annualValueAddedWanYuan || null,
    equipmentKwh: equipment,
    factorBenchmark: factorRow,
    intensityBenchmark: intensityBench,
  }
}

module.exports = { buildCalculation, round2 }
