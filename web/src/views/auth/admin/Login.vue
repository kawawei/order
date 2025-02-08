<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-header">
        <h1>系統管理後台</h1>
        <p>超級管理員登入</p>
      </div>
      
      <form class="login-form" @submit.prevent="handleLogin">
        <div class="form-group">
          <label>帳號</label>
          <div class="input-group">
            <font-awesome-icon icon="user" />
            <input 
              type="text" 
              v-model="form.username"
              placeholder="請輸入管理員帳號"
              required
            />
          </div>
        </div>
        
        <div class="form-group">
          <label>密碼</label>
          <div class="input-group">
            <font-awesome-icon icon="lock" />
            <input 
              :type="showPassword ? 'text' : 'password'" 
              v-model="form.password"
              placeholder="請輸入密碼"
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

        <div class="form-group verification-code">
          <label>驗證碼</label>
          <div class="input-group">
            <font-awesome-icon icon="shield-alt" />
            <input 
              type="text" 
              v-model="form.verificationCode"
              placeholder="請輸入驗證碼"
              required
            />
          </div>
          <!-- 這裡可以添加驗證碼圖片 -->
        </div>
        
        <BaseButton 
          type="submit"
          variant="primary"
          :loading="loading"
          class="login-button"
        >
          登入
        </BaseButton>
      </form>

      <div class="security-notice">
        <font-awesome-icon icon="info-circle" />
        <span>此為系統管理員專用入口，未經授權請勿嘗試登入</span>
      </div>
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
  username: '',
  password: '',
  verificationCode: ''
})

const handleLogin = async () => {
  try {
    loading.value = true
    await login({
      ...form.value,
      role: 'admin'
    })
    router.push('/admin/dashboard')
  } catch (error) {
    console.error('登入失敗：', error)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.verification-code {
  margin-bottom: 1.5rem;
}

.security-notice {
  margin-top: 2rem;
  padding: 1rem;
  background-color: #fff3cd;
  border: 1px solid #ffeeba;
  border-radius: 4px;
  color: #856404;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.security-notice svg {
  color: #856404;
}
</style>
