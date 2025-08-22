import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { orderService, receiptAPI } from '@/services/api'
import { generateReceiptFromStoredData } from '@/utils/receiptUtils'

export function useOrders(restaurantId = null) {
  // 響應式數據
  const activeTab = ref('live')
  const selectedDate = ref(new Date()) // 選中的日期
  const searchTerm = ref('')
  const loading = ref(false)
  const showOrderDetails = ref(false)
  const selectedOrder = ref(null)
  const dateViewMode = ref('day') // 日期視圖模式：'day', 'month', 'year'
  const isAutoRefreshing = ref(false) // 自動更新狀態

  // 收據預覽相關
  const showReceiptPreview = ref(false)
  const receiptData = ref(null)
  const receiptComponent = ref(null)

  // 當前日期
  const currentDate = computed(() => {
    return selectedDate.value.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    })
  })

  // 日期標題
  const dateTitle = computed(() => {
    const date = selectedDate.value
    
    switch (dateViewMode.value) {
      case 'year':
        return `${date.getFullYear()}年`
      case 'month':
        return `${date.getFullYear()}年${date.getMonth() + 1}月`
      case 'day':
      default:
        return date.toLocaleDateString('zh-TW', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
    }
  })

  // 即時訂單數據 - 從API獲取
  const liveOrders = ref([])
  
  // 歷史訂單數據 - 從API獲取
  const historyOrders = ref([])

  // 監聽選中日期和視圖模式變化，重新載入歷史訂單
  watch([selectedDate, dateViewMode], () => {
    if (activeTab.value === 'history') {
      loadHistoryOrders()
    }
  })

  // 日期導航功能
  const previousDate = () => {
    const newDate = new Date(selectedDate.value)
    
    switch (dateViewMode.value) {
      case 'year':
        newDate.setFullYear(newDate.getFullYear() - 1)
        break
      case 'month':
        newDate.setMonth(newDate.getMonth() - 1)
        break
      case 'day':
      default:
        newDate.setDate(newDate.getDate() - 1)
        break
    }
    
    selectedDate.value = newDate
  }

  const nextDate = () => {
    const newDate = new Date(selectedDate.value)
    
    switch (dateViewMode.value) {
      case 'year':
        newDate.setFullYear(newDate.getFullYear() + 1)
        break
      case 'month':
        newDate.setMonth(newDate.getMonth() + 1)
        break
      case 'day':
      default:
        newDate.setDate(newDate.getDate() + 1)
        break
    }
    
    selectedDate.value = newDate
  }

  // 更新日期視圖模式
  const updateDateViewMode = (mode) => {
    dateViewMode.value = mode
  }

  // 標籤頁配置
  const orderTabs = [
    { name: 'live', label: '即時監控' },
    { name: 'history', label: '歷史訂單' }
  ]

  // 歷史訂單表格欄位 - 簡化顯示
  const historyOrdersColumns = [
    { key: 'receiptOrderNumber', label: '收據號', width: '120px' },
    { key: 'tableOrderNumber', label: '訂單號', width: '140px' },
    { key: 'tableNumber', label: '桌號', width: '80px' },
    { key: 'completedAt', label: '結帳時間', width: '150px' },
    { key: 'totalAmount', label: '總金額', width: '120px' },
    { key: 'actions', label: '操作', width: '120px' }
  ]

  // 輔助函數：根據日期視圖模式獲取時間範圍
  const getDateRange = () => {
    const selectedDay = new Date(selectedDate.value)
    let startTime, endTime
    
    switch (dateViewMode.value) {
      case 'year':
        const startOfYear = new Date(selectedDay.getFullYear(), 0, 1)
        const endOfYear = new Date(selectedDay.getFullYear(), 11, 31, 23, 59, 59, 999)
        startTime = startOfYear.toISOString()
        endTime = endOfYear.toISOString()
        break
      case 'month':
        const startOfMonth = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), 1)
        const endOfMonth = new Date(selectedDay.getFullYear(), selectedDay.getMonth() + 1, 0, 23, 59, 59, 999)
        startTime = startOfMonth.toISOString()
        endTime = endOfMonth.toISOString()
        break
      case 'day':
      default:
        const startOfDay = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate())
        const endOfDay = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), 23, 59, 59, 999)
        startTime = startOfDay.toISOString()
        endTime = endOfDay.toISOString()
        break
    }
    
    return { startTime, endTime }
  }

  // 輔助函數：過濾指定日期範圍內的訂單
  const filterOrdersByDateRange = (statusFilter) => {
    const { startTime, endTime } = getDateRange()
    return liveOrders.value.filter(order => {
      const orderDate = new Date(order.createdAt)
      return orderDate >= new Date(startTime) && orderDate <= new Date(endTime) && statusFilter(order)
    })
  }

  // 計算屬性 - 支持批次分組
  const preparingOrders = computed(() => {
    const orders = filterOrdersByDateRange(order => 
      ['pending', 'confirmed', 'preparing'].includes(order.status)
    )
    return groupOrdersByBatch(orders)
  })

  const readyOrders = computed(() => {
    const orders = filterOrdersByDateRange(order => order.status === 'ready')
    return groupOrdersByBatch(orders)
  })

  const deliveredOrders = computed(() => {
    const orders = filterOrdersByDateRange(order => 
      ['served', 'delivered', 'completed'].includes(order.status)
    )
    
    // 分離已結帳和未結帳的訂單
    const completedOrders = orders.filter(order => order.status === 'completed')
    const nonCompletedOrders = orders.filter(order => order.status !== 'completed')
    
    // 已結帳訂單按收據號分組並合併相同菜品
    const completedGroups = groupCompletedOrdersByReceipt(completedOrders)
    
    // 未結帳訂單按批次分組
    const nonCompletedGroups = groupOrdersByBatch(nonCompletedOrders)
    
    // 合併兩組結果
    return [...completedGroups, ...nonCompletedGroups].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    )
  })

  // 將已結帳訂單按收據號分組，並合併相同菜品
  const groupCompletedOrdersByReceipt = (orders) => {
    const receiptMap = new Map()
    
    orders.forEach(order => {
      const receiptKey = order.receiptOrderNumber || `no-receipt-${order._id}`
      
      if (!receiptMap.has(receiptKey)) {
        receiptMap.set(receiptKey, {
          _id: receiptKey,
          receiptOrderNumber: order.receiptOrderNumber,
          tableNumber: order.tableNumber,
          createdAt: order.createdAt,
          completedAt: order.completedAt,
          items: new Map(), // 使用 Map 來合併相同菜品
          totalAmount: 0,
          status: 'completed',
          itemCount: 0
        })
      }
      
      const receipt = receiptMap.get(receiptKey)
      const processedItems = processOrderItems(order.items || [])
      
      // 合併相同菜品
      processedItems.forEach(item => {
        const itemKey = generateItemKey(item)
        
        if (receipt.items.has(itemKey)) {
          // 如果已存在相同菜品，累加數量
          const existingItem = receipt.items.get(itemKey)
          existingItem.quantity += item.quantity
        } else {
          // 如果是新菜品，直接添加
          receipt.items.set(itemKey, { ...item })
        }
      })
      
      receipt.totalAmount += order.totalAmount || 0
    })
    
    // 將 Map 轉換為陣列並計算總項目數
    return Array.from(receiptMap.values()).map(receipt => {
      const itemsArray = Array.from(receipt.items.values())
      receipt.items = itemsArray
      receipt.itemCount = itemsArray.reduce((total, item) => total + item.quantity, 0)
      return receipt
    })
  }

  // 生成菜品的唯一鍵值，用於合併相同菜品
  const generateItemKey = (item) => {
    const optionsString = item.processedOptions 
      ? item.processedOptions.map(opt => `${opt.key}:${opt.valueLabel}`).sort().join('|')
      : ''
    return `${item.name}|${optionsString}`
  }

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
      new Date(a.createdAt) - new Date(b.createdAt)
    )
  }

  // 輔助函數：獲取桌號
  const getTableNumber = (tableId) => {
    if (!tableId) return '未知桌號'
    
    if (typeof tableId === 'object' && tableId !== null) {
      // 優先使用 tableNumber，如果沒有則從 displayName 中提取純數字
      if (tableId.tableNumber) {
        return tableId.tableNumber
      }
      
      if (tableId.displayName) {
        // 從 displayName 中提取數字部分，例如 "桌號 2" -> "2"
        const match = tableId.displayName.match(/\d+/)
        if (match) {
          return match[0]
        }
        return tableId.displayName
      }
      
      return '未知桌號'
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
    delivered: deliveredOrders.value.filter(batch => batch.status === 'delivered').length,
    completed: deliveredOrders.value.filter(batch => batch.status === 'completed').length
  }))

  const selectedDateOrdersCount = computed(() => {
    // 計算歷史訂單中符合選中日期的訂單數量
    const getHistoryOrdersCount = () => {
      const selectedDay = new Date(selectedDate.value)
      const startOfDay = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate())
      const endOfDay = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), 23, 59, 59, 999)
      
      const dateCompletedOrders = historyOrders.value.filter(order => {
        if (!order.completedAt) return false
        const completedDate = new Date(order.completedAt)
        return completedDate >= startOfDay && completedDate <= endOfDay
      })
      return dateCompletedOrders.length
    }
    
    // 計算即時訂單中已完成的訂單數量（已送出的訂單）
    const getLiveCompletedOrdersCount = () => {
      const completedLiveOrders = liveOrders.value.filter(order => 
        ['served', 'delivered', 'completed'].includes(order.status)
      )
      
      const selectedDay = new Date(selectedDate.value)
      const startOfDay = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate())
      const endOfDay = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), 23, 59, 59, 999)
      
      return completedLiveOrders.filter(order => {
        const orderDate = new Date(order.createdAt)
        return orderDate >= startOfDay && orderDate <= endOfDay
      }).length
    }
    
    // 返回歷史訂單 + 即時訂單的總數
    return getHistoryOrdersCount() + getLiveCompletedOrdersCount()
  })

  // 保持向後兼容性
  const todayOrdersCount = computed(() => selectedDateOrdersCount.value)

  const historyStats = computed(() => {
    // 歷史訂單都是已完成的桌次訂單
    const completedOrders = historyOrders.value
    const totalRevenue = completedOrders.reduce((sum, order) => sum + order.totalAmount, 0)
    
    // 平均客單價 = 總營業額 / 總訂單數
    const averageOrderValue = completedOrders.length > 0 
      ? Math.round(totalRevenue / completedOrders.length) 
      : 0

    // 計算高峰時段
    const hourStats = {}
    completedOrders.forEach(order => {
      if (order.completedAt) {
        // 轉換為台灣時區 (UTC+8)
        const completedDate = new Date(order.completedAt)
        const taiwanHour = (completedDate.getUTCHours() + 8) % 24
        hourStats[taiwanHour] = (hourStats[taiwanHour] || 0) + 1
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

    // 搜尋過濾 - 支援收據號、訂單號、桌號搜尋
    if (searchTerm.value) {
      const term = searchTerm.value.toLowerCase()
      filtered = filtered.filter(order => 
        (order.receiptOrderNumber && order.receiptOrderNumber.toLowerCase().includes(term)) ||
        order.tableOrderNumber.toLowerCase().includes(term) ||
        order.tableNumber.toLowerCase().includes(term)
      )
      console.log('搜尋過濾後:', filtered)
    }

    // 現在直接從 API 獲取指定日期的數據，不需要額外的時間過濾
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
        status: 'pending,confirmed,preparing,ready,delivered,served,completed',
        limit: 50,
        sortBy: 'createdAt',
        sortOrder: 'desc'
      })
      
      if (response.status === 'success') {
        // 處理訂單數據，確保日期格式正確
        const orders = response.data.orders.map(order => {
          // 使用統一的桌號處理邏輯
          const tableNumber = getTableNumber(order.tableId)
          
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
      
      // 根據視圖模式決定查詢時間範圍 - 使用本地時間
      const selectedDay = new Date(selectedDate.value)
      console.log('=== 時間範圍計算調試 ===')
      console.log('selectedDate.value:', selectedDate.value)
      console.log('selectedDay:', selectedDay)
      console.log('selectedDay.getDate():', selectedDay.getDate())
      console.log('selectedDay.getMonth():', selectedDay.getMonth())
      console.log('selectedDay.getFullYear():', selectedDay.getFullYear())
      let startTime, endTime
      
      switch (dateViewMode.value) {
        case 'year':
          // 查詢整年的訂單 - 轉換為 UTC 時間
          const startOfYear = new Date(selectedDay.getFullYear(), 0, 1, 0, 0, 0, 0)
          const endOfYear = new Date(selectedDay.getFullYear(), 11, 31, 23, 59, 59, 999)
          // 轉換為 UTC 時間以匹配 MongoDB 存儲
          startTime = startOfYear.toISOString()
          endTime = endOfYear.toISOString()
          break
        case 'month':
          // 查詢整月的訂單 - 轉換為 UTC 時間
          const startOfMonth = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), 1, 0, 0, 0, 0)
          const endOfMonth = new Date(selectedDay.getFullYear(), selectedDay.getMonth() + 1, 0, 23, 59, 59, 999)
          // 轉換為 UTC 時間以匹配 MongoDB 存儲
          startTime = startOfMonth.toISOString()
          endTime = endOfMonth.toISOString()
          break
        case 'day':
        default:
          // 查詢單日的訂單 - 轉換為 UTC 時間（00:00:00到23:59:59）
          const startOfDay = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), 0, 0, 0, 0)
          const endOfDay = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), 23, 59, 59, 999)
          
          console.log('=== 時間計算調試 ===')
          console.log('selectedDay:', selectedDay)
          console.log('startOfDay:', startOfDay)
          console.log('endOfDay:', endOfDay)
          
          // 使用本地時間進行查詢，轉換為本地時間字符串
          const localStartTime = new Date(startOfDay.getTime() - (startOfDay.getTimezoneOffset() * 60000))
          const localEndTime = new Date(endOfDay.getTime() - (endOfDay.getTimezoneOffset() * 60000))
          startTime = localStartTime.toISOString()
          endTime = localEndTime.toISOString()
          
          console.log('計算出的 startTime:', startTime)
          console.log('計算出的 endTime:', endTime)
          break
      }
      
      console.log('日期查詢參數:', { 
        startTime, 
        endTime, 
        selectedDate: selectedDate.value.toLocaleDateString(),
        viewMode: dateViewMode.value,
        localTimeRange: `${new Date(startTime).toLocaleString('zh-TW')} 到 ${new Date(endTime).toLocaleString('zh-TW')}`
      })
      
      const response = await orderService.getOrdersByMerchant(merchantId, {
        status: 'completed,cancelled',
        limit: 200, // 增加限制以獲取更多數據進行合併
        sortBy: 'createdAt',
        sortOrder: 'desc',
        startDate: startTime,
        endDate: endTime
      })
      
      if (response.status === 'success') {
        // 添加詳細的調試信息
        console.log('=== 歷史訂單載入詳細信息 ===');
        console.log('原始訂單數量:', response.data.orders.length);
        
        // 顯示前5筆原始訂單的詳細信息
        if (response.data.orders.length > 0) {
          console.log('前5筆原始訂單詳細信息:');
          response.data.orders.slice(0, 5).forEach((order, index) => {
            console.log(`原始訂單 ${index + 1}:`, {
              id: order._id,
              orderNumber: order.orderNumber,
              tableOrderNumber: order.tableOrderNumber,
              receiptOrderNumber: order.receiptOrderNumber,
              status: order.status,
              createdAt: order.createdAt,
              completedAt: order.completedAt,
              tableNumber: order.tableId?.tableNumber || order.tableNumber,
              itemsCount: order.items?.length || 0,
              totalAmount: order.totalAmount
            });
          });
          
          // 顯示時間範圍統計
          const completedOrders = response.data.orders.filter(o => o.completedAt);
          const createdOrders = response.data.orders.filter(o => o.createdAt);
          
          console.log('歷史訂單時間範圍統計:', {
            totalOrders: response.data.orders.length,
            completedOrders: completedOrders.length,
            createdOrders: createdOrders.length,
            timeRange: `${startTime} 到 ${endTime}`,
            viewMode: dateViewMode.value,
            selectedDate: selectedDate.value.toLocaleDateString()
          });
        }
        
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
        console.log('合併後的桌次訂單數據:', processedOrders)
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
      
      // 從訂單號解析日期
      let orderDate = null
      if (order.orderNumber && order.orderNumber.includes('-')) {
        const parts = order.orderNumber.split('-')
        if (parts.length >= 2) {
          const dateGroupBatch = parts[1]
          if (dateGroupBatch.length >= 8) {
            // 前8位是日期：20250818
            const dateStr = dateGroupBatch.substring(0, 8)
            orderDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`
          }
        }
      }
      
      // 使用桌次+客人組別+日期作為分組鍵，確保只合併同一天的訂單
      const groupKey = `${tableId}_${customerGroup}_${orderDate}`
      
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
      
      // 累加所有訂單的金額和項目數量
      group.totalAmount += order.totalAmount
      group.itemCount += order.items.length
      
      // 保存最後結帳的訂單信息（有 receiptOrderNumber 的訂單）
      if (order.receiptOrderNumber) {
        group.lastCheckoutOrder = order
        group.lastCheckoutAmount = order.totalAmount // 保存最後結帳批次的金額
        group.lastCheckoutItemCount = order.items.length // 保存最後結帳批次的項目數量
      }
      
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
        receiptOrderNumber: group.lastCheckoutOrder?.receiptOrderNumber || null, // 添加收據號
        completedAt: group.lastOrderTime, // 使用最後訂單時間作為結帳時間
        tableCapacity: group.tableCapacity, // 添加桌次容量信息
        // 使用所有批次的總金額
        totalAmount: group.totalAmount,
        itemCount: group.lastCheckoutItemCount || group.itemCount,
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

  const printReceipt = async (order) => {
    console.log('=== 前端收據列印調試信息 ===');
    console.log('列印時間:', new Date().toISOString());
    console.log('訂單信息:', {
      orderId: order._id,
      orderNumber: order.orderNumber,
      tableOrderNumber: order.tableOrderNumber,
      tableNumber: order.tableNumber,
      totalAmount: order.totalAmount,
      batchCount: order.orders ? order.orders.length : 0
    });
    
    console.log('訂單類型判斷:', {
      isTableOrder: !!order.tableOrderNumber,
      hasOrders: !!(order.orders && order.orders.length > 0),
      ordersCount: order.orders ? order.orders.length : 0
    });
    
    try {
      let receipt = null;
      
      if (order.tableOrderNumber) {
        console.log('處理桌次訂單，查找對應的收據');
        // 桌次訂單 - 需要查找該桌次所有批次的收據
        if (order.orders && order.orders.length > 0) {
          // 嘗試查找第一個批次的收據（通常第一個批次會創建收據）
          const firstOrder = order.orders[0];
          console.log('第一個批次訂單:', {
            orderId: firstOrder._id,
            orderNumber: firstOrder.orderNumber
          });
          
          const response = await receiptAPI.getReceiptByOrderId(firstOrder._id);
          console.log('API 響應:', response);
          
          if (response.status === 'success') {
            receipt = response.data.receipt;
            console.log('找到收據:', {
              receiptId: receipt._id,
              billNumber: receipt.billNumber,
              orderId: receipt.orderId,
              total: receipt.total,
              itemsCount: receipt.items.length
            });
          } else {
            // 如果第一個批次沒有收據，嘗試查找其他批次
            console.log('第一個批次沒有收據，嘗試查找其他批次');
            for (let i = 1; i < order.orders.length; i++) {
              const otherOrder = order.orders[i];
              console.log(`嘗試第 ${i + 1} 個批次:`, {
                orderId: otherOrder._id,
                orderNumber: otherOrder.orderNumber
              });
              
              const otherResponse = await receiptAPI.getReceiptByOrderId(otherOrder._id);
              if (otherResponse.status === 'success') {
                receipt = otherResponse.data.receipt;
                console.log('找到收據:', {
                  receiptId: receipt._id,
                  billNumber: receipt.billNumber,
                  orderId: receipt.orderId,
                  total: receipt.total,
                  itemsCount: receipt.items.length
                });
                break;
              }
            }
          }
        }
      } else {
        console.log('處理單個批次訂單');
        // 單個批次訂單
        const response = await receiptAPI.getReceiptByOrderId(order._id);
        console.log('API 響應:', response);
        
        if (response.status === 'success') {
          receipt = response.data.receipt;
          console.log('找到收據:', {
            receiptId: receipt._id,
            billNumber: receipt.billNumber,
            orderId: receipt.orderId,
            total: receipt.total,
            itemsCount: receipt.items.length
          });
        }
      }
      
      if (receipt) {
        console.log('收據數據詳情:');
        console.log('收據項目:', receipt.items);
        console.log('收據基本信息:', {
          billNumber: receipt.billNumber,
          tableNumber: receipt.tableNumber,
          checkoutTime: receipt.checkoutTime,
          storeName: receipt.storeName,
          employeeId: receipt.employeeId,
          employeeName: receipt.employeeName
        });
        
        // 獲取餐廳名稱
        let storeName = receipt.storeName || '餐廳';
        
        // 優先從URL參數獲取餐廳名稱
        const urlParams = new URLSearchParams(window.location.search);
        const urlStoreName = urlParams.get('restaurantName');
        if (urlStoreName) {
          storeName = urlStoreName;
          console.log('從URL參數獲取餐廳名稱:', storeName);
        } else {
          // 如果URL中沒有餐廳名稱，嘗試從本地存儲獲取
          if (!storeName || storeName === '餐廳' || storeName === '餐廳名稱') {
            try {
              const merchantUser = localStorage.getItem('merchant_user');
              if (merchantUser) {
                const userData = JSON.parse(merchantUser);
                storeName = userData.businessName || userData.merchantName || userData.name || '餐廳';
              }
            } catch (error) {
              console.error('獲取餐廳名稱失敗:', error);
              storeName = '餐廳';
            }
          }
        }
        
        console.log('使用的餐廳名稱:', storeName);
        
        // 更新收據中的餐廳名稱
        receipt.storeName = storeName;
        
        // 如果是桌次訂單，需要修改收據數據以顯示所有批次的項目和總金額
        let finalReceiptData;
        if (order.tableOrderNumber && order.orders && order.orders.length > 1) {
          console.log('桌次訂單，修改收據數據以顯示所有批次的項目和總金額');
          const generatedReceiptData = generateReceiptFromStoredData(receipt);
          
          // 合併所有批次的項目，但保留選項差異
          const allItems = [];
          const itemMap = new Map(); // 用於合併相同項目
          
          order.orders.forEach((batchOrder, batchIndex) => {
            console.log(`處理第 ${batchIndex + 1} 個批次的項目:`, batchOrder.items);
            
            batchOrder.items.forEach(item => {
              // 創建更精確的項目鍵，包含所有影響價格的選項
              const optionsKey = item.selectedOptions ? 
                Object.entries(item.selectedOptions)
                  .sort(([a], [b]) => a.localeCompare(b)) // 排序確保一致性
                  .map(([key, value]) => {
                    // 處理不同的選項值格式
                    let displayValue = value;
                    if (typeof value === 'object' && value !== null) {
                      displayValue = value.label || value.name || value.value || JSON.stringify(value);
                    }
                    return `${key}:${displayValue}`;
                  })
                  .join('|') : '';
              
              const itemKey = `${item.dishId}-${optionsKey}`;
              
              console.log(`項目鍵: ${itemKey}`, {
                dishId: item.dishId,
                options: item.selectedOptions,
                optionsKey: optionsKey,
                price: item.price,
                totalPrice: item.totalPrice
              });
              
              if (itemMap.has(itemKey)) {
                // 合併完全相同的項目（包括選項）
                const existingItem = itemMap.get(itemKey);
                existingItem.quantity += item.quantity;
                existingItem.totalPrice += item.totalPrice;
                
                // 確保合併後的項目也有正確的顯示名稱
                if (!existingItem.displayName) {
                  existingItem.displayName = existingItem.dishName || existingItem.name;
                }
                
                console.log(`合併項目: ${existingItem.displayName}，新數量: ${existingItem.quantity}，新總價: ${existingItem.totalPrice}`);
              } else {
                // 新增項目（可能是相同菜品但選項不同）
                const newItem = {
                  ...item,
                  dishName: item.dishName || item.name, // 確保 dishName 存在
                  batchNumber: batchIndex + 1, // 標記批次號碼
                  originalPrice: item.price, // 保留原始單價
                  originalTotalPrice: item.totalPrice, // 保留原始總價
                  // 為收據顯示創建更清楚的項目名稱
                  displayName: item.dishName || item.name
                };
                itemMap.set(itemKey, newItem);
                console.log(`新增項目: ${item.dishName}，選項: ${JSON.stringify(item.selectedOptions)}，單價: ${item.price}，總價: ${item.totalPrice}`);
              }
            });
          });
          
          // 將合併後的項目轉換為陣列，並按菜品名稱排序
          allItems.push(...itemMap.values());
          allItems.sort((a, b) => {
            const nameA = a.dishName || a.displayName || a.name || '';
            const nameB = b.dishName || b.displayName || b.name || '';
            return nameA.localeCompare(nameB);
          });
          
          console.log('合併後的所有項目:', allItems);
          
          // 計算所有批次的總金額
          const totalAmount = order.totalAmount; // 使用桌次訂單的總金額
          
          finalReceiptData = {
            ...generatedReceiptData,
            items: allItems,
            subtotal: totalAmount,
            total: totalAmount,
            storeName: storeName
          };
          
          console.log('修改後的收據數據:', {
            originalSubtotal: generatedReceiptData.subtotal,
            originalTotal: generatedReceiptData.total,
            newSubtotal: finalReceiptData.subtotal,
            newTotal: finalReceiptData.total,
            originalItemsCount: generatedReceiptData.items.length,
            newItemsCount: finalReceiptData.items.length
          });
        } else {
          // 單個批次訂單，使用原始收據數據
          finalReceiptData = generateReceiptFromStoredData(receipt);
          // 確保餐廳名稱正確
          finalReceiptData.storeName = storeName;
        }
        
        console.log('最終收據數據:', finalReceiptData);
        
        // 顯示收據預覽
        console.log('準備顯示收據預覽...');
        receiptData.value = finalReceiptData;
        showReceiptPreview.value = true;
        
        console.log('收據預覽已顯示');
      } else {
        console.log('找不到收據數據，顯示錯誤訊息');
        // 如果找不到儲存的收據，顯示錯誤訊息
        if (order.tableOrderNumber) {
          console.log('顯示桌次訂單錯誤訊息');
          alert(`無法找到桌次訂單 ${order.tableOrderNumber} 的收據資料，請聯繫系統管理員。`)
        } else {
          console.log('顯示單個訂單錯誤訊息');
          alert(`無法找到訂單 ${order.orderNumber} 的收據資料，請聯繫系統管理員。`)
        }
      }
      
      console.log('=== 前端收據列印調試完成 ===');
    } catch (error) {
      console.error('列印收據失敗:', error);
      console.log('=== 前端收據列印調試失敗 ===');
      alert('列印收據失敗，請重試');
    }
  }

  // 關閉收據預覽
  const closeReceiptPreview = () => {
    showReceiptPreview.value = false;
    receiptData.value = null;
  }

  // 從收據預覽列印
  const printReceiptFromPreview = () => {
    if (receiptComponent.value) {
      receiptComponent.value.printReceipt();
    }
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
    // 檢查是否為今天
    const today = new Date()
    const selectedDay = new Date(selectedDate.value)
    
    if (today.toDateString() === selectedDay.toDateString()) {
      return 'primary'
    } else if (selectedDay < today) {
      return 'info'
    } else {
      return 'warning'
    }
  }

  // 獲取日期顯示文字
  const getDateDisplayText = () => {
    const today = new Date()
    const selectedDay = new Date(selectedDate.value)
    
    // 根據視圖模式返回不同的文字
    switch (dateViewMode.value) {
      case 'year':
        if (today.getFullYear() === selectedDay.getFullYear()) {
          return '今年'
        } else {
          return `${selectedDay.getFullYear()}年`
        }
      case 'month':
        if (today.getFullYear() === selectedDay.getFullYear() && 
            today.getMonth() === selectedDay.getMonth()) {
          return '本月'
        } else {
          return `${selectedDay.getFullYear()}年${selectedDay.getMonth() + 1}月`
        }
      case 'day':
      default:
        if (today.toDateString() === selectedDay.toDateString()) {
          return '今日'
        } else {
          return selectedDay.toLocaleDateString('zh-TW', { 
            month: 'long', 
            day: 'numeric' 
          })
        }
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
    // 每5秒自動刷新一次即時訂單，提供更即時的更新
    refreshInterval = setInterval(async () => {
      if (activeTab.value === 'live') {
        isAutoRefreshing.value = true
        try {
          await loadLiveOrders()
        } finally {
          isAutoRefreshing.value = false
        }
      }
    }, 5000) // 5秒
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

  // 匯出狀態管理
  const isExporting = ref(false)

  // 匯出歷史訂單
  const exportHistoryOrders = async (format = 'xlsx') => {
    console.log('=== 匯出函數被調用 ===', { format, isExporting: isExporting.value })
    
    // 防止重複調用
    if (isExporting.value) {
      console.log('匯出進行中，請稍候...')
      return
    }

    // 立即設置狀態，防止快速重複點擊
    isExporting.value = true
    console.log('設置匯出狀態為 true')

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

      // 根據視圖模式設定匯出範圍
      const selectedDay = new Date(selectedDate.value)
      const year = selectedDay.getFullYear()
      const month = String(selectedDay.getMonth() + 1).padStart(2, '0')
      const day = String(selectedDay.getDate()).padStart(2, '0')
      
      switch (dateViewMode.value) {
        case 'year':
          // 年模式：匯出整年資料
          params.startDate = `${year}-01-01`
          params.endDate = `${year}-12-31T23:59:59.999Z`
          break
        case 'month':
          // 月模式：匯出整月資料
          params.startDate = `${year}-${month}-01`
          // 計算該月的最後一天
          const lastDay = new Date(year, selectedDay.getMonth() + 1, 0).getDate()
          params.endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`
          break
        case 'day':
        default:
          // 日模式：匯出單日資料 - 修正為包含整天的時間範圍
          // 使用本地時間，不添加時區標識，讓後端正確處理
          params.startDate = `${year}-${month}-${day}`
          params.endDate = `${year}-${month}-${day}`
          break
      }

      console.log('匯出參數:', params)
      console.log('視圖模式:', dateViewMode.value)

      // 先檢查是否有訂單可以匯出
      const checkParams = {
        status: 'completed,cancelled',
        startDate: params.startDate,
        endDate: params.endDate,
        searchTerm: params.searchTerm
      }
      
      try {
        const checkResponse = await orderService.getOrdersByMerchant(merchantId, checkParams)
        const orderCount = checkResponse.data?.orders?.length || 0
        
        if (orderCount === 0) {
          // 沒有訂單，顯示提醒
          let message = ''
          switch (dateViewMode.value) {
            case 'year':
              message = `${year}年沒有找到已完成的訂單`
              break
            case 'month':
              message = `${year}年${month}月沒有找到已完成的訂單`
              break
            case 'day':
            default:
              message = `${year}年${month}月${day}日沒有找到已完成的訂單`
              break
          }
          alert(message)
          return
        }
      } catch (checkError) {
        console.error('檢查訂單數量失敗:', checkError)
        // 如果檢查失敗，繼續嘗試匯出
      }

      // 呼叫匯出 API
      const response = await orderService.exportHistoryOrders(merchantId, params)
      
      // 處理檔案下載
      const blob = new Blob([response.data], { 
        type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      
      // 從響應標頭獲取檔案名稱
      console.log('響應標頭:', response.headers)
      let fileName = response.headers?.['x-file-name'] || response.headers?.['X-File-Name']
      console.log('從標頭獲取的檔案名稱:', fileName)
      if (fileName) {
        fileName = decodeURIComponent(fileName)
        console.log('解碼後的檔案名稱:', fileName)
      } else {
        // 如果沒有標頭信息，使用預設名稱
        fileName = `歷史訂單_${new Date().toISOString().split('T')[0]}`
        console.log('使用預設檔案名稱:', fileName)
      }
      fileName = `${fileName}.${format}`
      console.log('最終檔案名稱:', fileName)
      
      link.download = fileName
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
          
          // 檢查是否是沒有訂單的錯誤
          if (error.response.status === 404 && errorData.message && errorData.message.includes('沒有找到')) {
            // 這是沒有訂單的情況，不需要顯示錯誤
            console.log('沒有找到訂單，已在前端檢查中處理')
            return
          }
          
          // 其他錯誤顯示提示
          alert(`匯出失敗: ${errorData.message || '未知錯誤'}`)
        } catch (parseError) {
          console.error('無法解析錯誤響應:', parseError)
          alert('匯出失敗: 無法解析錯誤信息')
        }
      } else {
        alert(`匯出失敗: ${error.message || '未知錯誤'}`)
      }
    } finally {
      console.log('匯出函數執行完成，準備重置狀態')
      // 延遲重置狀態，防止快速重複調用
      setTimeout(() => {
        isExporting.value = false
        console.log('延遲重置匯出狀態為 false')
      }, 500)
    }
  }

  return {
    // 響應式數據
    activeTab,
    selectedDate,
    searchTerm,
    loading,
    isExporting,
    currentDate,
    dateTitle,
    selectedDateOrdersCount,
    todayOrdersCount,
    dateViewMode,
    
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
    
    // 收據預覽狀態
    showReceiptPreview,
    receiptData,
    receiptComponent,
    
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
    closeReceiptPreview,
    printReceiptFromPreview,
    exportHistoryOrders,
    formatTime,
    formatDateTime,
    getStatVariant,
    getDateDisplayText,
    getOrderStatusVariant,
    getOrderStatusText,
    getOptionLabel,
    getOptionValueLabel,
    
    // 日期導航
    previousDate,
    nextDate,
    updateDateViewMode
  }
}
