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
              type="text" 
              v-model="form.merchantCode"
              placeholder="請輸入商家代碼"
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
              v-model="form.employeeCode"
              placeholder="請輸入員工編號"
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

        <div class="form-footer">
          <p>還沒有帳號？<router-link to="/merchant/register" class="register-link">立即註冊</router-link></p>
        </div>
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
  merchantCode: '',
  employeeCode: '',
  rememberMe: false
})

import { useToast } from '../../../composables/useToast'

const toast = useToast()

const handleLogin = async () => {
  try {
    loading.value = true
    const response = await login(form.value)
    console.log('登入響應:', response)
    
    // 先存儲用戶信息
    localStorage.setItem('user', JSON.stringify({
      ...response.data.merchant,
      role: 'merchant'
    }))
    
    // 存儲 token
    localStorage.setItem('token', response.token)
    
    toast.success('登入成功')
    
    // 等待一下再重定向，讓用戶看到成功提示
    setTimeout(() => {
      window.location.href = '/merchant/dashboard'
    }, 1000)
  } catch (error) {
    console.error('登入失敗：', error)
    if (error.response) {
      toast.error(error.response.data.message || '登入失敗，請稍後再試')
    } else if (error.message) {
      toast.error(error.message)
    } else {
      toast.error('登入失敗，請稍後再試')
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.form-footer {
  margin-top: 1rem;
  text-align: center;
}

.register-link {
  color: var(--primary-color);
  text-decoration: none;
  font-weight: 600;
}

.register-link:hover {
  text-decoration: underline;
}
</style>
