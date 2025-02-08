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
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const username = ref('管理員') // 這裡之後可以從 store 或 API 獲取

const handleLogout = () => {
  // TODO: 實現登出邏輯
  console.log('登出')
  // router.push('/login')
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
