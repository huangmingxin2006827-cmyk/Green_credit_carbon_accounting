import { acceptHMRUpdate, defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { chatKnowledge, chatReport, clearChatHistory, getChatHistory, saveChatHistory } from '../api/http'
import { newMsg, toHistory } from '../utils/history'
import { useReportStore } from './report'

export const CHAT_WELCOME_HINT =
  '您好，我是绿色信贷碳核算助手。请上传企业用电明细 Excel，我将生成碳足迹报告与减排建议；您也可在此提问或追问报告数据。'

export const useChatStore = defineStore('chat', () => {
  const knowledge = ref([])
  const followup = ref([])
  const inputText = ref('')
  const language = ref('zh')
  const streaming = ref(false)
  const errorMessage = ref('')
  let lastPayload = null
  let persistTimer = null
  let skipPersist = true
  let chatEpoch = 0

  const chatHistory = computed(() => [...knowledge.value, ...followup.value])

  function schedulePersist() {
    if (skipPersist) return
    clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      saveChatHistory({ knowledge: knowledge.value, followup: followup.value }).catch(() => {})
    }, 400)
  }

  watch([knowledge, followup], schedulePersist, { deep: true })

  async function loadHistory() {
    skipPersist = true
    try {
      const data = await getChatHistory()
      knowledge.value = data?.knowledge || []
      followup.value = data?.followup || []
    } catch {
      knowledge.value = []
      followup.value = []
    } finally {
      skipPersist = false
    }
  }

  function resetLocal() {
    skipPersist = true
    knowledge.value = []
    followup.value = []
    errorMessage.value = ''
    skipPersist = false
  }

  async function clearChat() {
    skipPersist = true
    knowledge.value = []
    followup.value = []
    errorMessage.value = ''
    try {
      await clearChatHistory()
    } finally {
      skipPersist = false
    }
  }

  function abandonRound() {
    chatEpoch += 1
    inputText.value = ''
    streaming.value = false
    errorMessage.value = ''
    lastPayload = null
    resetLocal()
  }

  function findBucketByMsgId(id) {
    if (knowledge.value.some((m) => m.id === id)) return knowledge
    if (followup.value.some((m) => m.id === id)) return followup
    return null
  }

  async function runStreamRound({
    text,
    reportId,
    history,
    bucket,
    assistant,
    removeAssistantIfEmpty,
    keepUntilFirstChunk = false,
  }) {
    const token = ++chatEpoch
    streaming.value = true
    errorMessage.value = ''
    lastPayload = { text, reportId, history }
    const patchAssistant = (patch) => {
      if (token !== chatEpoch) return
      Object.assign(assistant, patch)
      const idx = bucket.value.findIndex((m) => m.id === assistant.id)
      if (idx >= 0) {
        bucket.value[idx] = { ...bucket.value[idx], ...patch }
      }
    }

    const handlers = {
      onText(_chunk, full) {
        if (keepUntilFirstChunk && !String(full || '').length) return
        patchAssistant({ content: full, streaming: true, regenerating: false })
      },
      onDone(_payload, full) {
        // 有新全文则写入；否则保留气泡里已有内容（含刷新未出首包时的旧文案）
        const next = String(full || '').length ? full : assistant.content
        patchAssistant({ content: next, streaming: false, regenerating: false })
      },
      onError(err) {
        if (token !== chatEpoch) return
        errorMessage.value = err.message || 'AI 服务异常'
        patchAssistant({ streaming: false, regenerating: false })
      },
    }

    try {
      if (reportId) {
        await chatReport(reportId, { question: text, history, stream: true }, handlers)
      } else {
        await chatKnowledge({ message: text, history, stream: true }, handlers)
      }
    } catch (err) {
      if (token !== chatEpoch) return
      errorMessage.value = err.message || '发送失败'
      if (removeAssistantIfEmpty && !assistant.content) {
        const i = bucket.value.findIndex((m) => m.id === assistant.id)
        if (i >= 0) bucket.value.splice(i, 1)
      }
    } finally {
      if (token !== chatEpoch) return
      patchAssistant({ streaming: false, regenerating: false })
      streaming.value = false
    }
  }

  async function submitMessage() {
    const text = inputText.value.trim()
    if (!text || streaming.value) return
    const reportStore = useReportStore()
    const reportId = reportStore.reportId
    const bucket = reportId ? followup : knowledge
    const userMsg = newMsg('user', text)
    const assistant = newMsg('assistant', '', { streaming: true })
    bucket.value.push(userMsg, assistant)
    inputText.value = ''

    const timeline = [...knowledge.value, ...followup.value]
    const history = toHistory(timeline.slice(0, -2))
    await runStreamRound({
      text,
      reportId,
      history,
      bucket,
      assistant,
      removeAssistantIfEmpty: true,
    })
  }

  async function regenerateMessage(assistantId) {
    if (!assistantId || streaming.value) return
    const bucket = findBucketByMsgId(assistantId)
    if (!bucket) return
    const idx = bucket.value.findIndex((m) => m.id === assistantId)
    if (idx < 0) return
    const assistant = bucket.value[idx]
    if (assistant.role !== 'assistant') return
    const userMsg = idx > 0 ? bucket.value[idx - 1] : null
    if (!userMsg || userMsg.role !== 'user' || !String(userMsg.content || '').trim()) return

    const text = String(userMsg.content).trim()
    const reportStore = useReportStore()
    // 按消息所在通道决定接口：followup 用当前报告追问；knowledge 走知识问答
    const reportId = bucket === followup ? reportStore.reportId : null
    if (bucket === followup && !reportId) return

    const timeline = [...knowledge.value, ...followup.value]
    const globalIdx = timeline.findIndex((m) => m.id === userMsg.id)
    const history = toHistory(globalIdx >= 0 ? timeline.slice(0, globalIdx) : [])

    // 保留旧文案，标为重新生成中；首包到达后再替换
    bucket.value[idx] = { ...assistant, streaming: true, regenerating: true }
    const live = bucket.value[idx]

    await runStreamRound({
      text,
      reportId,
      history,
      bucket,
      assistant: live,
      removeAssistantIfEmpty: false,
      keepUntilFirstChunk: true,
    })
  }

  async function retryLast() {
    if (!lastPayload) return
    inputText.value = lastPayload.text
    await submitMessage()
  }

  return {
    chatHistory,
    knowledge,
    followup,
    inputText,
    language,
    streaming,
    errorMessage,
    loadHistory,
    resetLocal,
    submitMessage,
    regenerateMessage,
    retryLast,
    clearChat,
    abandonRound,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useChatStore, import.meta.hot))
}
