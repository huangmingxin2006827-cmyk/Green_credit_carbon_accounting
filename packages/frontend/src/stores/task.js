import { defineStore } from 'pinia'
import { clearTasks, deleteTask, listTasks, patchChecklist, patchTaskStatus } from '../api/http'

function sortTasks(list) {
  return [...list].sort((a, b) => {
    const rank = (s) => (s === 'done' ? 1 : 0)
    const d = rank(a.status) - rank(b.status)
    if (d) return d
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  })
}

export const useTaskStore = defineStore('task', {
  state: () => ({
    taskList: [],
    bubbleVisible: false,
  }),
  actions: {
    async refresh() {
      this.taskList = sortTasks((await listTasks()) || [])
    },
    resetLocal() {
      this.taskList = []
      this.bubbleVisible = false
    },
    openBubble() {
      this.bubbleVisible = true
    },
    closeBubble() {
      this.bubbleVisible = false
    },
    async setStatus(taskId, status) {
      const updated = await patchTaskStatus(taskId, status)
      const idx = this.taskList.findIndex((t) => t.taskId === taskId)
      if (idx >= 0) this.taskList[idx] = updated
      this.taskList = sortTasks(this.taskList)
    },
    async toggleChecklist(taskId, index, done) {
      const updated = await patchChecklist(taskId, index, done)
      const idx = this.taskList.findIndex((t) => t.taskId === taskId)
      if (idx >= 0) this.taskList[idx] = updated
      this.taskList = sortTasks(this.taskList)
    },
    async removeDone(taskId) {
      const prev = this.taskList
      this.taskList = prev.filter((t) => t.taskId !== taskId)
      if (!this.taskList.length) this.bubbleVisible = false
      if (String(taskId).startsWith('tmp_')) return
      try {
        await deleteTask(taskId)
      } catch (err) {
        if (err?.code === 'REPORT_NOT_FOUND' || /不存在/.test(err?.message || '')) return
        this.taskList = prev
        this.bubbleVisible = true
        throw err
      }
    },
    async clearAll() {
      await clearTasks()
      this.resetLocal()
    },
    prepend(task) {
      if (!task) return
      this.taskList = sortTasks([task, ...this.taskList.filter((t) => t.taskId !== task.taskId)])
      this.bubbleVisible = true
    },
    replaceTask(oldId, task) {
      if (!task) {
        this.taskList = this.taskList.filter((t) => t.taskId !== oldId)
        return
      }
      this.taskList = sortTasks([
        task,
        ...this.taskList.filter((t) => t.taskId !== oldId && t.taskId !== task.taskId),
      ])
    },
  },
})
