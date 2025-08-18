import { ref, computed, onMounted, onUnmounted } from 'vue'
import { orderService } from '@/services/api'
import api from '@/services/api'

export function useDashboard(restaurantId = null) {
  const currentDate = ref('')
  const loading = ref(false)
  const error = ref(null)
  
  // 真實數據
  const liveOrders = ref([])
  const orderStats = ref({
    pending: 0,
    preparing: 0,
    ready: 0,
    totalToday: 0
  })
  
  const businessStats = ref({
    tablesInUse: 0,
    totalTables: 0,
    currentGuests: 0,
    seatUtilization: 0
  })
  
  const revenueStats = ref({
    todayRevenue: 0,
    todayGrowth: 0,
    avgOrderValue: 0,
    peakHour: '',
    monthRevenue: 0,
    monthGrowth: 0,
    dailyAvg: 0,
    targetAchievement: 0
  })
  
  const popularItems = ref([])
  
  // 表格欄位配置
  const popularItemsColumns = [
    { key: 'name', label: '品項', width: '50%' },
    { key: 'quantity', label: '數量', width: '25%' },
    { key: 'trend', label: '趨勢', width: '25%' }
  ]

  // 計算屬性
  const pendingOrders = computed(() => 
    liveOrders.value.filter(order => order.status === 'pending')
  )
  
  const preparingOrders = computed(() => 
    liveOrders.value.filter(order => order.status === 'preparing')
  )
  
  const readyOrders = computed(() => 
    liveOrders.value.filter(order => order.status === 'ready')
  )

  // 獲取商家ID
  const getMerchantId = () => {
    try {
      // 優先使用傳入的restaurantId參數（超級管理員查看特定商家時使用）
      if (restaurantId) {
        console.log(`使用傳入的餐廳ID: ${restaurantId}`)
        return restaurantId
      }
      
      // 其次嘗試從URL查詢參數獲取restaurantId（超級管理員從餐廳管理頁面跳轉過來）
      const urlParams = new URLSearchParams(window.location.search)
      const urlRestaurantId = urlParams.get('restaurantId')
      if (urlRestaurantId) {
        console.log(`使用URL查詢參數中的餐廳ID: ${urlRestaurantId}`)
        return urlRestaurantId
      }
      
      // 再次嘗試從localStorage獲取用戶信息
      const storedUser = localStorage.getItem('user')
      if (storedUser) {
        const userData = JSON.parse(storedUser)
        // 如果是超級管理員，需要從其他地方獲取商家ID
        if (userData.role === 'admin' || userData.role === 'superadmin') {
          // 超級管理員查看商家後台時，應該有 restaurantId 參數
          // 如果沒有，則無法獲取商家ID
          console.warn('超級管理員查看商家後台需要指定餐廳ID')
          return null
        }
        // 普通商家用戶，直接返回用戶ID
        console.log(`使用商家用戶ID: ${userData._id || userData.id}`)
        return userData._id || userData.id
      }
      
      // 如果沒有用戶信息，嘗試從merchant存儲獲取
      const storedMerchant = localStorage.getItem('merchant')
      if (storedMerchant) {
        const merchantData = JSON.parse(storedMerchant)
        console.log(`使用merchant存儲中的ID: ${merchantData._id || merchantData.id}`)
        return merchantData._id || merchantData.id
      }
      
      console.warn('無法獲取商家ID，用戶可能未登入')
      return null
    } catch (error) {
      console.error('獲取商家ID失敗:', error)
      return null
    }
  }

  // 更新當前時間
  function updateCurrentDate() {
    const now = new Date()
    const options = { 
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit'
    }
    currentDate.value = now.toLocaleDateString('zh-TW', options)
  }

  // 載入即時訂單數據
  const loadLiveOrders = async () => {
    try {
      const merchantId = getMerchantId()
      if (!merchantId) {
        console.error('無法載入訂單：商家ID不存在')
        return
      }
      
      const response = await orderService.getOrdersByMerchant(merchantId, {
        status: 'pending,preparing,ready',
        limit: 50,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      })
      
      if (response.status === 'success') {
        liveOrders.value = response.data.orders.map(order => ({
          ...order,
          tableNumber: order.tableId?.tableNumber || '未知桌號',
          items: order.items || []
        }))
        
        // 更新訂單統計
        updateOrderStats()
      }
    } catch (error) {
      console.error('載入即時訂單失敗:', error)
    }
  }

  // 更新訂單統計
  const updateOrderStats = () => {
    orderStats.value = {
      pending: pendingOrders.value.length,
      preparing: preparingOrders.value.length,
      ready: readyOrders.value.length,
      totalToday: 0 // 將在 loadTodayCheckoutTables 中更新
    }
  }

  // 載入今日總訂單統計
  const loadTodayTotalOrders = async () => {
    try {
      const merchantId = getMerchantId()
      if (!merchantId) return
      
      // 獲取今天的日期
      const today = new Date()
      const todayStr = today.toISOString().slice(0, 10) // 格式：YYYY-MM-DD
      
      // 使用統計API獲取今天的總訂單數
      const response = await orderService.getOrderStats(merchantId, {
        date: todayStr
      })
      
      if (response.status === 'success') {
        // 更新今日總訂單數
        orderStats.value.totalToday = response.data.totalOrders
      }
    } catch (error) {
      console.error('載入今日總訂單統計失敗:', error)
      orderStats.value.totalToday = 0
    }
  }

  // 載入營業統計
  const loadBusinessStats = async () => {
    try {
      const merchantId = getMerchantId()
      if (!merchantId) {
        console.warn('無法載入營業統計：商家ID不存在')
        return
      }
      
      // 調用桌台統計API
      // 如果是超級管理員，需要傳遞merchantId參數
      const storedUser = localStorage.getItem('user')
      let tableResponse
      
      if (storedUser) {
        const userData = JSON.parse(storedUser)
        if (userData.role === 'admin' || userData.role === 'superadmin') {
          // 超級管理員需要傳遞merchantId參數
          tableResponse = await api.get(`/tables/stats?merchantId=${merchantId}`)
        } else {
          // 商家直接呼叫自己的API
          tableResponse = await api.get(`/tables/stats`)
        }
      } else {
        // 默認情況，直接呼叫API
        tableResponse = await api.get(`/tables/stats`)
      }
      
      if (tableResponse.status === 'success') {
        const stats = tableResponse.data
        businessStats.value = {
          tablesInUse: stats.occupiedTables || 0,
          totalTables: stats.totalTables || 0,
          currentGuests: (stats.occupiedTables || 0) * 3, // 假設每桌平均3人
          seatUtilization: stats.totalTables > 0 ? Math.round((stats.occupiedTables / stats.totalTables) * 100) : 0
        }
      }
    } catch (error) {
      console.error('載入營業統計失敗:', error)
      // 如果API調用失敗，使用默認值
      businessStats.value = {
        tablesInUse: 0,
        totalTables: 0,
        currentGuests: 0,
        seatUtilization: 0
      }
    }
  }

  // 載入營業額統計
  const loadRevenueStats = async () => {
    try {
      const merchantId = getMerchantId()
      if (!merchantId) return
      
      // 調用訂單統計API - 今日數據
      const today = new Date().toISOString().split('T')[0]
      const todayResponse = await orderService.getOrderStats(merchantId, { date: today })
      
      if (todayResponse.status === 'success') {
        const todayStats = todayResponse.data
        const totalRevenue = todayStats.totalRevenue || 0
        const totalOrders = todayStats.totalOrders || 0
        
        // 計算今日統計
        revenueStats.value.todayRevenue = totalRevenue
        revenueStats.value.avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0
        
        // 計算當月營業額
        const currentMonth = new Date()
        const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
        const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
        
        const monthResponse = await orderService.getOrderStats(merchantId, { 
          startDate: monthStart.toISOString().split('T')[0],
          endDate: monthEnd.toISOString().split('T')[0]
        })
        
        if (monthResponse.status === 'success') {
          const monthStats = monthResponse.data
          revenueStats.value.monthRevenue = monthStats.totalRevenue || 0
          
          // 計算日均營業額
          const daysInMonth = monthEnd.getDate()
          revenueStats.value.dailyAvg = daysInMonth > 0 ? Math.round(monthStats.totalRevenue / daysInMonth) : 0
          
          // 計算當月增長率（與上月比較）
          const lastMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
          const lastMonthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0)
          
          try {
            const lastMonthResponse = await orderService.getOrderStats(merchantId, {
              startDate: lastMonth.toISOString().split('T')[0],
              endDate: lastMonthEnd.toISOString().split('T')[0]
            })
            
            if (lastMonthResponse.status === 'success') {
              const lastMonthRevenue = lastMonthResponse.data.totalRevenue || 0
              if (lastMonthRevenue > 0) {
                const growth = ((monthStats.totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
                revenueStats.value.monthGrowth = Math.round(growth * 10) / 10
              } else {
                revenueStats.value.monthGrowth = monthStats.totalRevenue > 0 ? 100 : 0
              }
            }
          } catch (error) {
            console.warn('無法獲取上月數據，使用默認增長率:', error)
            revenueStats.value.monthGrowth = 0
          }
        }
        
        // 計算今日增長率（與昨日比較）
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]
        
        try {
          const yesterdayResponse = await orderService.getOrderStats(merchantId, { date: yesterdayStr })
          if (yesterdayResponse.status === 'success') {
            const yesterdayRevenue = yesterdayResponse.data.totalRevenue || 0
            if (yesterdayRevenue > 0) {
              const growth = ((totalRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
              revenueStats.value.todayGrowth = Math.round(growth * 10) / 10
            } else {
              revenueStats.value.todayGrowth = totalRevenue > 0 ? 100 : 0
            }
          }
        } catch (error) {
          console.warn('無法獲取昨日數據，使用默認增長率:', error)
          revenueStats.value.todayGrowth = 0
        }
        
        // 計算預期達成率（假設月目標為當月營業額的1.2倍）
        const monthlyTarget = revenueStats.value.monthRevenue * 1.2
        revenueStats.value.targetAchievement = monthlyTarget > 0 ? Math.round((revenueStats.value.monthRevenue / monthlyTarget) * 100) : 0
        
        // 暫時使用模擬數據，後續可以擴展為真實的尖峰時段計算
        revenueStats.value.peakHour = '12:00-13:00'
      }
    } catch (error) {
      console.error('載入營業額統計失敗:', error)
      // 如果API調用失敗，使用默認值
      revenueStats.value = {
        todayRevenue: 0,
        todayGrowth: 0,
        avgOrderValue: 0,
        peakHour: '',
        monthRevenue: 0,
        monthGrowth: 0,
        dailyAvg: 0,
        targetAchievement: 0
      }
    }
  }

  // 載入熱門品項
  const loadPopularItems = async () => {
    try {
      const merchantId = getMerchantId()
      if (!merchantId) return
      
      // 獲取最近7天的訂單數據來統計熱門品項
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const response = await orderService.getOrdersByMerchant(merchantId, {
        startDate: sevenDaysAgo.toISOString(),
        status: 'completed,delivered', // 只統計已完成的訂單
        limit: 1000
      })
      
      if (response.status === 'success') {
        // 統計每個餐點被點的次數
        const itemCounts = {}
        const itemTrends = {}
        
        response.data.orders.forEach(order => {
          if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
              const itemName = item.name || item.dishName
              if (itemName) {
                const quantity = item.quantity || 1
                itemCounts[itemName] = (itemCounts[itemName] || 0) + quantity
                
                // 簡單的趨勢計算：根據訂單時間判斷是前半週還是後半週
                const orderDate = new Date(order.createdAt)
                const midWeek = new Date(sevenDaysAgo.getTime() + (7 * 24 * 60 * 60 * 1000) / 2)
                
                if (!itemTrends[itemName]) {
                  itemTrends[itemName] = { firstHalf: 0, secondHalf: 0 }
                }
                
                if (orderDate < midWeek) {
                  itemTrends[itemName].firstHalf += quantity
                } else {
                  itemTrends[itemName].secondHalf += quantity
                }
              }
            })
          }
        })
        
        // 轉換為數組並排序
        const sortedItems = Object.entries(itemCounts)
          .map(([name, count]) => {
            const trend = itemTrends[name]
            let trendSymbol = '→'
            
            if (trend) {
              if (trend.secondHalf > trend.firstHalf) {
                trendSymbol = '↑'
              } else if (trend.secondHalf < trend.firstHalf) {
                trendSymbol = '↓'
              }
            }
            
            return {
              name,
              quantity: `${count}份`,
              trend: trendSymbol
            }
          })
          .sort((a, b) => {
            // 按數量排序，取前5名
            const countA = parseInt(a.quantity)
            const countB = parseInt(b.quantity)
            return countB - countA
          })
          .slice(0, 5)
        
        popularItems.value = sortedItems
      } else {
        // 如果API調用失敗，使用空數組
        popularItems.value = []
      }
    } catch (error) {
      console.error('載入熱門品項失敗:', error)
      popularItems.value = []
    }
  }

  // 刷新所有數據
  const refreshData = async () => {
    try {
      loading.value = true
      await Promise.all([
        loadLiveOrders(),
        loadBusinessStats(),
        loadRevenueStats(),
        loadPopularItems(),
        loadTodayTotalOrders() // 新增載入今日總訂單統計
      ])
    } catch (error) {
      console.error('刷新數據失敗:', error)
    } finally {
      loading.value = false
    }
  }

  // 刷新熱門品項
  const refreshItems = async () => {
    await loadPopularItems()
  }

  // 初始化
  onMounted(() => {
    updateCurrentDate()
    refreshData()
    
    // 每分鐘更新一次時間
    const timeInterval = setInterval(updateCurrentDate, 60000)
    
    // 每5分鐘更新一次數據
    const dataInterval = setInterval(refreshData, 300000)
    
    // 清理定時器
    onUnmounted(() => {
      clearInterval(timeInterval)
      clearInterval(dataInterval)
    })
  })

  return {
    // 響應式數據
    currentDate,
    loading,
    error,
    liveOrders,
    orderStats,
    businessStats,
    revenueStats,
    popularItems,
    popularItemsColumns,
    
    // 方法
    refreshData,
    refreshItems,
    loadLiveOrders
  }
}
