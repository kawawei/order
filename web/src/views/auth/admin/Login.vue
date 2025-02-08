<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-header">
        <h1>系統管理後台</h1>
        <p>超級管理員登入</p>
      </div>
      
      <form class="login-form" @submit.prevent="handleLogin">
        <div class="form-group">
          <div class="input-wrapper">
            <font-awesome-icon icon="user" class="input-icon" />
            <input 
              type="text" 
              v-model="form.username"
              placeholder="請輸入管理員帳號"
              required
            />
          </div>
        </div>
        
        <div class="form-group">
          <div class="input-wrapper">
            <font-awesome-icon icon="lock" class="input-icon" />
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

        <div class="form-group">
          <div class="input-wrapper">
            <font-awesome-icon icon="shield-alt" class="input-icon" />
            <input 
              type="text" 
              v-model="form.verificationCode"
              placeholder="請輸入驗證碼"
              maxlength="6"
              required
            />
          </div>
        </div>

        <div class="form-group remember-me">
          <label class="custom-checkbox">
            <input 
              type="checkbox"
              v-model="form.rememberMe"
            />
            <span class="checkmark"></span>
            <span class="label-text">記住我</span>
          </label>
        </div>
        
        <button 
          type="submit"
          class="login-button"
          :disabled="loading"
        >
          {{ loading ? '登入中...' : '登入' }}
        </button>
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
import { useToast } from '../../../composables/useToast'
import '../../../assets/styles/login.css'

const router = useRouter()
const { login } = useAuth()
const toast = useToast()

const loading = ref(false)
const showPassword = ref(false)
const form = ref({
  username: '',
  password: '',
  verificationCode: '',
  rememberMe: false
})

const handleLogin = async () => {
  try {
    loading.value = true
    await login({
      ...form.value,
      role: 'admin'
    })
    toast.success('登入成功')
    router.push('/admin/dashboard')
  } catch (error) {
    console.error('登入失敗：', error)
    toast.error('帳號、密碼或驗證碼錯誤')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.form-group {
  margin-bottom: 1.5rem;
}

.remember-me {
  margin: 1rem 0;
}

.custom-checkbox {
  display: flex;
  align-items: center;
  position: relative;
  padding-left: 28px;
  cursor: pointer;
  user-select: none;
  color: #374151;
  font-size: 0.9rem;
}

.custom-checkbox input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.checkmark {
  position: absolute;
  left: 0;
  height: 18px;
  width: 18px;
  background-color: #fff;
  border: 2px solid #E5E7EB;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.custom-checkbox:hover input ~ .checkmark {
  border-color: #3B82F6;
}

.custom-checkbox input:checked ~ .checkmark {
  background-color: #3B82F6;
  border-color: #3B82F6;
}

.checkmark:after {
  content: "";
  position: absolute;
  display: none;
  left: 5px;
  top: 1px;
  width: 4px;
  height: 9px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.custom-checkbox input:checked ~ .checkmark:after {
  display: block;
}

.label-text {
  margin-left: 4px;
}

.input-wrapper {
  position: relative;
}

.input-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #6B7280;
  z-index: 1;
}

.form-group input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.5rem;
  border: 1px solid #E5E7EB;
  border-radius: 0.5rem;
  font-size: 1rem;
  transition: all 0.2s;
  background-color: white;
}

.form-group input:focus {
  outline: none;
  border-color: #3B82F6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.toggle-password {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #6B7280;
  cursor: pointer;
  padding: 0;
}

.toggle-password:hover {
  color: #374151;
}

.login-button {
  width: 100%;
  padding: 0.75rem;
  background-color: #3B82F6;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.login-button:hover {
  background-color: #2563EB;
}

.login-button:disabled {
  background-color: #93C5FD;
  cursor: not-allowed;
}

.security-notice {
  margin-top: 2rem;
  padding: 1rem;
  background-color: #FEF3C7;
  border: 1px solid #FCD34D;
  border-radius: 0.5rem;
  color: #92400E;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.security-notice svg {
  color: #92400E;
}
</style>
