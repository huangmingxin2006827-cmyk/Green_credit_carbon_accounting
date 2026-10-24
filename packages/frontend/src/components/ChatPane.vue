<script setup>
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElButton, ElUpload, ElTag, ElAlert, ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowDown,
  ArrowUp,
  CopyDocument,
  Delete,
  Hide,
  Paperclip,
  Promotion,
  RefreshLeft,
  RefreshRight,
  SwitchButton,
  View,
} from '@element-plus/icons-vue'
import { useReportStore } from '../stores/report'
import { CHAT_WELCOME_HINT, useChatStore } from '../stores/chat'
import { useTaskStore } from '../stores/task'
import { useAuthStore } from '../stores/auth'
import { useRouter } from 'vue-router'
import { marked } from 'marked'
import SuggestionCard from './SuggestionCard.vue'
import RevealBtn from './RevealBtn.vue'
import { loadAuth } from '../utils/auth'
import { decodeUploadFileName } from '../utils/fileName'

const router = useRouter()
const reportStore = useReportStore()
const chatStore = useChatStore()
const taskStore = useTaskStore()
const auth = useAuthStore()
const { suggestions, uploadedFileName, chartsLoading } = storeToRefs(reportStore)
const displayFileName = computed(() => decodeUploadFileName(uploadedFileName.value || ''))
const { chatHistory, inputText, streaming, errorMessage } = storeToRefs(chatStore)
const { bubbleVisible, taskList } = storeToRefs(taskStore)
const inputRef = ref(null)
const sugsOpen = ref(true)

const visibleSuggestions = computed(() =>
  (suggestions.value || []).filter((s) => s.status !== 'rejected'),
)
const showWelcome = computed(() => !chatHistory.value.some((m) => m.role === 'user'))

function normalizeChatText(raw) {
  return String(raw || '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\+(?=\d+\.)/g, '\n')
}

function assistantHtml(raw) {
  const text = normalizeChatText(raw).trim()
  if (!text) return ''
  return marked.parse(text, { async: false, gfm: true, breaks: true })
}

watch(
  () => visibleSuggestions.value.length,
  (n, o) => {
    if (n > (o || 0)) sugsOpen.value = true
  },
)

function toggleTodoBubble() {
  if (bubbleVisible.value) taskStore.closeBubble()
  else taskStore.openBubble()
}

async function customUpload(options) {
  try {
    await reportStore.uploadExcel(options.file)
    options.onSuccess?.({})
  } catch (err) {
    ElMessage.error(err.message || '上传或生成失败')
    options.onError?.(err)
  }
}

function onAccept(id) {
  const s = visibleSuggestions.value.find((x) => x.suggestionId === id)
  if (s) reportStore.acceptSuggestion(s).catch((e) => ElMessage.error(e.message))
}

function onSaveEdit(id, detail, done) {
  const s = visibleSuggestions.value.find((x) => x.suggestionId === id)
  if (!s) {
    done?.(false)
    return
  }
  reportStore
    .saveSuggestionEdit(s, detail)
    .then(() => {
      ElMessage.success('建议已保存')
      done?.(true)
    })
    .catch((e) => {
      ElMessage.error(e.message || '保存失败')
      done?.(false)
    })
}

function onDiscard(id) {
  const s = visibleSuggestions.value.find((x) => x.suggestionId === id)
  if (s) reportStore.discardSuggestion(s).catch((e) => ElMessage.error(e.message))
}

function onSubmit() {
  void chatStore.submitMessage()
}

async function copyAnswer(msg) {
  const text = String(msg?.content || '').trim()
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

function refreshAnswer(msg) {
  if (!msg?.id || streaming.value) return
  void chatStore.regenerateMessage(msg.id)
}

function clearCurrentReport() {
  if (typeof reportStore.dismissCurrent === 'function') {
    reportStore.dismissCurrent()
    return
  }
  const id = reportStore.reportId
  const uid = loadAuth()?.user?.id
  if (id && uid != null) {
    const key = 'carbon_hidden_report'
    let all = {}
    try {
      all = JSON.parse(localStorage.getItem(key) || '{}') || {}
    } catch {
      all = {}
    }
    all[String(uid)] = id
    localStorage.setItem(key, JSON.stringify(all))
  }
  reportStore.resetLocal()
}

async function restartWorkspace() {
  try {
    await ElMessageBox.confirm(
      '将清空当前上传、图表、报告、建议和对话。已采纳的任务会保留。',
      '重新开始',
      {
        confirmButtonText: '清空',
        cancelButtonText: '取消',
        type: 'warning',
        customClass: 'workspace-reset-box',
        modalClass: 'workspace-reset-mask',
        appendTo: document.body,
      },
    )
  } catch (err) {
    if (err === 'cancel' || err === 'close') return
    ElMessage.error(err?.message || '无法打开确认框')
    return
  }
  try {
    clearCurrentReport()
    if (typeof chatStore.abandonRound === 'function') chatStore.abandonRound()
    else chatStore.resetLocal()
    await chatStore.clearChat()
    ElMessage.success('已清空当前核算')
  } catch (err) {
    ElMessage.error(err?.message || '清空失败')
  }
}

function logout() {
  auth.logout()
  reportStore.resetLocal()
  chatStore.resetLocal()
  taskStore.resetLocal()
  router.replace('/login')
}

function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    onSubmit()
  }
}
</script>

