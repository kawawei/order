// 報表統計頁面的 JavaScript 邏輯
import { ref, onMounted, watch, nextTick } from 'vue'
import { reportAPI } from '@/services/api'
import Chart from 'chart.js/auto'

export function useReports() {
  // 響應式數據
  const selectedPeriod = ref('day')
  const isLoading = ref(false)
  
  // 時間導航相關
  const currentDate = ref(new Date())
  const selectedDate = ref(new Date())
  const selectedMonth = ref(new Date())
  const selectedYear = ref(new Date())
  
  // 財務統計數據
  const financialStats = ref({
    revenue: 0,
    profit: 0,
    cost: 0,
    revenueChange: 0,
    profitChange: 0,
    costChange: 0,
    // 新增基於實際庫存成本的數據
    profitMargin: 0,
    costRatio: 0
  })
  
  // 人流量統計
  const trafficStats = ref({
    totalCustomers: 0,
    customerChange: 0,
    peakHours: [],
    averageStayTime: 0
  })
  
  // 熱門餐點
  const popularDishes = ref([])
  
  // 圖表數據
  const chartData = ref({
    revenue: [],
    traffic: [],
    dishes: []
  })
  
  // 圖表實例
  const revenueChart = ref(null)
  const trafficChart = ref(null)
  
  // 切換時間週期
  const changePeriod = (period) => {
    selectedPeriod.value = period
    // 重置時間選擇到當前時間
    const now = new Date()
    selectedDate.value = new Date(now)
    selectedMonth.value = new Date(now)
    selectedYear.value = new Date(now)
    loadReportData()
  }
  
  // 時間導航功能
  const navigateTime = (direction) => {
    const current = getCurrentTimeSelection()
    
    if (selectedPeriod.value === 'day') {
      // 切換日期
      const newDate = new Date(current)
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1))
      selectedDate.value = newDate
    } else if (selectedPeriod.value === 'month') {
      // 切換月份
      const newDate = new Date(current)
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
      selectedMonth.value = newDate
    } else if (selectedPeriod.value === 'year') {
      // 切換年份
      const newDate = new Date(current)
      newDate.setFullYear(newDate.getFullYear() + (direction === 'next' ? 1 : -1))
      selectedYear.value = newDate
    }
    
    loadReportData()
  }
  
  // 獲取當前選中的時間
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
  const loadReportData = async (customDate = null) => {
    try {
      isLoading.value = true
      
      // 構建查詢參數
      const params = {
        period: selectedPeriod.value
      }
      
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
      
      // 調用真實的 API
      const response = await reportAPI.getReportStats(params)
      
      if (response.status === 'success') {
        const data = response.data
        
        // 更新財務統計（使用實際庫存成本數據）
        financialStats.value = {
          revenue: data.financial.totalRevenue || 0,
          profit: data.financial.totalProfit || 0,
          cost: data.financial.totalCost || 0,
          revenueChange: data.financial.revenueChange || 0,
          profitChange: data.financial.profitChange || 0,
          costChange: data.financial.costChange || 0,
          profitMargin: data.financial.profitMargin || 0,
          costRatio: data.financial.costRatio || 0
        }
        
        // 更新人流量統計
        trafficStats.value = {
          totalCustomers: data.traffic.totalCustomers || 0,
          customerChange: data.traffic.customerChange || 0,
          peakHours: data.traffic.peakHours || [],
          averageStayTime: data.traffic.averageStayTime || 45
        }
        
        // 更新熱門餐點
        popularDishes.value = data.popularDishes || []
        
        // 更新圖表數據
        chartData.value = {
          revenue: data.timeSeries.revenue || [],
          traffic: data.timeSeries.traffic || [],
          dishes: data.popularDishes || []
        }
        
        // 更新圖表
        nextTick(() => {
          updateCharts()
        })
      }
    } catch (error) {
      console.error('載入報表數據失敗:', error)
      // 如果 API 調用失敗，使用預設數據
      setDefaultData()
    } finally {
      isLoading.value = false
    }
  }
  
  // 設置預設數據（當 API 調用失敗時使用）
  const setDefaultData = () => {
    financialStats.value = {
      revenue: 0,
      profit: 0,
      cost: 0,
      revenueChange: 0,
      profitChange: 0,
      costChange: 0,
      profitMargin: 0,
      costRatio: 0
    }
    
    trafficStats.value = {
      totalCustomers: 0,
      customerChange: 0,
      peakHours: [],
      averageStayTime: 0
    }
    
    popularDishes.value = []
    
    chartData.value = {
      revenue: [],
      traffic: [],
      dishes: []
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
    if (change > 0) return '↗️'
    if (change < 0) return '↘️'
    return '→'
  }
  
  // 獲取趨勢顏色
  const getTrendColor = (change) => {
    if (change > 0) return 'success'
    if (change < 0) return 'error'
    return 'default'
  }
  
  // 計算利潤率（使用後端返回的實際數據）
  const calculateProfitMargin = () => {
    if (financialStats.value.revenue === 0) return 0
    // 如果後端有提供實際利潤率，優先使用
    if (financialStats.value.profitMargin !== undefined) {
      return financialStats.value.profitMargin
    }
    // 否則前端計算
    return ((financialStats.value.profit / financialStats.value.revenue) * 100).toFixed(1)
  }
  
  // 計算成本率（使用後端返回的實際數據）
  const calculateCostRatio = () => {
    if (financialStats.value.revenue === 0) return 0
    // 如果後端有提供實際成本率，優先使用
    if (financialStats.value.costRatio !== undefined) {
      return financialStats.value.costRatio
    }
    // 否則前端計算
    return ((financialStats.value.cost / financialStats.value.revenue) * 100).toFixed(1)
  }
  
  // 獲取熱門時段
  const getPeakHours = () => {
    if (!trafficStats.value.peakHours || trafficStats.value.peakHours.length === 0) {
      return '暫無數據'
    }
    return trafficStats.value.peakHours.join('、')
  }
  
  // 導出報表
  const exportReport = () => {
    const reportData = {
      period: selectedPeriod.value,
      financial: financialStats.value,
      traffic: trafficStats.value,
      popularDishes: popularDishes.value,
      exportTime: new Date().toLocaleString('zh-TW')
    }
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json'
    })
    
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `報表統計_${selectedPeriod.value}_${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  // 檢查是否可以切換到上一個時間
  const canGoPrevious = () => {
    const current = getCurrentTimeSelection()
    const now = new Date()
    
    if (selectedPeriod.value === 'day') {
      // 允許查看過去30天
      const thirtyDaysAgo = new Date(now)
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      return current > thirtyDaysAgo
    } else if (selectedPeriod.value === 'month') {
      // 允許查看過去12個月
      const twelveMonthsAgo = new Date(now)
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)
      return current > twelveMonthsAgo
    } else {
      // 允許查看過去5年
      const fiveYearsAgo = new Date(now)
      fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)
      return current > fiveYearsAgo
    }
  }
  
  // 檢查是否可以切換到下一個時間
  const canGoNext = () => {
    const current = getCurrentTimeSelection()
    const now = new Date()
    
    if (selectedPeriod.value === 'day') {
      // 不允許查看未來日期
      return current < now
    } else if (selectedPeriod.value === 'month') {
      // 不允許查看未來月份
      return current.getFullYear() < now.getFullYear() || 
             (current.getFullYear() === now.getFullYear() && current.getMonth() < now.getMonth())
    } else {
      // 不允許查看未來年份
      return current.getFullYear() < now.getFullYear()
    }
  }
  
  // 獲取顯示時間
  const getDisplayTime = () => {
    const current = getCurrentTimeSelection()
    
    if (selectedPeriod.value === 'day') {
      return current.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      })
    } else if (selectedPeriod.value === 'month') {
      return current.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long'
      })
    } else {
      return current.toLocaleDateString('zh-TW', {
        year: 'numeric'
      })
    }
  }
  
  // 獲取日期選擇器標題
  const getDatePickerTitle = () => {
    if (selectedPeriod.value === 'day') {
      return '選擇日期'
    } else if (selectedPeriod.value === 'month') {
      return '選擇月份'
    } else {
      return '選擇年份'
    }
  }
  
  // 獲取日期選擇器標籤
  const getDatePickerLabel = () => {
    if (selectedPeriod.value === 'day') {
      return '選擇日期'
    } else if (selectedPeriod.value === 'month') {
      return '選擇月份'
    } else {
      return '選擇年份'
    }
  }
  
  // 獲取日期輸入框類型
  const getDateInputType = () => {
    if (selectedPeriod.value === 'day') {
      return 'date'
    } else if (selectedPeriod.value === 'month') {
      return 'month'
    } else {
      return 'number'
    }
  }
  
  // 更新圖表
  const updateCharts = () => {
    // 銷毀現有圖表
    if (revenueChart.value) {
      revenueChart.value.destroy()
      revenueChart.value = null
    }
    if (trafficChart.value) {
      trafficChart.value.destroy()
      trafficChart.value = null
    }
    
    // 延遲一下確保 DOM 已更新
    setTimeout(() => {
      // 獲取 canvas 元素
      const revenueCanvas = document.getElementById('revenueChart')
      const trafficCanvas = document.getElementById('trafficChart')
      
      if (!revenueCanvas || !trafficCanvas) {
        console.warn('找不到圖表 canvas 元素')
        return
      }
    
    // 繪製營收趨勢圖
    const revenueCtx = revenueCanvas.getContext('2d')
    revenueChart.value = new Chart(revenueCtx, {
      type: 'line',
      data: {
        labels: chartData.value.revenue.map(item => item._id || ''),
        datasets: [{
          label: '營收',
          data: chartData.value.revenue.map(item => item.revenue || 0),
          borderColor: 'rgb(75, 192, 192)',
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          tension: 0.1,
          fill: true
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
                return '$' + value.toLocaleString()
              }
            }
          }
        }
      }
    })
    
    // 繪製人流量趨勢圖
    const trafficCtx = trafficCanvas.getContext('2d')
    trafficChart.value = new Chart(trafficCtx, {
      type: 'bar',
      data: {
        labels: chartData.value.traffic.map(item => item._id || ''),
        datasets: [{
          label: '人流量',
          data: chartData.value.traffic.map(item => item.totalCustomers || 0),
          backgroundColor: 'rgba(54, 162, 235, 0.8)',
          borderColor: 'rgb(54, 162, 235)',
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
    }, 100) // 延遲 100ms
  }
  
  return {
    // 響應式數據
    selectedPeriod,
    selectedDate,
    selectedMonth,
    selectedYear,
    isLoading,
    financialStats,
    trafficStats,
    popularDishes,
    chartData,
    
    // 方法
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
  }
}
