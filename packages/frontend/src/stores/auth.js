import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { login as loginApi, register as registerApi } from '../api/http'
import { clearAuth, loadAuth, saveAuth } from '../utils/auth'

export const useAuthStore = defineStore('auth', () => {
  const cached = loadAuth()
  const token = ref(cached?.token || '')
  const user = ref(cached?.user || null)

  const isLoggedIn = computed(() => Boolean(token.value))
  const displayName = computed(() => user.value?.displayName || user.value?.username || '')

  async function login(username, password) {
    const data = await loginApi(username, password)
    token.value = data.token
    user.value = data.user
    saveAuth({ token: data.token, user: data.user })
    return data
  }

  async function register(username, password, displayName) {
    const data = await registerApi(username, password, displayName)
    token.value = data.token
    user.value = data.user
    saveAuth({ token: data.token, user: data.user })
    return data
  }

  function logout() {
    token.value = ''
    user.value = null
    clearAuth()
  }

  return { token, user, isLoggedIn, displayName, login, register, logout }
})
