import { ref, computed, onMounted } from 'vue'

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

  // 模擬的即時訂單數據
  const liveOrders = ref([
    {
      id: 1,
      orderNumber: 'ORD001',
      tableNumber: 'A3',
      status: 'preparing',
      createdAt: new Date(Date.now() - 15 * 60 * 1000), // 15分鐘前
      items: [
        { id: 1, name: '招牌牛肉麵', quantity: 2, price: 280 },
        { id: 2, name: '小籠包', quantity: 1, price: 180 }
      ],
      totalAmount: 740
    },
    {
      id: 2,
      orderNumber: 'ORD002',
      tableNumber: 'B5',
      status: 'preparing',
      createdAt: new Date(Date.now() - 8 * 60 * 1000), // 8分鐘前
      items: [
        { id: 3, name: '宮保雞丁', quantity: 1, price: 220 },
        { id: 4, name: '白飯', quantity: 2, price: 30 }
      ],
      totalAmount: 280
    },
    {
      id: 3,
      orderNumber: 'ORD003',
      tableNumber: 'C2',
      status: 'ready',
      createdAt: new Date(Date.now() - 25 * 60 * 1000), // 25分鐘前
      readyAt: new Date(Date.now() - 5 * 60 * 1000), // 5分鐘前準備好
      items: [
        { id: 5, name: '糖醋排骨', quantity: 1, price: 320 },
        { id: 6, name: '酸辣湯', quantity: 1, price: 80 }
      ],
      totalAmount: 400
    },
    {
      id: 4,
      orderNumber: 'ORD004',
      tableNumber: 'A1',
      status: 'ready',
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
      readyAt: new Date(Date.now() - 2 * 60 * 1000),
      items: [
        { id: 7, name: '紅燒豆腐', quantity: 1, price: 160 }
      ],
      totalAmount: 160
    },
    {
      id: 5,
      orderNumber: 'ORD005',
      tableNumber: 'B3',
      status: 'delivered',
      createdAt: new Date(Date.now() - 45 * 60 * 1000),
      deliveredAt: new Date(Date.now() - 10 * 60 * 1000),
      items: [
        { id: 8, name: '麻婆豆腐', quantity: 1, price: 180 },
        { id: 9, name: '蛋花湯', quantity: 1, price: 60 }
      ],
      totalAmount: 240
    }
  ])

  // 歷史訂單數據
  const historyOrders = ref([
    {
      id: 1,
      orderNumber: 'ORD001',
      tableNumber: 'A3',
      status: 'completed',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 90 * 60 * 1000),
      items: [
        { id: 1, name: '招牌牛肉麵', quantity: 2, price: 280 },
        { id: 2, name: '小籠包', quantity: 1, price: 180 }
      ],
      subtotal: 740,
      serviceCharge: 74,
      totalAmount: 814
    },
    {
      id: 2,
      orderNumber: 'ORD002',
      tableNumber: 'B5',
      status: 'completed',
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 2.5 * 60 * 60 * 1000),
      items: [
        { id: 3, name: '宮保雞丁', quantity: 1, price: 220 },
        { id: 4, name: '白飯', quantity: 2, price: 30 }
      ],
      subtotal: 280,
      serviceCharge: 28,
      totalAmount: 308
    },
    {
      id: 3,
      orderNumber: 'ORD003',
      tableNumber: 'C2',
      status: 'completed',
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 3.5 * 60 * 60 * 1000),
      items: [
        { id: 5, name: '糖醋排骨', quantity: 1, price: 320 },
        { id: 6, name: '酸辣湯', quantity: 1, price: 80 }
      ],
      subtotal: 400,
      serviceCharge: 40,
      totalAmount: 440
    },
    {
      id: 4,
      orderNumber: 'ORD004',
      tableNumber: 'A1',
      status: 'cancelled',
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      cancelledAt: new Date(Date.now() - 4.5 * 60 * 60 * 1000),
      items: [
        { id: 7, name: '紅燒豆腐', quantity: 1, price: 160 }
      ],
      subtotal: 160,
      serviceCharge: 0,
      totalAmount: 160
    }
  ])

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

  // 計算屬性
  const preparingOrders = computed(() => 
    liveOrders.value.filter(order => order.status === 'preparing')
  )

  const readyOrders = computed(() => 
    liveOrders.value.filter(order => order.status === 'ready')
  )

  const deliveredOrders = computed(() => 
    liveOrders.value.filter(order => order.status === 'delivered')
  )

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

  // 方法
  const refreshOrders = async () => {
    loading.value = true
    try {
      // 模擬 API 調用
      await new Promise(resolve => setTimeout(resolve, 1000))
      console.log('訂單已刷新')
    } catch (error) {
      console.error('刷新訂單失敗:', error)
    } finally {
      loading.value = false
    }
  }

  const markAsReady = (orderId) => {
    const order = liveOrders.value.find(o => o.id === orderId)
    if (order) {
      order.status = 'ready'
      order.readyAt = new Date()
      console.log(`訂單 ${order.orderNumber} 已標記為準備完成`)
    }
  }

  const markAsDelivered = (orderId) => {
    const order = liveOrders.value.find(o => o.id === orderId)
    if (order) {
      order.status = 'delivered'
      order.deliveredAt = new Date()
      console.log(`訂單 ${order.orderNumber} 已標記為已送出`)
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
      case 'preparing': return 'warning'
      case 'ready': return 'success'
      case 'delivered': return 'info'
      case 'completed': return 'success'
      case 'cancelled': return 'danger'
      default: return 'info'
    }
  }

  const getOrderStatusText = (status) => {
    switch (status) {
      case 'preparing': return '準備中'
      case 'ready': return '準備好'
      case 'delivered': return '已送出'
      case 'completed': return '已完成'
      case 'cancelled': return '已取消'
      default: return '未知'
    }
  }

  // 生命週期
  onMounted(() => {
    refreshOrders()
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
