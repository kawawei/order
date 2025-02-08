<template>
  <div class="dashboard">
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
              <span class="stat-number highlight-primary">8</span>
              <span class="stat-label">待處理</span>
            </div>
            <div class="stat-item">
              <span class="stat-number highlight-success">12</span>
              <span class="stat-label">製作中</span>
            </div>
            <div class="stat-item">
              <span class="stat-number highlight-info">5</span>
              <span class="stat-label">待送達</span>
            </div>
          </div>
          
          <div class="live-orders">
            <div class="live-orders-header">
              <font-awesome-icon icon="bell" class="live-icon pulse" />
              <span>即時點餐</span>
            </div>
            <div class="live-orders-list">
              <div v-for="order in liveOrders" :key="order.id" class="live-order-item">
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
                  :variant="order.status === '待處理' ? 'primary' : order.status === '製作中' ? 'success' : 'info'"
                  size="small"
                >
                  {{ order.status }}
                </BaseTag>
              </div>
            </div>
          </div>

          <div class="total-orders">
            <span class="total-number">25</span>
            <span class="total-label">今日總訂單</span>
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
                <span class="stat-value">15/20</span>
                <span class="stat-label">使用中/總桌數</span>
              </div>
            </div>
            <div class="business-stat">
              <div class="stat-icon">
                <font-awesome-icon icon="users" />
              </div>
              <div class="stat-info">
                <span class="stat-value">45</span>
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
                <span class="stat-value">75%</span>
                <span class="stat-label">座位使用率</span>
              </div>
            </div>
            <div class="capacity-bar">
              <div class="capacity-fill" :style="{ width: '75%' }"></div>
            </div>
          </div>
        </div>
      </BaseCard>
      
      <!-- 營業額統計 -->
      <BaseCard class="stat-card" elevation="low" hoverable>
        <template #header>
          <div class="card-header-content">
            <h3>營業額統計</h3>
            <BaseTag variant="primary" size="small">+8.3%</BaseTag>
          </div>
        </template>
        <div class="revenue-stats">
          <div class="revenue-list">
            <div class="revenue-card">
              <div class="revenue-header">
                <span class="revenue-label">今日營業額</span>
                <BaseTag variant="primary" size="small">+8.3%</BaseTag>
              </div>
              <span class="revenue-number">15,280</span>
              <div class="revenue-details">
                <div class="revenue-item">
                  <span class="item-label">平均單價</span>
                  <span class="item-value">580元</span>
                </div>
                <div class="revenue-item">
                  <span class="item-label">尖峰時段</span>
                  <span class="item-value">12:00-13:00</span>
                </div>
              </div>
            </div>
            
            <div class="revenue-card">
              <div class="revenue-header">
                <span class="revenue-label">當月營業額</span>
                <BaseTag variant="success" size="small">+12.5%</BaseTag>
              </div>
              <span class="revenue-number">342,600</span>
              <div class="revenue-details">
                <div class="revenue-item">
                  <span class="item-label">日均營業額</span>
                  <span class="item-value">11,420元</span>
                </div>
                <div class="revenue-item">
                  <span class="item-label">預期達成率</span>
                  <span class="item-value">89%</span>
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
            <BaseButton variant="text" size="small" icon="refresh" @click="refreshItems">
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
</template>

<script setup>
import { ref, onMounted } from 'vue'

const currentDate = ref('')
const liveOrders = ref([
  {
    id: 1,
    tableNumber: '3',
    status: '待處理',
    items: [
      { name: '炸雞套餐', quantity: 2 },
      { name: '可樂', quantity: 2 }
    ]
  },
  {
    id: 2,
    tableNumber: '5',
    status: '製作中',
    items: [
      { name: '牛肉麵', quantity: 1 },
      { name: '紅茶', quantity: 1 }
    ]
  },
  {
    id: 3,
    tableNumber: '8',
    status: '待送達',
    items: [
      { name: '滷肉飯', quantity: 1 },
      { name: '味增湯', quantity: 1 }
    ]
  }
])

const popularItemsColumns = [
  { key: 'name', label: '品項', width: '50%' },
  { key: 'quantity', label: '數量', width: '25%' },
  { key: 'trend', label: '趨勢', width: '25%' }
]

const popularItems = [
  { name: '炸雞套餐', quantity: '12份', trend: '↑' },
  { name: '牛肉麵', quantity: '8份', trend: '→' },
  { name: '滷肉飯', quantity: '6份', trend: '↓' }
]

onMounted(() => {
  updateCurrentDate()
  // 每分鐘更新一次時間
  setInterval(updateCurrentDate, 60000)
  // 每5分鐘更新一次數據
  setInterval(refreshData, 300000)
})

function updateCurrentDate() {
  const now = new Date()
  const options = { 
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit'
  }
  currentDate.value = now.toLocaleDateString('zh-TW', options)
}

function refreshItems() {
  // TODO: 實現即時更新熱門品項的邏輯
  console.log('更新熱門品項')
}

function refreshData() {
  // TODO: 實現定期更新所有數據的邏輯
  console.log('更新所有數據')
}
</script>

