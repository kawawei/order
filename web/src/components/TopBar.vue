<template>
  <div class="top-bar">
    <div class="top-bar-left">
      <h1 class="app-title">餐廳管理系統</h1>
    </div>
    <div class="top-bar-right">
      <div class="user-info">
        <font-awesome-icon icon="user" class="user-icon" />
        <span class="username">{{ username }}</span>
      </div>
      <BaseButton 
        variant="text" 
        size="small" 
        @click="handleLogout"
        class="logout-button"
      >
        <font-awesome-icon icon="sign-out-alt" class="logout-icon" />
        登出
      </BaseButton>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { user, logout } = useAuth()
const username = ref('')

onMounted(() => {
  // 優先從統一的 user 鍵讀取，若沒有則回退舊的 merchant 鍵
  const storedUserRaw = localStorage.getItem('user')
  if (storedUserRaw) {
    try {
      const userData = JSON.parse(storedUserRaw)
      // 根據角色推導顯示名稱
      let displayName = ''
      const role = userData.role
      if (role === 'admin' || role === 'superadmin') {
        displayName = userData.username || userData.name || '超級管理員'
      } else if (role === 'employee') {
        displayName = userData.name || userData.account || '員工'
      } else if (role === 'merchant') {
        displayName = userData.businessName || userData.name || userData.merchantCode || '商家'
      } else {
        displayName = userData.name || userData.username || '用戶'
      }
      username.value = displayName
      return
    } catch (e) {
      // 解析失敗則嘗試回退到 merchant
    }
  }

  const storedMerchantRaw = localStorage.getItem('merchant')
  if (storedMerchantRaw) {
    try {
      const merchantData = JSON.parse(storedMerchantRaw)
      username.value = merchantData.businessName || merchantData.name || '商家'
    } catch (e) {
      username.value = '商家'
    }
  }
})

import { useToast } from '../composables/useToast'

const toast = useToast()

const handleLogout = async () => {
  try {
    logout()
    toast.success('登出成功')
    await router.push({ name: 'MerchantLogin' })
    window.location.reload() // 強制重新載入頁面
  } catch (error) {
    toast.error('登出失敗')
    console.error('登出時發生錯誤：', error)
  }
}
</script>

<style>
.top-bar {
  height: 60px;
  background: white;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 1.5rem;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
}

.app-title {
  font-size: 1.25rem;
  color: #1d1d1f;
  margin: 0;
  font-weight: 600;
}

.top-bar-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.user-info:hover {
  background: #f5f5f7;
}

.user-icon {
  color: #666;
  font-size: 1rem;
}

.username {
  font-size: 0.9375rem;
  color: #1d1d1f;
  font-weight: 500;
}

.logout-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.logout-icon {
  font-size: 1rem;
  color: #666;
}
</style>
