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
        v-if="showBackToAdmin"
        variant="text" 
        size="small" 
        @click="backToAdmin"
        class="back-button"
      >
        <font-awesome-icon icon="arrow-left" class="back-icon" />
        返回管理員後台
      </BaseButton>
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
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const route = useRoute()
const { user, logout, getUserRole } = useAuth()
const username = ref('')

onMounted(() => {
  // 優先從統一的 user 鍵讀取，若沒有則回退舊的 merchant 鍵
  // 先讀 admin，再讀 merchant，再回退舊鍵
  const adminRaw = localStorage.getItem('admin_user')
  if (adminRaw) {
    try {
      const admin = JSON.parse(adminRaw)
      username.value = admin.username || admin.name || '超級管理員'
      return
    } catch (e) {}
  }

  const merchantRaw = localStorage.getItem('merchant_user')
  if (merchantRaw) {
    try {
      const mu = JSON.parse(merchantRaw)
      const role = mu.role
      let displayName = ''
      if (role === 'employee') {
        displayName = mu.name || mu.account || '員工'
      } else {
        displayName = mu.businessName || mu.name || mu.merchantCode || '商家'
      }
      username.value = displayName
      return
    } catch (e) {}
  }

  // 回退：舊鍵
  const legacyUserRaw = localStorage.getItem('user')
  if (legacyUserRaw) {
    try {
      const userData = JSON.parse(legacyUserRaw)
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
    } catch (e) {}
  }

  const legacyMerchantRaw = localStorage.getItem('merchant')
  if (legacyMerchantRaw) {
    try {
      const merchantData = JSON.parse(legacyMerchantRaw)
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
    const isAdminContext = window.location.pathname.startsWith('/admin')
    await router.push({ name: isAdminContext ? 'AdminLogin' : 'MerchantLogin' })
    window.location.reload()
  } catch (error) {
    toast.error('登出失敗')
    console.error('登出時發生錯誤：', error)
  }
}

// 僅當超級管理員/管理員身分正在瀏覽商家後台時，顯示返回管理員後台按鈕
const isAdminRole = (role) => role === 'admin' || role === 'superadmin'
const showBackToAdmin = computed(() => {
  const role = getUserRole()
  const path = route.path || window.location.pathname || ''
  const inMerchantArea = path.startsWith('/merchant')
  return inMerchantArea && isAdminRole(role)
})

const backToAdmin = async () => {
  try {
    await router.push({ name: 'AdminRestaurants' })
  } catch (e) {
    // 回退到管理員儀表板
    await router.push({ name: 'AdminDashboard' })
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

.back-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.back-icon {
  font-size: 1rem;
  color: #666;
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
