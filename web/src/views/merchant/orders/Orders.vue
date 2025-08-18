<template>
  <div class="orders-container">
    <header class="orders-header">
      <div class="header-main">
        <h1>訂單管理</h1>
        <div class="header-stats">
          <BaseTag variant="warning" size="medium">
            <font-awesome-icon icon="clock" class="mr-1" />
            {{ currentDate }}
          </BaseTag>
          <BaseTag variant="info" size="medium">
            <font-awesome-icon icon="receipt" class="mr-1" />
            今日訂單: {{ todayOrdersCount }}
          </BaseTag>
        </div>
      </div>
      <div class="header-actions">
        <BaseButton variant="secondary" size="small" icon="refresh" @click="refreshOrders" :loading="loading">
          重新整理
        </BaseButton>
        <BaseButton variant="secondary" size="small" icon="download">
          匯出報表
        </BaseButton>
      </div>
    </header>

    <!-- 訂單狀態標籤頁 -->
    <div class="orders-tabs">
      <BaseTabs v-model="activeTab" :tabs="orderTabs">
        <template #actions>
          <div class="tabs-actions">
            <select v-model="selectedTimeRange" class="time-filter">
              <option value="today">今日</option>
              <option value="week">本週</option>
              <option value="month">本月</option>
            </select>
          </div>
        </template>
      </BaseTabs>
    </div>

    <!-- 即時訂單監控 (準備中、準備好、已送出) -->
    <div v-if="activeTab === 'live'" class="live-orders-section">
      <div class="live-stats">
        <BaseCard elevation="low" hoverable>
          <div class="stat-grid">
            <div class="stat-item preparing">
              <div class="stat-icon">
                <font-awesome-icon icon="clock" />
              </div>
              <div class="stat-info">
                <span class="stat-number">{{ liveStats.preparing }}</span>
                <span class="stat-label">準備中</span>
              </div>
            </div>
            <div class="stat-item ready">
              <div class="stat-icon">
                <font-awesome-icon icon="bell" />
              </div>
              <div class="stat-info">
                <span class="stat-number">{{ liveStats.ready }}</span>
                <span class="stat-label">準備好</span>
              </div>
            </div>
            <div class="stat-item delivered">
              <div class="stat-icon">
                <font-awesome-icon icon="check-circle" />
              </div>
              <div class="stat-info">
                <span class="stat-number">{{ liveStats.delivered }}</span>
                <span class="stat-label">已送出</span>
              </div>
            </div>
          </div>
        </BaseCard>
      </div>

      <div class="live-orders-grid">
        <!-- 準備中訂單 -->
        <BaseCard class="orders-column" elevation="low">
          <template #header>
            <div class="column-header preparing">
              <font-awesome-icon icon="clock" />
              <span>準備中 ({{ preparingOrders.length }})</span>
            </div>
          </template>
          <div class="orders-list">
            <div v-for="batch in preparingOrders" :key="batch._id" class="batch-card preparing">
              <div class="batch-header">
                <div class="table-info">
                  <span class="table-number">{{ batch.tableNumber }}號桌</span>
                  <BaseTag variant="info" size="small">
                    批次 {{ batch.batchNumber }}
                  </BaseTag>
                </div>
                <div class="batch-time">{{ formatTime(batch.createdAt) }}</div>
              </div>
              <div class="batch-items">
                <div v-for="item in batch.items" :key="item._id" class="batch-item">
                  <span class="item-name">{{ item.name }}</span>
                  <span class="item-quantity">x{{ item.quantity }}</span>
                </div>
              </div>
              <div class="batch-footer">
                <div class="batch-stats">
                  <span class="total-items">{{ batch.itemCount }} 項</span>
                  <span class="total-amount">NT$ {{ batch.totalAmount }}</span>
                </div>
                <div class="batch-actions">
                  <BaseButton variant="primary" size="small" @click="markAsReady(batch._id)">
                    <font-awesome-icon icon="bell" />
                    完成批次
                  </BaseButton>
                </div>
              </div>
            </div>
          </div>
        </BaseCard>

        <!-- 準備好訂單 -->
        <BaseCard class="orders-column" elevation="low">
          <template #header>
            <div class="column-header ready">
              <font-awesome-icon icon="bell" />
              <span>準備好 ({{ readyOrders.length }})</span>
            </div>
          </template>
          <div class="orders-list">
            <div v-for="batch in readyOrders" :key="batch._id" class="batch-card ready">
              <div class="batch-header">
                <div class="table-info">
                  <span class="table-number">{{ batch.tableNumber }}號桌</span>
                  <BaseTag variant="success" size="small">
                    批次 {{ batch.batchNumber }}
                  </BaseTag>
                </div>
                <div class="batch-time">{{ formatTime(batch.createdAt) }}</div>
              </div>
              <div class="batch-items">
                <div v-for="item in batch.items" :key="item._id" class="batch-item">
                  <span class="item-name">{{ item.name }}</span>
                  <span class="item-quantity">x{{ item.quantity }}</span>
                </div>
              </div>
              <div class="batch-footer">
                <div class="batch-stats">
                  <span class="total-items">{{ batch.itemCount }} 項</span>
                  <span class="total-amount">NT$ {{ batch.totalAmount }}</span>
                </div>
                <div class="batch-actions">
                  <BaseButton variant="secondary" size="small" @click="markAsDelivered(batch._id)">
                    <font-awesome-icon icon="truck" />
                    送出批次
                  </BaseButton>
                </div>
              </div>
            </div>
          </div>
        </BaseCard>

        <!-- 已送出訂單 -->
        <BaseCard class="orders-column" elevation="low">
          <template #header>
            <div class="column-header delivered">
              <font-awesome-icon icon="check-circle" />
              <span>已送出 ({{ deliveredOrders.length }})</span>
            </div>
          </template>
          <div class="orders-list">
            <div v-for="batch in deliveredOrders" :key="batch._id" class="batch-card delivered">
              <div class="batch-header">
                <div class="table-info">
                  <span class="table-number">{{ batch.tableNumber }}號桌</span>
                  <BaseTag variant="success" size="small">
                    批次 {{ batch.batchNumber }}
                  </BaseTag>
                </div>
                <div class="batch-time">{{ formatTime(batch.createdAt) }}</div>
              </div>
              <div class="batch-items">
                <div v-for="item in batch.items" :key="item._id" class="batch-item">
                  <span class="item-name">{{ item.name }}</span>
                  <span class="item-quantity">x{{ item.quantity }}</span>
                </div>
              </div>
              <div class="batch-footer">
                <div class="batch-stats">
                  <span class="total-items">{{ batch.itemCount }} 項</span>
                  <span class="total-amount">NT$ {{ batch.totalAmount }}</span>
                </div>
                <div class="batch-actions">
                  <BaseButton variant="text" size="small" disabled>
                    <font-awesome-icon icon="check" />
                    已送出
                  </BaseButton>
                </div>
              </div>
            </div>
          </div>
        </BaseCard>
      </div>
    </div>

    <!-- 歷史訂單統計 -->
    <div v-if="activeTab === 'history'" class="history-orders-section">
      <!-- 統計卡片 -->
      <div class="history-stats">
        <BaseCard class="stat-card" elevation="low" hoverable>
          <template #header>
            <div class="card-header-content">
              <h3>訂單統計</h3>
              <BaseTag :variant="getStatVariant()" size="small">
                {{ selectedTimeRange === 'today' ? '今日' : selectedTimeRange === 'week' ? '本週' : '本月' }}
              </BaseTag>
            </div>
          </template>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-icon total">
                <font-awesome-icon icon="receipt" />
              </div>
              <div class="stat-info">
                <span class="stat-number">{{ historyStats.totalOrders }}</span>
                <span class="stat-label">總訂單數</span>
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-icon revenue">
                <font-awesome-icon icon="dollar-sign" />
              </div>
              <div class="stat-info">
                <span class="stat-number">${{ historyStats.totalRevenue }}</span>
                <span class="stat-label">總營業額</span>
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-icon average">
                <font-awesome-icon icon="chart-line" />
              </div>
              <div class="stat-info">
                <span class="stat-number">${{ historyStats.averageOrderValue }}</span>
                <span class="stat-label">平均客單價</span>
              </div>
            </div>
            <div class="stat-item">
              <div class="stat-icon peak">
                <font-awesome-icon icon="clock" />
              </div>
              <div class="stat-info">
                <span class="stat-number">{{ historyStats.peakHour }}</span>
                <span class="stat-label">高峰時段</span>
              </div>
            </div>
          </div>
        </BaseCard>
      </div>

      <!-- 歷史訂單表格 -->
      <BaseCard elevation="low">
        <template #header>
          <div class="card-header-content">
            <h3>歷史訂單</h3>
            <div class="header-filters">
              <input
                v-model="searchTerm"
                type="text"
                placeholder="搜尋訂單號或桌號..."
                class="search-input"
              />
            </div>
          </div>
        </template>
        <BaseTable
          :columns="historyOrdersColumns"
          :data="filteredHistoryOrders"
          :loading="loading"
          hoverable
        >
          <template #orderNumber="{ row }">
            <span class="order-number-link" @click="viewOrderDetails(row)">
              #{{ row.orderNumber }}
            </span>
          </template>
          <template #status="{ row }">
            <BaseTag :variant="getOrderStatusVariant(row.status)" size="small">
              {{ getOrderStatusText(row.status) }}
            </BaseTag>
          </template>
          <template #totalAmount="{ row }">
            <span class="amount">${{ row.totalAmount }}</span>
          </template>
          <template #actions="{ row }">
            <BaseButton variant="text" size="small" @click="viewOrderDetails(row)">
              <font-awesome-icon icon="eye" />
            </BaseButton>
            <BaseButton variant="text" size="small" @click="printReceipt(row)">
              <font-awesome-icon icon="print" />
            </BaseButton>
          </template>
        </BaseTable>
      </BaseCard>
    </div>

    <!-- 訂單詳情對話框 -->
    <BaseDialog
      v-model="showOrderDetails"
      title="訂單詳情"
      size="large"
    >
      <div v-if="selectedOrder" class="order-details">
        <div class="order-basic-info">
          <div class="info-row">
            <span class="label">訂單號:</span>
            <span class="value">#{{ selectedOrder.orderNumber }}</span>
          </div>
          <div class="info-row">
            <span class="label">桌號:</span>
            <span class="value">{{ selectedOrder.tableNumber }}號桌</span>
          </div>
          <div class="info-row">
            <span class="label">下單時間:</span>
            <span class="value">{{ formatDateTime(selectedOrder.createdAt) }}</span>
          </div>
          <div class="info-row">
            <span class="label">狀態:</span>
            <BaseTag :variant="getOrderStatusVariant(selectedOrder.status)" size="small">
              {{ getOrderStatusText(selectedOrder.status) }}
            </BaseTag>
          </div>
        </div>
        
        <div class="order-items-detail">
          <h4>訂單項目</h4>
          <div class="items-list">
            <div v-for="item in selectedOrder.items" :key="item.id" class="item-detail">
              <div class="item-info">
                <span class="item-name">{{ item.name }}</span>
                <span class="item-price">${{ item.price }}</span>
              </div>
              <div class="item-quantity">x{{ item.quantity }}</div>
              <div class="item-subtotal">${{ item.price * item.quantity }}</div>
            </div>
          </div>
          <div class="total-section">
            <div class="total-row">
              <span class="total-label">小計:</span>
              <span class="total-value">${{ selectedOrder.subtotal }}</span>
            </div>
            <div class="total-row">
              <span class="total-label">服務費:</span>
              <span class="total-value">${{ selectedOrder.serviceCharge || 0 }}</span>
            </div>
            <div class="total-row final">
              <span class="total-label">總計:</span>
              <span class="total-value">${{ selectedOrder.totalAmount }}</span>
            </div>
          </div>
        </div>
      </div>
      
      <template #footer>
        <BaseButton variant="secondary" @click="showOrderDetails = false">關閉</BaseButton>
        <BaseButton v-if="selectedOrder" variant="primary" @click="printReceipt(selectedOrder)">
          <font-awesome-icon icon="print" />
          列印收據
        </BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>

<script setup>
import { useOrders } from '../../../composables/merchant/useOrders'
import './Orders.css'

const {
  // 響應式數據
  activeTab,
  selectedTimeRange,
  searchTerm,
  loading,
  currentDate,
  todayOrdersCount,
  
  // 即時訂單數據
  liveStats,
  preparingOrders,
  readyOrders,
  deliveredOrders,
  
  // 歷史訂單數據
  historyStats,
  historyOrders,
  filteredHistoryOrders,
  
  // 對話框狀態
  showOrderDetails,
  selectedOrder,
  
  // 配置數據
  orderTabs,
  historyOrdersColumns,
  
  // 方法
  refreshOrders,
  markAsReady,
  markAsDelivered,
  viewOrderDetails,
  printReceipt,
  formatTime,
  formatDateTime,
  getStatVariant,
  getOrderStatusVariant,
  getOrderStatusText
} = useOrders()
</script>
