<template>
  <div class="admin-dashboard">
    <!-- 歡迎橫幅 -->
    <div class="welcome-banner">
      <div class="banner-content">
        <div class="welcome-text">
          <h1>歡迎回來，{{ userInfo.name || '管理員' }}</h1>
          <p>今天是 {{ currentDate }}，讓我們來看看今天的營運狀況</p>
        </div>
        <div class="banner-actions">
          <div class="quick-actions">
            <button class="action-btn primary" @click="handleViewReports">
              <font-awesome-icon icon="chart-bar" />
              <span>查看報表</span>
            </button>
            <button class="action-btn secondary" @click="handleManageUsers">
              <font-awesome-icon icon="users" />
              <span>餐廳管理</span>
            </button>
          </div>
          <div class="banner-stats">
            <div class="quick-stat">
              <font-awesome-icon icon="clock" />
              <span>上次登入：{{ lastLoginTime }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading-container">
      <div class="loading-spinner">
        <font-awesome-icon icon="spinner" spin size="2x" />
        <p>載入儀表板數據中...</p>
      </div>
    </div>

    <div v-else class="dashboard-content">
      <!-- 主要統計卡片 -->
      <div class="stats-grid">
        <div class="stat-card orders">
          <div class="stat-icon">
            <font-awesome-icon icon="receipt" />
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.todayOrders }}</div>
            <div class="stat-label">今日訂單</div>
            <div class="stat-trend positive">
              <font-awesome-icon icon="arrow-up" />
              <span>+12.5%</span>
            </div>
          </div>
        </div>

        <div class="stat-card revenue">
          <div class="stat-icon">
            <font-awesome-icon icon="dollar-sign" />
          </div>
          <div class="stat-content">
            <div class="stat-value">${{ stats.todayRevenue.toLocaleString() }}</div>
            <div class="stat-label">今日營收</div>
            <div class="stat-trend positive">
              <font-awesome-icon icon="arrow-up" />
              <span>+8.3%</span>
            </div>
          </div>
        </div>

        <div class="stat-card profit">
          <div class="stat-icon">
            <font-awesome-icon icon="chart-line" />
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.profitMargin }}%</div>
            <div class="stat-label">毛利率</div>
            <div class="stat-trend positive">
              <font-awesome-icon icon="arrow-up" />
              <span>+2.1%</span>
            </div>
          </div>
        </div>

        <div class="stat-card restaurants">
          <div class="stat-icon">
            <font-awesome-icon icon="store" />
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.popularRestaurants.length }}</div>
            <div class="stat-label">活躍餐廳</div>
            <div class="stat-trend neutral">
              <font-awesome-icon icon="minus" />
              <span>持平</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 主要內容區域 -->
      <div class="main-content">
        <!-- 左側：詳細數據 -->
        <div class="left-panel">
          <!-- 熱門餐廳排行 -->
          <BaseCard elevation="medium" class="ranking-card">
            <template #header>
              <div class="card-header">
                <h3>熱門餐廳排行</h3>
                <button class="view-all">查看全部</button>
              </div>
            </template>
            <div class="ranking-list">
              <div v-for="(restaurant, index) in stats.popularRestaurants" :key="restaurant.id" class="ranking-item">
                <div class="rank-badge" :class="'rank-' + (index + 1)">{{ index + 1 }}</div>
                <div class="restaurant-avatar">
                  <font-awesome-icon icon="store" />
                </div>
                <div class="restaurant-details">
                  <div class="restaurant-name">{{ restaurant.name }}</div>
                  <div class="restaurant-location">台北市</div>
                </div>
                <div class="restaurant-stats">
                  <div class="order-count">{{ restaurant.orderCount }} 訂單</div>
                  <div class="revenue-amount">${{ getRestaurantRevenue(restaurant.id).toLocaleString() }}</div>
                </div>
                <div class="trend-indicator positive">
                  <font-awesome-icon icon="arrow-up" />
                </div>
              </div>
            </div>
          </BaseCard>
        </div>

        <!-- 右側：營運狀況 -->
        <div class="right-panel">
          <!-- 餐廳營收比較 -->
          <BaseCard elevation="medium" class="revenue-card">
            <template #header>
              <div class="card-header">
                <h3>營收統計</h3>
                <div class="total-revenue">總計：${{ stats.totalRevenue.toLocaleString() }}</div>
              </div>
            </template>
            <div class="revenue-breakdown">
              <div v-for="restaurant in stats.restaurantRevenue" :key="restaurant.id" class="revenue-item">
                <div class="restaurant-info">
                  <div class="restaurant-name">{{ restaurant.name }}</div>
                </div>
                <div class="revenue-bar-container">
                  <div class="revenue-bar">
                    <div class="revenue-fill" :style="{ width: restaurant.percentage + '%' }"></div>
                  </div>
                  <div class="revenue-amount">${{ restaurant.revenue.toLocaleString() }}</div>
                </div>
              </div>
            </div>
          </BaseCard>

          <!-- 即時桌位狀態 -->
          <BaseCard elevation="medium" class="tables-card">
            <template #header>
              <div class="card-header">
                <h3>桌位狀態</h3>
                <div class="table-summary">
                  <span class="active-tables">{{ totalActiveTables }}</span> / 
                  <span class="total-tables">{{ totalTables }}</span> 桌使用中
                </div>
              </div>
            </template>
            <div class="tables-grid">
              <div v-for="restaurant in stats.activeTables" :key="restaurant.id" class="table-status">
                <div class="restaurant-header">
                  <font-awesome-icon icon="store" />
                  <span>{{ restaurant.name }}</span>
                </div>
                <div class="table-progress">
                  <div class="progress-bar">
                    <div class="progress-fill" :style="{ width: (restaurant.totalTables > 0 ? (restaurant.activeTables / restaurant.totalTables) * 100 : 0) + '%' }"></div>
                  </div>
                  <div class="table-count">
                    {{ restaurant.activeTables }} / {{ restaurant.totalTables }} 桌
                  </div>
                </div>
              </div>
            </div>
          </BaseCard>
        </div>
      </div>
    </div>
  </div>
</template>

<script src="./Dashboard.js"></script>

<style src="./Dashboard.css" scoped></style>
