<template>
  <div class="settings-page">
    <header class="page-header">
      <h1>設置</h1>
    </header>

    <main class="settings-content">
      <!-- 設置內容待實現 -->
      <div class="empty-state">
        <div class="empty-content">
          <font-awesome-icon icon="cog" size="2x" />
          <h2>設置頁面開發中</h2>
          <p>此功能即將推出，敬請期待</p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
</script>

<style scoped>
.settings-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.page-header {
  margin-bottom: 2rem;
}

.page-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1d1d1f;
  margin: 0;
}

.settings-content {
  flex: 1;
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.empty-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.empty-content {
  text-align: center;
  color: #666;
}

.empty-content h2 {
  margin: 1rem 0 0.5rem;
  font-size: 1.25rem;
  font-weight: 500;
}

.empty-content p {
  margin: 0;
  font-size: 0.9375rem;
}
</style>
