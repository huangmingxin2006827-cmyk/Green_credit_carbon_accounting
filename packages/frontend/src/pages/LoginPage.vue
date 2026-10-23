<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElForm, ElFormItem, ElInput, ElButton, ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'
import heroImg from '../assets/auth-forest-light.jpg'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const isRegister = computed(() => route.name === 'register')
const username = ref('')
const displayName = ref('')
const password = ref('')
const loading = ref(false)

const phase = ref('init')
let timers = []

function clearTimers() {
  timers.forEach((id) => clearTimeout(id))
  timers = []
}

function runIntro() {
  clearTimers()
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce) {
    phase.value = 'form'
    return
  }
  timers.push(
    setTimeout(() => {
      phase.value = 'shade'
    }, 200),
  )
  timers.push(
    setTimeout(() => {
      phase.value = 'form'
    }, 3100),
  )
}

async function onSubmit() {
  if (!username.value || !password.value) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    if (isRegister.value) {
      await auth.register(username.value.trim(), password.value, displayName.value.trim())
    } else {
      await auth.login(username.value.trim(), password.value)
    }
    await router.replace('/')
  } catch (err) {
    ElMessage.error(err.message || (isRegister.value ? '注册失败' : '登录失败'))
  } finally {
    loading.value = false
  }
}

onMounted(runIntro)
onUnmounted(clearTimers)
</script>

<template>
  <div
    class="auth"
    :class="{
      'is-shade': phase === 'shade' || phase === 'form',
      'is-form': phase === 'form',
    }"
  >
    <div class="hero" aria-hidden="true">
      <img class="hero-img" :src="heroImg" alt="" />
    </div>

    <aside class="shade">
      <div class="shade-fill" />

      <div class="shade-body">
        <div class="intro" :aria-hidden="phase === 'form'">
          <h1 class="intro-title">绿色信贷 · 碳核算</h1>
          <p class="intro-sub">碳账户 · 为绿色信贷决策提供可信碳足迹洞察</p>
        </div>

        <div class="form-wrap" :aria-hidden="phase !== 'form'">
          <p class="form-en">Green Credit · Carbon Accounting</p>
          <h2 class="form-title">{{ isRegister ? '创建账号' : '登录' }}</h2>

          <div class="segment" role="tablist" aria-label="登录或注册">
            <span class="thumb" :class="{ right: isRegister }" />
            <router-link
              class="seg"
              :class="{ active: !isRegister }"
              to="/login"
              role="tab"
              :aria-selected="!isRegister"
            >
              登录
            </router-link>
            <router-link
              class="seg"
              :class="{ active: isRegister }"
              to="/register"
              role="tab"
              :aria-selected="isRegister"
            >
              注册
            </router-link>
          </div>

          <div class="slider" :class="{ register: isRegister }">
            <div class="track">
              <div class="pane" :aria-hidden="isRegister">
                <el-form label-width="0" @submit.prevent="onSubmit">
                  <el-form-item>
                    <el-input v-model="username" placeholder="用户名" size="large" autocomplete="username" />
                  </el-form-item>
                  <el-form-item>
                    <el-input
                      v-model="password"
                      type="password"
                      placeholder="密码"
                      size="large"
                      show-password
                      autocomplete="current-password"
                      @keyup.enter="onSubmit"
                    />
                  </el-form-item>
                  <el-button
                    type="primary"
                    size="large"
                    class="cta"
                    :loading="loading && !isRegister"
                    native-type="submit"
                    @click="onSubmit"
                  >
                    继续
                  </el-button>
                </el-form>
              </div>
              <div class="pane" :aria-hidden="!isRegister">
                <el-form label-width="0" @submit.prevent="onSubmit">
                  <el-form-item>
                    <el-input v-model="username" placeholder="用户名" size="large" autocomplete="username" />
                  </el-form-item>
                  <el-form-item>
                    <el-input
                      v-model="displayName"
                      placeholder="显示名称（可选）"
                      size="large"
                      autocomplete="nickname"
                    />
                  </el-form-item>
                  <el-form-item>
                    <el-input
                      v-model="password"
                      type="password"
                      placeholder="密码"
                      size="large"
                      show-password
                      autocomplete="new-password"
                      @keyup.enter="onSubmit"
                    />
                  </el-form-item>
                  <el-button
                    type="primary"
                    size="large"
                    class="cta"
                    :loading="loading && isRegister"
                    native-type="submit"
                    @click="onSubmit"
                  >
                    创建账号
                  </el-button>
                </el-form>
              </div>
            </div>
          </div>

          <p class="legal">绿色信贷 · 碳足迹 AI 报告平台</p>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.auth {
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
  --spring: cubic-bezier(0.32, 0.72, 0, 1);
  position: relative;
  isolation: isolate;
  min-height: 100dvh;
  width: 100%;
  overflow: hidden;
  background: #14161a;
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    'SF Pro Display',
    'SF Pro Text',
    'PingFang SC',
    'Hiragino Sans GB',
    'Microsoft YaHei UI',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  color: #fff;
}

