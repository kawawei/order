<template>
  <div class="app-layout">
    <TopBar />
    <div class="layout-content">
      <Sidebar />
      <div class="main-content">
        <router-view></router-view>
      </div>
    </div>
  </div>
</template>

<script setup>
import Sidebar from '../components/Sidebar.vue'
import TopBar from '../components/TopBar.vue'
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  background-color: #f5f5f7;
}

.layout-content {
  display: flex;
  min-height: calc(100vh - 60px);
  margin-top: 60px;
}

.main-content {
  flex: 1;
  padding: 2rem;
  background-color: #f5f5f7;
  overflow-y: auto;
  height: calc(100vh - 60px);
}
</style>
