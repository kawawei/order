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
          >
            <div class="item-info">
              <span class="item-name">{{ item.name }}</span>
              <span class="item-quantity">x{{ item.quantity }}</span>
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
            <BaseButton
              variant="primary"
              size="large"
              @click="proceedToCheckout"
              class="checkout-button"
            >
              <font-awesome-icon icon="credit-card" />
              結帳 (NT$ {{ currentOrder.totalAmount }})
            </BaseButton>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { orderService, orderAPI } from '@/services/api'
import BaseCard from '../../components/base/BaseCard.vue'
import BaseButton from '../../components/base/BaseButton.vue'
import BaseTag from '../../components/base/BaseTag.vue'

const router = useRouter()

// 當前點餐紀錄
const currentOrder = ref(null)
const orders = ref([])
const loading = ref(false)
const error = ref(null)

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
    
    // 從後端獲取該桌子的訂單
    const response = await orderService.getOrdersByTable(tableData.id, {
      status: 'pending,confirmed,preparing,ready',
      limit: 10
    })
    
    if (response.status === 'success') {
      orders.value = response.data.orders
      // 如果有訂單，取最新的一個作為當前訂單
      if (orders.value.length > 0) {
        const order = orders.value[0]
        // 確保 createdAt 是有效的日期對象
        if (order.createdAt) {
          const dateObj = new Date(order.createdAt)
          order.createdAt = isNaN(dateObj.getTime()) ? new Date() : dateObj
        } else {
          order.createdAt = new Date()
        }
        currentOrder.value = order
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

const proceedToCheckout = async () => {
  if (!currentOrder.value || !currentOrder.value.items.length) {
    alert('目前沒有任何餐點可以結帳')
    return
  }

  const totalAmount = currentOrder.value.totalAmount
  
  if (confirm(`確定要結帳嗎？\n總金額：NT$ ${totalAmount}`)) {
    try {
      // 獲取桌子資訊
      const storedTableInfo = sessionStorage.getItem('currentTable')
      if (!storedTableInfo) {
        alert('找不到桌子資訊，請重新掃描QR碼')
        return
      }

      const tableData = JSON.parse(storedTableInfo)
      
      // 調用後端結帳 API
      const response = await orderAPI.checkout({
        tableId: tableData.id
      })
      
      if (response.status === 'success') {
        alert(`結帳成功！\n總金額：NT$ ${totalAmount}\n謝謝您的光臨！`)
        
        // 結帳完成後清空所有本地資料
        currentOrder.value = null
        localStorage.removeItem('currentOrder')
        sessionStorage.removeItem('cartItems') // 清空購物車
        
        // 跳轉回菜單頁面
        router.push('/menu')
      } else {
        alert('結帳失敗，請稍後再試')
      }
    } catch (error) {
      console.error('結帳失敗:', error)
      alert('結帳失敗，請稍後再試')
    }
  }
}

const goToMenu = () => {
  router.push('/menu')
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
