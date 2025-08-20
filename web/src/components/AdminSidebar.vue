<template>
  <aside class="sidebar" :class="{ 'collapsed': isCollapsed }">
    <div class="toggle-btn-wrapper">
      <button class="toggle-btn" @click="toggleSidebar">
        <font-awesome-icon :icon="isCollapsed ? 'bars' : 'chevron-left'" />
      </button>
    </div>

    <nav class="sidebar-nav">
      <router-link 
        v-for="item in menuItems" 
        :key="item.path"
        :to="item.path"
        class="nav-item"
        :class="{ 'active': $route.path === item.path }"
      >
        <div class="icon-wrapper">
          <font-awesome-icon :icon="item.icon" />
        </div>
        <span class="nav-text">{{ item.label }}</span>
      </router-link>
    </nav>
  </aside>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const isCollapsed = ref(false)

const menuItems = [
  { path: '/admin/dashboard', icon: 'chart-line', label: '儀表板' },
  { path: '/admin/restaurants', icon: 'utensils', label: '餐廳管理' },
  { path: '/admin/reports', icon: 'chart-bar', label: '報表統計' }
]

const toggleSidebar = () => {
  isCollapsed.value = !isCollapsed.value
}
</script>

<style scoped>
.sidebar {
  width: 240px;
  height: 100vh;
  background-color: #ffffff;
  color: #64748b;
  transition: all 0.3s;
  position: relative;
  box-shadow: 1px 0 4px rgba(0, 0, 0, 0.05);
  border-right: 1px solid #e2e8f0;
}

.collapsed {
  width: 64px;
}

.toggle-btn-wrapper {
  padding: 1.25rem;
  text-align: right;
  border-bottom: 1px solid #e2e8f0;
}

.toggle-btn {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 6px;
  transition: all 0.2s;
}

.toggle-btn:hover {
  color: #3b82f6;
  background-color: #f1f5f9;
}

.sidebar-nav {
  padding: 1rem 0;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 0.875rem 1.5rem;
  color: #64748b;
  text-decoration: none;
  transition: all 0.2s;
  margin: 0.25rem 0.75rem;
  border-radius: 8px;
}

.nav-item:hover {
  color: #3b82f6;
  background-color: #f1f5f9;
}

.nav-item.active {
  color: #3b82f6;
  background-color: #eff6ff;
  font-weight: 500;
}

.icon-wrapper {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 0.875rem;
}

.nav-text {
  font-size: 0.9375rem;
  font-weight: 500;
  white-space: nowrap;
  opacity: 1;
  transition: opacity 0.2s;
}

.collapsed .nav-text {
  opacity: 0;
  width: 0;
  margin: 0;
}

.collapsed .nav-item {
  padding: 0.875rem;
  justify-content: center;
}

.collapsed .icon-wrapper {
  margin: 0;
}
</style>]]>
