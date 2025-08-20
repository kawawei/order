import { ref, onMounted, watch, nextTick } from 'vue'
import { adminReportAPI } from '@/services/api'
import Chart from 'chart.js/auto'

export function useReports() {
  // 響應式數據
  const selectedPeriod = ref('day')
  const selectedRestaurant = ref('all')
  const isLoading = ref(false)
  const showDatePicker = ref(false)
  const customDate = ref('')

  // 時間導航相關
  const currentDate = ref(new Date())
  const selectedDate = ref(new Date())
  const selectedMonth = ref(new Date())
  const selectedYear = ref(new Date())

  // 餐廳列表
  const restaurants = ref([])

  // 平台統計數據
  const platformStats = ref({
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    grossMargin: 0,
    activeMerchants: 0,
    totalOrders: 0,
    revenueChange: 0,
    costChange: 0,
    profitChange: 0,
    marginChange: 0,
    merchantChange: 0,
    orderChange: 0
  })

  // 餐廳詳細資訊
  const restaurantDetails = ref({
    popularItems: [],
    peakHours: [],
    totalOrders: 0,
    avgOrderValue: 0,
    completedOrders: 0,
    cancelledOrders: 0
  })

  // 熱門商家
  const topMerchants = ref([])

  // 圖表數據
  const chartData = ref({
    revenue: [],
    activity: []
  })

  // 圖表實例
  const revenueChart = ref(null)
  const activityChart = ref(null)

  // 時間週期選項
  const periods = [
    { value: 'day', label: '日' },
    { value: 'month', label: '月' },
    { value: 'year', label: '年' }
  ]

  // 載入餐廳列表
  const loadRestaurants = async () => {
    try {
      const response = await adminReportAPI.getRestaurants()
      if (response.status === 'success') {
        restaurants.value = response.data || []
      }
    } catch (error) {
      console.error('載入餐廳列表失敗:', error)
    }
  }

  // 選擇餐廳
  const selectRestaurant = (restaurantId) => {
    selectedRestaurant.value = restaurantId
    loadReportData()
  }

  // 餐廳變更處理
  const onRestaurantChange = () => {
    loadReportData()
  }

  // 切換時間週期
  const changePeriod = (period) => {
    selectedPeriod.value = period
    // 重置時間選擇到當前時間
    const now = new Date()
    selectedDate.value = new Date(now)
    selectedMonth.value = new Date(now)
    selectedYear.value = new Date(now)
    customDate.value = ''
    loadReportData()
  }

  // 獲取當前時間選擇
  const getCurrentTimeSelection = () => {
    if (selectedPeriod.value === 'day') {
      return selectedDate.value
    } else if (selectedPeriod.value === 'month') {
      return selectedMonth.value
    } else {
      return selectedYear.value
    }
  }

  // 載入報表數據
  const loadReportData = async () => {
    isLoading.value = true
    try {
      const params = {
        period: selectedPeriod.value,
        restaurantId: selectedRestaurant.value
      }

      // 根據時間週期設置日期參數
      if (selectedPeriod.value === 'day') {
        const date = customDate || selectedDate.value
        params.date = date.toISOString().split('T')[0]
      } else if (selectedPeriod.value === 'month') {
        const month = customDate || selectedMonth.value
        const startDate = new Date(month.getFullYear(), month.getMonth(), 1)
        const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0)
        const startYear = startDate.getFullYear()
        const startMonth = String(startDate.getMonth() + 1).padStart(2, '0')
        const startDay = String(startDate.getDate()).padStart(2, '0')
        const endYear = endDate.getFullYear()
        const endMonth = String(endDate.getMonth() + 1).padStart(2, '0')
        const endDay = String(endDate.getDate()).padStart(2, '0')
        params.startDate = `${startYear}-${startMonth}-${startDay}`
        params.endDate = `${endYear}-${endMonth}-${endDay}`
      } else if (selectedPeriod.value === 'year') {
        const year = customDate || selectedYear.value
        const startDate = new Date(year.getFullYear(), 0, 1)
        const endDate = new Date(year.getFullYear(), 11, 31)
        const startYear = startDate.getFullYear()
        const startMonth = String(startDate.getMonth() + 1).padStart(2, '0')
        const startDay = String(startDate.getDate()).padStart(2, '0')
        const endYear = endDate.getFullYear()
        const endMonth = String(endDate.getMonth() + 1).padStart(2, '0')
        const endDay = String(endDate.getDate()).padStart(2, '0')
        params.startDate = `${startYear}-${startMonth}-${startDay}`
        params.endDate = `${endYear}-${endMonth}-${endDay}`
      }
      
      // 調用 API
      const response = await adminReportAPI.getPlatformStats(params)
      
      if (response.status === 'success') {
        const data = response.data
        
        // 更新平台統計
        platformStats.value = {
          totalRevenue: data.totalRevenue || 0,
          totalCost: data.totalCost || 0,
          totalProfit: data.totalProfit || 0,
          grossMargin: data.grossMargin || 0,
          activeMerchants: data.activeMerchants || 0,
          totalOrders: data.totalOrders || 0,
          revenueChange: data.revenueChange || 0,
          costChange: data.costChange || 0,
          profitChange: data.profitChange || 0,
          marginChange: data.marginChange || 0,
          merchantChange: data.merchantChange || 0,
          orderChange: data.orderChange || 0
        }
        
        // 更新餐廳詳細資訊
        if (selectedRestaurant.value !== 'all') {
          restaurantDetails.value = {
            popularItems: data.popularItems || [],
            peakHours: data.peakHours || [],
            totalOrders: data.totalOrders || 0,
            avgOrderValue: data.avgOrderValue || 0,
            completedOrders: data.completedOrders || 0,
            cancelledOrders: data.cancelledOrders || 0
          }
        }
        
        // 更新熱門商家
        topMerchants.value = data.topMerchants || []
        
        // 更新圖表數據
        chartData.value = {
          revenue: data.revenueChart || [],
          activity: data.activityChart || []
        }
        
        // 更新圖表
        nextTick(() => {
          updateCharts()
        })
      }
    } catch (error) {
      console.error('載入報表數據失敗:', error)
    } finally {
      isLoading.value = false
    }
  }

  // 格式化貨幣
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: 'TWD',
      minimumFractionDigits: 0
    }).format(amount)
  }

  // 格式化數字
  const formatNumber = (num) => {
    return new Intl.NumberFormat('zh-TW').format(num)
  }

  // 獲取趨勢圖標
  const getTrendIcon = (change) => {
    if (change > 0) return 'arrow-up'
    if (change < 0) return 'arrow-down'
    return 'minus'
  }

  // 獲取趨勢顏色
  const getTrendColor = (change) => {
    if (change > 0) return 'positive'
    if (change < 0) return 'negative'
    return 'neutral'
  }

  // 匯出報表
  const exportReport = async () => {
    try {
      const params = {
        period: selectedPeriod.value,
        restaurantId: selectedRestaurant.value
      }
      
      // 設置日期參數（與 loadReportData 相同的邏輯）
      if (selectedPeriod.value === 'day') {
        const date = customDate || selectedDate.value
        params.date = date.toISOString().split('T')[0]
      } else if (selectedPeriod.value === 'month') {
        const month = customDate || selectedMonth.value
        const startDate = new Date(month.getFullYear(), month.getMonth(), 1)
        const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0)
        params.startDate = startDate.toISOString().split('T')[0]
        params.endDate = endDate.toISOString().split('T')[0]
      } else if (selectedPeriod.value === 'year') {
        const year = customDate || selectedYear.value
        const startDate = new Date(year.getFullYear(), 0, 1)
        const endDate = new Date(year.getFullYear(), 11, 31)
        params.startDate = startDate.toISOString().split('T')[0]
        params.endDate = endDate.toISOString().split('T')[0]
      }
      
      const response = await adminReportAPI.exportPlatformReport(params)
      
      // 下載檔案
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `平台報表_${new Date().toISOString().split('T')[0]}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('匯出報表失敗:', error)
    }
  }

  // 時間導航
  const navigateTime = (direction) => {
    const current = getCurrentTimeSelection()
    const newDate = new Date(current)
    
    if (selectedPeriod.value === 'day') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1))
      selectedDate.value = newDate
    } else if (selectedPeriod.value === 'month') {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
      selectedMonth.value = newDate
    } else if (selectedPeriod.value === 'year') {
      newDate.setFullYear(newDate.getFullYear() + (direction === 'next' ? 1 : -1))
      selectedYear.value = newDate
    }
    
    loadReportData()
  }

  // 檢查是否可以導航
  const canGoPrevious = () => {
    const current = getCurrentTimeSelection()
    const now = new Date()
    
    if (selectedPeriod.value === 'day') {
      return current < now
    } else if (selectedPeriod.value === 'month') {
      return current.getFullYear() < now.getFullYear() || 
             (current.getFullYear() === now.getFullYear() && current.getMonth() < now.getMonth())
    } else if (selectedPeriod.value === 'year') {
      return current.getFullYear() < now.getFullYear()
    }
    return false
  }

  const canGoNext = () => {
    const current = getCurrentTimeSelection()
    const now = new Date()
    
    if (selectedPeriod.value === 'day') {
      return current < now
    } else if (selectedPeriod.value === 'month') {
      return current.getFullYear() < now.getFullYear() || 
             (current.getFullYear() === now.getFullYear() && current.getMonth() < now.getMonth())
    } else if (selectedPeriod.value === 'year') {
      return current.getFullYear() < now.getFullYear()
    }
    return false
  }

  // 顯示時間
  const getDisplayTime = () => {
    const current = getCurrentTimeSelection()
    if (selectedPeriod.value === 'day') {
      return current.toLocaleDateString('zh-TW')
    } else if (selectedPeriod.value === 'month') {
      return `${current.getFullYear()}年${current.getMonth() + 1}月`
    } else if (selectedPeriod.value === 'year') {
      return `${current.getFullYear()}年`
    }
    return ''
  }

  // 日期選擇器相關
  const getDatePickerTitle = () => {
    if (selectedPeriod.value === 'day') return '選擇日期'
    if (selectedPeriod.value === 'month') return '選擇月份'
    if (selectedPeriod.value === 'year') return '選擇年份'
    return '選擇時間'
  }

  const getDatePickerLabel = () => {
    if (selectedPeriod.value === 'day') return '日期'
    if (selectedPeriod.value === 'month') return '月份'
    if (selectedPeriod.value === 'year') return '年份'
    return '時間'
  }

  const getDateInputType = () => {
    if (selectedPeriod.value === 'day') return 'date'
    if (selectedPeriod.value === 'month') return 'month'
    if (selectedPeriod.value === 'year') return 'number'
    return 'date'
  }

  const handleDateChange = () => {
    showDatePicker.value = false
    loadReportData()
  }

  // 更新圖表
  const updateCharts = () => {
    // 更新營收圖表
    if (revenueChart.value) {
      revenueChart.value.destroy()
    }
    
    const revenueCtx = document.getElementById('revenueChart')
    if (revenueCtx) {
      revenueChart.value = new Chart(revenueCtx, {
        type: 'line',
        data: {
          labels: chartData.value.revenue.map(item => item.label),
          datasets: [{
            label: '營收',
            data: chartData.value.revenue.map(item => item.value),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function(value) {
                  return formatCurrency(value)
                }
              }
            }
          }
        }
      })
    }
    
    // 更新活躍度圖表
    if (activityChart.value) {
      activityChart.value.destroy()
    }
    
    const activityCtx = document.getElementById('activityChart')
    if (activityCtx) {
      activityChart.value = new Chart(activityCtx, {
        type: 'bar',
        data: {
          labels: chartData.value.activity.map(item => item.label),
          datasets: [{
            label: selectedRestaurant.value === 'all' ? '活躍商家數' : '訂單數',
            data: chartData.value.activity.map(item => item.value),
            backgroundColor: '#10b981',
            borderColor: '#059669',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1
              }
            }
          }
        }
      })
    }
  }

  // 監聽時間變化
  watch([selectedDate, selectedMonth, selectedYear], () => {
    loadReportData()
  })

  // 組件掛載時載入數據
  onMounted(() => {
    loadRestaurants()
    loadReportData()
  })

  return {
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
  }
}
