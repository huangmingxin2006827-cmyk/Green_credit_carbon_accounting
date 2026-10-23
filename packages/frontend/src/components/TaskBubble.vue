<script setup>
import { onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElTag, ElCheckbox, ElCollapse, ElCollapseItem, ElButton, ElMessage } from 'element-plus'
import { Check, Close, Delete } from '@element-plus/icons-vue'
import RevealBtn from './RevealBtn.vue'
import { deleteTask } from '../api/http'
import { useTaskStore } from '../stores/task'

const taskStore = useTaskStore()
const { taskList, bubbleVisible } = storeToRefs(taskStore)
const pop = ref(false)
const expanded = ref([])

watch(bubbleVisible, (open) => {
  if (open) pop.value = true
  else pop.value = false
})
onMounted(() => {
  if (bubbleVisible.value) pop.value = true
  taskStore.refresh().catch(() => {})
})

const labels = { pending: '待采纳', inProgress: '执行中', done: '已完成' }
const types = { pending: 'info', inProgress: 'warning', done: 'success' }

async function onRemove(task) {
  const id = task.taskId
  const prev = [...taskList.value]
  taskList.value = prev.filter((t) => t.taskId !== id)
  if (!taskList.value.length) bubbleVisible.value = false
  try {
    if (!String(id).startsWith('tmp_')) await deleteTask(id)
  } catch (err) {
    if (err?.code === 'REPORT_NOT_FOUND' || /不存在/.test(err?.message || '')) return
    taskList.value = prev
    bubbleVisible.value = true
    ElMessage.error(err.message || '删除失败')
  }
}
</script>

<template>
  <Transition name="pop">
    <aside v-if="bubbleVisible && taskList.length" class="anchor" aria-label="任务待办">
      <div class="bubble" :class="{ open: pop }">
        <header>
          <h2>任务待办</h2>
          <el-tag size="small" type="info">{{ taskList.length }}</el-tag>
          <el-button
            class="x"
            :icon="Close"
            circle
            size="small"
            text
            aria-label="关闭"
            @click.stop="taskStore.closeBubble()"
          />
        </header>
        <div class="list">
          <div v-for="task in taskList" :key="task.taskId" class="card" :class="{ done: task.status === 'done' }">
            <div class="top">
              <h3>{{ task.title }}</h3>
              <el-tag size="small" :type="types[task.status] || 'info'">
                {{ labels[task.status] || task.status }}
              </el-tag>
            </div>
            <div class="meta">
              <span>优先级：{{ task.priority }}</span>
              <span>到期：{{ task.suggestedDueDate }}</span>
            </div>
            <div class="status-row">
              <RevealBtn
                v-if="task.status !== 'done'"
                class="act"
                :icon="Check"
                label="标记完成"
                text
                @click.stop="taskStore.setStatus(task.taskId, 'done')"
              />
              <RevealBtn v-else class="act del" :icon="Delete" label="删除" text @click.stop="onRemove(task)" />
            </div>
            <el-collapse v-model="expanded">
              <el-collapse-item
                v-if="task.detail"
                :name="`${task.taskId}-detail`"
                title="建议详情"
              >
                <p class="detail">{{ task.detail }}</p>
              </el-collapse-item>
              <el-collapse-item :name="task.taskId" title="执行清单">
                <div v-for="(item, idx) in task.checklist" :key="idx">
                  <el-checkbox
                    :model-value="task.checklistDone?.[idx]"
                    :disabled="task.status === 'done'"
                    @change="(v) => taskStore.toggleChecklist(task.taskId, idx, v)"
                  >
                    {{ item }}
                  </el-checkbox>
                </div>
              </el-collapse-item>
            </el-collapse>
            <div class="flow">
              <div>建议审批流程（仅供参考）</div>
              <ol>
                <li v-for="(step, i) in task.approvalFlow" :key="i">{{ step }}</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
