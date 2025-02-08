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
import { useDashboard } from '../composables/useDashboard'

const {
  currentDate,
  liveOrders,
  popularItemsColumns,
  popularItems,
  refreshItems
} = useDashboard()
</script>

<style>
@import '../assets/styles/dashboard.css';
</style>
