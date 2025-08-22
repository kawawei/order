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
          <!-- 隱藏本週本月本日訂單數顯示 -->
          <!-- <BaseTag v-if="activeTab === 'history'" variant="info" size="medium">
            <font-awesome-icon icon="receipt" class="mr-1" />
            {{ timeRangeTitle }}: {{ selectedTimeRangeOrdersCount }}
          </BaseTag> -->
        </div>
      </div>
      <div class="header-actions">
        <BaseButton variant="secondary" size="small" icon="refresh" @click="refreshOrders" :loading="loading">
          重新整理
        </BaseButton>
        <BaseButton 
          v-if="activeTab === 'history'" 
          variant="primary" 
          size="small" 
          icon="download" 
          @click="() => exportHistoryOrders('xlsx')"
          :loading="isExporting"
          :disabled="isExporting"
        >
          {{ isExporting ? '匯出中...' : '匯出歷史訂單' }}
        </BaseButton>
      </div>
    </header>

    <!-- 訂單狀態標籤頁 -->
    <div class="orders-tabs">
      <BaseTabs v-model="activeTab" :tabs="orderTabs">
        <template #actions>
          <div class="tabs-actions">
            <div class="date-navigation">
              <button class="nav-arrow" @click="previousDate">
                <font-awesome-icon icon="chevron-left" />
              </button>
              <BaseDatePicker 
                v-model="selectedDate" 
                :mode="dateViewMode"
                @change="handleDateChange"
                @modeChange="handleModeChange"
              />
              <button class="nav-arrow" @click="nextDate">
                <font-awesome-icon icon="chevron-right" />
              </button>
            </div>
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
            <div v-if="preparingOrders.length === 0" class="empty-state">
              <div class="empty-icon">
                <font-awesome-icon icon="clock" />
              </div>
              <p class="empty-text">目前沒有準備中的訂單</p>
              <p class="empty-subtext">新訂單會出現在這裡</p>
            </div>
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
                  <div class="item-main">
                    <span class="item-name">{{ item.name }}</span>
                    <!-- 選項標籤橫排在菜名右邊 -->
                    <div v-if="item.processedOptions && item.processedOptions.length > 0" class="item-options-inline">
                      <span v-for="option in item.processedOptions" :key="option.key" class="option-tag">
                        {{ option.valueLabel }}
                      </span>
                    </div>
                    <span class="item-quantity">x{{ item.quantity }}</span>
                  </div>
                </div>
              </div>
              <div class="batch-footer">
                <div class="batch-stats">
                  <span class="total-items">{{ batch.itemCount }} 項</span>
                  <span class="total-amount">NT$ {{ batch.totalAmount }}</span>
                </div>
                <div class="batch-actions">
                  <!-- 根據訂單狀態顯示不同的按鈕 -->
                  <BaseButton 
                    v-if="batch.status === 'pending'" 
                    variant="primary" 
                    size="small" 
                    @click="confirmOrder(batch._id)"
                  >
                    <font-awesome-icon icon="check" />
                    確認訂單
                  </BaseButton>
                  <BaseButton 
                    v-else-if="batch.status === 'confirmed'" 
                    variant="danger" 
                    size="small" 
                    @click="startPreparing(batch._id)"
                  >
                    <font-awesome-icon icon="clock" />
                    開始製作
                  </BaseButton>
                  <BaseButton 
                    v-else-if="batch.status === 'preparing'" 
                    variant="primary" 
                    size="small" 
                    @click="markAsReady(batch._id)"
                  >
                    <font-awesome-icon icon="check-circle" />
                    製作完成
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
            <div v-if="readyOrders.length === 0" class="empty-state">
              <div class="empty-icon">
                <font-awesome-icon icon="bell" />
              </div>
              <p class="empty-text">目前沒有準備好的訂單</p>
              <p class="empty-subtext">製作完成的訂單會出現在這裡</p>
            </div>
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
                  <div class="item-main">
                    <span class="item-name">{{ item.name }}</span>
                    <!-- 選項標籤橫排在菜名右邊 -->
                    <div v-if="item.processedOptions && item.processedOptions.length > 0" class="item-options-inline">
                      <span v-for="option in item.processedOptions" :key="option.key" class="option-tag">
                        {{ option.valueLabel }}
                      </span>
                    </div>
                    <span class="item-quantity">x{{ item.quantity }}</span>
                  </div>
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
                    出餐
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
            <div v-if="deliveredOrders.length === 0" class="empty-state">
              <div class="empty-icon">
                <font-awesome-icon icon="check-circle" />
              </div>
              <p class="empty-text">目前沒有已送出的訂單</p>
              <p class="empty-subtext">已出餐的訂單會出現在這裡</p>
            </div>
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
                  <div class="item-main">
                    <span class="item-name">{{ item.name }}</span>
                    <!-- 選項標籤橫排在菜名右邊 -->
                    <div v-if="item.processedOptions && item.processedOptions.length > 0" class="item-options-inline">
                      <span v-for="option in item.processedOptions" :key="option.key" class="option-tag">
                        {{ option.valueLabel }}
                      </span>
                    </div>
                    <span class="item-quantity">x{{ item.quantity }}</span>
                  </div>
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
                {{ getDateDisplayText() }}
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
          <template #tableOrderNumber="{ row }">
            <span class="order-number-link" @click="viewOrderDetails(row)">
              {{ row.tableOrderNumber }}
            </span>
          </template>
          <template #completedAt="{ row }">
            <span>{{ formatDateTime(row.completedAt) }}</span>
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
            <span class="label">桌次訂單號:</span>
            <span class="value">{{ selectedOrder.tableOrderNumber }}</span>
          </div>
          <div class="info-row">
            <span class="label">桌號:</span>
            <span class="value">{{ selectedOrder.tableNumber }}號桌</span>
          </div>
          <div class="info-row">
            <span class="label">客人組別:</span>
            <span class="value">{{ selectedOrder.customerGroup }}組</span>
          </div>
          <div class="info-row">
            <span class="label">結帳時間:</span>
            <span class="value">{{ formatDateTime(selectedOrder.completedAt) }}</span>
          </div>
          <div class="info-row">
            <span class="label">批次數:</span>
            <span class="value">{{ selectedOrder.batchCount }}</span>
          </div>
          <div class="info-row">
            <span class="label">總金額:</span>
            <span class="value">${{ selectedOrder.totalAmount }}</span>
          </div>
        </div>
        
        <div class="order-items-detail">
          <h4>批次訂單詳情</h4>
          <div v-for="(order, index) in selectedOrder.orders" :key="order._id" class="batch-order">
            <div class="batch-header">
              <h5>批次 {{ index + 1 }} - {{ order.orderNumber }}</h5>
              <span class="batch-time">{{ formatDateTime(order.createdAt) }}</span>
            </div>
            <div class="items-list">
              <div v-for="item in order.items" :key="item._id" class="item-detail">
                <div class="item-info">
                  <span class="item-name">{{ item.name }}</span>
                  <span class="item-price">${{ item.unitPrice }}</span>
                </div>
                <div class="item-options" v-if="item.selectedOptions && Object.keys(item.selectedOptions).length > 0">
                  <div v-for="(value, key) in item.selectedOptions" :key="key" class="option-item">
                    <span class="option-label">{{ getOptionLabel(key) }}:</span>
                    <span class="option-value">
                      <template v-if="typeof value === 'object' && value !== null && value.name">
                        {{ value.name }}
                      </template>
                      <template v-else>
                        {{ getOptionValueLabel(key, value) }}
                      </template>
                    </span>
                  </div>
                </div>
                <div class="item-notes" v-if="item.notes">
                  <span class="notes-label">備註:</span>
                  <span class="notes-value">{{ item.notes }}</span>
                </div>
                <div class="item-quantity">x{{ item.quantity }}</div>
                <div class="item-subtotal">${{ item.unitPrice * item.quantity }}</div>
              </div>
            </div>
            <div class="batch-total">
              <span class="total-label">批次小計:</span>
              <span class="total-value">${{ order.totalAmount }}</span>
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

    <!-- 收據預覽對話框 -->
    <BaseDialog
      v-model="showReceiptPreview"
      title="收據預覽"
      size="large"
    >
      <div v-if="receiptData" class="receipt-preview">
        <BaseReceipt 
          :receipt="receiptData" 
          ref="receiptComponent"
        />
      </div>
      
      <template #footer>
        <BaseButton variant="secondary" @click="closeReceiptPreview">關閉</BaseButton>
        <BaseButton v-if="receiptData" variant="primary" @click="printReceiptFromPreview">
          <font-awesome-icon icon="print" />
          列印收據
        </BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { useOrders } from '../../../composables/merchant/useOrders'
