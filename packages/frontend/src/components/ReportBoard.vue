<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import {
  ElMessage,
  ElSkeleton,
  ElButton,
  ElDropdown,
  ElDropdownMenu,
  ElDropdownItem,
  ElIcon,
  ElTag,
} from 'element-plus'
import { ArrowDown, ArrowUp, Check, EditPen, Rank } from '@element-plus/icons-vue'
import { marked } from 'marked'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { storeToRefs } from 'pinia'
import { useReportStore } from '../stores/report'
import ChartCard from './ChartCard.vue'
import RevealBtn from './RevealBtn.vue'

const reportStore = useReportStore()
const { reportData, chartsLoading, hasData, content, benchmarkMissing, reportStreaming } =
  storeToRefs(reportStore)

const PRIMARY = '#2dd4bf'
const AXIS_TEXT = '#a8bcb5'
const SPLIT_LINE = 'rgba(255, 255, 255, 0.07)'
const AXIS_LINE = 'rgba(255, 255, 255, 0.12)'
const grid = { left: 48, right: 16, top: 36, bottom: 28 }


const CHART_KEYS = ['trend', 'bar', 'pie', 'benchmark']
const CHART_META = {
  trend: { title: '近 12 个月碳排放趋势' },
  bar: { title: '月度排放量对比' },
  pie: { title: '用电构成碳足迹占比' },
  benchmark: { title: '单位增加值碳强度 vs 行业基准' },
}

function loadChartOrder() {
  try {
    const raw = JSON.parse(localStorage.getItem('chart-order') || '')
    if (Array.isArray(raw)) {
      const valid = raw.filter((k) => CHART_KEYS.includes(k))
      if (valid.length === CHART_KEYS.length) return valid
    }
  } catch {

  }
  return [...CHART_KEYS]
}

const order = ref(loadChartOrder())
const gripDown = ref(false)
const dragKey = ref('')
const overKey = ref('')
const droppedKey = ref('')
let dropTimer = null

function onGripDown() {
  gripDown.value = true
}
function onGripUp() {
  gripDown.value = false
}
function onDragStart(k) {
  dragKey.value = k
}
function onDragOver(k) {
  if (k !== dragKey.value) overKey.value = k
}
function onDragEnd() {
  gripDown.value = false
  dragKey.value = ''
  overKey.value = ''
}
function onDrop(k) {
  const key = dragKey.value
  const from = order.value.indexOf(key)
  const to = order.value.indexOf(k)
  onDragEnd()
  if (!key || from === -1 || to === -1 || from === to) return
  const next = [...order.value]
  next.splice(from, 1)
  next.splice(to, 0, key)
  order.value = next
  try {
    localStorage.setItem('chart-order', JSON.stringify(next))
  } catch {

  }
  droppedKey.value = k
  clearTimeout(dropTimer)
  dropTimer = setTimeout(() => (droppedKey.value = ''), 450)
}

function tooltipOf(trigger) {
  return {
    trigger,
    backgroundColor: 'rgba(13, 19, 18, 0.95)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
    textStyle: { color: '#d8e6e2', fontSize: 12 },
    extraCssText: 'border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.4);',
  }
}

