import { createRouter, createWebHistory } from 'vue-router'
import DashboardPage from '../pages/DashboardPage.vue'
import LoginPage from '../pages/LoginPage.vue'
import { clearAuth, getToken, loadAuth, saveAuth } from '../utils/auth'
import { fetchMe } from '../api/http'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: LoginPage },
    { path: '/register', name: 'register', component: LoginPage },
    { path: '/', name: 'dashboard', component: DashboardPage, meta: { auth: true } },
  ],
})

async function ensureValidSession() {
  const token = getToken()
  if (!token) return false
  try {
    const data = await fetchMe()
    if (data?.user) {
      const prev = loadAuth() || {}
      saveAuth({ token, user: data.user || prev.user })
      return true
    }
  } catch {
    /* 令牌无效或过期 */
  }
  clearAuth()
  return false
}

router.beforeEach(async (to) => {
  const isAuthPage = to.name === 'login' || to.name === 'register'
  if (to.meta.auth) {
    const ok = await ensureValidSession()
    if (!ok) return { name: 'login', query: { redirect: to.fullPath } }
    return true
  }
  if (isAuthPage && getToken()) {
    const ok = await ensureValidSession()
    if (ok) return { name: 'dashboard' }
  }
  return true
})