<template>
  <section class="pane glass-panel">
    <header>
      <h2>智能交互</h2>
      <el-button
        class="sugs-fold"
        :icon="sugsOpen ? ArrowUp : ArrowDown"
        circle
        size="small"
        text
        :disabled="!visibleSuggestions.length"
        :aria-label="sugsOpen ? '折叠建议' : '展开建议'"
        title="折叠 / 展开建议"
        @click="sugsOpen = !sugsOpen"
      />
      <el-button
        class="todo-eye"
        :icon="bubbleVisible ? View : Hide"
        circle
        size="small"
        text
        :disabled="!taskList.length"
        :aria-label="bubbleVisible ? '隐藏待办弹窗' : '显示待办弹窗'"
        title="显示 / 隐藏待办"
        @click="toggleTodoBubble"
      />
      <div class="ops">
        <el-tag
          v-if="displayFileName"
          class="fname"
          closable
          size="small"
          round
          type="info"
          :title="displayFileName"
          @close="reportStore.clearUploadedFile()"
        >
          <span class="fname-inner">
            <svg class="fname-ico" width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M3 2h7l3 3v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"
                stroke="currentColor"
                stroke-width="1.3"
              />
              <path d="M10 2v3h3" stroke="currentColor" stroke-width="1.3" />
            </svg>
            <span class="fname-text">{{ displayFileName }}</span>
          </span>
        </el-tag>
        <el-button class="restart" size="small" :icon="RefreshLeft" @click="restartWorkspace">
          重新开始
        </el-button>
        <RevealBtn :icon="Delete" label="清空对话" text @click="chatStore.clearChat()" />
        <span class="who">{{ auth.displayName }}</span>
        <RevealBtn :icon="SwitchButton" label="退出" text @click="logout" />
      </div>
    </header>

    <div class="stage">
      <div v-if="visibleSuggestions.length && sugsOpen" class="sugs">
        <div class="lab">AI 主动建议</div>
        <SuggestionCard
          v-for="s in visibleSuggestions"
          :key="s.suggestionId"
          :suggestion="s"
          @accept="onAccept(s.suggestionId)"
          @save="(detail, hooks) => onSaveEdit(s.suggestionId, detail, hooks?.done)"
          @discard="onDiscard(s.suggestionId)"
        />
      </div>

      <div class="thread">
        <p v-if="showWelcome" class="hint">{{ CHAT_WELCOME_HINT }}</p>
        <div v-for="msg in chatHistory" :key="msg.id" class="row" :class="msg.role">
          <div class="bubble" :class="{ regenerating: msg.regenerating }">
            <template v-if="msg.role === 'user'">{{ msg.content }}</template>
            <template v-else>
              <div v-if="msg.regenerating" class="regen-hint">重新生成中…</div>
              <div class="md" v-html="assistantHtml(msg.content)" />
            </template>
            <span v-if="msg.streaming && !msg.regenerating" class="cursor">▍</span>
          </div>
          <div
            v-if="msg.role === 'assistant' && !msg.streaming && msg.content"
            class="msg-actions"
          >
            <el-button
              text
              size="small"
              :icon="CopyDocument"
              :disabled="streaming"
              title="复制"
              @click="copyAnswer(msg)"
            >
              复制
            </el-button>
            <el-button
              text
              size="small"
              :icon="RefreshRight"
              :disabled="streaming"
              title="刷新"
              @click="refreshAnswer(msg)"
            >
              刷新
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <el-alert v-if="errorMessage" type="error" :closable="false" show-icon class="err">
      <template #default>
        {{ errorMessage }}
        <el-button size="small" type="danger" link @click="chatStore.retryLast()">重试</el-button>
      </template>
    </el-alert>

    <div class="composer">
      <el-upload
        :show-file-list="false"
        accept=".xlsx,.xls"
        :http-request="customUpload"
        :disabled="chartsLoading"
        class="clip"
      >
        <el-button
          :icon="Paperclip"
          circle
          :loading="chartsLoading"
          title="上传用电明细"
        />
      </el-upload>
      <input
        ref="inputRef"
        v-model="inputText"
        type="text"
        placeholder="请输入问题，例如「根据这份数据写一份绿色信贷风险评估报告」"
        @keydown="onKeydown"
      />
      <RevealBtn
        class="send"
        type="primary"
        :icon="Promotion"
        label="提交"
        :loading="streaming"
        @click="onSubmit"
      />
    </div>
  </section>
