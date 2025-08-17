<template>
  <div class="table-access">
    <div class="loading-container" v-if="isLoading">
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p class="loading-text">正在載入桌次資訊...</p>
      </div>
    </div>

    <div class="error-container" v-else-if="error">
      <div class="error-card">
        <div class="error-icon">
          <font-awesome-icon icon="triangle-exclamation" />
        </div>
        <h2 class="error-title">無法載入桌次</h2>
        <p class="error-message">{{ error }}</p>
        <div class="error-actions">
          <BaseButton 
            variant="primary" 
            @click="retryLoad"
            class="retry-button"
          >
            重新載入
          </BaseButton>
          <BaseButton 
            variant="secondary" 
            @click="goToMenu"
            class="fallback-button"
          >
            直接進入菜單
          </BaseButton>
        </div>
      </div>
    </div>

    <!-- 桌次歡迎頁面 -->
    <div class="welcome-container" v-else-if="tableData && !isStartingOrder">
      <div class="welcome-card">
        <div class="restaurant-header">
          <div class="restaurant-icon">
            <font-awesome-icon icon="utensils" />
          </div>
          <h1 class="restaurant-name">{{ tableData.merchant.businessName }}</h1>
          <p class="restaurant-description" v-if="tableData.merchant.businessType">
            {{ getBusinessTypeText(tableData.merchant.businessType) }}
          </p>
        </div>

        <div class="table-info-card">
          <div class="table-number">
            <span class="table-label">桌號</span>
            <span class="table-value">{{ tableData.tableNumber }}</span>
          </div>
          <div class="table-details">
            <div v-if="tableData.tableName" class="detail-item">
              <font-awesome-icon icon="tag" />
              <span>{{ tableData.tableName }}</span>
            </div>
            <div class="detail-item">
              <font-awesome-icon icon="users" />
              <span>{{ tableData.capacity }}人桌</span>
            </div>
          </div>
        </div>

        <div class="welcome-message">
          <h2>歡迎光臨！</h2>
          <p>點擊下方按鈕開始您的用餐體驗</p>
        </div>

        <div class="action-section">
          <BaseButton 
            variant="primary" 
            @click="startOrdering"
            class="start-ordering-btn"
            :loading="isStartingOrder"
            size="large"
          >
            <font-awesome-icon icon="play" />
            開始點餐
          </BaseButton>
        </div>


      </div>
    </div>

    <!-- 正在開始點餐的載入狀態 -->
    <div class="loading-container" v-else-if="isStartingOrder">
      <div class="loading-spinner">
        <div class="spinner"></div>
        <p class="loading-text">正在為您準備點餐...</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../../services/api'
import BaseButton from '../../components/base/BaseButton.vue'

const route = useRoute()
const router = useRouter()

const isLoading = ref(true)
const error = ref(null)
const tableCode = ref(route.params.code)
const tableData = ref(null)
const isStartingOrder = ref(false)

// 載入桌次資訊
const loadTableInfo = async () => {
  try {
    isLoading.value = true
    error.value = null

    // 呼叫後端 API 獲取桌次資訊
    const response = await api.get(`/tables/public/${tableCode.value}`)
    
    if (response.status === 'success') {
      tableData.value = response.data.table
      
      // 將桌次和商家資訊保存到 sessionStorage
      sessionStorage.setItem('currentTable', JSON.stringify({
        id: tableData.value.id,
        tableNumber: tableData.value.tableNumber,
        tableName: tableData.value.tableName,
        capacity: tableData.value.capacity,
        status: tableData.value.status,
        merchant: tableData.value.merchant,
        uniqueCode: tableCode.value,
        isAvailable: tableData.value.isAvailable
      }))

      // 不再自動跳轉，而是顯示歡迎頁面
    } else {
      throw new Error('獲取桌次資訊失敗')
    }
  } catch (err) {
    console.error('載入桌次資訊失敗:', err)
    
    if (err.response?.status === 404) {
      error.value = '找不到此桌次，請確認 QR Code 是否正確'
    } else if (err.response?.status === 400) {
      error.value = '此桌次目前無法使用，請聯絡店家'
    } else {
      error.value = '載入桌次資訊時發生錯誤，請稍後再試'
    }
  } finally {
    isLoading.value = false
  }
}

