<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  title: { type: String, required: true },
  option: { type: Object, default: null },
})

const canvas = ref(null)
let instance = null
let grownBar = null

function restoreBar() {
  if (!grownBar) return
  const el = grownBar
  grownBar = null
  el.stopAnimation?.()
  el.animateTo({ scaleX: 1, scaleY: 1 }, { duration: 150, easing: 'cubicOut' })
}

function onBarOver(params) {
  restoreBar()
  if (params.componentType !== 'series' || params.seriesType !== 'bar') return
  const seriesModel = instance?.getModel()?.getSeriesByIndex(params.seriesIndex)
  const el = seriesModel?.getData()?.getItemGraphicEl(params.dataIndex)
  if (!el?.shape) return
  const { x, y, width, height } = el.shape
  el.attr({
    originX: x + width / 2,
    originY: y + height,
  })
  el.stopAnimation?.()
  el.animateTo({ scaleX: 1.22, scaleY: 1.12 }, { duration: 180, easing: 'cubicOut' })
  grownBar = el
}

function bindBarHoverScale() {
  if (!instance) return
  instance.off('mouseover', onBarOver)
  instance.off('mouseout', restoreBar)
  instance.off('globalout', restoreBar)
  instance.on('mouseover', onBarOver)
  instance.on('mouseout', restoreBar)
  instance.on('globalout', restoreBar)
}

function draw() {
  if (!canvas.value || !props.option) return
  restoreBar()
  if (!instance) instance = echarts.init(canvas.value)
  instance.setOption(props.option, true)
  bindBarHoverScale()
}

function resize() {
  instance?.resize()
}

watch(() => props.option, draw, { deep: true })
onMounted(() => {
  draw()
  window.addEventListener('resize', resize)
})
onUnmounted(() => {
  window.removeEventListener('resize', resize)
  restoreBar()
  instance?.dispose()
  instance = null
})
</script>

<template>
  <article class="chart-card">
    <h3>
      <i class="accent" aria-hidden="true" />
      <span>{{ title }}</span>
    </h3>
    <div ref="canvas" class="plot" />
  </article>
</template>

<style scoped>
.chart-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  padding: 8px 8px 6px;
  border-radius: var(--radius-sm);
  background: var(--chart-sub-bg);
  border: 1px solid var(--chart-sub-border);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  animation: chart-in 0.6s var(--ease-liquid) both;
}
.chart-card:nth-child(2) {
  animation-delay: 0.06s;
}
.chart-card:nth-child(3) {
  animation-delay: 0.12s;
}
.chart-card:nth-child(4) {
  animation-delay: 0.18s;
}
h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 11.5px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: var(--text-chart);
  padding: 2px 6px 4px;
  text-shadow: none;
  transition: color 0.2s ease;
}
.accent {
  flex-shrink: 0;
  width: 2px;
  height: 12px;
  border-radius: 1px;
  background: linear-gradient(180deg, var(--primary-hover), var(--primary));
  box-shadow: 0 0 8px rgba(45, 212, 191, 0.35);
}
.chart-card:hover h3 {
  color: var(--text-secondary);
}
.plot {
  flex: 1;
  min-height: 150px;
}
</style>
