<template>
  <div class="customer-orders">
    <div class="orders-header">
      <h1>點餐紀錄</h1>
      <p class="subtitle">當前用餐的點餐內容</p>
    </div>

    <!-- 當前訂單 -->
    <div class="current-order" v-if="currentOrder">
      <BaseCard
        elevation="low"
        class="order-card"
      >
        <div class="order-header">
          <div class="order-info">
            <h3>當前點餐內容</h3>
            <p class="order-number" v-if="currentOrder.orderNumber">訂單編號：{{ currentOrder.orderNumber }}</p>
            <p class="order-date">{{ formatDate(currentOrder.createdAt) }}</p>
          </div>
          <div class="order-status">
            <BaseTag :variant="statusMap[currentOrder.status]?.variant || 'default'">
              {{ statusMap[currentOrder.status]?.label || currentOrder.status }}
            </BaseTag>
          </div>
        </div>

        <div class="order-items">
          <div
            v-for="(item, index) in currentOrder.items"
            :key="`${item.dishId || item.id}-${index}`"
            class="order-item"
            :class="{ 'batch-item': item.batchNumber }"
          >
            <div class="item-info">
              <span class="item-name">{{ item.name }}</span>
              <span class="item-quantity">x{{ item.quantity }}</span>
              <BaseTag 
                v-if="item.batchNumber && currentOrder.batchCount > 1" 
                variant="info" 
                size="small"
                class="batch-tag"
              >
                批次 {{ item.batchNumber }}
              </BaseTag>
              <BaseTag 
                v-if="item.batchStatus && item.batchStatus !== 'pending'"
                :variant="statusMap[item.batchStatus]?.variant || 'default'"
                size="small"
                class="status-tag"
              >
                {{ statusMap[item.batchStatus]?.label || item.batchStatus }}
              </BaseTag>
            </div>
            <div class="item-options" v-if="item.selectedOptions && getOptionsText(item.selectedOptions).length > 0">
              <BaseTag
                v-for="option in getOptionsText(item.selectedOptions)"
                :key="option"
                variant="default"
                size="small"
              >
                {{ option }}
              </BaseTag>
            </div>
            <div class="item-notes" v-if="item.notes">
              <small class="text-muted">備註：{{ item.notes }}</small>
            </div>
            <div class="item-price">NT$ {{ item.totalPrice }}</div>
          </div>
        </div>

        <div class="order-footer">
          <div class="order-total">
            <strong>總計：NT$ {{ currentOrder.totalAmount }}</strong>
          </div>
          <div class="order-actions">
            <!-- 收據按鈕 -->
            <BaseButton
              variant="secondary"
              size="medium"
              @click.stop="showReceipt"
              class="receipt-button"
            >
              <font-awesome-icon icon="receipt" />
              查看收據
            </BaseButton>
            
            <!-- 結帳按鈕已隱藏，但功能保留以便之後調用 -->
            <!-- 
            <BaseButton
              variant="primary"
              size="large"
              @click.stop="proceedToCheckout"
              class="checkout-button"
            >
              <font-awesome-icon icon="credit-card" />
              結帳 (NT$ {{ currentOrder.totalAmount }})
            </BaseButton>
            -->
          </div>
        </div>
      </BaseCard>
    </div>

    <!-- 空狀態 -->
    <div v-else class="empty-state">
      <BaseCard elevation="low">
        <div class="empty-content">
          <font-awesome-icon icon="receipt" class="empty-icon" />
          <h3>還沒有點餐紀錄</h3>
          <p>您還沒有點選任何餐點，快去菜單選擇您喜歡的美食吧！</p>
          <BaseButton variant="primary" @click="goToMenu">
            瀏覽菜單
          </BaseButton>
        </div>
      </BaseCard>
    </div>

    <!-- 收據模態框 -->
    <div v-if="showReceiptModal" class="receipt-modal-overlay" @click="closeReceipt">
      <div class="receipt-modal" @click.stop>
        <div class="receipt-modal-header">
          <h3>收據預覽</h3>
          <button class="close-button" @click="closeReceipt">
            <font-awesome-icon icon="times" />
          </button>
        </div>
        <div class="receipt-modal-content">
          <BaseReceipt 
            v-if="receiptData" 
            :receipt="receiptData" 
            ref="receiptComponent"
          />
        </div>
        <div class="receipt-modal-actions">
          <BaseButton variant="secondary" @click="closeReceipt">
            關閉
          </BaseButton>
          <BaseButton variant="primary" @click="printReceipt">
            <font-awesome-icon icon="print" />
            列印收據
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { orderService, orderAPI } from '@/services/api'
import BaseCard from '../../components/base/BaseCard.vue'
import BaseButton from '../../components/base/BaseButton.vue'
import BaseTag from '../../components/base/BaseTag.vue'
import BaseReceipt from '../../components/base/BaseReceipt.vue'
import { generateReceiptData } from '../../utils/receiptUtils'