// 開始點餐
const startOrdering = async () => {
  try {
    isStartingOrder.value = true
    
    // 呼叫後端 API 開始點餐，更新桌次狀態為已入座
    await api.post(`/tables/${tableData.value.id}/start-ordering`)
    
    // 更新 sessionStorage 中的桌次狀態
    const currentTable = JSON.parse(sessionStorage.getItem('currentTable') || '{}')
    currentTable.status = 'occupied'
    sessionStorage.setItem('currentTable', JSON.stringify(currentTable))
    
    // 跳轉到菜單頁面
    router.push({
      name: 'CustomerMenu',
      query: {
        table: tableData.value.tableNumber,
        code: tableCode.value
      }
    })
  } catch (err) {
    console.error('開始點餐失敗:', err)
    alert('開始點餐失敗，請稍後再試')
  } finally {
    isStartingOrder.value = false
  }
}

// 重試載入
const retryLoad = () => {
  loadTableInfo()
}

// 直接進入菜單頁面（不更新桌次狀態）
const goToMenu = () => {
  router.push({ 
    name: 'CustomerMenu',
    query: tableData.value ? {
      table: tableData.value.tableNumber,
      code: tableCode.value
    } : {}
  })
}

// 獲取商家類型文字
const getBusinessTypeText = (type) => {
  const types = {
    'restaurant': '餐廳',
    'cafe': '咖啡廳',
    'bar': '酒吧',
    'fastfood': '快餐店',
    'bakery': '烘焙店',
    'other': '其他'
  }
  return types[type] || '餐飲店'
}

// 組件掛載時載入桌次資訊
onMounted(() => {
  if (tableCode.value) {
    loadTableInfo()
  } else {
    error.value = '無效的桌次代碼'
    isLoading.value = false
  }
})
</script>

<style scoped>
.table-access {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.loading-container {
  text-align: center;
  color: white;
}

.loading-spinner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-left-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  font-size: 1.1rem;
  font-weight: 500;
  margin: 0;
}

.error-container, .welcome-container {
  max-width: 480px;
  width: 100%;
}

.error-card, .welcome-card {
  background: white;
  border-radius: 20px;
  padding: 40px 30px;
  text-align: center;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

.error-icon {
  width: 60px;
  height: 60px;
  background: #fef2f2;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
}

.error-icon svg {
  color: #ef4444;
  font-size: 24px;
}

.error-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 12px;
}

.error-message {
  color: #6b7280;
  font-size: 1rem;
  line-height: 1.6;
  margin: 0 0 30px;
}

.error-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.retry-button,
.fallback-button {
  width: 100%;
  padding: 12px 24px;
  font-weight: 500;
}

/* 歡迎頁面樣式 */
.restaurant-header {
  margin-bottom: 30px;
}

.restaurant-icon {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
}

.restaurant-icon svg {
  color: white;
  font-size: 32px;
}

.restaurant-name {
  font-size: 1.8rem;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 8px;
}

.restaurant-description {
  color: #6b7280;
  font-size: 1rem;
  margin: 0;
}

.table-info-card {
  background: #f8fafc;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 30px;
}

.table-number {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 16px;
}

.table-label {
  color: #6b7280;
  font-size: 1rem;
}

.table-value {
  font-size: 2rem;
  font-weight: 800;
  color: #1f2937;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.table-details {
  display: flex;
  justify-content: center;
  gap: 20px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #6b7280;
  font-size: 0.9rem;
}

.detail-item svg {
  font-size: 14px;
}

.welcome-message {
  margin-bottom: 30px;
}

.welcome-message h2 {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 8px;
}

.welcome-message p {
  color: #6b7280;
  font-size: 1rem;
  margin: 0;
}

.action-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 30px;
}

.start-ordering-btn {
  width: 100%;
  padding: 16px 24px;
  font-weight: 600;
  font-size: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

/* 響應式設計 */
@media (max-width: 480px) {
  .table-access {
    padding: 16px;
  }
  
  .error-card, .welcome-card {
    padding: 30px 20px;
  }
  
  .error-title, .restaurant-name {
    font-size: 1.25rem;
  }
  
  .error-message {
    font-size: 0.9rem;
  }
  
  .table-value {
    font-size: 1.5rem;
  }
  
  .welcome-message h2 {
    font-size: 1.25rem;
  }
  
  .table-details {
    flex-direction: column;
    gap: 12px;
  }
}
</style>
