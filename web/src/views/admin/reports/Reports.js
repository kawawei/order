import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
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
  
  // 圖表 ID 計數器
  const chartIdCounter = ref(0)

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
      console.log('=== 載入報表數據調試 ===')
      console.log('選擇的餐廳:', selectedRestaurant.value)
      console.log('選擇的時間週期:', selectedPeriod.value)
      
      const params = {
        period: selectedPeriod.value,
        restaurantId: selectedRestaurant.value
      }

      // 根據時間週期設置日期參數
      if (selectedPeriod.value === 'day') {
        let date = customDate.value || selectedDate.value
        // 確保是 Date 對象
        if (typeof date === 'string') {
          date = new Date(date)
        }
        if (!(date instanceof Date) || isNaN(date)) {
          date = new Date()
        }
        params.date = date.toLocaleDateString('en-CA') // 使用 YYYY-MM-DD 格式的本地時間
      } else if (selectedPeriod.value === 'month') {
        let month = customDate.value || selectedMonth.value
        // 確保是 Date 對象
        if (typeof month === 'string') {
          month = new Date(month)
        }
        if (!(month instanceof Date) || isNaN(month)) {
          month = new Date()
        }
        const startDate = new Date(month.getFullYear(), month.getMonth(), 1)
        const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0)
        params.startDate = startDate.toLocaleDateString('en-CA') // 使用 YYYY-MM-DD 格式的本地時間
        params.endDate = endDate.toLocaleDateString('en-CA') // 使用 YYYY-MM-DD 格式的本地時間
      } else if (selectedPeriod.value === 'year') {
        let year = customDate.value || selectedYear.value
        // 確保是 Date 對象
        if (typeof year === 'string') {
          year = new Date(year)
        }
        if (!(year instanceof Date) || isNaN(year)) {
          year = new Date()
        }
        const startDate = new Date(year.getFullYear(), 0, 1)
        const endDate = new Date(year.getFullYear(), 11, 31)
        params.startDate = startDate.toLocaleDateString('en-CA') // 使用 YYYY-MM-DD 格式的本地時間
        params.endDate = endDate.toLocaleDateString('en-CA') // 使用 YYYY-MM-DD 格式的本地時間
      }
      
      // 調用 API
      console.log('API 參數:', params)
      const response = await adminReportAPI.getPlatformStats(params)
      console.log('API 回應:', response)
      
      if (response.status === 'success') {
        const data = response.data
        console.log('回應數據:', data)
        
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
        console.log('更新餐廳詳細資訊，選擇的餐廳:', selectedRestaurant.value)
        if (selectedRestaurant.value !== 'all') {
          console.log('餐廳詳細資訊數據:', {
            popularItems: data.popularItems,
            peakHours: data.peakHours,
            totalOrders: data.totalOrders,
            avgOrderValue: data.avgOrderValue,
            completedOrders: data.completedOrders,
            cancelledOrders: data.cancelledOrders
          })
          restaurantDetails.value = {
            popularItems: data.popularItems || [],
            peakHours: data.peakHours || [],
            totalOrders: data.totalOrders || 0,
            avgOrderValue: data.avgOrderValue || 0,
            completedOrders: data.completedOrders || 0,
            cancelledOrders: data.cancelledOrders || 0
          }
        } else {
          // 當選擇所有餐廳時，清空餐廳詳細資訊
          console.log('清空餐廳詳細資訊')
          restaurantDetails.value = {
            popularItems: [],
            peakHours: [],
            totalOrders: 0,
            avgOrderValue: 0,
            completedOrders: 0,
            cancelledOrders: 0
          }
        }
        
        // 更新熱門商家
        topMerchants.value = data.topMerchants || []
        
        // 更新圖表數據
        chartData.value = {
          revenue: data.revenueChart || [],
          activity: data.activityChart || []
        }
        
        // 檢查是否有數據
        const hasData = (chartData.value.revenue && chartData.value.revenue.length > 0) || 
                       (chartData.value.activity && chartData.value.activity.length > 0)
        
        if (hasData) {
          // 更新圖表
          nextTick(() => {
            updateCharts()
          })
        } else {
          // 清空圖表
          if (revenueChart.value) {
            revenueChart.value.destroy()
            revenueChart.value = null
          }
          if (activityChart.value) {
            activityChart.value.destroy()
            activityChart.value = null
          }
        }
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
        let date = customDate.value || selectedDate.value
        // 確保是 Date 對象
        if (typeof date === 'string') {
          date = new Date(date)
        }
        if (!(date instanceof Date) || isNaN(date)) {
          date = new Date()
        }
        params.date = date.toLocaleDateString('en-CA') // 使用 YYYY-MM-DD 格式的本地時間
      } else if (selectedPeriod.value === 'month') {
        let month = customDate.value || selectedMonth.value
        // 確保是 Date 對象
        if (typeof month === 'string') {
          month = new Date(month)
        }
        if (!(month instanceof Date) || isNaN(month)) {
          month = new Date()
        }
        const startDate = new Date(month.getFullYear(), month.getMonth(), 1)
        const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 0)
        params.startDate = startDate.toLocaleDateString('en-CA') // 使用 YYYY-MM-DD 格式的本地時間
        params.endDate = endDate.toLocaleDateString('en-CA') // 使用 YYYY-MM-DD 格式的本地時間
      } else if (selectedPeriod.value === 'year') {
        let year = customDate.value || selectedYear.value
        // 確保是 Date 對象
        if (typeof year === 'string') {
          year = new Date(year)
        }
        if (!(year instanceof Date) || isNaN(year)) {
          year = new Date()
        }
        const startDate = new Date(year.getFullYear(), 0, 1)
        const endDate = new Date(year.getFullYear(), 11, 31)
        params.startDate = startDate.toLocaleDateString('en-CA') // 使用 YYYY-MM-DD 格式的本地時間
        params.endDate = endDate.toLocaleDateString('en-CA') // 使用 YYYY-MM-DD 格式的本地時間
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
    let current = getCurrentTimeSelection()
    
    // 確保是 Date 對象
    if (!(current instanceof Date) || isNaN(current)) {
      current = new Date()
    }
    
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
    let current = getCurrentTimeSelection()
    const now = new Date()
    
    // 確保是 Date 對象
    if (!(current instanceof Date) || isNaN(current)) {
      current = new Date()
    }
    
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
    let current = getCurrentTimeSelection()
    const now = new Date()
    
    // 確保是 Date 對象
    if (!(current instanceof Date) || isNaN(current)) {
      current = new Date()
    }
    
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
    let current = getCurrentTimeSelection()
    
    // 確保是 Date 對象
    if (!(current instanceof Date) || isNaN(current)) {
      current = new Date()
    }
    
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

  // 清理圖表實例
  const destroyCharts = () => {
    console.log('清理圖表實例...')
    
    if (revenueChart.value) {
      try {
        revenueChart.value.destroy()
        console.log('銷毀營收圖表')
      } catch (e) {
        console.warn('銷毀營收圖表時發生錯誤:', e)
      }
      revenueChart.value = null
    }
    
    if (activityChart.value) {
      try {
        activityChart.value.destroy()
        console.log('銷毀活躍度圖表')
      } catch (e) {
        console.warn('銷毀活躍度圖表時發生錯誤:', e)
      }
      activityChart.value = null
    }
  }

  // 創建新的 Canvas 元素
  const createCanvas = (containerId, chartType) => {
    const container = document.getElementById(containerId)
    if (!container) {
      console.error(`找不到容器: ${containerId}`)
      return null
    }
    
    // 清理容器內的所有 canvas
    const existingCanvases = container.querySelectorAll('canvas')
    existingCanvases.forEach(canvas => {
      try {
        canvas.remove()
      } catch (e) {
        console.warn('移除 canvas 時發生錯誤:', e)
      }
    })
    
    // 創建新的 canvas 元素，使用唯一 ID
    const timestamp = Date.now()
    const uniqueId = `${chartType}_${timestamp}_${chartIdCounter.value++}`
    
    const canvas = document.createElement('canvas')
    canvas.id = uniqueId
    canvas.width = 400
    canvas.height = 200
    canvas.style.width = '100%'
    canvas.style.height = 'auto'
    
    // 確保 canvas 元素有效
    if (!canvas.getContext) {
      console.error('Canvas 元素不支持 getContext')
      return null
    }
    
    // 測試 2D 上下文
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.error('無法獲取 2D 上下文')
      return null
    }
    
    container.appendChild(canvas)
    console.log(`創建新的 ${chartType} canvas: ${uniqueId}`)
    
    return canvas
  }

  // 更新圖表
  const updateCharts = () => {
    try {
      console.log('=== 開始更新圖表 ===')
      
      // 檢查數據是否有效
      if (!chartData.value) {
        console.warn('圖表數據無效，跳過圖表更新')
        return
      }

      // 清理舊的圖表實例
      destroyCharts()

      // 使用 nextTick 確保 DOM 已更新
      nextTick(() => {
        // 添加延遲確保 DOM 完全準備好
        setTimeout(() => {
          // 創建新的 Canvas 元素
          const revenueCanvas = createCanvas('revenueChartContainer', 'revenue')
          const activityCanvas = createCanvas('activityChartContainer', 'activity')
          
          if (!revenueCanvas || !activityCanvas) {
            console.error('無法創建 Canvas 元素')
            return
          }

          // 再次檢查 Canvas 是否有效
          if (!revenueCanvas.getContext || !activityCanvas.getContext) {
            console.error('Canvas 元素無效')
            return
          }

          // 創建營收圖表
          if (chartData.value.revenue && chartData.value.revenue.length > 0) {
            const validRevenueData = chartData.value.revenue.filter(item => 
              item && typeof item.value === 'number' && !isNaN(item.value)
            )
            
            if (validRevenueData.length > 0) {
              try {
                const ctx = revenueCanvas.getContext('2d')
                if (!ctx) {
                  console.error('無法獲取營收圖表 2D 上下文')
                  return
                }
                
                revenueChart.value = new Chart(ctx, {
                  type: 'line',
                  data: {
                    labels: chartData.value.revenue.map(item => item.label || ''),
                    datasets: [{
                      label: '營收',
                      data: chartData.value.revenue.map(item => item.value || 0),
                      borderColor: '#3b82f6',
                      backgroundColor: 'rgba(59, 130, 246, 0.1)',
                      borderWidth: 2,
                      tension: 0.1,
                      fill: false,
                      pointBackgroundColor: '#3b82f6',
                      pointBorderColor: '#ffffff',
                      pointBorderWidth: 2,
                      pointRadius: 4,
                      pointHoverRadius: 6
                    }]
                  },
                  options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                      duration: 800
                    },
                    plugins: {
                      legend: {
                        display: false
                      }
                    },
                    scales: {
                      x: {
                        grid: {
                          display: false
                        }
                      },
                      y: {
                        beginAtZero: true,
                        grid: {
                          color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                          callback: function(value) {
                            return formatCurrency(value)
                          }
                        }
                      }
                    }
                  }
                })
                console.log('營收圖表創建成功')
              } catch (chartError) {
                console.error('創建營收圖表失敗:', chartError)
              }
            } else {
              console.warn('營收圖表數據無效，跳過創建')
            }
          }
          
          // 創建活躍度圖表
          if (chartData.value.activity && chartData.value.activity.length > 0) {
            const validActivityData = chartData.value.activity.filter(item => 
              item && typeof item.value === 'number' && !isNaN(item.value)
            )
            
            if (validActivityData.length > 0) {
              try {
                const ctx = activityCanvas.getContext('2d')
                if (!ctx) {
                  console.error('無法獲取活躍度圖表 2D 上下文')
                  return
                }
                
                activityChart.value = new Chart(ctx, {
                  type: 'bar',
                  data: {
                    labels: chartData.value.activity.map(item => item.label || ''),
                    datasets: [{
                      label: selectedRestaurant.value === 'all' ? '活躍商家數' : '訂單數',
                      data: chartData.value.activity.map(item => item.value || 0),
                      backgroundColor: 'rgba(16, 185, 129, 0.8)',
                      borderColor: '#059669',
                      borderWidth: 1,
                      borderRadius: 2
                    }]
                  },
                  options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                      duration: 800
                    },
                    plugins: {
                      legend: {
                        display: false
                      }
                    },
                    scales: {
                      x: {
                        grid: {
                          display: false
                        }
                      },
                      y: {
                        beginAtZero: true,
                        grid: {
                          color: 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                          stepSize: 1
                        }
                      }
                    }
                  }
                })
                console.log('活躍度圖表創建成功')
              } catch (chartError) {
                console.error('創建活躍度圖表失敗:', chartError)
              }
            } else {
              console.warn('活躍度圖表數據無效，跳過創建')
            }
          }
        }, 100) // 延遲 100ms 確保 DOM 完全準備好
      })
    } catch (error) {
      console.error('更新圖表時發生錯誤:', error)
      destroyCharts()
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

  // 組件卸載時清理圖表
  onUnmounted(() => {
    // 使用統一的清理函數
    destroyAllCharts()
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
