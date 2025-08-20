<template>
  <div class="admin-reports-container">
    <div class="reports-header">
      <h1>平台報表統計</h1>
      <div class="header-actions">
        <!-- 餐廳選擇 -->
        <div class="restaurant-selector">
          <select v-model="selectedRestaurant" @change="onRestaurantChange" class="restaurant-select">
            <option value="all">所有餐廳</option>
            <option v-for="restaurant in restaurants" :key="restaurant._id" :value="restaurant._id">
              {{ restaurant.businessName }}
            </option>
          </select>
        </div>

        <!-- 時間導航控制 -->
        <div class="time-navigation">
          <button 
            class="nav-btn"
            @click="navigateTime('previous')"
            :disabled="!canGoPrevious()"
            :class="{ disabled: !canGoPrevious() }"
          >
            <font-awesome-icon icon="chevron-left" />
          </button>
          
          <div class="current-time-display" @click="showDatePicker = true">
            <span class="time-label">{{ getDisplayTime() }}</span>
            <font-awesome-icon icon="chevron-down" class="dropdown-icon" />
          </div>
          
          <button 
            class="nav-btn"
            @click="navigateTime('next')"
            :disabled="!canGoNext()"
            :class="{ disabled: !canGoNext() }"
          >
            <font-awesome-icon icon="chevron-right" />
          </button>
        </div>

        <!-- 時間週期選擇 -->
        <div class="period-selector">
          <button 
            v-for="period in periods" 
            :key="period.value"
            @click="changePeriod(period.value)"
            :class="['period-btn', { active: selectedPeriod === period.value }]"
          >
            {{ period.label }}
          </button>
        </div>

        <!-- 匯出按鈕 -->
        <button class="export-btn" @click="exportReport">
          <font-awesome-icon icon="download" />
          匯出報表
        </button>
      </div>
    </div>

    <!-- 載入狀態 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner">
        <font-awesome-icon icon="spinner" spin />
        <span>載入中...</span>
      </div>
    </div>

    <!-- 平台統計卡片 -->
    <div class="stats-grid">
      <!-- 總營收 -->
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon revenue">
            <font-awesome-icon icon="dollar-sign" />
          </div>
          <div class="stat-trend" :class="getTrendColor(platformStats.revenueChange)">
            <font-awesome-icon :icon="getTrendIcon(platformStats.revenueChange)" />
            {{ Math.abs(platformStats.revenueChange) }}%
          </div>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ formatCurrency(platformStats.totalRevenue) }}</div>
          <div class="stat-label">總營收</div>
        </div>
      </div>

      <!-- 總成本 -->
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon cost">
            <font-awesome-icon icon="calculator" />
          </div>
          <div class="stat-trend" :class="getTrendColor(platformStats.costChange)">
            <font-awesome-icon :icon="getTrendIcon(platformStats.costChange)" />
            {{ Math.abs(platformStats.costChange) }}%
          </div>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ formatCurrency(platformStats.totalCost) }}</div>
          <div class="stat-label">總成本</div>
        </div>
      </div>

      <!-- 總淨利 -->
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon profit">
            <font-awesome-icon icon="chart-line" />
          </div>
          <div class="stat-trend" :class="getTrendColor(platformStats.profitChange)">
            <font-awesome-icon :icon="getTrendIcon(platformStats.profitChange)" />
            {{ Math.abs(platformStats.profitChange) }}%
          </div>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ formatCurrency(platformStats.totalProfit) }}</div>
          <div class="stat-label">總淨利</div>
        </div>
      </div>

      <!-- 毛利率 -->
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon margin">
            <font-awesome-icon icon="percentage" />
          </div>
          <div class="stat-trend" :class="getTrendColor(platformStats.marginChange)">
            <font-awesome-icon :icon="getTrendIcon(platformStats.marginChange)" />
            {{ Math.abs(platformStats.marginChange) }}%
          </div>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ platformStats.grossMargin }}%</div>
          <div class="stat-label">毛利率</div>
        </div>
      </div>

      <!-- 活躍商家數 -->
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon merchants">
            <font-awesome-icon icon="store" />
          </div>
          <div class="stat-trend" :class="getTrendColor(platformStats.merchantChange)">
            <font-awesome-icon :icon="getTrendIcon(platformStats.merchantChange)" />
            {{ Math.abs(platformStats.merchantChange) }}%
          </div>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ formatNumber(platformStats.activeMerchants) }}</div>
          <div class="stat-label">活躍商家</div>
        </div>
      </div>

      <!-- 總訂單數 -->
      <div class="stat-card">
        <div class="stat-header">
          <div class="stat-icon orders">
            <font-awesome-icon icon="receipt" />
          </div>
          <div class="stat-trend" :class="getTrendColor(platformStats.orderChange)">
            <font-awesome-icon :icon="getTrendIcon(platformStats.orderChange)" />
            {{ Math.abs(platformStats.orderChange) }}%
          </div>
        </div>
        <div class="stat-content">
          <div class="stat-value">{{ formatNumber(platformStats.totalOrders) }}</div>
          <div class="stat-label">總訂單數</div>
        </div>
      </div>
    </div>

    <!-- 單餐廳詳細資訊 -->
    <div v-if="selectedRestaurant !== 'all'" class="restaurant-details">
      <h3>餐廳詳細資訊</h3>
      <div class="restaurant-stats-grid">
        <!-- 受歡迎餐點 -->
        <div class="detail-card">
          <h4>受歡迎餐點</h4>
          <div class="popular-items">
            <div v-for="(item, index) in restaurantDetails.popularItems" :key="item._id" class="popular-item">
              <div class="item-rank">{{ index + 1 }}</div>
              <div class="item-info">
                <div class="item-name">{{ item.name }}</div>
                <div class="item-category">{{ item.category }}</div>
              </div>
              <div class="item-stats">
                <div class="item-orders">{{ formatNumber(item.orderCount) }} 筆訂單</div>
                <div class="item-revenue">{{ formatCurrency(item.revenue) }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 熱門時段 -->
        <div class="detail-card">
          <h4>熱門時段</h4>
          <div class="peak-hours">
            <div v-for="(hour, index) in restaurantDetails.peakHours" :key="index" class="peak-hour">
              <div class="hour-label">{{ hour.hour }}</div>
              <div class="hour-bar">
                <div class="hour-fill" :style="{ width: hour.percentage + '%' }"></div>
              </div>
              <div class="hour-count">{{ formatNumber(hour.orderCount) }}</div>
            </div>
          </div>
        </div>

        <!-- 訂單統計 -->
        <div class="detail-card">
          <h4>訂單統計</h4>
          <div class="order-stats">
            <div class="order-stat">
              <div class="stat-number">{{ formatNumber(restaurantDetails.totalOrders) }}</div>
              <div class="stat-label">總訂單數</div>
            </div>
            <div class="order-stat">
              <div class="stat-number">{{ formatNumber(restaurantDetails.avgOrderValue) }}</div>
              <div class="stat-label">平均訂單金額</div>
            </div>
            <div class="order-stat">
              <div class="stat-number">{{ formatNumber(restaurantDetails.completedOrders) }}</div>
              <div class="stat-label">已完成訂單</div>
            </div>
            <div class="order-stat">
              <div class="stat-number">{{ formatNumber(restaurantDetails.cancelledOrders) }}</div>
              <div class="stat-label">取消訂單</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 圖表區域 -->
    <div class="charts-section">
      <div class="chart-container">
        <h3>{{ selectedRestaurant === 'all' ? '平台' : '餐廳' }}營收趨勢</h3>
        <div class="chart-placeholder">
          <canvas id="revenueChart" width="400" height="200"></canvas>
        </div>
      </div>

      <div class="chart-container">
        <h3>{{ selectedRestaurant === 'all' ? '商家' : '訂單' }}活躍度趨勢</h3>
        <div class="chart-placeholder">
          <canvas id="activityChart" width="400" height="200"></canvas>
        </div>
      </div>
    </div>

    <!-- 熱門商家排行 (僅在查看所有餐廳時顯示) -->
    <div v-if="selectedRestaurant === 'all'" class="top-merchants">
      <h3>熱門商家排行</h3>
      <div class="merchants-list">
        <div 
          v-for="(merchant, index) in topMerchants" 
          :key="merchant._id" 
          class="merchant-item"
          @click="selectRestaurant(merchant._id)"
        >
          <div class="merchant-rank">{{ index + 1 }}</div>
          <div class="merchant-info">
            <div class="merchant-name">{{ merchant.businessName }}</div>
            <div class="merchant-code">{{ merchant.merchantCode }}</div>
          </div>
          <div class="merchant-stats">
            <div class="merchant-orders">{{ formatNumber(merchant.orderCount) }} 筆訂單</div>
            <div class="merchant-revenue">{{ formatCurrency(merchant.revenue) }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 日期選擇器彈窗 -->
    <div v-if="showDatePicker" class="date-picker-overlay" @click="showDatePicker = false">
      <div class="date-picker-modal" @click.stop>
        <div class="date-picker-header">
          <h3>{{ getDatePickerTitle() }}</h3>
          <button class="close-btn" @click="showDatePicker = false">
            <font-awesome-icon icon="times" />
          </button>
        </div>
        <div class="date-picker-content">
          <label>{{ getDatePickerLabel() }}</label>
          <input 
            :type="getDateInputType()"
            v-model="customDate"
            @change="handleDateChange"
            class="date-input"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useReports } from './Reports.js'

const {
  // 響應式數據
  selectedPeriod,
  selectedRestaurant,
  isLoading,
  showDatePicker,
  customDate,
  currentDate,
  selectedDate,
  selectedMonth,
  selectedYear,
  restaurants,
  platformStats,
  restaurantDetails,
  topMerchants,
  chartData,
  revenueChart,
  activityChart,
  periods,

  // 方法
  loadRestaurants,
  selectRestaurant,
  onRestaurantChange,
  changePeriod,
  getCurrentTimeSelection,
  loadReportData,
  formatCurrency,
  formatNumber,
  getTrendIcon,
  getTrendColor,
  exportReport,
  navigateTime,
  canGoPrevious,
  canGoNext,
  getDisplayTime,
  getDatePickerTitle,
  getDatePickerLabel,
  getDateInputType,
  handleDateChange,
  updateCharts
} = useReports()
</script>

<style scoped>
@import './Reports.css';
</style>
