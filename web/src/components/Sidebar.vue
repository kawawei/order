<template>
  <aside class="sidebar" :class="{ 'collapsed': isCollapsed }">
    <div class="toggle-btn-wrapper">
      <button class="toggle-btn" @click="toggleSidebar">
        <font-awesome-icon :icon="isCollapsed ? 'bars' : 'chevron-left'" size="lg" />
      </button>
    </div>
    <nav class="sidebar-nav">
      <router-link :to="{ path: '/merchant/dashboard', query: route.query }" class="nav-item">
        <div class="icon-wrapper">
          <font-awesome-icon icon="chart-line" />
        </div>
        <span class="nav-text">儀表板</span>
      </router-link>

      <router-link :to="{ path: '/merchant/menu', query: route.query }" class="nav-item">
        <div class="icon-wrapper">
          <font-awesome-icon icon="utensils" />
        </div>
        <span class="nav-text">菜單管理</span>
      </router-link>

      <router-link :to="{ path: '/merchant/tables', query: route.query }" class="nav-item">
        <div class="icon-wrapper">
          <font-awesome-icon icon="table" />
        </div>
        <span class="nav-text">桌次管理</span>
      </router-link>

      <router-link :to="{ path: '/merchant/orders', query: route.query }" class="nav-item">
        <div class="icon-wrapper">
          <font-awesome-icon icon="receipt" />
        </div>
        <span class="nav-text">查看訂單</span>
      </router-link>

      <router-link :to="{ path: '/merchant/settings', query: route.query }" class="nav-item">
        <div class="icon-wrapper">
          <font-awesome-icon icon="cog" />
        </div>
        <span class="nav-text">基礎設置</span>
      </router-link>
    </nav>
  </aside>
</template>

<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
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
  transition: all 0.3s;
  border-left: 3px solid transparent;
  white-space: nowrap;
  height: 42px;
}

.icon-wrapper {
  width: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.nav-item:hover {
  color: #1a73e8;
  background-color: #f8f9fa;
  border-left-color: #1a73e8;
}

.nav-item.router-link-active {
  color: #1a73e8;
  background-color: #f8f9fa;
  border-left-color: #1a73e8;
}

.nav-text {
  margin-left: 0.8rem;
  transition: opacity 0.3s;
}

.sidebar.collapsed .nav-item {
  padding: 0.8rem 0;
  justify-content: center;
}

.sidebar.collapsed .nav-text {
  display: none;
  opacity: 0;
}
</style>