<style scoped>
/* 基礎布局 */
.dashboard {
  padding: 1.5rem;
}

.dashboard-header {
  margin-bottom: 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header-main h1 {
  font-size: 1.8rem;
  color: #1d1d1f;
  margin: 0;
  font-weight: 600;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

/* 訂單統計卡片 */
.orders-content {
  padding: 1rem 0;
}

.order-stat {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  padding: 0 0.5rem;
}

.stat-item {
  text-align: center;
}

.stat-number {
  display: block;
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1;
  margin-bottom: 0.5rem;
}

.highlight-primary {
  color: #007AFF;
}

.highlight-success {
  color: #34C759;
}

.highlight-info {
  color: #5856D6;
}

.stat-label {
  font-size: 0.875rem;
  color: #86868b;
}

.total-orders {
  text-align: center;
  padding-top: 1rem;
  border-top: 1px solid #f5f5f7;
}

.total-number {
  display: block;
  font-size: 2rem;
  font-weight: 600;
  color: #1d1d1f;
  margin-bottom: 0.25rem;
}

.total-label {
  font-size: 0.9375rem;
  color: #86868b;
}

/* 營業概況卡片 */
.business-stats {
  padding: 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.business-stat-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.business-stat {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: #f9f9f9;
  padding: 1rem;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.business-stat:hover {
  background: #f2f2f7;
}

.stat-icon {
  font-size: 1.25rem;
  color: #007AFF;
  background: white;
  padding: 0.75rem;
  border-radius: 12px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: #1d1d1f;
  line-height: 1;
  margin-bottom: 0.25rem;
}

.capacity-bar {
  background: #f5f5f7;
  border-radius: 8px;
  height: 8px;
  position: relative;
  margin-top: 1rem;
}

.capacity-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: #34C759;
  border-radius: 8px;
  transition: width 0.3s ease;
}

.capacity-text {
  display: block;
  text-align: center;
  font-size: 0.875rem;
  color: #86868b;
  margin-top: 0.5rem;
}

/* 營業額統計卡片 */
.revenue-stats {
  padding: 1rem 0;
}

.revenue-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.revenue-card {
  background: #f9f9f9;
  padding: 1.25rem;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.revenue-card:hover {
  background: #f2f2f7;
}

.revenue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.revenue-number {
  display: block;
  font-size: 1.75rem;
  font-weight: 600;
  color: #1d1d1f;
  margin-bottom: 1rem;
}

.revenue-label {
  font-size: 0.9375rem;
  color: #1d1d1f;
  font-weight: 500;
}

.revenue-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(0,0,0,0.05);
}

.revenue-item {
  text-align: center;
}

.item-label {
  display: block;
  font-size: 0.875rem;
  color: #86868b;
  margin-bottom: 0.25rem;
}

.item-value {
  font-size: 1rem;
  font-weight: 500;
  color: #1d1d1f;
}

/* 即時訂單樣式 */
.live-orders {
  margin: 1rem 0;
  border-radius: 8px;
  background: #f5f5f7;
  padding: 1rem;
}

.live-orders-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  color: #1d1d1f;
  font-weight: 500;
}

.live-icon {
  color: #ff3b30;
}

.pulse {
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
  100% {
    opacity: 1;
  }
}

.live-orders-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.live-order-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: white;
  padding: 0.75rem;
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.table-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #1d1d1f;
  font-weight: 500;
  min-width: 80px;
}

.order-items {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0 1rem;
}

.order-item {
  font-size: 0.875rem;
  color: #1d1d1f;
}

/* 座位使用率樣式 */
.capacity-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.capacity-bar {
  background: #f5f5f7;
  border-radius: 8px;
  height: 8px;
  position: relative;
}

.capacity-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: #34C759;
  border-radius: 8px;
  transition: width 0.3s ease;
}

.capacity-text {
  text-align: center;
  font-size: 0.875rem;
  color: #86868b;
}

/* 通用樣式 */
.mr-1 {
  margin-right: 0.25rem;
}

.stat-card {
  height: 100%;
}

.card-header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header-content h3 {
  font-size: 0.9375rem;
  color: #1d1d1f;
  margin: 0;
  font-weight: 600;
}
.dashboard {
  padding: 1rem;
}

.dashboard-header {
  margin-bottom: 2rem;
}

.dashboard-header h1 {
  font-size: 1.8rem;
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.current-time {
  color: #666;
  font-size: 0.9rem;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

.dashboard-card {
  background: white;
  border-radius: 10px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.dashboard-card h3 {
  color: #666;
  font-size: 1rem;
  margin-bottom: 1rem;
}

.card-content {
  display: flex;
  align-items: baseline;
}

.number {
  font-size: 2rem;
  font-weight: bold;
  color: #2c3e50;
  margin-right: 0.5rem;
}

.label {
  color: #666;
}

.popular-items {
  list-style: none;
  padding: 0;
}

.popular-items li {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
  border-bottom: 1px solid #eee;
}

.popular-items li:last-child {
  border-bottom: none;
}

.rating {
  text-align: center;
}

.rating .number {
  color: #f1c40f;
}

.rating .label {
  display: block;
  margin-top: 0.5rem;
}
</style>