.hero {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
}

.hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(105deg, rgba(6, 10, 9, 0.55) 0%, rgba(6, 10, 9, 0.28) 42%, rgba(6, 10, 9, 0.12) 70%, transparent 100%),
    linear-gradient(180deg, rgba(8, 12, 11, 0.28) 0%, transparent 30%, transparent 55%, rgba(6, 10, 9, 0.42) 100%);
  pointer-events: none;
}

.hero-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center center;
  transform: scale(1);
  transition: transform 2.2s var(--ease) 0.9s;
  will-change: transform;
}

.auth.is-shade .hero-img {
  transform: scale(1.13);
}

.shade {
  position: absolute;
  z-index: 2;
  top: 0;
  bottom: 0;
  left: 0;
  width: 58vw;
  transform: translateX(-105%);
  transition: transform 1.55s var(--ease) 0.2s;
  pointer-events: none;
}

.auth.is-shade .shade {
  transform: translateX(0);
}

.auth.is-form .shade {
  pointer-events: auto;
}

.shade-fill {
  position: absolute;
  inset: -6% 0;
  background: linear-gradient(
    110deg,
    rgba(4, 8, 7, 0.88) 0%,
    rgba(4, 8, 7, 0.84) 57%,
    rgba(4, 8, 7, 0.62) 60%,
    rgba(214, 224, 234, 0.38) 62.5%,
    rgba(0, 0, 0, 0.2) 65.5%,
    rgba(0, 0, 0, 0.08) 69%,
    transparent 72%,
    rgba(224, 230, 235, 0.12) 74.5%,
    transparent 77%
  );
}

.shade-body {
  position: relative;
  z-index: 1;
  height: 100%;
}

.intro,
.form-wrap {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 11vh clamp(24px, 3.5vw, 56px) 32px clamp(32px, 5.8vw, 96px);
}

.intro {
  padding-top: 18vh;
}

.form-wrap {
  max-width: 540px;
}

.intro {
  opacity: 1;
  transition:
    opacity 0.45s var(--ease),
    transform 0.45s var(--ease);
}

.auth.is-form .intro {
  opacity: 0;
  transform: translateY(-12px);
  pointer-events: none;
}

.intro-title {
  margin: 0 0 3.5vh;
  font-size: clamp(34px, 5vh, 58px);
  font-weight: 650;
  letter-spacing: 0.01em;
  line-height: 1.2;
}

.intro-sub {
  margin: 0;
  max-width: 26em;
  font-size: 15px;
  line-height: 1.7;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.58);
}

.form-wrap {
  opacity: 0;
  transform: translateY(16px);
  transition:
    opacity 0.55s 0.05s var(--ease),
    transform 0.55s 0.05s var(--spring);
  pointer-events: none;
}

.auth.is-form .form-wrap {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.form-en {
  margin: 0 0 8px;
  font-size: 34px;
  font-weight: 650;
  letter-spacing: 0.02em;
  line-height: 1.2;
  white-space: nowrap;
  color: rgba(255, 255, 255, 0.9);
}

.form-title {
  margin: 0 0 20px;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: rgba(255, 255, 255, 0.88);
}

.segment {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-bottom: 18px;
  padding: 3px;
  border-radius: 980px;
  background: rgba(255, 255, 255, 0.1);
}

.thumb {
  position: absolute;
  top: 3px;
  bottom: 3px;
  left: 3px;
  width: calc(50% - 3px);
  border-radius: 980px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  transition: transform 0.45s var(--spring);
  z-index: 0;
}
.thumb.right {
  transform: translateX(100%);
}

.seg {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  min-height: 34px;
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.65);
  transition: color 0.25s ease;
}
.seg.active {
  color: #111;
}

