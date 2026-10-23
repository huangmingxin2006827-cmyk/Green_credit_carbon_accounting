import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  exportUrl,
  generateReport,
  getCharts,
  getLatestReport,
  getLatestSuggestions,
  getReport,
  patchReport,
  suggestionAction,
  uploadFile,
} from '../api/http'
import { getToken, loadAuth } from '../utils/auth'
import { decodeUploadFileName } from '../utils/fileName'
import { useTaskStore } from './task'

const HIDDEN_REPORT_KEY = 'carbon_hidden_report'

function currentUserId() {
  const id = loadAuth()?.user?.id
  return id == null ? '' : String(id)
}

function readHiddenMap() {
  try {
    const raw = JSON.parse(localStorage.getItem(HIDDEN_REPORT_KEY) || '{}')
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

function hiddenReportId() {
  const uid = currentUserId()
  if (!uid) return ''
  return String(readHiddenMap()[uid] || '')
}

function rememberHiddenReport(reportId) {
  const uid = currentUserId()
  if (!uid) return
  const all = readHiddenMap()
  if (reportId) all[uid] = reportId
  else delete all[uid]
  localStorage.setItem(HIDDEN_REPORT_KEY, JSON.stringify(all))
}

export const useReportStore = defineStore('report', () => {
  let viewEpoch = 0
  const reportData = ref(null)
  const charts = ref(null)
  const suggestions = ref([])
  const uploadedFileName = ref('')
  const fileId = ref('')
  const chartsLoading = ref(false)
  const reportStreaming = ref(false)
  const content = ref('')

  const reportId = computed(() => reportData.value?.reportId || '')
  const hasData = computed(() => Boolean(reportData.value))

  const benchmarkMissing = computed(() => {
    const series = reportData.value?.charts?.benchmarkLine?.series || []
    const bench = series.find((s) => s.name === '行业基准')
    if (bench?.data?.length) return false
    const calc = reportData.value?.calculation
    return !calc?.intensityBenchmark?.value
  })
  const visibleSuggestions = computed(() =>
    suggestions.value.filter((s) => s.status !== 'rejected'),
  )

  function resetLocal() {
    reportData.value = null
    charts.value = null
    suggestions.value = []
    uploadedFileName.value = ''
    fileId.value = ''
    content.value = ''
    chartsLoading.value = false
    reportStreaming.value = false
  }

  async function hydrate() {
    const latest = await getLatestReport()
    if (!latest?.reportId || latest.reportId === hiddenReportId()) {
      resetLocal()
      return
    }
    content.value = latest.content || ''
    uploadedFileName.value = decodeUploadFileName(latest.fileName || '')
    fileId.value = latest.fileId || ''
    try {
      await attachCharts(latest.reportId)
    } catch {
      reportData.value = latest
      charts.value = latest.charts || null
    }
    const latestSug = await getLatestSuggestions()
    if (latestSug?.reportId === latest.reportId) {
      suggestions.value = (latestSug.suggestions || []).map((s) => ({
        ...s,
        collapsed: Boolean(s.status && s.status !== 'pending'),
        detailStreaming: false,
      }))
    }
  }

  async function attachCharts(id) {
    const [detail, chartData] = await Promise.all([getReport(id), getCharts(id)])
    reportData.value = { ...detail, charts: chartData, content: content.value || detail.content }
    charts.value = chartData
    chartsLoading.value = false
  }

  async function waitForSuggestions(id, token) {
    for (let i = 0; i < 40; i += 1) {
      if (token != null && token !== viewEpoch) return
      const latestSug = await getLatestSuggestions()
      const list = latestSug?.suggestions || []
      if (latestSug?.reportId === id && list.length) {
        const prevById = new Map((suggestions.value || []).map((s) => [s.suggestionId, s]))
        suggestions.value = list.map((s) => {
          const prev = prevById.get(s.suggestionId)
          const status = prev?.status && prev.status !== 'pending' ? prev.status : s.status
          const detail = prev?.status === 'edited' && prev.detail ? prev.detail : s.detail
          return {
            ...s,
            status,
            detail,
            collapsed: Boolean(status && status !== 'pending'),
            detailStreaming: false,
          }
        })
        return
      }
      await new Promise((r) => setTimeout(r, 1500))
    }
  }

  function dismissCurrent() {
    viewEpoch += 1
    const id = reportId.value
    if (id) rememberHiddenReport(id)
    resetLocal()
  }

  async function uploadExcel(file) {
    const token = ++viewEpoch
    rememberHiddenReport('')
    chartsLoading.value = true
    try {
      const data = await uploadFile(file)
      fileId.value = data.fileId
      uploadedFileName.value = decodeUploadFileName(data.fileName || file.name || '')
      reportStreaming.value = true
      content.value = ''
      suggestions.value = []
      await generateReport(
        { fileId: data.fileId, stream: true },
        {
          onReady: async (payload) => {
            if (token !== viewEpoch) return
            if (payload?.reportId) {
              reportData.value = {
                ...(reportData.value || {}),
                reportId: payload.reportId,
                version: 1,
                confirmed: true,
              }
              try {
                await attachCharts(payload.reportId)
              } catch {

              }
              waitForSuggestions(payload.reportId, token).catch(() => {})
            }
          },
          onText(_chunk, full) {
            if (token !== viewEpoch) return
            content.value = full
          },
          onDone(payload) {
            if (token !== viewEpoch) return
            if (payload?.reportId) {
              reportData.value = {
                ...(reportData.value || {}),
                reportId: payload.reportId,
                version: 1,
                confirmed: true,
                content: content.value,
              }
            }
          },
        },
      )
      if (token !== viewEpoch) return
      const id = reportData.value?.reportId
      if (id) {
        if (!charts.value) await attachCharts(id)
        if (!content.value) {
          const detail = await getReport(id)
          if (detail?.content) content.value = detail.content
        }
        waitForSuggestions(id, token).catch(() => {})
      }
    } finally {
      if (token === viewEpoch) {
        reportStreaming.value = false
        chartsLoading.value = false
      }
    }
  }

  function clearUploadedFile() {
    uploadedFileName.value = ''
    fileId.value = ''
  }

  async function saveContent() {
    if (!reportId.value) return
    await patchReport(reportId.value, content.value)
  }

  async function acceptSuggestion(s) {
    const tasks = useTaskStore()
    s.status = 'accepted'
    s.collapsed = true
    const due = new Date()
    due.setMonth(due.getMonth() + 3)
    const tempId = `tmp_${s.suggestionId}_${Date.now()}`
    tasks.prepend({
      taskId: tempId,
      reportId: s.reportId,
      suggestionId: s.suggestionId,
      title: `审批任务：${s.title}`,
      source: '减排建议采纳',
      priority: '中',
      suggestedDueDate: due.toISOString().slice(0, 10),
      detail: s.detail || '',
      checklist: ['现场评估', '方案编制', '立项审批', '实施验收'],
      checklistDone: [false, false, false, false],
      approvalFlow: ['支行客户经理发起', '绿色金融部审核', '分行风控复核', '分管行长终审'],
      status: 'inProgress',
      createdAt: new Date().toISOString(),
    })
    try {
      const data = await suggestionAction(s.suggestionId, 'accept')
      s.status = data.suggestion?.status || 'accepted'
      tasks.replaceTask(tempId, data.task)
    } catch (err) {
      tasks.replaceTask(tempId, null)
      s.status = 'pending'
      s.collapsed = false
      throw err
    }
  }

  async function saveSuggestionEdit(s, detail) {
    const tasks = useTaskStore()
    const text = String(detail || '').trim()
    if (!text) throw new Error('请填写建议内容')
    const due = new Date()
    due.setMonth(due.getMonth() + 3)
    const tempId = `tmp_${s.suggestionId}_${Date.now()}`
    tasks.prepend({
      taskId: tempId,
      reportId: s.reportId,
      suggestionId: s.suggestionId,
      title: `审批任务：${s.title}`,
      source: '减排建议修改',
      priority: '中',
      suggestedDueDate: due.toISOString().slice(0, 10),
      detail: text,
      checklist: ['现场评估', '方案编制', '立项审批', '实施验收'],
      checklistDone: [false, false, false, false],
      approvalFlow: ['支行客户经理发起', '绿色金融部审核', '分行风控复核', '分管行长终审'],
      status: 'inProgress',
      createdAt: new Date().toISOString(),
    })
    try {
      const data = await suggestionAction(s.suggestionId, 'edit', text)
      s.detail = data.suggestion?.detail || text
      s.status = data.suggestion?.status || 'edited'
      s.collapsed = true
      tasks.replaceTask(tempId, data.task)
      return data
    } catch (err) {
      tasks.replaceTask(tempId, null)
      throw err
    }
  }

  async function discardSuggestion(s) {
    await suggestionAction(s.suggestionId, 'reject')
    s.status = 'rejected'
    s.collapsed = true
  }

  async function downloadExport(format) {
    if (!reportId.value) return
    const key = String(format)
    const presets = {
      markdown: {
        name: '碳足迹总结报告.md',
        types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }],
      },
      md: {
        name: '碳足迹总结报告.md',
        types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }],
      },
      word: {
        name: '碳足迹总结报告.docx',
        types: [
          {
            description: 'Word 文档',
            accept: {
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            },
          },
        ],
      },
      docx: {
        name: '碳足迹总结报告.docx',
        types: [
          {
            description: 'Word 文档',
            accept: {
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            },
          },
        ],
      },
      pdf: {
        name: '碳足迹总结报告.pdf',
        types: [{ description: 'PDF', accept: { 'application/pdf': ['.pdf'] } }],
      },
    }
    const preset = presets[key] || { name: '碳足迹总结报告', types: [] }

    const res = await fetch(exportUrl(reportId.value, format), {
      headers: {
        Authorization: getToken() ? `Bearer ${getToken()}` : '',
      },
    })
    if (!res.ok) {
      throw new Error('导出失败')
    }
    const blob = await res.blob()

    if (typeof window.showSaveFilePicker === 'function') {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: preset.name,
          types: preset.types.length ? preset.types : undefined,
        })
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
        return
      } catch (err) {
        if (err?.name === 'AbortError') return

      }
    }

    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = preset.name
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return {
    reportData,
    charts,
    suggestions,
    uploadedFileName,
    fileId,
    chartsLoading,
    reportStreaming,
    content,
    reportId,
    hasData,
    benchmarkMissing,
    visibleSuggestions,
    uploadExcel,
    hydrate,
    resetLocal,
    dismissCurrent,
    clearUploadedFile,
    saveContent,
    acceptSuggestion,
    saveSuggestionEdit,
    discardSuggestion,
    downloadExport,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useReportStore, import.meta.hot))
}