function cellText(cell) {
  return (cell.textContent || '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()
}

function tableToGfm(table) {
  const rows = [...table.querySelectorAll('tr')]
  if (!rows.length) return ''
  const matrix = rows.map((tr) => [...tr.querySelectorAll('th,td')].map(cellText))
  const width = Math.max(1, ...matrix.map((r) => r.length))
  const padded = matrix.map((row) => {
    const next = [...row]
    while (next.length < width) next.push('')
    return next
  })
  const header = padded[0]
  const sep = header.map(() => '---')
  const lines = [
    `| ${header.join(' | ')} |`,
    `| ${sep.join(' | ')} |`,
    ...padded.slice(1).map((row) => `| ${row.join(' | ')} |`),
  ]
  return `\n\n${lines.join('\n')}\n\n`
}

function normalizeEditableHtml(html) {
  const box = document.createElement('div')
  box.innerHTML = html
  ;[...box.querySelectorAll('span')].forEach((el) => {
    el.replaceWith(...el.childNodes)
  })
  ;[...box.querySelectorAll('div')].forEach((el) => {
    if (el.closest('table')) return
    const p = document.createElement('p')
    p.innerHTML = el.innerHTML
    el.replaceWith(p)
  })
  ;[...box.querySelectorAll('b')].forEach((el) => {
    const strong = document.createElement('strong')
    strong.innerHTML = el.innerHTML
    el.replaceWith(strong)
  })
  return box
}

const toMarkdown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
toMarkdown.use(gfm)
toMarkdown.addRule('pipeTable', {
  filter: 'table',
  replacement(_content, node) {
    return tableToGfm(node)
  },
})

function htmlToMarkdown(html) {
  const root = normalizeEditableHtml(html)
  return toMarkdown.turndown(root).trim()
}

function axisOf(categoryData) {
  return {
    xAxis: {
      type: 'category',
      data: categoryData,
      axisLabel: { fontSize: 10, color: AXIS_TEXT },
      axisLine: { lineStyle: { color: AXIS_LINE } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 10, color: AXIS_TEXT },
      axisLine: { show: false },
      splitLine: { lineStyle: { type: 'dashed', color: SPLIT_LINE } },
    },
  }
}

function optionOf(kind) {
  const charts = reportData.value?.charts
  if (!charts) return null
  const tooltip = tooltipOf('axis')
  if (kind === 'trend') {
    return {
      color: [PRIMARY],
      tooltip,
      legend: { show: false },
      grid,
      ...axisOf(charts.trendLine.xAxis),
      yAxis: {
        type: 'value',
        name: 'tCO2e',
        nameTextStyle: { fontSize: 10, color: AXIS_TEXT },
        axisLabel: { fontSize: 10, color: AXIS_TEXT },
        axisLine: { show: false },
        splitLine: { lineStyle: { type: 'dashed', color: SPLIT_LINE } },
      },
      series: charts.trendLine.series.map((s) => ({
        name: s.name,
        type: 'line',
        smooth: true,
        showSymbol: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 2.5 },
        data: s.data,

        emphasis: {
          focus: 'series',
          scale: 2.4,
          itemStyle: {
            borderWidth: 2,
            borderColor: 'rgba(255, 255, 255, 0.85)',
            shadowBlur: 16,
            shadowColor: 'rgba(45, 212, 191, 0.5)',
          },
          lineStyle: { width: 3.5 },
        },
      })),
    }
  }
  if (kind === 'bar') {
    return {
      color: [PRIMARY],
      tooltip,
      legend: { show: false },
      grid,
      ...axisOf(charts.bar.xAxis),
      series: [
        {
          name: charts.bar.series[0]?.name,
          type: 'bar',
          data: charts.bar.series[0]?.data,
          itemStyle: { borderRadius: [4, 4, 0, 0] },

          emphasis: {
            focus: 'self',
            itemStyle: {
              shadowBlur: 22,
              shadowColor: 'rgba(45, 212, 191, 0.45)',
              color: '#5eead4',
            },
          },
          blur: { itemStyle: { opacity: 0.35 } },
        },
      ],
    }
  }
  if (kind === 'pie') {
    return {
      color: ['#2dd4bf', '#5eead4', '#7dd3fc', '#8b9fb0'],
      tooltip: tooltipOf('item'),
      legend: {
        orient: 'vertical',
        right: 8,
        top: 'middle',
        textStyle: { fontSize: 11, color: AXIS_TEXT },
      },
      series: [
        {
          type: 'pie',
          radius: ['42%', '68%'],
          center: ['40%', '50%'],
          data: charts.pie.series[0]?.data || [],
          label: { fontSize: 11, color: '#c9dbd6' },
          labelLine: { lineStyle: { color: 'rgba(255, 255, 255, 0.28)' } },
          itemStyle: { borderColor: 'rgba(10, 15, 14, 0.9)', borderWidth: 2 },

          emphasis: {
            scale: true,
            scaleSize: 14,
            label: { fontSize: 13, fontWeight: 700, color: '#ffffff' },
            itemStyle: { shadowBlur: 28, shadowColor: 'rgba(0, 0, 0, 0.55)' },
          },
        },
      ],
    }
  }
  const showBench = !benchmarkMissing.value
  const benchVal = reportData.value?.calculation?.intensityBenchmark?.value
  return {
    color: [PRIMARY, '#7dd3fc'],
    tooltip,
    legend: {
      bottom: 0,
      textStyle: { fontSize: 11, color: AXIS_TEXT },
      data: showBench ? ['企业碳强度', '行业基准'] : ['企业碳强度'],
    },
    grid,
    ...axisOf(charts.benchmarkLine.xAxis),
    yAxis: {
      type: 'value',
      name: 'tCO2e/万元',
      nameTextStyle: { fontSize: 10, color: AXIS_TEXT },
      axisLabel: { fontSize: 10, color: AXIS_TEXT },
      axisLine: { show: false },
      splitLine: { lineStyle: { type: 'dashed', color: SPLIT_LINE } },
    },
    series: charts.benchmarkLine.series
      .filter((s) => showBench || s.name !== '行业基准')
      .map((s) => {
        const isBench = s.name === '行业基准'
        return {
          name: s.name,
          type: 'line',
          smooth: !isBench,
          showSymbol: true,
          symbol: 'circle',
          symbolSize: isBench ? 6 : 8,
          data: s.data,
          itemStyle: isBench ? { color: '#7dd3fc' } : { color: PRIMARY },
          lineStyle: isBench
            ? { type: 'dashed', width: 2, color: '#7dd3fc' }
            : { width: 2.5, color: PRIMARY },
          emphasis: {
            focus: 'series',
            scale: 2.4,
            itemStyle: {
              borderWidth: 2,
              borderColor: 'rgba(255, 255, 255, 0.85)',
              shadowBlur: 16,
              shadowColor: isBench ? 'rgba(125, 211, 252, 0.45)' : 'rgba(45, 212, 191, 0.5)',
            },
            lineStyle: { width: isBench ? 3 : 3.5 },
          },
          endLabel: isBench && Number.isFinite(Number(benchVal))
            ? {
                show: true,
                formatter: () => String(benchVal),
                color: AXIS_TEXT,
                fontSize: 11,
              }
            : undefined,
        }
      }),
  }
}

