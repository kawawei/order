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

    <!-- 成功載入後會自動重定向，不需要顯示內容 -->
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../../services/api'

const route = useRoute()
const router = useRouter()

const isLoading = ref(true)
const error = ref(null)
const tableCode = ref(route.params.code)

// 載入桌次資訊
const loadTableInfo = async () => {
  try {
    isLoading.value = true
    error.value = null

    // 呼叫後端 API 獲取桌次資訊
    const response = await api.get(`/tables/public/${tableCode.value}`)
    
    if (response.status === 'success') {
      const tableData = response.data.table
      
      // 將桌次和商家資訊保存到 sessionStorage
      sessionStorage.setItem('currentTable', JSON.stringify({
        id: tableData.id,
        tableNumber: tableData.tableNumber,
        tableName: tableData.tableName,
        capacity: tableData.capacity,
        status: tableData.status,
        merchant: tableData.merchant,
        uniqueCode: tableCode.value,
        isAvailable: tableData.isAvailable
      }))

      // 重定向到客戶點餐頁面，並傳遞桌次資訊
      router.push({
        name: 'CustomerMenu',
        query: {
          table: tableData.tableNumber,
          code: tableCode.value
        }
      })
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

// 重試載入
const retryLoad = () => {
  loadTableInfo()
}

// 回退到一般菜單頁面
const goToMenu = () => {
  router.push({ name: 'CustomerMenu' })
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

.error-container {
  max-width: 400px;
  width: 100%;
}

.error-card {
  background: white;
  border-radius: 16px;
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

/* 響應式設計 */
@media (max-width: 480px) {
  .table-access {
    padding: 16px;
  }
  
  .error-card {
    padding: 30px 20px;
  }
  
  .error-title {
    font-size: 1.25rem;
  }
  
  .error-message {
    font-size: 0.9rem;
  }
}
</style>
