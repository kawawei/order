<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-header">
        <h1>餐廳管理系統</h1>
        <p>請登入您的帳號</p>
      </div>
      
      <form class="login-form" @submit.prevent="handleLogin">
        <div class="form-group">
          <div class="input-group">
            <span class="input-icon">
              <font-awesome-icon icon="envelope" />
            </span>
            <input 
              type="email" 
              v-model="form.email"
              placeholder="請輸入您的電子郵件"
              required
            />
          </div>
        </div>
        
        <div class="form-group">
          <div class="input-group">
            <span class="input-icon">
              <font-awesome-icon icon="lock" />
            </span>
            <input 
              :type="showPassword ? 'text' : 'password'" 
              v-model="form.password"
              placeholder="請輸入您的密碼"
              required
            />
            <button 
              type="button"
              class="toggle-password"
              @click="showPassword = !showPassword"
            >
              <font-awesome-icon :icon="showPassword ? 'eye-slash' : 'eye'" />
            </button>
          </div>
        </div>
        
        <div class="form-group remember-me">
          <label class="checkbox-label">
            <input 
              type="checkbox" 
              v-model="form.rememberMe"
            />
            <span>記住我</span>
          </label>
          <a href="#" class="forgot-password">忘記密碼？</a>
        </div>
        
        <BaseButton 
          type="submit"
          variant="primary"
          :loading="loading"
          class="login-button"
          :disabled="loading"
        >
          {{ loading ? '登入中...' : '登入' }}
        </BaseButton>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../../../composables/useAuth'
import '../../../assets/styles/login.css'

const router = useRouter()
const { login } = useAuth()

const loading = ref(false)
const showPassword = ref(false)
const form = ref({
  email: '',
  password: '',
  rememberMe: false
})

import { useToast } from '../../../composables/useToast'

const toast = useToast()

const handleLogin = async () => {
  try {
    loading.value = true
    await login(form.value)
    toast.success('登入成功')
    router.push({ name: 'MerchantDashboard' })
  } catch (error) {
    toast.error(error.message || '登入失敗')
    console.error('登入失敗：', error)
  } finally {
    loading.value = false
  }
}
</script>
