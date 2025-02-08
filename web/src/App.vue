<template>
  <router-view></router-view>
</template>

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
  min-height: 100vh;
  position: relative;
  overflow-x: hidden;
  background-color: white;
}

.app-content {
  display: flex;
  min-height: calc(100vh - 60px);
  margin-top: 60px;
}

.main-content {
  flex: 1;
  padding: 1.5rem;
  background-color: #f8f9fa;
  transition: margin-left 0.3s ease;
}
</style>
