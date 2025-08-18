import { ref, computed, onMounted, onUnmounted } from 'vue'
import { orderService } from '@/services/api'

export function useOrders() {
  // 響應式數據
  const activeTab = ref('live')
  const selectedTimeRange = ref('today')
  const searchTerm = ref('')
  const loading = ref(false)
  const showOrderDetails = ref(false)
  const selectedOrder = ref(null)

  // 當前日期
  const currentDate = computed(() => {
    return new Date().toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    })
  })

  // 即時訂單數據 - 從API獲取
  const liveOrders = ref([])
  
  // 歷史訂單數據 - 從API獲取
  const historyOrders = ref([])

  // 標籤頁配置
  const orderTabs = [
    { name: 'live', label: '即時監控' },
    { name: 'history', label: '歷史訂單' }
  ]

  // 歷史訂單表格欄位
  const historyOrdersColumns = [
    { key: 'orderNumber', label: '訂單號', width: '120px' },
    { key: 'tableNumber', label: '桌號', width: '80px' },
    { key: 'createdAt', label: '下單時間', width: '150px' },
    { key: 'status', label: '狀態', width: '100px' },
    { key: 'totalAmount', label: '金額', width: '100px' },
    { key: 'actions', label: '操作', width: '120px' }
  ]

  // 計算屬性 - 支持批次分組
  const preparingOrders = computed(() => {
    const orders = liveOrders.value.filter(order => 
      ['pending', 'confirmed', 'preparing'].includes(order.status)
    )
    return groupOrdersByBatch(orders)
  })

  const readyOrders = computed(() => {
    const orders = liveOrders.value.filter(order => order.status === 'ready')
    return groupOrdersByBatch(orders)
  })

  const deliveredOrders = computed(() => {
    const orders = liveOrders.value.filter(order => 
      ['served', 'delivered'].includes(order.status)
    )
    return groupOrdersByBatch(orders)
  })

  // 將訂單按批次分組，每個批次一張卡片，按時間順序排列
  const groupOrdersByBatch = (orders) => {
    const batchCards = []
    
    orders.forEach(order => {
      // 每個訂單就是一個批次卡片
      const tableNumber = getTableNumber(order.tableId)
      
      const batchCard = {
        _id: order._id,
        tableId: order.tableId?._id || order.tableId,
        tableNumber: tableNumber,
        batchNumber: order.batchNumber || 1,
        status: order.status,
        totalAmount: order.totalAmount,
        itemCount: order.items.length,
        createdAt: order.createdAt,
        items: order.items,
        orderNumber: order.orderNumber
      }
      
      batchCards.push(batchCard)
    })
    
    // 按時間順序排列，最新的在最上面
    return batchCards.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }

  // 輔助函數：獲取桌號
  const getTableNumber = (tableId) => {
    if (!tableId) return '未知桌號'
    
    if (typeof tableId === 'object' && tableId !== null) {
      return tableId.tableNumber || tableId.displayName || '未知桌號'
    }
    
    return String(tableId)
  }

  // 將同桌訂單按批次分組 (保留原有函數以備用)
  const groupOrdersByTable = (orders) => {
    const grouped = {}
    
    orders.forEach(order => {
      const tableKey = order.tableId?._id || order.tableId
      if (!grouped[tableKey]) {
        // 直接在這裡處理桌號邏輯，不依賴預先設置的 tableNumber
        let tableNumber = '未知桌號'
        if (order.tableId) {
          if (typeof order.tableId === 'object' && order.tableId !== null) {
            // 如果是對象，優先使用 tableNumber，其次是 displayName
            tableNumber = order.tableId.tableNumber || order.tableId.displayName || '未知桌號'
          } else {
            // 如果是字符串或其他類型，直接使用
            tableNumber = String(order.tableId)
          }
        }
        
        grouped[tableKey] = {
          tableId: tableKey,
          tableNumber: tableNumber,
          batches: [],
          totalAmount: 0,
          itemCount: 0,
          earliestTime: order.createdAt,
          latestTime: order.createdAt
        }
      }
      
      grouped[tableKey].batches.push(order)
      grouped[tableKey].totalAmount += order.totalAmount
      grouped[tableKey].itemCount += order.items.length
      
      // 更新時間範圍
      if (order.createdAt < grouped[tableKey].earliestTime) {
        grouped[tableKey].earliestTime = order.createdAt
      }
      if (order.createdAt > grouped[tableKey].latestTime) {
        grouped[tableKey].latestTime = order.createdAt
      }
    })
    
    return Object.values(grouped).sort((a, b) => a.earliestTime - b.earliestTime)
  }

  const liveStats = computed(() => ({
    preparing: preparingOrders.value.length,
    ready: readyOrders.value.length,
    delivered: deliveredOrders.value.length
  }))

  const todayOrdersCount = computed(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return [...liveOrders.value, ...historyOrders.value].filter(order => {
      const orderDate = new Date(order.createdAt)
      orderDate.setHours(0, 0, 0, 0)
      return orderDate.getTime() === today.getTime()
    }).length
  })

  const historyStats = computed(() => {
    const completedOrders = historyOrders.value.filter(order => order.status === 'completed')
    const totalRevenue = completedOrders.reduce((sum, order) => sum + order.totalAmount, 0)
    const averageOrderValue = completedOrders.length > 0 
      ? Math.round(totalRevenue / completedOrders.length) 
      : 0

    return {
      totalOrders: completedOrders.length,
      totalRevenue,
      averageOrderValue,
      peakHour: '12:00-13:00'
    }
  })

  const filteredHistoryOrders = computed(() => {
    let filtered = historyOrders.value

    // 搜尋過濾
    if (searchTerm.value) {
      const term = searchTerm.value.toLowerCase()
      filtered = filtered.filter(order => 
        order.orderNumber.toLowerCase().includes(term) ||
        order.tableNumber.toLowerCase().includes(term)
      )
    }

    // 時間範圍過濾
    const now = new Date()
    if (selectedTimeRange.value === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      filtered = filtered.filter(order => new Date(order.createdAt) >= today)
    } else if (selectedTimeRange.value === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      filtered = filtered.filter(order => new Date(order.createdAt) >= weekAgo)
    } else if (selectedTimeRange.value === 'month') {
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
      filtered = filtered.filter(order => new Date(order.createdAt) >= monthAgo)
    }

    return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  })

  // 獲取商家ID - 從localStorage中的用戶信息獲取
  const getMerchantId = () => {
    try {
      // 首先嘗試從localStorage獲取用戶信息
      const storedUser = localStorage.getItem('user')
      if (storedUser) {
        const userData = JSON.parse(storedUser)
        return userData._id || userData.id
      }
      
      // 如果沒有用戶信息，嘗試從merchant存儲獲取
      const storedMerchant = localStorage.getItem('merchant')
      if (storedMerchant) {
        const merchantData = JSON.parse(storedMerchant)
        return merchantData._id || merchantData.id
      }
      
      console.warn('無法獲取商家ID，用戶可能未登入')
      return null
    } catch (error) {
      console.error('獲取商家ID失敗:', error)
      return null
    }
  }

  // 載入即時訂單數據
  const loadLiveOrders = async () => {
    try {
      const merchantId = getMerchantId()
      if (!merchantId) {
        console.error('無法載入訂單：商家ID不存在，請重新登入')
        return
      }
      
      const response = await orderService.getOrdersByMerchant(merchantId, {
        status: 'pending,confirmed,preparing,ready,delivered',
        limit: 50,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      })
      
      if (response.status === 'success') {
        // 處理訂單數據，確保日期格式正確
        const orders = response.data.orders.map(order => {
          // 處理桌號顯示邏輯
          let tableNumber = '未知桌號'
          if (order.tableId) {
            if (typeof order.tableId === 'object' && order.tableId !== null) {
              // 如果是對象，優先使用 tableNumber，其次是 displayName
              tableNumber = order.tableId.tableNumber || order.tableId.displayName || '未知桌號'
            } else {
              // 如果是字符串或其他類型，直接使用
              tableNumber = String(order.tableId)
            }
          }
          
          return {
            ...order,
            createdAt: new Date(order.createdAt),
            readyAt: order.readyAt ? new Date(order.readyAt) : null,
            deliveredAt: order.deliveredAt ? new Date(order.deliveredAt) : null,
            completedAt: order.completedAt ? new Date(order.completedAt) : null,
            tableNumber: tableNumber
          }
        })
        
        liveOrders.value = orders
        console.log('即時訂單載入成功:', orders.length, '筆訂單')
      }
    } catch (error) {
      console.error('載入即時訂單失敗:', error)
      // 可以選擇顯示錯誤訊息給用戶
    }
  }

  // 載入歷史訂單數據
  const loadHistoryOrders = async () => {
    try {
      const merchantId = getMerchantId()
      if (!merchantId) {
        console.error('無法載入歷史訂單：商家ID不存在，請重新登入')
        return
      }
      
      const response = await orderService.getOrdersByMerchant(merchantId, {
        status: 'completed,cancelled',
        limit: 100,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      })
      
      if (response.status === 'success') {
        // 處理訂單數據，確保日期格式正確
        const orders = response.data.orders.map(order => {
          // 處理桌號顯示邏輯
          let tableNumber = '未知桌號'
          if (order.tableId) {
            if (typeof order.tableId === 'object' && order.tableId !== null) {
              // 如果是對象，優先使用 tableNumber，其次是 displayName
              tableNumber = order.tableId.tableNumber || order.tableId.displayName || '未知桌號'
            } else {
              // 如果是字符串或其他類型，直接使用
              tableNumber = String(order.tableId)
            }
          }
          
          return {
            ...order,
            createdAt: new Date(order.createdAt),
            completedAt: order.completedAt ? new Date(order.completedAt) : null,
            cancelledAt: order.cancelledAt ? new Date(order.cancelledAt) : null,
            tableNumber: tableNumber
          }
        })
        
        historyOrders.value = orders
        console.log('歷史訂單載入成功:', orders.length, '筆訂單')
      }
    } catch (error) {
      console.error('載入歷史訂單失敗:', error)
    }
  }

  // 方法
  const refreshOrders = async () => {
    loading.value = true
    try {
      // 並行載入即時訂單和歷史訂單
      await Promise.all([
        loadLiveOrders(),
        loadHistoryOrders()
      ])
      console.log('訂單已刷新')
    } catch (error) {
      console.error('刷新訂單失敗:', error)
    } finally {
      loading.value = false
    }
  }

  // 確認訂單
  const confirmOrder = async (orderId) => {
    try {
      const response = await orderService.updateOrderStatus(orderId, {
        status: 'confirmed'
      })
      
      if (response.status === 'success') {
        // 更新本地數據
        const order = liveOrders.value.find(o => o._id === orderId)
        if (order) {
          order.status = 'confirmed'
          // 觸發響應式更新
          liveOrders.value = [...liveOrders.value]
        }
        console.log(`訂單已確認`)
      }
    } catch (error) {
      console.error('確認訂單失敗:', error)
      alert('確認訂單失敗，請重試')
    }
  }

  // 開始製作
  const startPreparing = async (orderId) => {
    try {
      const response = await orderService.updateOrderStatus(orderId, {
        status: 'preparing'
      })
      
      if (response.status === 'success') {
        // 更新本地數據
        const order = liveOrders.value.find(o => o._id === orderId)
        if (order) {
          order.status = 'preparing'
          // 觸發響應式更新
          liveOrders.value = [...liveOrders.value]
        }
        console.log(`訂單已開始製作`)
      }
    } catch (error) {
      console.error('開始製作失敗:', error)
      alert('開始製作失敗，請重試')
    }
  }

  // 製作完成，標記為準備好
  const markAsReady = async (orderId) => {
    try {
      const response = await orderService.updateOrderStatus(orderId, {
        status: 'ready'
      })
      
      if (response.status === 'success') {
        // 更新本地數據
        const order = liveOrders.value.find(o => o._id === orderId)
        if (order) {
          order.status = 'ready'
          order.readyAt = new Date()
          // 觸發響應式更新
          liveOrders.value = [...liveOrders.value]
        }
        console.log(`訂單已標記為準備好`)
      }
    } catch (error) {
      console.error('更新訂單狀態失敗:', error)
      alert('更新訂單狀態失敗，請重試')
    }
  }

  const markAsDelivered = async (orderId) => {
    try {
      const response = await orderService.updateOrderStatus(orderId, {
        status: 'delivered'
      })
      
      if (response.status === 'success') {
        // 更新本地數據
        const order = liveOrders.value.find(o => o._id === orderId)
        if (order) {
          order.status = 'delivered'
          order.deliveredAt = new Date()
          // 觸發響應式更新
          liveOrders.value = [...liveOrders.value]
        }
        console.log(`訂單已標記為已送出`)
      }
    } catch (error) {
      console.error('更新訂單狀態失敗:', error)
      alert('更新訂單狀態失敗，請重試')
    }
  }

  const viewOrderDetails = (order) => {
    selectedOrder.value = order
    showOrderDetails.value = true
  }

  const printReceipt = (order) => {
    console.log(`列印訂單 ${order.orderNumber} 的收據`)
    // 這裡可以實現真實的列印邏輯
    alert(`正在列印訂單 ${order.orderNumber} 的收據...`)
  }

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('zh-TW', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDateTime = (date) => {
    return new Date(date).toLocaleString('zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatVariant = () => {
    switch (selectedTimeRange.value) {
      case 'today': return 'primary'
      case 'week': return 'success'
      case 'month': return 'warning'
      default: return 'info'
    }
  }

  const getOrderStatusVariant = (status) => {
    switch (status) {
      case 'pending': return 'warning'
      case 'confirmed': return 'primary'
      case 'preparing': return 'warning'
      case 'ready': return 'success'
      case 'served': 
      case 'delivered': return 'info'
      case 'completed': return 'success'
      case 'cancelled': return 'danger'
      default: return 'info'
    }
  }

  const getOrderStatusText = (status) => {
    switch (status) {
      case 'pending': return '待確認'
      case 'confirmed': return '已確認'
      case 'preparing': return '準備中'
      case 'ready': return '準備好'
      case 'served': return '已送達'
      case 'delivered': return '已送出'
      case 'completed': return '已完成'
      case 'cancelled': return '已取消'
      default: return '未知'
    }
  }

  // 自動刷新定時器
  let refreshInterval = null

  // 啟動自動刷新
  const startAutoRefresh = () => {
    // 每30秒自動刷新一次即時訂單
    refreshInterval = setInterval(() => {
      if (activeTab.value === 'live') {
        loadLiveOrders()
      }
    }, 30000) // 30秒
  }

  // 停止自動刷新
  const stopAutoRefresh = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval)
      refreshInterval = null
    }
  }

  // 生命週期
  onMounted(() => {
    refreshOrders()
    startAutoRefresh()
  })

  // 組件卸載時清理定時器
  onUnmounted(() => {
    stopAutoRefresh()
  })

  return {
    // 響應式數據
    activeTab,
    selectedTimeRange,
    searchTerm,
    loading,
    currentDate,
    todayOrdersCount,
    
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
    formatTime,
    formatDateTime,
    getStatVariant,
    getOrderStatusVariant,
    getOrderStatusText
  }
}