const router = useRouter()

// 當前點餐紀錄
const currentOrder = ref(null)
const orders = ref([])
const loading = ref(false)
const error = ref(null)

// 收據相關
const showReceiptModal = ref(false)
const receiptData = ref(null)
const receiptComponent = ref(null)

// 狀態標籤映射
const statusMap = {
  'pending': { label: '待確認', variant: 'warning' },
  'confirmed': { label: '已確認', variant: 'info' },
  'preparing': { label: '製作中', variant: 'primary' },
  'ready': { label: '可取餐', variant: 'success' },
  'served': { label: '已送達', variant: 'success' },
  'cancelled': { label: '已取消', variant: 'danger' }
}

// 載入訂單資料
const loadOrders = async () => {
  try {
    loading.value = true
    error.value = null

    // 獲取桌子資訊
    const storedTableInfo = sessionStorage.getItem('currentTable')
    if (!storedTableInfo) {
      console.warn('找不到桌子資訊')
      loadCurrentOrderFromLocal()
      return
    }

    const tableData = JSON.parse(storedTableInfo)
    
    // 從後端獲取該桌子的所有批次訂單
    const response = await orderAPI.getTableBatches(tableData.id)
    
    if (response.status === 'success') {
      const batches = response.data.batches
      orders.value = batches
      
      // 如果有批次訂單，將它們合併顯示為一個完整的訂單
      if (batches.length > 0) {
        // 合併所有批次的商品
        const allItems = []
        let totalAmount = 0
        let latestCreatedAt = null
        
        batches.forEach(batch => {
          // 為每個商品添加批次信息
          batch.items.forEach(item => {
            allItems.push({
              ...item,
              batchNumber: batch.batchNumber,
              batchStatus: batch.status
            })
          })
          totalAmount += batch.totalAmount
          
          // 找到最新的創建時間
          const batchDate = new Date(batch.createdAt)
          if (!latestCreatedAt || batchDate > latestCreatedAt) {
            latestCreatedAt = batchDate
          }
        })
        
        // 創建合併後的訂單顯示
        currentOrder.value = {
          orderNumber: `批次合併 (${batches.length} 批次)`,
          items: allItems,
          totalAmount: totalAmount,
          createdAt: latestCreatedAt || new Date(),
          status: 'pending', // 顯示為待處理，實際狀態由各批次決定
          batches: batches, // 保存原始批次信息
          batchCount: batches.length
        }
      }
    }
    
  } catch (err) {
    console.error('載入訂單失敗:', err)
    error.value = err.message || '載入訂單失敗'
    // 如果後端載入失敗，嘗試從localStorage載入
    loadCurrentOrderFromLocal()
  } finally {
    loading.value = false
  }
}

// 從localStorage載入訂單（後備方案）
const loadCurrentOrderFromLocal = () => {
  try {
    const orderData = localStorage.getItem('currentOrder')
    if (orderData) {
      const order = JSON.parse(orderData)
      // 確保 createdAt 是有效的日期
      if (order.createdAt) {
        const dateObj = new Date(order.createdAt)
        // 如果日期無效，設為當前時間
        order.createdAt = isNaN(dateObj.getTime()) ? new Date() : dateObj
      } else {
        // 如果沒有 createdAt，設為當前時間
        order.createdAt = new Date()
      }
      currentOrder.value = order
    }
  } catch (error) {
    console.error('載入本地訂單失敗:', error)
    currentOrder.value = null
  }
}

// 組件掛載時載入訂單
onMounted(() => {
  loadOrders()
})

// 方法
const formatDate = (date) => {
  // 檢查日期是否有效
  if (!date) {
    return '日期未設定'
  }
  
  // 確保 date 是 Date 對象
  const dateObj = date instanceof Date ? date : new Date(date)
  
  // 檢查日期是否有效
  if (isNaN(dateObj.getTime())) {
    return '無效日期'
  }
  
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(dateObj)
}

