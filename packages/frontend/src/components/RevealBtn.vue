<script setup>
import { ElButton } from 'element-plus'

defineProps({
  icon: { type: Object, default: null },
  label: { type: String, default: '' },
  size: { type: String, default: 'small' },
  type: { type: String, default: 'default' },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
})
</script>

<template>
  <el-button
    class="reveal"
    :size="size"
    :type="type"
    :icon="icon"
    :disabled="disabled"
    :loading="loading"
    :title="label"
    :aria-label="label"
  >
    <span class="lbl">{{ label }}</span>
  </el-button>
</template>

<style scoped>
/* 收起时只露图标；悬浮时按钮拉长、文字滑出 */
.reveal {
  padding: 0 9px;
  border-radius: 999px;
  overflow: hidden;
}
.reveal .lbl {
  display: inline-block;
  max-width: 0;
  opacity: 0;
  margin-left: 0;
  white-space: nowrap;
  overflow: hidden;
  vertical-align: middle;
  font-weight: 600;
  transition:
    max-width 0.5s var(--ease-spring),
    opacity 0.24s ease 0.05s,
    margin-left 0.5s var(--ease-spring);
}
.reveal:hover .lbl,
.reveal:focus-visible .lbl {
  max-width: 160px;
  opacity: 1;
  margin-left: 6px;
}
</style>
