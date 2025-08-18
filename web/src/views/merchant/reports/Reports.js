// 報表統計頁面的 JavaScript 邏輯
import { ref, onMounted, watch } from 'vue'

export function useReports() {
  // 響應式數據
  const selectedPeriod = ref('day')
  const isLoading = ref(false)
  
  // 財務統計數據
  const financialStats = ref({
    revenue: 0,
    profit: 0,
    cost: 0,
    revenueChange: 0,
    profitChange: 0,
    costChange: 0
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
  
  // 切換時間週期
  const changePeriod = (period) => {
    selectedPeriod.value = period
    loadReportData()
  }
  
  // 載入報表數據
  const loadReportData = async () => {
    try {
      isLoading.value = true
      // 這裡應該調用 API 獲取數據
      await simulateDataLoading()
      generateChartData()
    } catch (error) {
      console.error('載入報表數據失敗:', error)
    } finally {
      isLoading.value = false
    }
  }
  
  // 模擬數據載入
  const simulateDataLoading = async () => {
    // 模擬 API 延遲
    await new Promise(resolve => setTimeout(resolve, 800))
    
    if (selectedPeriod.value === 'day') {
      financialStats.value = {
        revenue: 12500,
        profit: 8500,
        cost: 4000,
        revenueChange: 12.5,
        profitChange: 8.3,
        costChange: -2.1
      }
      trafficStats.value = {
        totalCustomers: 156,
        customerChange: 15.2,
        peakHours: ['12:00-13:00', '18:00-19:00'],
        averageStayTime: 45
      }
      popularDishes.value = [
        { id: 1, name: '紅燒牛肉麵', category: '麵食', orderCount: 45, revenue: 2250 },
        { id: 2, name: '宮保雞丁', category: '熱炒', orderCount: 38, revenue: 1900 },
        { id: 3, name: '麻婆豆腐', category: '熱炒', orderCount: 32, revenue: 1280 },
        { id: 4, name: '酸菜魚', category: '湯品', orderCount: 28, revenue: 1400 },
        { id: 5, name: '糖醋里脊', category: '熱炒', orderCount: 25, revenue: 1250 }
      ]
    } else if (selectedPeriod.value === 'month') {
      financialStats.value = {
        revenue: 285000,
        profit: 195000,
        cost: 90000,
        revenueChange: 8.7,
        profitChange: 12.3,
        costChange: 3.2
      }
      trafficStats.value = {
        totalCustomers: 3240,
        customerChange: 6.8,
        peakHours: ['週末 12:00-14:00', '週末 18:00-20:00'],
        averageStayTime: 52
      }
      popularDishes.value = [
        { id: 1, name: '紅燒牛肉麵', category: '麵食', orderCount: 890, revenue: 44500 },
        { id: 2, name: '宮保雞丁', category: '熱炒', orderCount: 756, revenue: 37800 },
        { id: 3, name: '麻婆豆腐', category: '熱炒', orderCount: 634, revenue: 25360 },
        { id: 4, name: '酸菜魚', category: '湯品', orderCount: 598, revenue: 29900 },
        { id: 5, name: '糖醋里脊', category: '熱炒', orderCount: 523, revenue: 26150 }
      ]
    } else {
      financialStats.value = {
        revenue: 2850000,
        profit: 1950000,
        cost: 900000,
        revenueChange: 15.2,
        profitChange: 18.7,
        costChange: 8.9
      }
      trafficStats.value = {
        totalCustomers: 32400,
        customerChange: 12.3,
        peakHours: ['節假日 12:00-14:00', '節假日 18:00-20:00'],
        averageStayTime: 48
      }
      popularDishes.value = [
        { id: 1, name: '紅燒牛肉麵', category: '麵食', orderCount: 8900, revenue: 445000 },
        { id: 2, name: '宮保雞丁', category: '熱炒', orderCount: 7560, revenue: 378000 },
        { id: 3, name: '麻婆豆腐', category: '熱炒', orderCount: 6340, revenue: 253600 },
        { id: 4, name: '酸菜魚', category: '湯品', orderCount: 5980, revenue: 299000 },
        { id: 5, name: '糖醋里脊', category: '熱炒', orderCount: 5230, revenue: 261500 }
      ]
    }
  }
  
  // 生成圖表數據
  const generateChartData = () => {
    if (selectedPeriod.value === 'day') {
      chartData.value.revenue = [
        { time: '06:00', value: 0 },
        { time: '09:00', value: 1200 },
        { time: '12:00', value: 4500 },
        { time: '15:00', value: 1800 },
        { time: '18:00', value: 3800 },
        { time: '21:00', value: 1200 }
      ]
      chartData.value.traffic = [
        { time: '06:00', value: 0 },
        { time: '09:00', value: 15 },
        { time: '12:00', value: 45 },
        { time: '15:00', value: 18 },
        { time: '18:00', value: 38 },
        { time: '21:00', value: 12 }
      ]
    } else if (selectedPeriod.value === 'month') {
      chartData.value.revenue = [
        { time: '第1週', value: 65000 },
        { time: '第2週', value: 72000 },
        { time: '第3週', value: 68000 },
        { time: '第4週', value: 80000 }
      ]
      chartData.value.traffic = [
        { time: '第1週', value: 780 },
        { time: '第2週', value: 820 },
        { time: '第3週', value: 760 },
        { time: '第4週', value: 880 }
      ]
    } else {
      chartData.value.revenue = [
        { time: '1月', value: 220000 },
        { time: '2月', value: 180000 },
        { time: '3月', value: 250000 },
        { time: '4月', value: 280000 },
        { time: '5月', value: 300000 },
        { time: '6月', value: 320000 },
        { time: '7月', value: 350000 },
        { time: '8月', value: 380000 },
        { time: '9月', value: 360000 },
        { time: '10月', value: 390000 },
        { time: '11月', value: 420000 },
        { time: '12月', value: 450000 }
      ]
      chartData.value.traffic = [
        { time: '1月', value: 2200 },
        { time: '2月', value: 1800 },
        { time: '3月', value: 2500 },
        { time: '4月', value: 2800 },
        { time: '5月', value: 3000 },
        { time: '6月', value: 3200 },
        { time: '7月', value: 3500 },
        { time: '8月', value: 3800 },
        { time: '9月', value: 3600 },
        { time: '10月', value: 3900 },
        { time: '11月', value: 4200 },
        { time: '12月', value: 4500 }
      ]
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
    if (change > 0) return '↗'
    if (change < 0) return '↘'
    return '→'
  }
  
  // 獲取趨勢顏色
  const getTrendColor = (change) => {
    if (change > 0) return '#10b981'
    if (change < 0) return '#ef4444'
    return '#6b7280'
  }
  
  // 計算毛利率
  const calculateProfitMargin = () => {
    if (financialStats.value.revenue === 0) return 0
    return ((financialStats.value.profit / financialStats.value.revenue) * 100).toFixed(1)
  }
  
  // 計算成本率
  const calculateCostRatio = () => {
    if (financialStats.value.revenue === 0) return 0
    return ((financialStats.value.cost / financialStats.value.revenue) * 100).toFixed(1)
  }
  
  // 獲取熱門時段
  const getPeakHours = () => {
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
  
  return {
    // 響應式數據
    selectedPeriod,
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
    exportReport
  }
}