// 添加防重複調用狀態
const isCheckingOut = ref(false)

const proceedToCheckout = async () => {
  console.log('=== 結帳函數被調用 ===')
  console.log('調用時間:', new Date().toISOString())
  console.log('當前結帳狀態:', isCheckingOut.value)
  
  // 防重複調用檢查
  if (isCheckingOut.value) {
    console.log('正在結帳中，忽略重複調用')
    return
  }
  
  try {
    // 立即設置為結帳中狀態，防止重複調用
    isCheckingOut.value = true
    console.log('設置結帳狀態為 true')
    
    // 獲取桌子資訊
    console.log('=== 獲取桌子資訊 ===')
    const storedTableInfo = sessionStorage.getItem('currentTable')
    console.log('儲存的桌子資訊:', storedTableInfo)
    
    if (!storedTableInfo) {
      console.log('找不到桌子資訊')
      alert('找不到桌子資訊，請重新掃描QR碼')
      return
    }

    const tableData = JSON.parse(storedTableInfo)
    console.log('解析後的桌子資料:', tableData)
    
    // 獲取桌子的所有批次總金額
    console.log('=== 獲取桌子總金額 ===')
    console.log('調用 getTableTotal API，桌次 ID:', tableData.id)
    const totalResponse = await orderAPI.getTableTotal(tableData.id)
    console.log('API 回應:', totalResponse)
    
    if (!totalResponse.data || totalResponse.data.totalAmount === 0) {
      console.log('沒有餐點可以結帳')
      alert('目前沒有任何餐點可以結帳')
      return
    }

    const totalAmount = totalResponse.data.totalAmount
    const batchCount = totalResponse.data.batchCount
    
    // 添加詳細的調試訊息
    console.log('=== 結帳調試訊息 ===')
    console.log('桌次 ID:', tableData.id)
    console.log('桌次名稱:', tableData.name)
    console.log('批次數量:', batchCount)
    console.log('總金額:', totalAmount)
    console.log('當前時間:', new Date().toISOString())
    console.log('調用次數:', (window.checkoutCallCount || 0) + 1)
    console.log('==================')
    
    // 記錄調用次數
    window.checkoutCallCount = (window.checkoutCallCount || 0) + 1
    
    const confirmMessage = batchCount > 1 
      ? `確定要結帳嗎？\n共有 ${batchCount} 批次訂單\n總金額：NT$ ${totalAmount}`
      : `確定要結帳嗎？\n總金額：NT$ ${totalAmount}`
    
    if (confirm(confirmMessage)) {
      console.log('用戶確認結帳，調用結帳 API')
      console.log('=== 開始結帳流程 ===')
      console.log('結帳時間:', new Date().toISOString())
      console.log('調用 checkoutTable API，桌次 ID:', tableData.id)
      
      // 調用新的桌子結帳 API - 合併所有批次
      const response = await orderAPI.checkoutTable(tableData.id)
      console.log('結帳 API 回應:', response)
      
      if (response.status === 'success') {
        const checkoutData = response.data
        console.log('=== 結帳成功詳細資訊 ===')
        console.log('結帳資料:', checkoutData)
        console.log('結帳金額:', checkoutData.totalAmount)
        console.log('批次數量:', checkoutData.batchCount)
        console.log('結帳時間:', new Date().toISOString())
        console.log('調用次數:', window.checkoutCallCount)
        console.log('========================')
        
        // 結帳完成後清空所有本地資料
        currentOrder.value = null
        localStorage.removeItem('currentOrder')
        sessionStorage.removeItem('cartItems') // 清空購物車
        
        // 跳轉到謝謝光臨頁面，並傳遞結帳資料
        router.push({
          name: 'CustomerThankYou',
          query: {
            checkoutData: JSON.stringify({
              totalAmount: checkoutData.totalAmount,
              batchCount: checkoutData.batchCount,
              checkoutTime: new Date().toISOString()
            })
          }
        })
      } else {
        alert('結帳失敗，請稍後再試')
      }
    } else {
      console.log('=== 用戶取消結帳 ===')
      console.log('取消時間:', new Date().toISOString())
    }
  } catch (error) {
    console.log('=== 結帳發生錯誤 ===')
    console.error('錯誤詳情:', error)
    console.log('錯誤時間:', new Date().toISOString())
    alert('結帳失敗，請稍後再試')
  } finally {
    // 重置結帳狀態
    isCheckingOut.value = false
    console.log('=== 結帳流程結束 ===')
    console.log('重置結帳狀態:', isCheckingOut.value)
    console.log('最終調用次數:', window.checkoutCallCount)
    console.log('==================')
  }
}

