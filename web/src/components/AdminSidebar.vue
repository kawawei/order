<template>
  <aside class="sidebar" :class="{ 'collapsed': isCollapsed }">
    <div class="toggle-btn-wrapper">
      <button class="toggle-btn" @click="toggleSidebar">
        <i :class="isCollapsed ? 'fas fa-bars' : 'fas fa-chevron-left'"></i>
      </button>
    </div>
    <nav class="sidebar-nav">
      <router-link to="/admin/dashboard" class="nav-item">
        <div class="icon-wrapper">
          <i class="fas fa-chart-pie"></i>
        </div>
        <span class="nav-text">系統總覽</span>
      </router-link>

      <router-link to="/admin/restaurants" class="nav-item">
        <div class="icon-wrapper">
          <i class="fas fa-store"></i>
        </div>
        <span class="nav-text">餐廳管理</span>
      </router-link>

      <router-link to="/admin/users" class="nav-item">
        <div class="icon-wrapper">
          <i class="fas fa-users"></i>
        </div>
        <span class="nav-text">用戶管理</span>
      </router-link>

      <router-link to="/admin/settings" class="nav-item">
        <div class="icon-wrapper">
          <i class="fas fa-cogs"></i>
        </div>
        <span class="nav-text">系統設置</span>
      </router-link>
    </nav>
  </aside>
</template>

<script setup>
import { ref } from 'vue'

const isCollapsed = ref(false)

const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
}
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