const editor = ref(null)
const preview = ref(null)
const editing = ref(false)
const reportExpanded = ref(false)
const showSource = computed(() => reportStreaming.value)
const previewHtml = computed(() => {
  const raw = (content.value || '').trim()
  if (!raw) return ''
  return marked.parse(raw, { async: false, gfm: true, breaks: true })
})

function paintEditor() {
  if (!showSource.value) return
  const el = editor.value
  if (!el) return
  const next = `${content.value || ''}▍`
  if (el.value !== next) {
    el.value = next
    el.scrollTop = el.scrollHeight
  }
}

async function startEdit() {
  if (reportStreaming.value || !hasData.value) return
  editing.value = true
  await nextTick()
  preview.value?.focus()
}

watch(reportStreaming, (on) => {
  if (on) editing.value = false
})
watch([content, reportStreaming, showSource], paintEditor, { flush: 'sync' })
watch(
  [previewHtml, editing, showSource],
  async () => {
    if (showSource.value || editing.value) return
    await nextTick()
    if (preview.value) {
      preview.value.innerHTML = previewHtml.value || '报告生成后将显示于此，可直接编辑…'
    }
  },
  { flush: 'post', immediate: true },
)
onMounted(paintEditor)

async function onSave() {
  try {
    if (editing.value && preview.value) {
      content.value = htmlToMarkdown(preview.value.innerHTML || '')
    }
    await reportStore.saveContent()
    editing.value = false
    ElMessage.success('报告修改已保存')
  } catch (err) {
    ElMessage.error(err.message || '保存失败')
  }
}

async function onExport(command) {
  if (!hasData.value) {
    ElMessage.warning('请先上传用电明细并生成报告')
    return
  }
  try {
    await reportStore.downloadExport(String(command))
  } catch (err) {
    ElMessage.error(err.message || '导出失败')
  }
}
</script>