import BaseReceipt from '../../../components/base/BaseReceipt.vue'
import BaseDatePicker from '../../../components/BaseDatePicker.vue'
import './Orders.css'

const route = useRoute()

const {
    // 響應式數據
  activeTab,
  selectedDate,
  searchTerm,
  loading,
  isExporting,
  currentDate,
  dateTitle,
  selectedDateOrdersCount,
  todayOrdersCount,
  dateViewMode,
  
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
  
  // 收據預覽狀態
  showReceiptPreview,
  receiptData,
  receiptComponent,
  
  // 配置數據
  orderTabs,
  historyOrdersColumns,
  
  // 方法
  refreshOrders,
  confirmOrder,
  startPreparing,
  markAsReady,
  markAsDelivered,
  viewOrderDetails,
  printReceipt,
  closeReceiptPreview,
  printReceiptFromPreview,
  exportHistoryOrders,
  formatTime,
  formatDateTime,
  getStatVariant,
  getDateDisplayText,
  getOrderStatusVariant,
  getOrderStatusText,
  getOptionLabel,
  getOptionValueLabel,
  
  // 日期導航
  previousDate,
  nextDate,
  updateDateViewMode
  } = useOrders(route.query.restaurantId)

// 處理日期變化事件
const handleDateChange = (newDate) => {
  // 這裡可以添加額外的邏輯，比如記錄用戶的日期選擇行為
  console.log('日期已更改:', newDate)
}

// 處理模式變化事件
const handleModeChange = (newMode) => {
  updateDateViewMode(newMode)
  console.log('視圖模式已更改:', newMode)
}
</script>
