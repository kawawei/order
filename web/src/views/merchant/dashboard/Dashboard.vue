<template>
  <div class="dashboard">
    <!-- 儀表板內容 -->
    <div>
      <header class="dashboard-header">
        <div class="header-main">
          <h1>儀表板</h1>
          <BaseTag variant="info" size="medium">
            <font-awesome-icon icon="clock" class="mr-1" />
            {{ currentDate }}
          </BaseTag>
        </div>
        <div class="header-actions">
          <BaseButton variant="secondary" size="small" icon="print">
            匯出報表
          </BaseButton>
        </div>
      </header>
    
    <div class="dashboard-grid">
      <!-- 即時訂單 -->
      <BaseCard class="stat-card" elevation="low" hoverable>
        <template #header>
          <div class="card-header-content">
            <h3>即時訂單</h3>
            <BaseTag variant="warning" size="small">進行中</BaseTag>
          </div>
        </template>
        <div class="orders-content">
          <div class="order-stat">
            <div class="stat-item">
              <span class="stat-number highlight-primary">{{ orderStats.pending }}</span>
              <span class="stat-label">待處理</span>
            </div>
            <div class="stat-item">
              <span class="stat-number highlight-success">{{ orderStats.preparing }}</span>
              <span class="stat-label">製作中</span>
            </div>
            <div class="stat-item">
              <span class="stat-number highlight-info">{{ orderStats.ready }}</span>
              <span class="stat-label">待送達</span>
            </div>
          </div>
          
          <div class="live-orders">
            <div class="live-orders-header">
              <font-awesome-icon icon="bell" class="live-icon pulse" />
              <span>即時點餐</span>
            </div>
            <div class="live-orders-list">
              <div v-if="liveOrders.length === 0" class="no-orders">
                <font-awesome-icon icon="inbox" />
                <span>目前沒有進行中的訂單</span>
              </div>
              <div v-else v-for="order in liveOrders.slice(0, 5)" :key="order._id" class="live-order-item">
                <div class="table-info">
                  <font-awesome-icon icon="chair" />
                  <span>{{ order.tableNumber }}號桌</span>
                </div>
                <div class="order-items">
                  <span v-for="(item, index) in order.items" 
                        :key="index"
                        class="order-item">
                    {{ item.name }} x{{ item.quantity }}
                  </span>
                </div>
                <BaseTag 
                  :variant="getStatusVariant(order.status)"
                  size="small"
                >
                  {{ getStatusLabel(order.status) }}
                </BaseTag>
              </div>
            </div>
          </div>

          <div class="total-orders">
            <span class="total-number">{{ orderStats.totalToday }}</span>
            <span class="total-label">今日總組數</span>
          </div>
          <div class="total-customers">
            <span class="total-number">{{ orderStats.totalCustomers }}</span>
            <span class="total-label">今日總人數</span>
          </div>
        </div>
      </BaseCard>
      
      <!-- 營業概況 -->
      <BaseCard class="stat-card" elevation="low" hoverable>
        <template #header>
          <div class="card-header-content">
            <h3>營業概況</h3>
            <BaseTag variant="success" size="small">營業中</BaseTag>
          </div>
        </template>
        <div class="business-stats">
          <div class="business-stat-list">
            <div class="business-stat">
              <div class="stat-icon">
                <font-awesome-icon icon="chair" />
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ businessStats.tablesInUse }}/{{ businessStats.totalTables }}</span>
                <span class="stat-label">使用中/總桌數</span>
              </div>
            </div>
            <div class="business-stat">
              <div class="stat-icon">
                <font-awesome-icon icon="users" />
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ businessStats.currentGuests }}</span>
                <span class="stat-label">目前客人數</span>
              </div>
            </div>
          </div>
          <div class="capacity-wrapper">
            <div class="business-stat">
              <div class="stat-icon">
                <font-awesome-icon icon="chart-line" />
              </div>
              <div class="stat-info">
                <span class="stat-value">{{ businessStats.seatUtilization }}%</span>
                <span class="stat-label">座位使用率</span>
              </div>
            </div>
            <div class="capacity-bar">
              <div class="capacity-fill" :style="{ width: businessStats.seatUtilization + '%' }"></div>
            </div>
          </div>
        </div>
      </BaseCard>
      
      <!-- 營業額統計 -->
      <BaseCard class="stat-card" elevation="low" hoverable>
        <template #header>
          <div class="card-header-content">
            <h3>營業額統計</h3>
          </div>
        </template>
        <div class="revenue-stats">
          <div class="revenue-list">
            <div class="revenue-card">
              <div class="revenue-header">
                <span class="revenue-label">今日營業額</span>
              </div>
              <span class="revenue-number">{{ formatCurrency(revenueStats.todayRevenue) }}</span>
              <div class="revenue-details">
                <div class="revenue-item">
                  <span class="item-label">平均客單價</span>
                  <span class="item-value">{{ revenueStats.avgOrderValue }}元</span>
                </div>
                <div class="revenue-item">
                  <span class="item-label">尖峰時段</span>
                  <span class="item-value">{{ revenueStats.peakHour }}</span>
                </div>
              </div>
            </div>
            
            <div class="revenue-card">
              <div class="revenue-header">
                <span class="revenue-label">當月營業額</span>
              </div>
              <span class="revenue-number">{{ formatCurrency(revenueStats.monthRevenue) }}</span>
              <div class="revenue-details single-item">
                <div class="revenue-item">
                  <span class="item-label">日均營業額</span>
                  <span class="item-value">{{ formatCurrency(revenueStats.dailyAvg) }}元</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </BaseCard>
      
      <!-- 熱門品項 -->
      <BaseCard class="stat-card" elevation="low" hoverable>
        <template #header>
          <div class="card-header-content">
            <h3>熱門品項</h3>
            <BaseButton variant="text" size="small" icon="refresh" @click="refreshItems" :loading="loading">
              更新
            </BaseButton>
          </div>
        </template>
        <BaseTable
          :columns="popularItemsColumns"
          :data="popularItems"
          hoverable
        />
      </BaseCard>
    </div>
      </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDashboard } from '../../../composables/merchant/useDashboard'

const route = useRoute()
const router = useRouter()

// 從路由查詢參數獲取餐廳ID（超級管理員查看特定商家時使用）
const restaurantId = route.query.restaurantId

const {
  currentDate,
  loading,
  error,
  liveOrders,
  orderStats,
  businessStats,
  revenueStats,
  popularItems,
  popularItemsColumns,
  refreshItems
} = useDashboard(restaurantId)

// 處理來自超級管理員的查詢參數
onMounted(() => {
  const restaurantId = route.query.restaurantId
  const restaurantName = route.query.restaurantName
  
  if (restaurantId && restaurantName) {
    console.log(`超級管理員正在查看餐廳: ${restaurantName} (ID: ${restaurantId})`)
    // 這裡可以根據需要設置特定的餐廳數據或顯示提示
  }
})

// 格式化貨幣
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('zh-TW').format(amount)
}

// 獲取狀態變體
const getStatusVariant = (status) => {
  const variants = {
    'pending': 'primary',
    'preparing': 'success',
    'ready': 'info'
  }
  return variants[status] || 'default'
}

// 獲取狀態標籤
const getStatusLabel = (status) => {
  const labels = {
    'pending': '待處理',
    'preparing': '製作中',
    'ready': '待送達'
  }
  return labels[status] || status
}


</script>

<style>
@import '../../../assets/styles/dashboard.css';
</style>
