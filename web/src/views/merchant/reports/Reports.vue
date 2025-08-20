<template>
  <div class="reports-container">
    <div class="reports-header">
      <h1>報表統計</h1>
      <div class="header-actions">
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
          
          <!-- 日期選擇器彈窗 -->
          <div v-if="showDatePicker" class="date-picker-overlay" @click="showDatePicker = false">
            <div class="date-picker-modal" @click.stop>
              <div class="date-picker-header">
                <h4>{{ getDatePickerTitle() }}</h4>
                <button class="close-btn" @click="showDatePicker = false">
                  <font-awesome-icon icon="xmark" />
                </button>
              </div>
              <div class="date-picker-content">
                <div class="date-input-group">
                  <label>{{ getDatePickerLabel() }}:</label>
                  <input 
                    v-if="selectedPeriod === 'day' || selectedPeriod === 'month'"
                    :type="getDateInputType()" 
                    v-model="selectedDate" 
                    @change="onDateChange"
                    class="date-input"
                  />
                  <div v-else class="year-picker">
                    <div class="year-grid">
                      <div 
                        v-for="year in availableYears" 
                        :key="year"
                        class="year-option"
                        :class="{ active: selectedYear && selectedYear.getFullYear() === year }"
                        @click="selectYear(year)"
                      >
                        {{ year }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
          <canvas id="revenueChart" width="400" height="200"></canvas>
        </div>
      </div>

      <div class="chart-container">
        <h3>人流量趨勢</h3>
        <div class="chart-placeholder">
          <canvas id="trafficChart" width="400" height="200"></canvas>
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
import { ref, computed, onMounted } from 'vue'

const route = useRoute()

// 日期選擇器相關狀態
const showDatePicker = ref(false)

// 使用報表統計邏輯
const {
  selectedPeriod,
  selectedDate,
  selectedYear,
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
  exportReport,
  navigateTime,
  canGoPrevious,
  canGoNext,
  getDisplayTime,
  getDatePickerTitle,
  getDatePickerLabel,
  getDateInputType,
  updateCharts
} = useReports()

// 日期選擇器方法
const onDateChange = () => {
  if (selectedDate.value) {
    // 關閉日期選擇器
    showDatePicker.value = false
    
    // 調用報表載入方法，傳入新日期
    loadReportData(selectedDate.value)
  }
}

// 可用年份列表 - 只顯示當前年份及以前的年份
const availableYears = computed(() => {
  const currentYear = new Date().getFullYear()
  const years = []
  // 從 2010 年開始，到當前年份（不包含未來年份）
  for (let year = 2010; year <= currentYear; year++) {
    years.push(year)
  }
  return years
})

// 選擇年份方法
const selectYear = (year) => {
  // 將選中的年份轉換為 Date 對象
  selectedYear.value = new Date(year, 0, 1)
  // 關閉日期選擇器
  showDatePicker.value = false
  
  // 調用報表載入方法，傳入新年份
  loadReportData(selectedYear.value)
}

// 組件掛載時載入數據
onMounted(() => {
  loadReportData()
})
</script>

<style scoped>
@import './Reports.css';

/* 年份選擇器樣式 */
.year-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.year-picker label {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.year-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
  padding: 8px;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  background: #fff;
}

/* 自定義滾動條樣式 */
.year-grid::-webkit-scrollbar {
  width: 6px;
}

.year-grid::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.year-grid::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.year-grid::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.year-option {
  padding: 8px 12px;
  text-align: center;
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #495057;
  transition: all 0.2s ease;
}

.year-option:hover {
  background: #e9ecef;
  border-color: #dee2e6;
  transform: translateY(-1px);
}

.year-option.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
  box-shadow: 0 2px 4px rgba(0, 123, 255, 0.2);
}
</style>
