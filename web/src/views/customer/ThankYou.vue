<template>
  <div class="thank-you-page">
    <div class="thank-you-card">
      <!-- 成功圖標 -->
      <div class="success-icon">
        <i class="fas fa-check"></i>
      </div>
      
      <!-- 謝謝光臨標題 -->
      <h1 class="thank-you-title">謝謝光臨!</h1>
      
      <!-- 完成訊息 -->
      <p class="completion-message">您的結帳已完成,歡迎再次光臨</p>
      
      <!-- 結帳資訊 -->
      <div class="checkout-info" v-if="checkoutData">
        <div class="info-item">
          <span class="label">總金額:</span>
          <span class="value">NT$ {{ checkoutData.totalAmount }}</span>
        </div>
        <div class="info-item" v-if="checkoutData.batchCount > 1">
          <span class="label">合併批次:</span>
          <span class="value">{{ checkoutData.batchCount }}批次</span>
        </div>
        <div class="info-item">
          <span class="label">結帳時間:</span>
          <span class="value">{{ formatCheckoutTime(checkoutData.checkoutTime) }}</span>
        </div>
      </div>
      
      <!-- 重新開始點餐按鈕 -->
      <button class="restart-button" @click="restartOrdering">
        <i class="fas fa-utensils"></i>
        重新開始點餐
      </button>
      
      <!-- 餐廳資訊 -->
      <div class="restaurant-info">
        <p class="restaurant-name">測試餐廳</p>
        <p class="restaurant-subtitle">restaurant</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const checkoutData = ref(null)

onMounted(() => {
  // 從 URL 參數獲取結帳資料
  if (route.query.checkoutData) {
    try {
      checkoutData.value = JSON.parse(route.query.checkoutData)
    } catch (error) {
      console.error('解析結帳資料失敗:', error)
    }
  }
})

// 格式化結帳時間
const formatCheckoutTime = (timeString) => {
  if (!timeString) return ''
  
  try {
    const date = new Date(timeString)
    return new Intl.DateTimeFormat('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  } catch (error) {
    return timeString
  }
}

// 重新開始點餐
const restartOrdering = () => {
  // 清空訂單和購物車資料，但保留桌次信息
  localStorage.removeItem('currentOrder')
  sessionStorage.removeItem('cartItems')
  
  // 保留 currentTable 信息，這樣重新進入菜單時還能識別桌次
  
  // 跳轉到菜單頁面
  router.push('/menu')
}
</script>

<style scoped>
.thank-you-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.thank-you-card {
  background: white;
  border-radius: 20px;
  padding: 40px;
  text-align: center;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  max-width: 500px;
  width: 100%;
}

.success-icon {
  width: 80px;
  height: 80px;
  background: #4CAF50;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
}

.success-icon i {
  color: white;
  font-size: 40px;
}

.thank-you-title {
  font-size: 2.5rem;
  font-weight: bold;
  color: #333;
  margin-bottom: 10px;
}

.completion-message {
  font-size: 1.1rem;
  color: #666;
  margin-bottom: 30px;
}

.checkout-info {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 30px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.info-item:last-child {
  margin-bottom: 0;
}

.label {
  font-weight: 500;
  color: #555;
}

.value {
  font-weight: bold;
  color: #333;
}

.restart-button {
  background: #007bff;
  color: white;
  border: none;
  border-radius: 10px;
  padding: 15px 30px;
  font-size: 1.1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 0 auto 30px;
}

.restart-button:hover {
  background: #0056b3;
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(0, 123, 255, 0.3);
}

.restart-button i {
  font-size: 1.2rem;
}

.restaurant-info {
  border-top: 1px solid #eee;
  padding-top: 20px;
}

.restaurant-name {
  font-size: 1.2rem;
  font-weight: bold;
  color: #333;
  margin-bottom: 5px;
}

.restaurant-subtitle {
  font-size: 0.9rem;
  color: #666;
  margin: 0;
}

/* 響應式設計 */
@media (max-width: 768px) {
  .thank-you-page {
    padding: 10px;
  }
  
  .thank-you-card {
    padding: 30px 20px;
  }
  
  .thank-you-title {
    font-size: 2rem;
  }
  
  .success-icon {
    width: 60px;
    height: 60px;
  }
  
  .success-icon i {
    font-size: 30px;
  }
}
</style>