<template>
  <section class="board glass-panel" :class="{ 'report-full': reportExpanded }">
    <header>
      <div>
        <h1>碳账户数据看板</h1>
        <p v-if="reportData">报告 {{ reportData.reportId }} · v{{ reportData.version || 1 }}</p>
      </div>
      <el-tag v-if="benchmarkMissing && hasData" type="warning" size="small">行业强度基准待配置</el-tag>
    </header>

    <div v-if="!hasData && !chartsLoading" class="empty">
      <div aria-hidden="true">📊</div>
      <p>暂无数据</p>
      <span>请在中间区上传《企业用电明细.xlsx》以生成图表与报告</span>
    </div>

    <div v-else class="grid">
      <template v-if="chartsLoading && !reportData?.charts">
        <el-skeleton v-for="i in 4" :key="i" animated class="sk" />
      </template>
      <template v-else>
        <div
          v-for="k in order"
          :key="k"
          class="chart-slot"
          :class="{ dragging: dragKey === k, over: overKey === k, dropped: droppedKey === k }"
          :draggable="gripDown"
          @dragstart="onDragStart(k)"
          @dragover.prevent="onDragOver(k)"
          @dragend="onDragEnd"
          @drop="onDrop(k)"
        >
          <button
            class="grip"
            type="button"
            title="拖动调整图表位置"
            aria-label="拖动调整图表位置"
            @mousedown="onGripDown"
            @mouseup="onGripUp"
            @mouseleave="onGripUp"
          >
            <el-icon><Rank /></el-icon>
          </button>
          <ChartCard :title="CHART_META[k].title" :option="optionOf(k)" />
        </div>
      </template>
    </div>

    <div class="report" :class="{ collapsed: !reportExpanded }">
      <div class="notepad">
        <span class="ico" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M3 2h7l3 3v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"
              stroke="currentColor"
              stroke-width="1.2"
            />
            <path d="M10 2v3h3" stroke="currentColor" stroke-width="1.2" />
            <path d="M5 8h6M5 11h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
          </svg>
        </span>
        <span
          class="status"
          :class="{
            ready: hasData && !reportStreaming,
            streaming: reportStreaming,
            idle: !hasData && !reportStreaming,
          }"
          :title="reportStreaming ? '生成中' : hasData ? '已生成' : '待生成'"
          aria-hidden="true"
        />
        <span class="ntitle">碳足迹总结报告.md</span>
        <el-button
          class="expand"
          :icon="reportExpanded ? ArrowDown : ArrowUp"
          circle
          size="small"
          text
          :aria-label="reportExpanded ? '收起报告' : '展开报告'"
          :title="reportExpanded ? '收起报告' : '展开报告覆盖图表'"
          @click="reportExpanded = !reportExpanded"
        />
      </div>
      <textarea
        v-show="showSource"
        ref="editor"
        class="md"
        placeholder="报告生成后将显示于此，可直接编辑…"
        readonly
      />
      <div
        v-show="!showSource"
        ref="preview"
        class="md md-preview"
        :class="{ empty: !previewHtml, editing }"
        :contenteditable="editing ? 'true' : 'false'"
      />
      <div class="actions">
        <el-dropdown
          trigger="click"
          placement="top-start"
          teleported
          popper-class="report-export-dropdown"
          @command="onExport"
        >
          <el-button size="small" :class="{ muted: !hasData }">
            导出
            <el-icon class="caret"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="markdown" :disabled="!hasData">Markdown</el-dropdown-item>
              <el-dropdown-item command="word" :disabled="!hasData">Word</el-dropdown-item>
              <el-dropdown-item command="pdf" :disabled="!hasData">PDF</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <div class="edit-save">
          <RevealBtn :icon="EditPen" label="编辑" :disabled="!hasData || reportStreaming" @click="startEdit" />
          <RevealBtn
            :icon="Check"
            label="保存修改"
            type="primary"
            :disabled="!hasData || reportStreaming"
            @click="onSave"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.board {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  padding: 18px 18px 16px;
  margin: 12px 0 12px 12px;
  border-radius: var(--radius-md);
}
header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}
h1 {
  margin: 0;
  font-size: 19px;
  font-weight: 750;
  letter-spacing: -0.02em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}
header p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 12px;
  flex: 7 1 0;
  min-height: 0;
}

