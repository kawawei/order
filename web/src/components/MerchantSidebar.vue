<![CDATA[<template>
  <aside class="sidebar" :class="{ 'collapsed': isCollapsed }">
    <div class="toggle-btn-wrapper">
      <button class="toggle-btn" @click="toggleSidebar">
        <i :class="isCollapsed ? 'fas fa-bars' : 'fas fa-chevron-left'"></i>
      </button>
    </div>
    <nav class="sidebar-nav">
      <router-link to="/merchant/dashboard" class="nav-item">
        <div class="icon-wrapper">
          <i class="fas fa-chart-line"></i>
        </div>
        <span class="nav-text">營運儀表板</span>
      </router-link>

      <router-link to="/merchant/menu" class="nav-item">
        <div class="icon-wrapper">
          <i class="fas fa-utensils"></i>
        </div>
        <span class="nav-text">菜單管理</span>
      </router-link>

      <!-- 暫時隱藏設置選項
      <router-link to="/merchant/settings" class="nav-item">
        <div class="icon-wrapper">
          <i class="fas fa-cog"></i>
        </div>
        <span class="nav-text">基礎設置</span>
      </router-link>
      -->
    </nav>
  </aside>
</template>

<script setup>
import { ref, onMounted } from 'vue'

// 從 localStorage 讀取側邊欄狀態，預設為展開狀態
const getInitialSidebarState = () => {
  try {
    const stored = localStorage.getItem('merchant_sidebar_collapsed')
    return stored ? JSON.parse(stored) : false
  } catch (error) {
    console.error('讀取商家側邊欄狀態失敗:', error)
    return false
  }
}

const isCollapsed = ref(getInitialSidebarState())

const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
  // 將狀態保存到 localStorage
  try {
    localStorage.setItem('merchant_sidebar_collapsed', JSON.stringify(isCollapsed.value))
  } catch (error) {
    console.error('保存商家側邊欄狀態失敗:', error)
  }
}

// 組件掛載時確保狀態同步
onMounted(() => {
  // 如果 localStorage 中的狀態與當前狀態不一致，則同步
  const storedState = getInitialSidebarState()
  if (storedState !== isCollapsed.value) {
    isCollapsed.value = storedState
  }
})
</script>

<style scoped>
.sidebar {
  width: 200px;
  height: 100vh;
  background-color: white;
  color: #333;
  transition: all 0.3s ease;
  position: relative;
  border-right: 1px solid #eee;
}

.sidebar.collapsed {
  width: 48px;
}

.toggle-btn-wrapper {
  padding: 1rem;
  display: flex;
  justify-content: flex-end;
}

.toggle-btn {
  background: white;
  border: 1px solid #eee;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.toggle-btn:hover {
  background: #f8f9fa;
  color: #1a73e8;
}

.sidebar.collapsed .toggle-btn-wrapper {
  padding: 0.5rem;
}

.sidebar.collapsed .toggle-btn {
  width: 36px;
  height: 36px;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  padding-top: 1rem;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 0.8rem 1rem;
  color: #666;
  text-decoration: none;
  transition: all 0.3s ease;
}

.nav-item:hover {
  background: #f8f9fa;
  color: #1a73e8;
}

.nav-item.router-link-active {
  color: #1a73e8;
  background: #f0f7ff;
  font-weight: 500;
}

.icon-wrapper {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 0.8rem;
}

.nav-text {
  white-space: nowrap;
  opacity: 1;
  transition: opacity 0.3s ease;
}

.sidebar.collapsed .nav-text {
  opacity: 0;
  width: 0;
  overflow: hidden;
}

.sidebar.collapsed .nav-item {
  padding: 0.8rem;
  justify-content: center;
}

.sidebar.collapsed .icon-wrapper {
  margin-right: 0;
}
</style>]]>
