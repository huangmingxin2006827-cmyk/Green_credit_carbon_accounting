const { saveCharts, getReport } = require('./reportStore')
const { buildCalculation } = require('./calculationService')
const { query } = require('../utils/db')

function monthLabel(raw, index) {
  const s = String(raw)
  const m = s.match(/(\d{1,2})月/) || s.match(/-(\d{1,2})$/)
  if (m) return `${Number(m[1])}月`
  return `${index + 1}月`
}

function isLegacyBenchmarkCharts(charts, calculation) {
  if (!charts?.benchmarkLine?.series?.length) return true
  if (calculation && !calculation.intensityBenchmark && calculation.carbonIntensity === 0.45) return true
  const bench = charts.benchmarkLine.series.find((s) => s.name === '行业基准')
  if (!bench?.data?.length) return !calculation?.intensityBenchmark
  if (bench.data.every((v) => Number(v) === 0.45)) return true
  const live = calculation?.intensityBenchmark?.value
  if (Number.isFinite(Number(live)) && bench.data.some((v) => Number(v) !== Number(live))) return true
  return false
}

async function buildCharts(reportId, parsed, calculation) {
  const xAxis = parsed.monthly.map((row, i) => monthLabel(row.month, i))
  const intensityLine = (calculation.monthlyIntensity || []).map((v) =>
    v === null || v === undefined ? null : v,
  )
  const benchVal = calculation.intensityBenchmark?.value
  const hasIntensityBench = Number.isFinite(Number(benchVal))
  const pieSource = calculation.equipmentKwh || {}
  const pieData = Object.entries(pieSource)
    .map(([name, kwh]) => ({
      name,
      value: Math.round(((Number(kwh) || 0) / 1000) * calculation.emissionFactor * 100) / 100,
    }))
    .filter((d) => d.value > 0)

  const benchmarkSeries = [{ name: '企业碳强度', data: intensityLine }]
  if (hasIntensityBench) {
    benchmarkSeries.push({
      name: '行业基准',
      data: xAxis.map(() => Number(benchVal)),
    })
  }

  const charts = {
    trendLine: {
      xAxis,
      series: [{ name: '碳排放', data: calculation.monthlyEmission }],
    },
    bar: {
      xAxis,
      series: [{ name: '碳排放', data: calculation.monthlyEmission }],
    },
    pie: {
      series: [{ name: '用电构成碳足迹占比', data: pieData }],
    },
    benchmarkLine: {
      xAxis,
      series: benchmarkSeries,
    },
  }

  await saveCharts(reportId, charts)
  return charts
}

async function getCharts(reportId, userId) {
  const report = await getReport(reportId, userId)
  if (!report?.parsed) return report?.charts || null

  const calculation = buildCalculation(report.parsed)
  if (!isLegacyBenchmarkCharts(report.charts, report.calculation) && report.charts) {
    return report.charts
  }

  const charts = await buildCharts(reportId, report.parsed, calculation)
  try {
    await query(
      `UPDATE reports SET calculation_json = ?, calculation_extra_json = ?, charts_json = ? WHERE report_id = ?`,
      [
        JSON.stringify({
          totalElectricityKwh: calculation.totalElectricityKwh,
          totalEmissionTCO2e: calculation.totalEmissionTCO2e,
          emissionFactor: calculation.emissionFactor,
          carbonIntensity: calculation.carbonIntensity,
          monthlyElectricity: calculation.monthlyElectricity,
          monthlyEmission: calculation.monthlyEmission,
          monthlyIntensity: calculation.monthlyIntensity,
          annualValueAddedWanYuan: calculation.annualValueAddedWanYuan,
          intensityBenchmark: calculation.intensityBenchmark,
          factorBenchmark: calculation.factorBenchmark,
          equipmentKwh: calculation.equipmentKwh,
        }),
        JSON.stringify(calculation),
        JSON.stringify(charts),
        reportId,
      ],
    )
  } catch (err) {
    console.warn('[charts refresh persist]', err.message)
  }
  return charts
}

module.exports = { buildCharts, getCharts }