</template>

<style scoped>
.pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  margin: 12px 12px 12px 0;
  border-radius: var(--radius-md);
  overflow: hidden;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.02);
  flex-shrink: 0;
}
h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.02em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
}
.sugs-fold,
.todo-eye {
  flex-shrink: 0;
}
.todo-eye {
  margin-right: auto;
}
.ops {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.restart {
  border-color: rgba(45, 212, 191, 0.45);
  color: #d7fff8;
  background: rgba(45, 212, 191, 0.12);
}
.who {
  font-size: 12px;
  color: var(--text-muted);
}
.fname {
  max-width: 220px;
  height: 26px;
  padding: 0 8px 0 10px;
  background: rgba(12, 20, 18, 0.65);
  border-color: rgba(45, 212, 191, 0.28);
  color: var(--text-secondary);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}
.fname-inner {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-width: 0;
}
.fname-ico {
  flex-shrink: 0;
  color: var(--primary);
}
.fname-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fname :deep(.el-tag__content) {
  display: inline-flex;
  max-width: 100%;
  overflow: hidden;
}
.fname :deep(.el-tag__close) {
  color: rgba(255, 255, 255, 0.45);
  margin-left: 4px;
}
.fname :deep(.el-tag__close:hover) {
  color: #fff;
  background-color: rgba(45, 212, 191, 0.2);
}
.thread {
  flex: 1;
  overflow: auto;
  margin: 0 10px 0;
  padding: 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: relative;
  border-radius: 14px 14px 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: var(--surface-muted);
  box-shadow: 0 -6px 18px rgba(0, 0, 0, 0.08);
}
.hint {
  position: absolute;
  inset: 16px 20px;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 13px;
  line-height: 1.65;
  color: rgba(255, 255, 255, 0.16);
  pointer-events: none;
  user-select: none;
}
.row {
  display: flex;
  position: relative;
  z-index: 1;
  animation: msg-in 0.42s var(--ease-spring) both;
}
.row.user {
  justify-content: flex-end;
}
.row.assistant,
.row.system {
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  gap: 4px;
}
.msg-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: 2px;
  opacity: 0.55;
  transition: opacity 0.15s ease;
}
.row.assistant:hover .msg-actions {
  opacity: 0.9;
}
.msg-actions :deep(.el-button) {
  --el-button-text-color: rgba(255, 255, 255, 0.55);
  --el-button-hover-text-color: rgba(255, 255, 255, 0.9);
  padding: 2px 6px;
  height: auto;
  font-size: 12px;
}
.bubble {
  max-width: 92%;
  padding: 11px 14px;
  border-radius: 12px;
  font-size: 13.5px;
  line-height: 1.55;
}
.bubble.regenerating .md {
  opacity: 0.45;
}
.regen-hint {
  margin: 0 0 8px;
  font-size: 12px;
  color: rgba(45, 212, 191, 0.85);
  letter-spacing: 0.02em;
}
.user .bubble {
  background: var(--primary);
  color: #04302b;
  font-weight: 500;
  white-space: pre-wrap;
}
.assistant .bubble .md :deep(p) {
  margin: 0 0 0.45em;
}
.assistant .bubble .md :deep(p:last-child) {
  margin-bottom: 0;
}
.assistant .bubble .md :deep(ul),
.assistant .bubble .md :deep(ol) {
  margin: 0.2em 0 0.45em;
  padding-left: 1.2em;
}
.assistant .bubble .md :deep(h1),
.assistant .bubble .md :deep(h2),
.assistant .bubble .md :deep(h3) {
  margin: 0.35em 0 0.2em;
  font-size: 14px;
  line-height: 1.4;
}
.assistant .bubble .md :deep(pre) {
  margin: 0.35em 0;
  padding: 8px 10px;
  overflow: auto;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.28);
  white-space: pre-wrap;
}
.assistant .bubble .md :deep(code) {
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12.5px;
}
.assistant .bubble,
.system .bubble {
  background: rgba(23, 31, 29, 0.72);
  border: 1px solid var(--border);
  box-shadow: 0 2px 8px rgba(15, 61, 54, 0.04);
}
.cursor {
  animation: blink 1s step-end infinite;
}
@keyframes blink {
  50% {
    opacity: 0;
  }
}
/* 舞台：聊天区与建议区共用，建议列表悬浮在聊天记录上方 */
.stage {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
/* 建议列表：浮在对话框上方的实心面板，完全遮挡后面的聊天内容 */
.sugs {
  position: absolute;
  top: 10px;
  left: 12px;
  right: 12px;
  z-index: 5;
  max-height: min(46vh, 360px);
  overflow: auto;
  padding: 4px 10px 10px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: var(--radius-md);
  background:
    linear-gradient(168deg, rgba(255, 255, 255, 0.14) 0%, rgba(255, 255, 255, 0.05) 45%, rgba(255, 255, 255, 0.08) 100%),
    linear-gradient(168deg, #24302d 0%, #161f1c 100%);
  box-shadow:
    0 20px 50px rgba(0, 0, 0, 0.45),
    0 2px 6px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
  animation: pop-in 0.4s var(--ease-spring) both;
  transform-origin: top center;
}
.lab {
  font-size: 12px;
  color: var(--text-muted);
  padding: 8px 4px;
}
.err {
  margin: 0 12px 8px;
}
.composer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.02);
  border-top: 1px solid rgba(255, 255, 255, 0.07);
  flex-shrink: 0;
}
.clip {
  flex-shrink: 0;
}
input {
  flex: 1;
  min-width: 0;
  height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 999px;
  padding: 0 14px;
  font-family: inherit;
  font-size: 13px;
  outline: none;
  color: var(--text-primary);
  caret-color: var(--primary);
  background: rgba(255, 255, 255, 0.06);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
}
input::placeholder {
  color: var(--text-muted);
}
input:focus {
  border-color: rgba(45, 212, 191, 0.55);
  background: rgba(255, 255, 255, 0.09);
  box-shadow: var(--glow-primary);
}
.send {
  flex-shrink: 0;
  height: 36px;
  min-width: 36px;
}
</style>
