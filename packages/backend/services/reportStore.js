const fs = require('fs')
const path = require('path')
const { nowId } = require('../utils/ids')
const { ensureDir } = require('../utils/fileStore')
const { REPORTS_DIR } = require('../utils/paths')
const { decodeUploadFileName } = require('../utils/fileName')
const { query, queryOne, asJson } = require('../utils/db')
const { fail } = require('../utils/response')

function toReport(row) {
  if (!row) return null
  return {
    reportId: row.report_id,
    userId: row.user_id,
    fileId: row.file_id,
    fileName: decodeUploadFileName(row.file_name || ''),
    industry: row.industry,
    carbonTotal: row.carbon_total,
    scope1: row.scope1,
    scope2: row.scope2,
    scope3: row.scope3,
    content: row.content || '',
    calculation: asJson(row.calculation_json),
    parsed: asJson(row.parsed_json),
    calculationExtra: asJson(row.calculation_extra_json),
    benchmark: asJson(row.benchmark_json),
    charts: asJson(row.charts_json),
    createdAt: row.created_at,
    confirmed: Boolean(row.confirmed),
    status: row.status,
    version: row.version,
    exportedFileUrl: row.exported_file_url,
  }
}

async function getReport(reportId, userId) {
  const row = userId
    ? await queryOne('SELECT * FROM reports WHERE report_id = ? AND user_id = ?', [reportId, userId])
    : await queryOne('SELECT * FROM reports WHERE report_id = ?', [reportId])
  if (!row) throw fail('REPORT_NOT_FOUND', '报告不存在', 404)
  return toReport(row)
}

async function getLatest(userId) {
  const row = await queryOne('SELECT * FROM reports WHERE user_id = ? ORDER BY created_at DESC, report_id DESC LIMIT 1', [
    userId,
  ])
  return toReport(row)
}

async function upsertReport(report) {
  ensureDir(REPORTS_DIR)
  fs.writeFileSync(path.join(REPORTS_DIR, `${report.reportId}.md`), report.content || '', 'utf8')
  await query(
    `INSERT INTO reports (
      report_id, user_id, file_id, file_name, industry, carbon_total, scope1, scope2, scope3,
      content, status, confirmed, version, exported_file_url, calculation_json, calculation_extra_json,
      parsed_json, benchmark_json, charts_json
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE
      file_name = VALUES(file_name),
      industry = VALUES(industry),
      carbon_total = VALUES(carbon_total),
      scope1 = VALUES(scope1),
      scope2 = VALUES(scope2),
      scope3 = VALUES(scope3),
      content = VALUES(content),
      status = VALUES(status),
      confirmed = VALUES(confirmed),
      version = VALUES(version),
      exported_file_url = VALUES(exported_file_url),
      calculation_json = VALUES(calculation_json),
      calculation_extra_json = VALUES(calculation_extra_json),
      parsed_json = VALUES(parsed_json),
      benchmark_json = VALUES(benchmark_json),
      charts_json = COALESCE(VALUES(charts_json), charts_json)`,
    [
      report.reportId,
      report.userId,
      report.fileId,
      report.fileName || null,
      report.industry || null,
      report.carbonTotal ?? null,
      report.scope1 ?? null,
      report.scope2 ?? null,
      report.scope3 ?? null,
      report.content || '',
      report.status || 'generating',
      report.confirmed ? 1 : 0,
      report.version || 0,
      report.exportedFileUrl || null,
      JSON.stringify(report.calculation || null),
      JSON.stringify(report.calculationExtra || null),
      JSON.stringify(report.parsed || null),
      JSON.stringify(report.benchmark || null),
      report.charts ? JSON.stringify(report.charts) : null,
    ],
  )
  return report
}

async function createDraft({ userId, fileId, fileName, parsed, calculation, benchmark }) {
  const reportId = nowId('r')
  const report = {
    reportId,
    userId,
    fileId,
    fileName,
    industry: parsed.enterprise.industry,
    carbonTotal: calculation.totalEmissionTCO2e,
    scope1: 0,
    scope2: calculation.totalEmissionTCO2e,
    scope3: 0,
    content: '',
    calculation: {
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
    },
    parsed,
    calculationExtra: calculation,
    benchmark,
    createdAt: new Date().toISOString(),
    confirmed: false,
    status: 'generating',
    version: 0,
    exportedFileUrl: null,
  }
  return upsertReport(report)
}

async function patchContent(reportId, content, userId) {
  const report = await getReport(reportId, userId)
  report.content = content
  report.version = (report.version || 0) + 1
  return upsertReport(report)
}

async function saveUploadCache(fileId, payload, userId) {
  await query(
    `INSERT INTO uploads (file_id, user_id, file_name, disk_path, parsed_json)
     VALUES (?,?,?,?,?)
     ON DUPLICATE KEY UPDATE file_name = VALUES(file_name), disk_path = VALUES(disk_path), parsed_json = VALUES(parsed_json)`,
    [fileId, userId, payload.fileName, payload.storedPath, JSON.stringify(payload.parsed || null)],
  )
}

async function loadUploadCache(fileId, userId) {
  const row = await queryOne('SELECT * FROM uploads WHERE file_id = ? AND user_id = ?', [fileId, userId])
  if (!row) throw fail('REPORT_NOT_FOUND', '上传文件不存在或已过期', 404)
  return {
    fileId: row.file_id,
    fileName: decodeUploadFileName(row.file_name || ''),
    storedPath: row.disk_path,
    parsed: asJson(row.parsed_json),
    userId: row.user_id,
  }
}

async function saveCharts(reportId, charts) {
  await query('UPDATE reports SET charts_json = ? WHERE report_id = ?', [JSON.stringify(charts), reportId])
}

async function loadCharts(reportId, userId) {
  const report = await getReport(reportId, userId)
  return report.charts || null
}

module.exports = {
  getReport,
  getLatest,
  upsertReport,
  createDraft,
  patchContent,
  saveUploadCache,
  loadUploadCache,
  saveCharts,
  loadCharts,
}
