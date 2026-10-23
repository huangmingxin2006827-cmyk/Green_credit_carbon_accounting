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

  async function submitMessage() {
    const text = inputText.value.trim()
    if (!text || streaming.value) return
    const token = ++chatEpoch
    const reportStore = useReportStore()
    const reportId = reportStore.reportId
    const bucket = reportId ? followup : knowledge
    const userMsg = newMsg('user', text)
    const assistant = newMsg('assistant', '', { streaming: true })
    bucket.value.push(userMsg, assistant)
    inputText.value = ''
    streaming.value = true
    errorMessage.value = ''

    const timeline = [...knowledge.value, ...followup.value]
    const history = toHistory(timeline.slice(0, -2))
    lastPayload = { text, reportId, history }

    const handlers = {
      onText(_chunk, full) {
        if (token !== chatEpoch) return
        assistant.content = full
        const idx = bucket.value.findIndex((m) => m.id === assistant.id)
        if (idx >= 0) {
          bucket.value[idx] = { ...bucket.value[idx], content: full, streaming: true }
        }
      },
      onDone(_payload, full) {
        if (token !== chatEpoch) return
        const idx = bucket.value.findIndex((m) => m.id === assistant.id)
        const shown = full || assistant.content
        if (idx >= 0) {
          bucket.value[idx] = { ...bucket.value[idx], content: shown, streaming: false }
        }
        assistant.content = shown
        assistant.streaming = false
      },
      onError(err) {
        if (token !== chatEpoch) return
        errorMessage.value = err.message || 'AI 服务异常'
        assistant.streaming = false
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
      if (!assistant.content) {
        const i = bucket.value.lastIndexOf(assistant)
        if (i >= 0) bucket.value.splice(i, 1)
      }
    } finally {
      if (token !== chatEpoch) return
      assistant.streaming = false
      streaming.value = false
    }
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
    retryLast,
    clearChat,
    abandonRound,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useChatStore, import.meta.hot))
}
