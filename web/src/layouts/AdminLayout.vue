<template>
  <div class="app-layout">
    <TopBar />
    <div class="layout-content">
      <AdminSidebar />
      <main class="main-content">
        <Suspense>
          <router-view />
        </Suspense>
      </main>
    </div>
  </div>
</template>

<script setup>
import TopBar from '../components/TopBar.vue'
import AdminSidebar from '../components/AdminSidebar.vue'
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
}
</style>