.slider {
  overflow: hidden;
  width: 100%;
  height: 176px;
  transition: height 0.42s var(--spring);
}
.slider.register {
  height: 232px;
}
.track {
  display: flex;
  width: 200%;
  transition: transform 0.48s var(--spring);
}
.slider.register .track {
  transform: translateX(-50%);
}
.pane {
  width: 50%;
  flex: 0 0 50%;
}

.legal {
  margin: 18px 0 0;
  font-size: 12px;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.45);
}

:deep(.el-form-item) {
  margin-bottom: 12px;
}
:deep(.el-form-item__label) {
  display: none !important;
}
:deep(.el-form-item__content) {
  margin-left: 0 !important;
}

:deep(.el-input__wrapper) {
  min-height: 44px;
  padding: 0 14px !important;
  border-radius: 12px !important;
  overflow: hidden;
  background-color: rgba(12, 18, 16, 0.55) !important;
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.28) inset,
    0 8px 24px rgba(0, 0, 0, 0.22) !important;
  backdrop-filter: blur(12px);
}
:deep(.el-input__wrapper:hover) {
  background-color: rgba(16, 24, 22, 0.62) !important;
}
:deep(.el-input__wrapper.is-focus) {
  background-color: rgba(18, 28, 25, 0.72) !important;
  box-shadow:
    0 0 0 1px rgba(45, 212, 191, 0.55) inset,
    0 0 0 4px rgba(45, 212, 191, 0.12),
    0 8px 24px rgba(0, 0, 0, 0.28) !important;
}

:deep(.el-input__inner) {
  height: 44px;
  font-size: 15px;
  color: #fff;
  background: transparent !important;
  -webkit-text-fill-color: #fff;
  caret-color: #fff;
  transition: background-color 99999s ease-in-out 0s;
}
:deep(.el-input__inner::placeholder) {
  color: rgba(255, 255, 255, 0.45);
  -webkit-text-fill-color: rgba(255, 255, 255, 0.45);
}
:deep(.el-input__inner:-webkit-autofill),
:deep(.el-input__inner:-webkit-autofill:hover),
:deep(.el-input__inner:-webkit-autofill:focus),
:deep(.el-input__inner:-webkit-autofill:active) {
  border-radius: 12px !important;
  -webkit-text-fill-color: #fff !important;
  caret-color: #fff;
  box-shadow: 0 0 0 100px rgba(255, 255, 255, 0.04) inset !important;
  -webkit-box-shadow: 0 0 0 100px rgba(255, 255, 255, 0.04) inset !important;
  transition: background-color 99999s ease-in-out 0s;
}
:deep(.el-input__suffix) {
  color: rgba(255, 255, 255, 0.55);
}

.cta {
  width: 100%;
  margin-top: 6px;
  height: 44px !important;
  border: none !important;
  border-radius: 980px !important;
  font-size: 15px !important;
  font-weight: 600 !important;
  color: #06241f !important;
  background: linear-gradient(135deg, #5eead4 0%, #2dd4bf 48%, #14b8a6 100%) !important;
  box-shadow:
    0 8px 22px rgba(45, 212, 191, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.35) !important;
  transition:
    transform 0.18s var(--spring),
    filter 0.18s ease,
    box-shadow 0.18s ease !important;
}
.cta:hover {
  filter: brightness(1.06);
  box-shadow:
    0 10px 26px rgba(45, 212, 191, 0.42),
    inset 0 1px 0 rgba(255, 255, 255, 0.4) !important;
}
.cta:active {
  transform: scale(0.985);
}

@media (max-width: 720px) {
  .shade {
    width: 94vw;
  }
  .shade-fill {
    background: linear-gradient(
      104deg,
      rgba(4, 8, 7, 0.9) 0%,
      rgba(4, 8, 7, 0.86) 82%,
      rgba(4, 8, 7, 0.62) 86%,
      rgba(214, 224, 234, 0.38) 89%,
      rgba(0, 0, 0, 0.18) 92%,
      transparent 96%,
      rgba(224, 230, 235, 0.12) 98%,
      transparent 100%
    );
  }
  .intro,
  .form-wrap {
    padding-top: 13vh;
    padding-left: clamp(28px, 8vw, 48px);
    padding-right: clamp(20px, 6vw, 32px);
  }
  .form-wrap {
    max-width: none;
  }
}

@media (max-height: 720px) {
  .intro,
  .form-wrap {
    padding-top: 9vh;
  }
  .intro-title {
    margin-bottom: 2.5vh;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hero-img,
  .shade,
  .intro,
  .form-wrap,
  .track,
  .thumb,
  .slider {
    transition: none !important;
  }
}
</style>
