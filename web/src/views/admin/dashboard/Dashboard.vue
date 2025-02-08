<template>
  <div class="admin-dashboard">
    <header class="dashboard-header">
      <h1>系統管理儀表板</h1>
      <div class="header-actions">
        <span class="last-login">
          <font-awesome-icon icon="clock" class="text-gray-500" />
          上次登入時間：{{ lastLoginTime }}
        </span>
      </div>
    </header>

    <div class="dashboard-grid">
      <!-- 餐廳統計 -->
      <BaseCard elevation="low" hoverable>
        <template #header>
          <div class="card-header-content">
            <div class="icon-wrapper restaurant">
              <font-awesome-icon icon="utensils" />
            </div>
            <h3>餐廳統計</h3>
          </div>
        </template>

        <div class="stat-list">
          <div class="stat-item">
            <div class="stat-info">
              <span class="stat-label">總餐廳數</span>
              <span class="stat-value">{{ stats.totalRestaurants }}</span>
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-info">
              <span class="stat-label">本月新增</span>
              <span class="stat-value highlight-green">{{ stats.newRestaurants }}</span>
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-info">
              <span class="stat-label">活躍餐廳</span>
              <span class="stat-value highlight-blue">{{ stats.activeRestaurants }}</span>
            </div>
          </div>
        </div>
      </BaseCard>

      <!-- 用戶統計 -->
      <BaseCard elevation="low" hoverable>
        <template #header>
          <div class="card-header-content">
            <div class="icon-wrapper users">
              <font-awesome-icon icon="users" />
            </div>
            <h3>用戶統計</h3>
          </div>
        </template>

        <div class="stat-list">
          <div class="stat-item">
            <div class="stat-info">
              <span class="stat-label">總用戶數</span>
              <span class="stat-value">{{ stats.totalUsers }}</span>
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-info">
              <span class="stat-label">本月活躍</span>
              <span class="stat-value highlight-purple">{{ stats.activeUsers }}</span>
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-info">
              <span class="stat-label">新註冊</span>
              <span class="stat-value highlight-orange">{{ stats.newUsers }}</span>
            </div>
          </div>
        </div>
      </BaseCard>

      <!-- 系統狀態 -->
      <BaseCard elevation="low" hoverable>
        <template #header>
          <div class="card-header-content">
            <div class="icon-wrapper system">
              <font-awesome-icon icon="chart-line" />
            </div>
            <h3>系統狀態</h3>
          </div>
        </template>

        <div class="stat-list">
          <div class="stat-item">
            <div class="stat-info">
              <span class="stat-label">系統運行時間</span>
              <span class="stat-value">{{ stats.uptime }}</span>
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-info">
              <span class="stat-label">CPU 使用率</span>
              <span class="stat-value" :class="{
                'highlight-red': stats.cpuUsage > 80,
                'highlight-orange': stats.cpuUsage > 60 && stats.cpuUsage <= 80,
                'highlight-green': stats.cpuUsage <= 60
              }">
                {{ stats.cpuUsage }}%
              </span>
            </div>
          </div>
          <div class="stat-item">
            <div class="stat-info">
              <span class="stat-label">記憶體使用</span>
              <span class="stat-value" :class="{
                'highlight-red': stats.memoryUsage > 80,
                'highlight-orange': stats.memoryUsage > 60 && stats.memoryUsage <= 80,
                'highlight-green': stats.memoryUsage <= 60
              }">
                {{ stats.memoryUsage }}%
              </span>
            </div>
          </div>
        </div>
      </BaseCard>
    </div>
  </div>
</template>

<script src="./Dashboard.js"></script>

<style src="./Dashboard.css" scoped></style>