.chart-slot {
  position: relative;
  min-width: 0;
  min-height: 0;
  border-radius: var(--radius-sm);
  transition:
    opacity 0.25s ease,
    background-color 0.25s ease,
    box-shadow 0.25s ease;
}
.chart-slot :deep(.chart-card) {
  height: 100%;
}
.chart-slot :deep(h3) {
  padding-right: 34px;
}
.chart-slot.dragging {
  opacity: 0.35;
}
.chart-slot.over {
  background: rgba(45, 212, 191, 0.06);
  box-shadow: inset 0 0 0 1.5px rgba(45, 212, 191, 0.55);
}
.chart-slot.dropped {
  animation: pop-in 0.45s var(--ease-spring);
}
.grip {
  position: absolute;
  top: 4px;
  right: 6px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-muted);
  cursor: grab;
  opacity: 0;
  transition:
    opacity 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease,
    transform 0.3s var(--ease-spring-soft);
}
.chart-slot:hover .grip {
  opacity: 1;
}
.grip:hover {
  background: rgba(255, 255, 255, 0.13);
  color: var(--text-primary);
  transform: scale(1.1);
}
.grip:active {
  cursor: grabbing;
  transform: scale(0.92);
}
.sk {
  height: 200px;
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.03);
}
.empty {
  flex: 7 1 0;
  min-height: 0;
  border: 1px dashed rgba(255, 255, 255, 0.16);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.02);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  text-align: center;
  gap: 6px;
}
.empty div {
  font-size: 40px;
  opacity: 0.6;
}
.report {
  background: rgba(15, 22, 20, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-soft), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  flex: 3 1 0;
  min-height: 0;
  overflow: hidden;
}
.notepad {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 10px 0;
  padding: 7px 12px;
  min-height: 36px;
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
  background: rgba(10, 16, 14, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}
.ico {
  display: flex;
  color: var(--primary);
  flex-shrink: 0;
}
.status {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  background: rgba(148, 163, 184, 0.55);
  box-shadow: 0 0 0 2px rgba(148, 163, 184, 0.12);
}
.status.ready {
  background: var(--primary);
  box-shadow: 0 0 0 2px rgba(45, 212, 191, 0.2), 0 0 8px rgba(45, 212, 191, 0.45);
}
.status.streaming {
  background: #7dd3fc;
  box-shadow: 0 0 0 2px rgba(125, 211, 252, 0.2);
  animation: status-pulse 1.2s ease-in-out infinite;
}
@keyframes status-pulse {
  50% {
    opacity: 0.45;
  }
}
.ntitle {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.expand {
  margin-left: auto;
  flex-shrink: 0;
  color: var(--primary-hover);
}
.board.report-full .grid,
.board.report-full .empty {
  display: none;
}
.board.report-full .report {

  flex: 1 1 0;
  min-height: 0;
}
.md {
  flex: 1 1 0;
  min-height: 0;
  border: none;
  resize: none;
  padding: 14px 16px;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.75;
  outline: none;
  overflow: auto;
}
.md-preview {
  color: var(--text-primary);
}
.md-preview.empty {
  color: var(--text-muted);
}
.md-preview.editing {
  outline: 1px solid var(--primary);
  outline-offset: -1px;
  cursor: text;
}
.md-preview :deep(h1),
.md-preview :deep(h2),
.md-preview :deep(h3) {
  margin: 0 0 8px;
  font-weight: 700;
  line-height: 1.4;
}
.md-preview :deep(h1) {
  font-size: 18px;
}
.md-preview :deep(h2) {
  font-size: 15px;
  margin-top: 14px;
}
.md-preview :deep(h3) {
  font-size: 14px;
  margin-top: 12px;
}
.md-preview :deep(p) {
  margin: 0 0 10px;
}
.md-preview :deep(ul),
.md-preview :deep(ol) {
  margin: 0 0 10px;
  padding-left: 1.4em;
}
.md-preview :deep(li) {
  margin: 0 0 5px;
}
.md-preview :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 10px;
  font-size: 12px;
}
.md-preview :deep(th),
.md-preview :deep(td) {
  border: 1px solid var(--border);
  padding: 4px 8px;
  text-align: left;
}
.md-preview :deep(code) {
  font-size: 12px;
  background: rgba(45, 212, 191, 0.1);
  color: var(--primary-hover);
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid rgba(45, 212, 191, 0.18);
}
.md-preview :deep(pre) {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(8, 14, 12, 0.65);
  border: 1px solid var(--chart-sub-border);
  overflow-x: auto;
}
.md-preview :deep(pre code) {
  background: transparent;
  border: none;
  padding: 0;
  color: var(--text-secondary);
}
.md-preview :deep(strong) {
  color: #e2f8f3;
  font-weight: 650;
}
.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.03);
  flex-shrink: 0;
  margin-top: auto;
}
.edit-save {
  display: flex;
  gap: 8px;
  align-items: center;
}
.caret {
  margin-left: 4px;
}
.muted:not(:hover) {
  opacity: 0.65;
}
</style>
