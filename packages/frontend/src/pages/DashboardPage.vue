<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElButton, ElDrawer } from 'element-plus'
import ReportBoard from '../components/ReportBoard.vue'
import ChatPane from '../components/ChatPane.vue'
import TaskBubble from '../components/TaskBubble.vue'
import { useBreakpoint } from '../composables/useBreakpoint'
import { useChatStore } from '../stores/chat'
import { useReportStore } from '../stores/report'
import { useTaskStore } from '../stores/task'
import bgImg from '../assets/auth-forest-light.jpg'

const { width } = useBreakpoint()
const mobile = computed(() => width.value < 768)
const drawer = ref(false)
const reportStore = useReportStore()
const chatStore = useChatStore()
const taskStore = useTaskStore()

onMounted(async () => {
  await Promise.all([reportStore.hydrate(), chatStore.loadHistory(), taskStore.refresh()])
})
</script>

<template>
  <div class="dash" :class="{ mobile }">
    <div class="dash-bg" aria-hidden="true">
      <img :src="bgImg" alt="" />
      <i class="orb o1" />
      <i class="orb o2" />
      <i class="orb o3" />
    </div>

    <div class="col left">
      <ReportBoard />
    </div>
    <div v-if="!mobile" class="col center">
      <ChatPane />
    </div>
    <TaskBubble />
    <div v-if="mobile" class="fab">
      <el-button type="primary" @click="drawer = true">对话</el-button>
    </div>
    <el-drawer v-if="mobile" v-model="drawer" title="智能交互" size="90%" direction="btt" class="chat-drawer">
      <ChatPane />
    </el-drawer>
  </div>
</template>

<style scoped>
.dash {
  position: relative;
  isolation: isolate;
  display: flex;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: var(--bg-page);
}

.dash-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}
.dash-bg img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: blur(16px) brightness(0.75) saturate(1);
  animation: bg-drift 90s ease-in-out infinite alternate;
}
@keyframes bg-drift {
  from {
    transform: scale(1.14) translate(0, 0);
  }
  to {
    transform: scale(1.17) translate(-1%, -0.6%);
  }
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(70px);
  mix-blend-mode: screen;
  pointer-events: none;
  will-change: transform;
}
.o1 {
  width: 46vw;
  height: 46vw;
  left: -12vw;
  top: -14vw;
  background: radial-gradient(circle at 50% 50%, rgba(45, 212, 191, 0.34), transparent 62%);
  animation: orb-a 48s ease-in-out infinite alternate;
}
.o2 {
  width: 38vw;
  height: 38vw;
  right: -10vw;
  top: 30vh;
  background: radial-gradient(circle at 50% 50%, rgba(56, 148, 255, 0.22), transparent 62%);
  animation: orb-b 56s ease-in-out infinite alternate;
}
.o3 {
  width: 30vw;
  height: 30vw;
  left: 30vw;
  bottom: -12vw;
  background: radial-gradient(circle at 50% 50%, rgba(251, 191, 36, 0.14), transparent 62%);
  animation: orb-c 64s ease-in-out infinite alternate;
}
@keyframes orb-a {
  to {
    transform: translate(9vw, 8vh) scale(1.15);
  }
}
@keyframes orb-b {
  to {
    transform: translate(-7vw, -6vh) scale(0.9);
  }
}
@keyframes orb-c {
  to {
    transform: translate(6vw, -8vh) scale(1.1);
  }
}

.col {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}
.col > * {
  flex: 1;
  min-height: 0;
}
.left {
  flex: 0 0 50%;
  max-width: 50%;
  animation: rise-in 0.8s var(--ease-spring) both;
}
.center {
  flex: 0 0 50%;
  max-width: 50%;
  padding: 0;
  animation: rise-in 0.8s 0.09s var(--ease-spring) both;
}
.dash.mobile {
  flex-direction: column;
}
.dash.mobile .left,
.dash.mobile .center {
  max-width: none;
  width: 100%;
}
.dash.mobile .left {
  flex: 1 1 auto;
}
.fab {
  position: fixed;
  right: 16px;
  bottom: 16px;
  z-index: 20;
}
.fab :deep(.el-button) {
  border-radius: 999px;
}
</style>

<style>
.chat-drawer {
  background: rgba(14, 20, 19, 0.96) !important;
}
.chat-drawer .el-drawer__header {
  color: var(--text-primary);
  margin-bottom: 0;
}
.chat-drawer .el-drawer__body {
  padding: 0;
  height: 100%;
}
.chat-drawer .pane {
  height: 100%;
  margin: 0;
  border: none;
  border-radius: 0;
  box-shadow: none;
}
</style>