.anchor {
  position: fixed;
  top: 0;
  right: 0;
  z-index: 4000;
  padding: 14px 14px 0 0;
}
.bubble {
  pointer-events: auto;
  width: min(320px, calc(100vw - 28px));
  display: flex;
  flex-direction: column;
  background: linear-gradient(170deg, rgba(34, 46, 43, 0.92) 0%, rgba(18, 26, 24, 0.9) 100%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 50%;
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.07);
  overflow: hidden;
  transform: scale(0.15);
  transform-origin: top right;
  opacity: 0;
  transition:
    transform 0.55s var(--ease-spring),
    opacity 0.3s ease,
    border-radius 0.55s var(--ease-spring);
}
.bubble.open {
  transform: scale(1);
  opacity: 1;
  border-radius: 28px;
  height: min(480px, calc(100vh - 72px));
  max-height: min(480px, calc(100vh - 72px));
}
header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 14px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(45, 212, 191, 0.07);
  flex-shrink: 0;
}
h2 {
  margin: 0;
  font-size: 15px;
  flex: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}
.x {
  flex-shrink: 0;
}
.list {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 8px 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.card {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  padding: 10px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.045);
  animation: card-in 0.5s var(--ease-spring) both;
  transition:
    border-color 0.3s ease,
    box-shadow 0.45s var(--ease-spring),
    background-color 0.3s ease;
}
.card:hover {
  border-color: rgba(255, 255, 255, 0.22);
  box-shadow:
    0 12px 28px rgba(0, 0, 0, 0.32),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
}
.list .card:nth-child(2) {
  animation-delay: 0.06s;
}
.list .card:nth-child(3) {
  animation-delay: 0.12s;
}
.list .card:nth-child(4) {
  animation-delay: 0.18s;
}
.list .card:nth-child(5) {
  animation-delay: 0.24s;
}
.card.done {
  background: rgba(45, 212, 191, 0.07);
}
.card.done .top,
.card.done .meta,
.card.done .flow,
.card.done :deep(.el-collapse) {
  opacity: 0.55;
}
.status-row {
  position: relative;
  z-index: 2;
  margin: 4px 0 2px;
}
.act {
  --el-button-text-color: var(--primary);
  --el-button-hover-text-color: var(--primary-hover);
  --el-button-active-text-color: var(--primary-hover);
  font-size: 12px;
}
.act.del {
  --el-button-text-color: #f87171;
  --el-button-hover-text-color: #fca5a5;
  --el-button-active-text-color: #fca5a5;
  font-weight: 600;
}
.bubble :deep(.el-collapse) {
  border-color: rgba(255, 255, 255, 0.1);
  --el-collapse-border-color: rgba(255, 255, 255, 0.1);
  --el-collapse-header-bg-color: transparent;
  --el-collapse-content-bg-color: transparent;
  --el-collapse-header-text-color: var(--text-secondary);
  --el-collapse-content-text-color: var(--text-secondary);
}
.bubble :deep(.el-collapse-item__header),
.bubble :deep(.el-collapse-item__wrap) {
  border-bottom-color: rgba(255, 255, 255, 0.06);
}
.bubble :deep(.el-collapse-item__header.is-active) {
  border-bottom-color: rgba(255, 255, 255, 0.06);
}
.top {
  display: flex;
  justify-content: space-between;
  gap: 6px;
}
h3 {
  margin: 0;
  font-size: 13px;
}
.meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 6px 0;
  color: var(--text-muted);
  font-size: 11px;
}
.detail {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.55;
  color: var(--text-secondary);
  font-size: 12px;
}
.flow {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed var(--border);
  font-size: 11px;
  color: var(--text-secondary);
}
.flow ol {
  margin: 0;
  padding-left: 16px;
}
.pop-leave-active {
  transition:
    transform 0.22s ease-in,
    opacity 0.2s ease;
}
.pop-leave-to .bubble {
  transform: scale(0.2);
  opacity: 0;
}
</style>