const goToMenu = () => {
  router.push('/menu')
}

// 顯示收據
const showReceipt = () => {
  try {
    // 獲取桌子資訊
    const storedTableInfo = sessionStorage.getItem('currentTable')
    if (!storedTableInfo) {
      alert('找不到桌子資訊，請重新掃描QR碼')
      return
    }

    const tableData = JSON.parse(storedTableInfo)
    
    // 獲取員工資訊（從localStorage或sessionStorage）
    const employeeInfo = JSON.parse(localStorage.getItem('employeeInfo') || sessionStorage.getItem('employeeInfo') || '{}')
    const employeeId = employeeInfo.employeeId || '001' // 預設員工編號
    
    // 生成收據數據
    receiptData.value = generateReceiptData(currentOrder.value, employeeId, tableData.name)
    
    // 顯示收據模態框
    showReceiptModal.value = true
  } catch (error) {
    console.error('生成收據失敗:', error)
    alert('生成收據失敗，請稍後再試')
  }
}

// 列印收據
const printReceipt = () => {
  if (receiptData.value && receiptComponent.value) {
    // 調用收據組件的列印方法
    receiptComponent.value.printReceipt()
  }
}

// 關閉收據模態框
const closeReceipt = () => {
  showReceiptModal.value = false
  receiptData.value = null
}

// 格式化選項文字顯示
const getOptionsText = (selectedOptions) => {
  if (!selectedOptions) return []
  
  const options = []
  
  // 處理不同格式的 selectedOptions
  if (selectedOptions instanceof Map) {
    // 如果是 Map 對象
    for (const [key, value] of selectedOptions.entries()) {
      const optionText = formatOptionValue(key, value)
      if (optionText) options.push(optionText)
    }
  } else if (typeof selectedOptions === 'object' && selectedOptions !== null) {
    // MongoDB 的 Map 類型在序列化後會變成一個特殊的對象
    // 檢查是否有 $type 或其他 MongoDB 特殊字段
    if (selectedOptions.$type === 'Map' || selectedOptions.constructor.name === 'Object') {
      // 直接遍歷對象的所有屬性
      for (const [key, value] of Object.entries(selectedOptions)) {
        // 跳過 MongoDB 的元數據字段
        if (key.startsWith('$')) continue
        
        const optionText = formatOptionValue(key, value)
        if (optionText) options.push(optionText)
      }
    }
  }
  
  return options
}

// 格式化單個選項的顯示值
const formatOptionValue = (key, value) => {
  let displayValue = ''
  let price = 0
  
  // 處理各種可能的 value 格式
  if (typeof value === 'string') {
    try {
      // 嘗試解析 JSON 格式的字符串
      const parsed = JSON.parse(value)
      if (typeof parsed === 'object') {
        displayValue = parsed.label || parsed.name || parsed.value || value
        price = parsed.price || 0
      } else {
        displayValue = parsed
      }
    } catch (e) {
      // 如果不是 JSON，直接使用原值
      displayValue = value
    }
  } else if (typeof value === 'object' && value !== null) {
    // 如果 value 本身就是對象
    displayValue = value.label || value.name || value.value || value.toString()
    price = value.price || 0
    
    // 如果 toString 返回 [object Object]，嘗試其他方式
    if (displayValue === '[object Object]' || displayValue.toString() === '[object Object]') {
      // 嘗試找到可能的顯示值
      const possibleKeys = ['text', 'title', 'description', 'val']
      for (const possibleKey of possibleKeys) {
        if (value[possibleKey] && typeof value[possibleKey] === 'string') {
          displayValue = value[possibleKey]
          break
        }
      }
      
      // 如果還是找不到，就用 JSON.stringify
      if (displayValue === '[object Object]' || displayValue.toString() === '[object Object]') {
        displayValue = JSON.stringify(value)
      }
    }
  } else {
    displayValue = String(value)
  }
  
  // 組合顯示文字
  let optionText = `${key}: ${displayValue}`
  
  // 如果有加價，顯示加價信息
  if (price > 0) {
    optionText += ` (+NT$ ${price})`
  }
  
  return optionText
}
</script>

<style scoped>
@import './Orders.css';
</style>
