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
    totalToday: 0,
    totalCustomers: 0
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
      console.log('=== getMerchantId 調試信息 ===') // 添加調試日誌
      console.log('傳入的 restaurantId 參數:', restaurantId) // 添加調試日誌
      
      // 優先使用傳入的restaurantId參數（超級管理員查看特定商家時使用）
      if (restaurantId) {
        console.log(`使用傳入的餐廳ID: ${restaurantId}`)
        return restaurantId
      }
      
      // 其次嘗試從URL查詢參數獲取restaurantId（超級管理員從餐廳管理頁面跳轉過來）
      const urlParams = new URLSearchParams(window.location.search)
      const urlRestaurantId = urlParams.get('restaurantId')
      console.log('URL查詢參數中的 restaurantId:', urlRestaurantId) // 添加調試日誌
      if (urlRestaurantId) {
        console.log(`使用URL查詢參數中的餐廳ID: ${urlRestaurantId}`)
        return urlRestaurantId
      }
      
      // 再次嘗試從localStorage獲取用戶信息（新鍵優先）
      const merchantUserRaw = localStorage.getItem('merchant_user')
      console.log('localStorage 中的 merchant_user 數據:', merchantUserRaw)
      if (merchantUserRaw) {
        const mu = JSON.parse(merchantUserRaw)
        const merchantId =
          mu.merchantId ||
          (typeof mu.merchant === 'string' ? mu.merchant : null) ||
          mu._id ||
          mu.id
        console.log(`使用 merchant_user 中的 ID: ${merchantId}`)
        return merchantId
      }

      // 回退舊鍵：統一 user
      const storedUser = localStorage.getItem('user')
      console.log('localStorage 中的 user 數據:', storedUser)
      if (storedUser) {
        const userData = JSON.parse(storedUser)
        if (userData.role === 'admin' || userData.role === 'superadmin') {
          console.warn('超級管理員查看商家後台需要指定餐廳ID')
          return null
        }
        const merchantId =
          userData.merchantId ||
          (typeof userData.merchant === 'string' ? userData.merchant : null) ||
          userData._id ||
          userData.id
        console.log(`使用商家用戶ID: ${merchantId}`)
        return merchantId
      }

      // 回退舊鍵：merchant
      const storedMerchant = localStorage.getItem('merchant')
      console.log('localStorage 中的 merchant 數據:', storedMerchant)
      if (storedMerchant) {
        const merchantData = JSON.parse(storedMerchant)
        const merchantId = merchantData._id || merchantData.id
        console.log(`使用 merchant 存儲中的ID: ${merchantId}`)
        return merchantId
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
      totalToday: 0, // 將在 loadTodayCheckoutTables 中更新
      totalCustomers: 0 // 將在 loadTodayCheckoutTables 中更新
    }
  }

  // 按桌次和客人組別合併訂單的方法（與訂單管理頁面相同的邏輯）
  const mergeOrdersByTable = (orders) => {
    const tableGroups = {}
    
    orders.forEach(order => {
      const tableId = order.tableId?._id || order.tableId
      const tableNumber = getTableNumber(order.tableId)
      
      // 從訂單號解析客人組別和批次號
      let customerGroup = '1' // 預設組別
      let batchNumber = '1' // 預設批次號
      
      if (order.orderNumber && order.orderNumber.includes('-')) {
        const parts = order.orderNumber.split('-')
        if (parts.length >= 2) {
          // 訂單號格式：T1-202508180001001
          // parts[0] = T1, parts[1] = 202508180001001
          const dateGroupBatch = parts[1]
          
          if (dateGroupBatch.length >= 12) {
            // 202508180001001 中：
            // 前8位是日期：20250818
            // 中間4位是客人組別：0001
            // 後3位是批次號：001
            const groupPart = dateGroupBatch.substring(8, 12)
            const batchPart = dateGroupBatch.substring(12, 15)
            
            // 去掉前導零
            customerGroup = parseInt(groupPart).toString()
            batchNumber = parseInt(batchPart).toString()
          }
        }
      }
      
      // 使用桌次+客人組別作為分組鍵
      const groupKey = `${tableId}_${customerGroup}`
      
      if (!tableGroups[groupKey]) {
        tableGroups[groupKey] = {
          tableId: tableId,
          tableNumber: tableNumber,
          customerGroup: customerGroup,
          orders: [],
          batchNumbers: new Set(), // 使用 Set 來收集批次號
          totalAmount: 0,
          itemCount: 0,
          firstOrderTime: order.createdAt,
          lastOrderTime: order.createdAt,
          completedAt: order.completedAt,
          tableCapacity: order.tableId?.capacity || 4, // 預設4人桌
          status: 'completed' // 歷史訂單都是已完成狀態
        }
      }
      
      const group = tableGroups[groupKey]
      group.orders.push(order)
      group.batchNumbers.add(batchNumber) // 添加批次號到 Set
      group.totalAmount += order.totalAmount
      group.itemCount += order.items.length
      
      // 更新時間範圍
      const orderTime = new Date(order.createdAt)
      const firstTime = new Date(group.firstOrderTime)
      const lastTime = new Date(group.lastOrderTime)
      
      if (orderTime < firstTime) {
        group.firstOrderTime = order.createdAt
      }
      if (orderTime > lastTime) {
        group.lastOrderTime = order.createdAt
      }
      
      // 更新完成時間（使用最新的完成時間）
      if (order.completedAt) {
        const orderCompletedTime = new Date(order.completedAt)
        const groupCompletedTime = group.completedAt ? new Date(group.completedAt) : null
        
        if (!groupCompletedTime || orderCompletedTime > groupCompletedTime) {
          group.completedAt = order.completedAt
        }
      }
    })
    
    // 轉換為數組並添加計算屬性
    return Object.values(tableGroups).map(group => ({
      ...group,
      batchNumbers: Array.from(group.batchNumbers).sort((a, b) => parseInt(a) - parseInt(b)),
      batchCount: group.batchNumbers.size,
      tableOrderNumber: `T${group.tableNumber}-${group.customerGroup}`,
      // 添加桌次容量信息
      tableCapacity: group.tableCapacity
    }))
  }

  // 獲取桌號的輔助函數
  const getTableNumber = (tableInfo) => {
    if (!tableInfo) return '1'
    if (typeof tableInfo === 'string') return tableInfo
    return tableInfo.tableNumber || tableInfo._id || '1'
  }

  // 載入今日總訂單統計
  const loadTodayTotalOrders = async () => {
    try {
      const merchantId = getMerchantId()
      console.log('loadTodayTotalOrders - 商家ID:', merchantId)
      
      if (!merchantId) {
        console.warn('無法載入今日總訂單統計：商家ID不存在')
        return
      }
      
      // 使用與訂單管理頁面相同的邏輯：先獲取所有歷史訂單，然後在前端過濾
      const response = await orderService.getOrdersByMerchant(merchantId, {
        status: 'completed,cancelled',
        limit: 200,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      })
      
      console.log('loadTodayTotalOrders - API響應:', response)
      
      if (response.status === 'success') {
        // 按桌次分組合併訂單（與訂單管理頁面相同的邏輯）
        const tableOrders = mergeOrdersByTable(response.data.orders)
        
        // 計算今日結帳的訂單數
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const todayCompletedOrders = tableOrders.filter(order => {
          if (!order.completedAt) return false
          const completedDate = new Date(order.completedAt)
          completedDate.setHours(0, 0, 0, 0)
          return completedDate.getTime() === today.getTime()
        })
        
        // 計算今日客人數
        const todayCustomers = todayCompletedOrders.reduce((sum, order) => {
          return sum + (order.tableCapacity || 0)
        }, 0)
        
        // 更新統計數據
        orderStats.value = {
          ...orderStats.value,
          totalToday: todayCompletedOrders.length,
          totalCustomers: todayCustomers
        }
        console.log('loadTodayTotalOrders - 更新統計:', {
          totalToday: todayCompletedOrders.length,
          totalCustomers: todayCustomers
        })
      } else {
        console.warn('loadTodayTotalOrders - API返回失敗狀態:', response)
      }
    } catch (error) {
      console.error('載入今日總訂單統計失敗:', error)
      orderStats.value.totalToday = 0
      orderStats.value.totalCustomers = 0
    }
  }

  // 載入營業統計
  const loadBusinessStats = async () => {
    try {
      const merchantId = getMerchantId()
      console.log('loadBusinessStats - 獲取到的商家ID:', merchantId) // 添加調試日誌
      
      if (!merchantId) {
        console.warn('無法載入營業統計：商家ID不存在')
        return
      }
      
      // 調用桌台統計API：一律帶上 merchantId 以兼容員工/管理員 Token 的授權判定
      let tableResponse
      console.log('loadBusinessStats - 調用 /tables/stats，附帶 merchantId 參數')
      tableResponse = await api.get('/tables/stats', { params: { merchantId } })
      
      if (tableResponse.status === 'success') {
        const stats = tableResponse.data.stats // 修正：從 data.stats 獲取統計數據
        console.log('桌次統計數據:', stats) // 添加日誌以便調試
        
        businessStats.value = {
          tablesInUse: stats.occupiedTables || 0,
          totalTables: stats.totalTables || 0,
          currentGuests: (stats.occupiedTables || 0) * 3, // 假設每桌平均3人
          seatUtilization: stats.totalTables > 0 ? Math.round((stats.occupiedTables / stats.totalTables) * 100) : 0
        }
        
        console.log('更新後的營業統計:', businessStats.value) // 添加日誌以便調試
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
        
        // 使用與 loadTodayTotalOrders 相同的邏輯來獲取今日總人數
        const response = await orderService.getOrdersByMerchant(merchantId, {
          status: 'completed,cancelled',
          limit: 200,
          sortBy: 'createdAt',
          sortOrder: 'desc'
        })
        
        let todayCustomers = 0
        if (response.status === 'success') {
          // 按桌次分組合併訂單
          const tableOrders = mergeOrdersByTable(response.data.orders)
          
          // 計算今日結帳的訂單數（使用台灣時區）
          const today = new Date()
          const taiwanStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
          const taiwanEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)
          
          const todayCompletedOrders = tableOrders.filter(order => {
            if (!order.completedAt) return false
            const completedDate = new Date(order.completedAt)
            // 檢查是否在今日台灣時區範圍內
            return completedDate >= taiwanStart && completedDate <= taiwanEnd
          })
          
          // 計算今日客人數
          todayCustomers = todayCompletedOrders.reduce((sum, order) => {
            return sum + (order.tableCapacity || 0)
          }, 0)
        }
        
        // 計算今日統計
        revenueStats.value.todayRevenue = totalRevenue
        revenueStats.value.avgOrderValue = todayCustomers > 0 ? Math.round(totalRevenue / todayCustomers) : 0
        
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
          
          // 計算有訂單的天數
          const monthOrdersResponse = await orderService.getOrdersByMerchant(merchantId, {
            status: 'completed,cancelled',
            limit: 1000,
            sortBy: 'createdAt',
            sortOrder: 'desc'
          })
          
          let daysWithOrders = 0
          if (monthOrdersResponse.status === 'success') {
            // 按桌次分組合併訂單
            const tableOrders = mergeOrdersByTable(monthOrdersResponse.data.orders)
            
            // 計算當月有訂單的天數
            const orderDates = new Set()
            tableOrders.forEach(order => {
              if (order.completedAt) {
                const completedDate = new Date(order.completedAt)
                // 檢查是否在當月範圍內
                if (completedDate >= monthStart && completedDate <= monthEnd) {
                  const dateStr = completedDate.toISOString().split('T')[0]
                  orderDates.add(dateStr)
                }
              }
            })
            daysWithOrders = orderDates.size
          }
          
          // 計算日均營業額（總營業額/有訂單的天數）
          revenueStats.value.dailyAvg = daysWithOrders > 0 ? Math.round(monthStats.totalRevenue / daysWithOrders) : 0
          
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
        
        // 計算尖峰時段（基於最近7天的訂單數據）
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        
        const peakHourResponse = await orderService.getOrdersByMerchant(merchantId, {
          startDate: sevenDaysAgo.toISOString(),
          status: 'completed,cancelled',
          limit: 1000
        })
        
        if (peakHourResponse.status === 'success') {
          // 按小時統計訂單數量
          const hourStats = {}
          
          peakHourResponse.data.orders.forEach(order => {
            if (order.completedAt) {
              // 轉換為台灣時區 (UTC+8)
              const completedDate = new Date(order.completedAt)
              const taiwanHour = (completedDate.getUTCHours() + 8) % 24
              hourStats[taiwanHour] = (hourStats[taiwanHour] || 0) + 1
            }
          })
          
          // 找出訂單最多的時段
          let peakHour = '12:00-13:00' // 預設值
          let maxOrders = 0
          
          Object.entries(hourStats).forEach(([hour, count]) => {
            if (count > maxOrders) {
              maxOrders = count
              const startHour = hour.padStart(2, '0')
              const endHour = ((parseInt(hour) + 1) % 24).toString().padStart(2, '0')
              peakHour = `${startHour}:00-${endHour}:00`
            }
          })
          
          revenueStats.value.peakHour = peakHour
        } else {
          revenueStats.value.peakHour = '12:00-13:00' // 預設值
        }
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
