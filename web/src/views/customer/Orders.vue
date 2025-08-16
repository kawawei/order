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
            <p class="order-date">{{ formatDate(currentOrder.createdAt) }}</p>
          </div>
          <div class="order-status">
            <BaseTag variant="info">
              待結帳
            </BaseTag>
          </div>
        </div>

        <div class="order-items">
          <div
            v-for="item in currentOrder.items"
            :key="`${item.id}-${item.options || 'default'}`"
            class="order-item"
          >
            <div class="item-info">
              <span class="item-name">{{ item.name }}</span>
              <span class="item-quantity">x{{ item.quantity }}</span>
            </div>
            <div class="item-options" v-if="item.selectedOptions">
              <BaseTag
                v-for="(option, key) in item.selectedOptions"
                :key="key"
                variant="default"
                size="small"
              >
                {{ option.label }}
              </BaseTag>
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
import BaseCard from '../../components/base/BaseCard.vue'
import BaseButton from '../../components/base/BaseButton.vue'
import BaseTag from '../../components/base/BaseTag.vue'

const router = useRouter()

// 當前點餐紀錄（從localStorage獲取）
const currentOrder = ref(null)

// 載入訂單資料
const loadCurrentOrder = () => {
  try {
    const orderData = localStorage.getItem('currentOrder')
    if (orderData) {
      const order = JSON.parse(orderData)
      // 確保 createdAt 是 Date 對象
      order.createdAt = new Date(order.createdAt)
      currentOrder.value = order
    }
  } catch (error) {
    console.error('載入訂單失敗:', error)
    currentOrder.value = null
  }
}

// 組件掛載時載入訂單
onMounted(() => {
  loadCurrentOrder()
})

// 方法
const formatDate = (date) => {
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const proceedToCheckout = () => {
  if (!currentOrder.value || !currentOrder.value.items.length) {
    alert('目前沒有任何餐點可以結帳')
    return
  }

  const totalAmount = currentOrder.value.totalAmount
  
  if (confirm(`確定要結帳嗎？\n總金額：NT$ ${totalAmount}`)) {
    // 這裡可以實現實際的結帳邏輯
    // 例如：調用API、跳轉到付款頁面等
    alert(`結帳成功！\n總金額：NT$ ${totalAmount}\n謝謝您的光臨！`)
    
    // 結帳完成後清空當前訂單和 localStorage
    currentOrder.value = null
    localStorage.removeItem('currentOrder')
    
    // 可選：跳轉到成功頁面或回到菜單
    // router.push('/menu')
  }
}

const goToMenu = () => {
  router.push('/menu')
}
</script>

<style scoped>
.customer-orders {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.orders-header {
  margin-bottom: 32px;
  text-align: center;
}

.orders-header h1 {
  margin: 0 0 8px;
  font-size: 2rem;
  font-weight: 700;
  color: #1d1d1f;
}

.subtitle {
  margin: 0;
  color: #666;
  font-size: 1rem;
}

.orders-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.order-card {
  overflow: visible;
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.order-info h3 {
  margin: 0 0 4px;
  font-size: 1.25rem;
  font-weight: 600;
  color: #1d1d1f;
}

.order-date {
  margin: 0;
  color: #666;
  font-size: 0.875rem;
}

.order-items {
  margin-bottom: 16px;
}

.order-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
  gap: 12px;
}

.order-item:last-child {
  border-bottom: none;
}

.item-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.item-name {
  font-weight: 500;
}

.item-quantity {
  color: #666;
  font-size: 0.875rem;
}

.item-options {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
}

.item-price {
  font-weight: 600;
  color: #007AFF;
  flex-shrink: 0;
}

.order-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.order-total {
  font-size: 1.125rem;
}

.order-actions {
  display: flex;
  gap: 8px;
}

.checkout-button {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  min-width: 200px;
  justify-content: center;
}

.checkout-button svg {
  font-size: 1.1rem;
}

/* 空狀態 */
.empty-state {
  margin-top: 40px;
}

.empty-content {
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  font-size: 3rem;
  color: #ccc;
  margin-bottom: 16px;
}

.empty-content h3 {
  margin: 0 0 8px;
  font-size: 1.5rem;
  font-weight: 600;
  color: #1d1d1f;
}

.empty-content p {
  margin: 0 0 24px;
  color: #666;
  line-height: 1.5;
}

/* 手機版樣式調整 */
@media (max-width: 768px) {
  .customer-orders {
    padding: 16px;
  }

  .orders-header h1 {
    font-size: 1.5rem;
  }

  .checkout-button {
    min-width: 100%;
    font-size: 1rem;
  }
  
  .order-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }

  .order-footer {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  .order-total {
    text-align: center;
    font-size: 1.25rem;
  }
}

/* 響應式設計 */
@media (max-width: 768px) {
  .customer-orders {
    padding: 16px;
  }
  
  .order-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .order-footer {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
  }
  
  .order-actions {
    justify-content: center;
  }
  
  .order-item {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  
  .item-options {
    margin: 4px 0;
  }
  
  .item-price {
    text-align: right;
  }
}
</style>
