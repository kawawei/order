<template>
  <div class="reports-container">
    <div class="reports-header">
      <h1>報表統計</h1>
      <div class="header-actions">
        <div class="period-selector">
          <button 
            :class="['period-btn', { active: selectedPeriod === 'day' }]"
            @click="changePeriod('day')"
          >
            日
          </button>
          <button 
            :class="['period-btn', { active: selectedPeriod === 'month' }]"
            @click="changePeriod('month')"
          >
            月
          </button>
          <button 
            :class="['period-btn', { active: selectedPeriod === 'year' }]"
            @click="changePeriod('year')"
          >
            年
          </button>
        </div>
        <button class="export-btn" @click="exportReport" :disabled="isLoading">
          <font-awesome-icon icon="download" />
          導出報表
        </button>
      </div>
    </div>

    <!-- 財務統計卡片 -->
    <div class="stats-grid">
      <div class="stat-card revenue">
        <div class="stat-icon">
          <font-awesome-icon icon="dollar-sign" />
        </div>
        <div class="stat-content">
          <h3>營收</h3>
          <div class="stat-value">{{ formatCurrency(financialStats.revenue) }}</div>
          <div class="stat-change" :class="financialStats.revenueChange >= 0 ? 'positive' : 'negative'">
            {{ financialStats.revenueChange >= 0 ? '+' : '' }}{{ financialStats.revenueChange }}%
          </div>
        </div>
      </div>

      <div class="stat-card profit">
        <div class="stat-icon">
          <font-awesome-icon icon="chart-line" />
        </div>
        <div class="stat-content">
          <h3>利潤</h3>
          <div class="stat-value">{{ formatCurrency(financialStats.profit) }}</div>
          <div class="stat-change" :class="financialStats.profitChange >= 0 ? 'positive' : 'negative'">
            {{ financialStats.profitChange >= 0 ? '+' : '' }}{{ financialStats.profitChange }}%
          </div>
        </div>
      </div>

      <div class="stat-card cost">
        <div class="stat-icon">
          <font-awesome-icon icon="calculator" />
        </div>
        <div class="stat-content">
          <h3>成本</h3>
          <div class="stat-value">{{ formatCurrency(financialStats.cost) }}</div>
          <div class="stat-change" :class="financialStats.costChange >= 0 ? 'positive' : 'negative'">
            {{ financialStats.costChange >= 0 ? '+' : '' }}{{ financialStats.costChange }}%
          </div>
        </div>
      </div>

      <div class="stat-card customers">
        <div class="stat-icon">
          <font-awesome-icon icon="users" />
        </div>
        <div class="stat-content">
          <h3>人流量</h3>
          <div class="stat-value">{{ formatNumber(trafficStats.totalCustomers) }}</div>
          <div class="stat-change" :class="trafficStats.customerChange >= 0 ? 'positive' : 'negative'">
            {{ getTrendIcon(trafficStats.customerChange) }} {{ trafficStats.customerChange >= 0 ? '+' : '' }}{{ trafficStats.customerChange }}%
          </div>
          <div class="stat-extra">
            <span class="extra-label">熱門時段:</span>
            <span class="extra-value">{{ getPeakHours() }}</span>
          </div>
        </div>
      </div>

      <div class="stat-card margin">
        <div class="stat-icon">
                          <font-awesome-icon icon="percent" />
        </div>
        <div class="stat-content">
          <h3>毛利率</h3>
          <div class="stat-value">{{ calculateProfitMargin() }}%</div>
          <div class="stat-change" :class="financialStats.profitChange >= 0 ? 'positive' : 'negative'">
            {{ getTrendIcon(financialStats.profitChange) }} {{ financialStats.profitChange >= 0 ? '+' : '' }}{{ financialStats.profitChange }}%
          </div>
          <div class="stat-extra">
            <span class="extra-label">成本率:</span>
            <span class="extra-value">{{ calculateCostRatio() }}%</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 圖表區域 -->
    <div class="charts-section">
      <div class="chart-container">
        <h3>營收趨勢</h3>
        <div class="chart-placeholder">
          <canvas ref="revenueChart" width="400" height="200"></canvas>
        </div>
      </div>

      <div class="chart-container">
        <h3>人流量趨勢</h3>
        <div class="chart-placeholder">
          <canvas ref="trafficChart" width="400" height="200"></canvas>
        </div>
      </div>
    </div>

    <!-- 熱門餐點排行 -->
    <div class="popular-dishes">
      <h3>熱門餐點排行</h3>
      <div class="dishes-list">
        <div 
          v-for="(dish, index) in popularDishes" 
          :key="dish.id" 
          class="dish-item"
        >
          <div class="dish-rank">{{ index + 1 }}</div>
          <div class="dish-info">
            <div class="dish-name">{{ dish.name }}</div>
            <div class="dish-category">{{ dish.category }}</div>
          </div>
          <div class="dish-stats">
            <div class="dish-orders">{{ dish.orderCount }} 次</div>
            <div class="dish-revenue">{{ formatCurrency(dish.revenue) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRoute } from 'vue-router'
import { useReports } from './Reports.js'

const route = useRoute()

// 使用報表統計邏輯
const {
  selectedPeriod,
  isLoading,
  financialStats,
  trafficStats,
  popularDishes,
  chartData,
  changePeriod,
  loadReportData,
  formatCurrency,
  formatNumber,
  getTrendIcon,
  getTrendColor,
  calculateProfitMargin,
  calculateCostRatio,
  getPeakHours,
  exportReport
} = useReports()

// 組件掛載時載入數據
import { onMounted } from 'vue'
onMounted(() => {
  loadReportData()
})
</script>

<style scoped>
@import './Reports.css';
</style>
