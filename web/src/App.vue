<template>
  <div class="app">
    <Sidebar />
    <main class="main-content">
      <router-view></router-view>
    </main>
  </div>
</template>

<script setup>
import Sidebar from './components/Sidebar.vue'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  background-color: #f8f9fa;
  color: #333;
}

.app {
  display: flex;
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
  background-color: white;
}

.main-content {
  flex: 1;
  padding: 2rem;
  background-color: #f8f9fa;
  transition: margin-left 0.3s ease;
}
</style>
