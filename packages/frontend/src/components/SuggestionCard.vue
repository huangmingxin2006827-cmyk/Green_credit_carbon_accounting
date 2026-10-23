<script setup>
import { computed, ref } from 'vue'
import { ElCard, ElTag, ElInput } from 'element-plus'
import { Check, Close, EditPen } from '@element-plus/icons-vue'
import RevealBtn from './RevealBtn.vue'

const props = defineProps({
  suggestion: { type: Object, required: true },
})
const emit = defineEmits(['accept', 'save', 'discard'])

const editing = ref(false)
const draft = ref('')
const saving = ref(false)

const statusLabel = {
  accepted: '已采纳',
  edited: '已修改',
  rejected: '已丢弃',
}

const done = computed(() => {
  const st = props.suggestion.status
  return st === 'accepted' || st === 'edited' || st === 'rejected'
})

const dimmed = computed(() => Boolean(props.suggestion.collapsed || done.value))

function startEdit() {
  if (done.value) return
  draft.value = props.suggestion.detail || ''
  editing.value = true
}

function cancelEdit() {
  editing.value = false
  draft.value = ''
}

function saveEdit() {
  const text = draft.value.trim()
  if (!text || saving.value || done.value) return
  saving.value = true
  emit('save', text, {
    done(ok) {
      saving.value = false
      if (ok) editing.value = false
    },
  })
}
</script>

<template>
  <el-card class="sg" :class="{ dim: dimmed }" shadow="hover">
    <template #header>
      <div class="hd">
        <span>{{ suggestion.title }}</span>
        <el-tag v-if="done" size="small" :type="suggestion.status === 'rejected' ? 'info' : 'warning'">
          {{ statusLabel[suggestion.status] || '已处理' }}
        </el-tag>
        <el-tag v-else size="small" type="success">AI 建议</el-tag>
      </div>
    </template>
    <el-input
      v-if="editing"
      v-model="draft"
      type="textarea"
      :autosize="{ minRows: 3, maxRows: 8 }"
      class="draft"
    />
    <p v-else>
      {{ suggestion.detail }}
      <span v-if="suggestion.detailStreaming" class="cursor">▍</span>
    </p>
    <div v-if="!done" class="btns">
      <template v-if="editing">
        <RevealBtn :icon="Check" label="保存" type="primary" :loading="saving" @click="saveEdit" />
        <RevealBtn :icon="Close" label="取消" :disabled="saving" @click="cancelEdit" />
      </template>
      <template v-else>
        <RevealBtn
          :icon="Check"
          label="采纳"
          type="primary"
          :disabled="suggestion.detailStreaming"
          @click="emit('accept')"
        />
        <RevealBtn :icon="EditPen" label="修改" :disabled="suggestion.detailStreaming" @click="startEdit" />
        <RevealBtn
          :icon="Close"
          label="丢弃"
          text
          type="info"
          :disabled="suggestion.detailStreaming"
          @click="emit('discard')"
        />
      </template>
    </div>
  </el-card>
</template>

<style scoped>
.sg {
  margin-bottom: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.045);
  color: var(--text-primary);
  animation: card-in 0.5s var(--ease-spring) both;
  transition:
    transform 0.45s var(--ease-spring),
    border-color 0.3s ease,
    box-shadow 0.45s var(--ease-spring),
    opacity 0.3s ease;
}
.sg:hover {
  transform: translateY(-3px);
  border-color: rgba(255, 255, 255, 0.22);
  box-shadow:
    0 14px 34px rgba(0, 0, 0, 0.35),
    0 0 0 1px rgba(94, 213, 255, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.14);
}
/* 依次入场，制造液体涟漪般的错峰 */
.sg:nth-child(2) {
  animation-delay: 0.05s;
}
.sg:nth-child(3) {
  animation-delay: 0.1s;
}
.sg:nth-child(4) {
  animation-delay: 0.15s;
}
.sg:nth-child(5) {
  animation-delay: 0.2s;
}
.sg:nth-child(6) {
  animation-delay: 0.25s;
}
.sg :deep(.el-card__header) {
  border-bottom-color: rgba(255, 255, 255, 0.08);
  background: rgba(45, 212, 191, 0.06);
}
.sg :deep(.el-card__body) {
  color: var(--text-primary);
}
.sg :deep(.el-textarea__inner) {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.14);
  color: var(--text-primary);
  box-shadow: none;
}
.sg :deep(.el-textarea__inner::placeholder) {
  color: var(--text-muted);
}
.sg.dim {
  opacity: 0.55;
}
.hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
}
p {
  margin: 0 0 12px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-secondary);
}
.draft {
  margin-bottom: 12px;
}
.btns {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.cursor {
  animation: blink 1s step-end infinite;
}
@keyframes blink {
  50% {
    opacity: 0;
  }
}
</style>
