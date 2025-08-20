import { ref, computed, onMounted, onUnmounted } from 'vue'
import { orderService } from '@/services/api'

export function useOrders(restaurantId = null) {
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

  // 歷史訂單表格欄位 - 簡化顯示
  const historyOrdersColumns = [
    { key: 'tableOrderNumber', label: '訂單號', width: '140px' },
    { key: 'tableNumber', label: '桌號', width: '80px' },
    { key: 'completedAt', label: '結帳時間', width: '150px' },
    { key: 'totalAmount', label: '總金額', width: '120px' },
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
    const batchMap = new Map()
    
    orders.forEach(order => {
      const batchKey = order.batchNumber || order._id
      if (!batchMap.has(batchKey)) {
        batchMap.set(batchKey, {
          _id: order._id, // 使用真正的訂單ID，而不是批次號碼
          batchNumber: order.batchNumber || '單一訂單',
          tableNumber: order.tableNumber,
          createdAt: order.createdAt,
          items: [],
          totalAmount: 0,
          status: order.status,
          itemCount: 0 // 項目數量統計｜Count of items in this batch
        })
      }
      
      const batch = batchMap.get(batchKey)
      // 將訂單項目處理為帶有中文選項標籤的結構｜Process order items into objects with human-readable option labels
      const processedItems = processOrderItems(order.items || [])
      batch.items.push(...processedItems)
      batch.totalAmount += order.totalAmount || 0
      batch.itemCount += processedItems.length // 累加此批次的項目數量｜Accumulate item count for this batch
    })
    
    return Array.from(batchMap.values()).sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    )
  }

  // 輔助函數：獲取桌號
  const getTableNumber = (tableId) => {
    if (!tableId) return '未知桌號'
    
    if (typeof tableId === 'object' && tableId !== null) {
      return tableId.tableNumber || tableId.displayName || '未知桌號'
    }
    
    return String(tableId)
  }

  // 獲取選項的中文標籤
  const getOptionLabel = (optionName) => {
    const optionLabels = {
      'sweetness': '甜度',
      'ice': '冰塊',
      'size': '尺寸',
      'temperature': '溫度',
      'spiceLevel': '辣度',
      'sugar': '糖度',
      'milk': '奶精',
      'toppings': '配料',
      'sauce': '醬料',
      'cooking': '烹調方式'
    }
    return optionLabels[optionName] || optionName
  }

  // 獲取選項值的中文標籤
  const getOptionValueLabel = (optionName, optionValue) => {
    const valueLabels = {
      'sweetness': {
        'no-sugar': '無糖',
        'less-sugar': '微糖',
        'half-sugar': '半糖',
        'normal-sugar': '正常糖',
        'more-sugar': '多糖'
      },
      'ice': {
        'no-ice': '去冰',
        'less-ice': '微冰',
        'normal-ice': '正常冰',
        'more-ice': '多冰'
      },
      'size': {
        'small': '小杯',
        'medium': '中杯',
        'large': '大杯'
      },
      'temperature': {
        'hot': '熱',
        'warm': '溫',
        'cold': '冷'
      },
      'spiceLevel': {
        '0': '不辣',
        '1': '微辣',
        '2': '小辣',
        '3': '中辣',
        '4': '大辣',
        '5': '特辣'
      }
    }
    
    const labels = valueLabels[optionName]
    if (labels && labels[optionValue]) {
      return labels[optionValue]
    }
    
    // 如果沒有預定義的標籤，嘗試智能匹配
    if (typeof optionValue === 'string') {
      if (optionValue.includes('no') || optionValue.includes('0')) return '無'
      if (optionValue.includes('less') || optionValue.includes('1')) return '微'
      if (optionValue.includes('half') || optionValue.includes('2')) return '半'
      if (optionValue.includes('normal') || optionValue.includes('3')) return '正常'
      if (optionValue.includes('more') || optionValue.includes('4')) return '多'
      if (optionValue.includes('5')) return '特'
      if (optionValue.includes('small')) return '小'
      if (optionValue.includes('medium')) return '中'
      if (optionValue.includes('large')) return '大'
      if (optionValue.includes('hot')) return '熱'
      if (optionValue.includes('warm')) return '溫'
      if (optionValue.includes('cold')) return '冷'
    }
    
    return optionValue
  }

  // 處理訂單項目，添加選項標籤
  const processOrderItems = (items) => {
    return items.map(item => ({
      ...item,
      // 處理選項，添加中文標籤
      processedOptions: item.selectedOptions ? 
        Object.entries(item.selectedOptions).map(([key, value]) => {
          // 如果 value 是對象且包含 name 屬性，直接使用
          if (typeof value === 'object' && value !== null && value.name) {
            return {
              key,
              value: value.name,
              label: getOptionLabel(key),
              valueLabel: value.name
            }
          }
          // 否則使用原有的邏輯
          return {
            key,
            value,
            label: getOptionLabel(key),
            valueLabel: getOptionValueLabel(key, value)
          }
        }) : []
    }))
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
      
      // 處理訂單項目的選項
      const processedOrder = {
        ...order,
        items: processOrderItems(order.items)
      }
      
      grouped[tableKey].batches.push(processedOrder)
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
    
    // 只計算今日結帳的訂單（包括即時訂單中已結帳的和歷史訂單）
    const todayCompletedOrders = historyOrders.value.filter(order => {
      if (!order.completedAt) return false
      const completedDate = new Date(order.completedAt)
      completedDate.setHours(0, 0, 0, 0)
      return completedDate.getTime() === today.getTime()
    })
    
    return todayCompletedOrders.length
  })

  const historyStats = computed(() => {
    // 歷史訂單都是已完成的桌次訂單
    const completedOrders = historyOrders.value
    const totalRevenue = completedOrders.reduce((sum, order) => sum + order.totalAmount, 0)
    
    // 計算總客人數（與儀表板計算方式一致）
    const totalCustomers = completedOrders.reduce((sum, order) => {
      return sum + (order.tableCapacity || 0)
    }, 0)
    
    // 客單價 = 總營業額 / 總客人數（與儀表板計算方式一致）
    const averageOrderValue = totalCustomers > 0 
      ? Math.round(totalRevenue / totalCustomers) 
      : 0

    // 計算高峰時段
    const hourStats = {}
    completedOrders.forEach(order => {
      if (order.completedAt) {
        const completedHour = new Date(order.completedAt).getHours()
        hourStats[completedHour] = (hourStats[completedHour] || 0) + 1
      }
    })
    
    // 找出訂單最多的時段
    let peakHour = ''
    let maxOrders = 0
    
    Object.entries(hourStats).forEach(([hour, count]) => {
      if (count > maxOrders) {
        maxOrders = count
        const startHour = hour.padStart(2, '0')
        const endHour = ((parseInt(hour) + 1) % 24).toString().padStart(2, '0')
        peakHour = `${startHour}:00-${endHour}:00`
      }
    })

    return {
      totalOrders: completedOrders.length,
      totalRevenue,
      averageOrderValue,
      peakHour
    }
  })

  const filteredHistoryOrders = computed(() => {
    let filtered = historyOrders.value
    console.log('filteredHistoryOrders 計算 - 原始數據:', filtered)

    // 搜尋過濾 - 修改為使用合併後的桌次訂單屬性
    if (searchTerm.value) {
      const term = searchTerm.value.toLowerCase()
      filtered = filtered.filter(order => 
        order.tableOrderNumber.toLowerCase().includes(term) ||
        order.tableNumber.toLowerCase().includes(term)
      )
      console.log('搜尋過濾後:', filtered)
    }

    // 時間範圍過濾 - 使用 completedAt 進行過濾
    const now = new Date()
    if (selectedTimeRange.value === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      filtered = filtered.filter(order => {
        try {
          const orderTime = new Date(order.completedAt)
          return orderTime >= today
        } catch (error) {
          console.warn('時間過濾失敗:', order, error)
          return false
        }
      })
      console.log('今日過濾後:', filtered)
    } else if (selectedTimeRange.value === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      filtered = filtered.filter(order => {
        try {
          const orderTime = new Date(order.completedAt)
          return orderTime >= weekAgo
        } catch (error) {
          console.warn('時間過濾失敗:', order, error)
          return false
        }
      })
      console.log('本週過濾後:', filtered)
    } else if (selectedTimeRange.value === 'month') {
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
      filtered = filtered.filter(order => {
        try {
          const orderTime = new Date(order.completedAt)
          return orderTime >= monthAgo
        } catch (error) {
          console.warn('時間過濾失敗:', order, error)
          return false
        }
      })
      console.log('本月過濾後:', filtered)
    }

    const sorted = filtered.sort((a, b) => {
      try {
        const timeA = new Date(a.completedAt)
        const timeB = new Date(b.completedAt)
        return timeB - timeA
      } catch (error) {
        console.warn('排序失敗:', a, b, error)
          return 0
        }
      })
    console.log('最終過濾結果:', sorted)
    return sorted
  })

  // 獲取商家ID - 從localStorage中的用戶信息獲取
  const getMerchantId = () => {
    try {
      // 優先使用傳入的restaurantId參數（超級管理員查看特定商家時使用）
      if (restaurantId) {
        console.log(`使用傳入的餐廳ID: ${restaurantId}`)
        return restaurantId
      }
      
      // 其次嘗試從localStorage獲取用戶信息（新鍵優先）
      const merchantUserRaw = localStorage.getItem('merchant_user')
      if (merchantUserRaw) {
        const mu = JSON.parse(merchantUserRaw)
        return (
          mu.merchantId ||
          (typeof mu.merchant === 'string' ? mu.merchant : null) ||
          mu._id ||
          mu.id
        )
      }

      // 回退舊鍵：統一的 user（可能是 admin/merchant/employee）
      const storedUser = localStorage.getItem('user')
      if (storedUser) {
        const userData = JSON.parse(storedUser)
        if (userData.role === 'admin' || userData.role === 'superadmin') {
          console.warn('超級管理員查看商家後台需要指定餐廳ID')
          return null
        }
        return (
          userData.merchantId ||
          (typeof userData.merchant === 'string' ? userData.merchant : null) ||
          userData._id ||
          userData.id
        )
      }

      // 再回退舊鍵：merchant
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
        status: 'pending,confirmed,preparing,ready,delivered,served',
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

  // 載入歷史訂單數據 - 修改為按桌次合併顯示
  const loadHistoryOrders = async () => {
    try {
      const merchantId = getMerchantId()
      if (!merchantId) {
        console.error('無法載入歷史訂單：商家ID不存在，請重新登入')
        return
      }
      
      const response = await orderService.getOrdersByMerchant(merchantId, {
        status: 'completed,cancelled',
        limit: 200, // 增加限制以獲取更多數據進行合併
        sortBy: 'createdAt',
        sortOrder: 'desc'
      })
      
      if (response.status === 'success') {
        // 按桌次分組合併訂單
        const tableOrders = mergeOrdersByTable(response.data.orders)
        
        // 處理合併後的桌次訂單數據
        const processedOrders = tableOrders.map(tableOrder => {
          return {
            ...tableOrder,
            firstOrderTime: new Date(tableOrder.firstOrderTime),
            lastOrderTime: new Date(tableOrder.lastOrderTime),
            tableNumber: tableOrder.tableNumber
          }
        })
        
        historyOrders.value = processedOrders
        console.log('歷史訂單載入成功:', processedOrders.length, '筆桌次訂單')
        console.log('歷史訂單數據:', processedOrders)
      }
    } catch (error) {
      console.error('載入歷史訂單失敗:', error)
    }
  }

  // 按桌次和客人組別合併訂單的方法
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
    })
    
    // 轉換為數組並生成桌次訂單號
    return Object.values(tableGroups).map(group => {
      // 將批次號 Set 轉換為排序後的數組，並顯示為 "1,2,3批次" 格式
      const sortedBatchNumbers = Array.from(group.batchNumbers).sort((a, b) => parseInt(a) - parseInt(b))
      const batchDisplay = sortedBatchNumbers.join(',') + '批次'
      
      // 使用後端提供的 displayOrderNumber 字段，如果沒有則使用自定義格式
      let tableOrderNumber
      if (group.orders[0] && group.orders[0].displayOrderNumber) {
        // 使用後端的簡化格式，例如：T1-001
        tableOrderNumber = group.orders[0].displayOrderNumber
      } else {
        // 備用格式：T1-1組-1,2批次
        tableOrderNumber = `T${group.tableNumber}-${group.customerGroup}組-${batchDisplay}`
      }
      
      return {
        ...group,
        tableOrderNumber: tableOrderNumber,
        completedAt: group.lastOrderTime, // 使用最後訂單時間作為結帳時間
        tableCapacity: group.tableCapacity, // 添加桌次容量信息
        _id: `table_${group.tableId}_${group.customerGroup}_${group.lastOrderTime}` // 創建唯一ID
      }
    })
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
    if (order.tableOrderNumber) {
      // 桌次訂單
      console.log(`列印桌次訂單 ${order.tableOrderNumber} 的收據`)
      alert(`正在列印桌次訂單 ${order.tableOrderNumber} 的收據...\n桌號：${order.tableNumber}\n批次數：${order.batchCount}\n總金額：NT$ ${order.totalAmount}`)
    } else {
      // 單個批次訂單
      console.log(`列印訂單 ${order.orderNumber} 的收據`)
      alert(`正在列印訂單 ${order.orderNumber} 的收據...`)
    }
    // 這裡可以實現真實的列印邏輯
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

  // 匯出歷史訂單
  const exportHistoryOrders = async (format = 'xlsx') => {
    try {
      const merchantId = getMerchantId()
      if (!merchantId) {
        console.error('無法獲取商家ID')
        return
      }

      // 準備匯出參數
      const params = {
        format,
        searchTerm: searchTerm.value
      }

      // 根據選擇的時間範圍設定日期
      const now = new Date()
      if (selectedTimeRange.value === 'today') {
        // 使用本地時區的今天日期
        const today = new Date()
        const year = today.getFullYear()
        const month = String(today.getMonth() + 1).padStart(2, '0')
        const day = String(today.getDate()).padStart(2, '0')
        params.startDate = `${year}-${month}-${day}`
      } else if (selectedTimeRange.value === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const year = weekAgo.getFullYear()
        const month = String(weekAgo.getMonth() + 1).padStart(2, '0')
        const day = String(weekAgo.getDate()).padStart(2, '0')
        params.startDate = `${year}-${month}-${day}`
        
        const today = new Date()
        const todayYear = today.getFullYear()
        const todayMonth = String(today.getMonth() + 1).padStart(2, '0')
        const todayDay = String(today.getDate()).padStart(2, '0')
        params.endDate = `${todayYear}-${todayMonth}-${todayDay}`
      } else if (selectedTimeRange.value === 'month') {
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
        const year = monthAgo.getFullYear()
        const month = String(monthAgo.getMonth() + 1).padStart(2, '0')
        const day = String(monthAgo.getDate()).padStart(2, '0')
        params.startDate = `${year}-${month}-${day}`
        
        const today = new Date()
        const todayYear = today.getFullYear()
        const todayMonth = String(today.getMonth() + 1).padStart(2, '0')
        const todayDay = String(today.getDate()).padStart(2, '0')
        params.endDate = `${todayYear}-${todayMonth}-${todayDay}`
      }

      console.log('匯出參數:', params)

      // 呼叫匯出 API
      const response = await orderService.exportHistoryOrders(merchantId, params)
      
      // 處理檔案下載
      const blob = new Blob([response], { 
        type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `歷史訂單_${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      console.log('匯出成功')
    } catch (error) {
      console.error('匯出失敗:', error)
      
      // 檢查是否是 JSON 錯誤響應
      if (error.response && error.response.data instanceof Blob) {
        try {
          const errorText = await error.response.data.text()
          const errorData = JSON.parse(errorText)
          console.error('後端錯誤:', errorData)
          // 可以在這裡添加錯誤提示，例如使用 toast 或 alert
          alert(`匯出失敗: ${errorData.message || '未知錯誤'}`)
        } catch (parseError) {
          console.error('無法解析錯誤響應:', parseError)
          alert('匯出失敗: 無法解析錯誤信息')
        }
      } else {
        alert(`匯出失敗: ${error.message || '未知錯誤'}`)
      }
    }
  }

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
    exportHistoryOrders,
    formatTime,
    formatDateTime,
    getStatVariant,
    getOrderStatusVariant,
    getOrderStatusText,
    getOptionLabel,
    getOptionValueLabel
  }
}
