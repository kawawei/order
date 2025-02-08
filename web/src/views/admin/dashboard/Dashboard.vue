<template>
  <div class="admin-dashboard">
    <header class="dashboard-header">
      <h1>系統管理儀表板</h1>
      <div class="header-actions">
        <span class="last-login">
          <font-awesome-icon icon="clock" />
          上次登入時間：{{ lastLoginTime }}
        </span>
      </div>
    </header>

    <div class="dashboard-grid">
      <!-- 餐廳統計 -->
      <div class="dashboard-card">
        <div class="card-header">
          <font-awesome-icon icon="utensils" />
          <h3>餐廳統計</h3>
        </div>
        <div class="card-content">
          <div class="stat-item">
            <span class="stat-label">總餐廳數</span>
            <span class="stat-value">{{ stats.totalRestaurants }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">本月新增</span>
            <span class="stat-value">{{ stats.newRestaurants }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">活躍餐廳</span>
            <span class="stat-value">{{ stats.activeRestaurants }}</span>
          </div>
        </div>
      </div>

      <!-- 用戶統計 -->
      <div class="dashboard-card">
        <div class="card-header">
          <font-awesome-icon icon="users" />
          <h3>用戶統計</h3>
        </div>
        <div class="card-content">
          <div class="stat-item">
            <span class="stat-label">總用戶數</span>
            <span class="stat-value">{{ stats.totalUsers }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">本月活躍</span>
            <span class="stat-value">{{ stats.activeUsers }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">新註冊</span>
            <span class="stat-value">{{ stats.newUsers }}</span>
          </div>
        </div>
      </div>

      <!-- 系統狀態 -->
      <div class="dashboard-card">
        <div class="card-header">
          <font-awesome-icon icon="chart-line" />
          <h3>系統狀態</h3>
        </div>
        <div class="card-content">
          <div class="stat-item">
            <span class="stat-label">系統運行時間</span>
            <span class="stat-value">{{ stats.uptime }}</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">CPU 使用率</span>
            <span class="stat-value">{{ stats.cpuUsage }}%</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">記憶體使用</span>
            <span class="stat-value">{{ stats.memoryUsage }}%</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

// 模擬數據
const stats = ref({
  totalRestaurants: 156,
  newRestaurants: 12,
  activeRestaurants: 98,
  totalUsers: 1234,
  activeUsers: 856,
  newUsers: 45,
  uptime: '15 天 6 小時',
  cpuUsage: 35,
  memoryUsage: 42
})

const lastLoginTime = ref('2024-02-08 15:30:25')

onMounted(() => {
  // 這裡可以添加實際的數據獲取邏輯
})
</script>

<style scoped>
.admin-dashboard {
  padding: 1.5rem;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.dashboard-header h1 {
  font-size: 1.8rem;
  color: #2c3e50;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.last-login {
  font-size: 0.9rem;
  color: #666;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
}

.dashboard-card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  padding: 1.5rem;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  color: #2c3e50;
}

.card-header svg {
  font-size: 1.25rem;
  color: #3b82f6;
}

.card-header h3 {
  margin: 0;
  font-size: 1.25rem;
}

.card-content {
  display: grid;
  gap: 1rem;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
  border-bottom: 1px solid #eee;
}

.stat-item:last-child {
  border-bottom: none;
}

.stat-label {
  color: #666;
  font-size: 0.9rem;
}

.stat-value {
  font-weight: 600;
  color: #2c3e50;
  font-size: 1.1rem;
}
</style>
