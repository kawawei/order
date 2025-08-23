<template>
  <div class="restaurants-page">
    <header class="page-header">
      <div class="header-main">
        <h1>餐廳管理</h1>
        <BaseTag variant="info" size="medium">
          <font-awesome-icon icon="store" class="mr-1" />
          {{ totalUsers }} 間餐廳
        </BaseTag>
      </div>
    </header>

    <div class="restaurants-grid">
      <BaseCard class="restaurants-list" elevation="low">
        <template #header>
          <div class="card-header-content">
            <h3>餐廳列表</h3>
            <div class="search-box">
              <input
                type="text"
                v-model="searchQuery"
                placeholder="搜尋餐廳..."
                class="search-input"
                @keyup.enter="handleSearch"
              />
              <BaseButton
                variant="primary"
                size="small"
                @click="handleSearch"
                :disabled="loading"
              >
                <font-awesome-icon icon="search" />
              </BaseButton>
              <BaseButton
                variant="primary"
                size="small"
                class="ml-2"
                @click="showAddDialog = true"
              >
                <font-awesome-icon icon="plus" /> 新增餐廳
              </BaseButton>
              <BaseButton
                variant="secondary"
                size="small"
                class="ml-2"
                @click="showImportDialog = true"
              >
                <font-awesome-icon icon="file-excel" /> 匯入餐廳
              </BaseButton>
            </div>
          </div>
        </template>

        <!-- 加載狀態 -->
        <div v-if="loading" class="loading-state">
          <font-awesome-icon icon="spinner" spin />
          載入中...
        </div>

        <!-- 錯誤狀態 -->
        <div v-else-if="error" class="error-state">
          <font-awesome-icon icon="exclamation-triangle" />
          {{ error }}
          <BaseButton
            variant="primary"
            size="small"
            @click="loadMerchants"
            class="ml-2"
          >
            重試
          </BaseButton>
        </div>

        <!-- 數據表格 -->
        <div v-else class="table-container">
          <BaseTable
            :columns="columns"
            :data="filteredUsers"
            hoverable
            class="restaurants-table"
          >
            <!-- 餐廳名稱列 -->
            <template #businessName="{ row }">
              <div class="restaurant-name">
                <font-awesome-icon icon="store" class="mr-2" />
                {{ row.businessName }}
              </div>
            </template>

            <!-- 狀態列 -->
            <template #status="{ row }">
              <BaseTag
                :variant="getStatusVariant(row.status)"
                size="small"
              >
                {{ getStatusText(row.status) }}
              </BaseTag>
            </template>

            <!-- 操作列 -->
            <template #actions="{ row }">
              <div class="action-buttons">
                <BaseButton
                  variant="text"
                  size="small"
                  @click="editUser(row)"
                  title="編輯"
                >
                  <font-awesome-icon icon="pen" />
                </BaseButton>
                
                <!-- 前往餐廳按鈕 -->
                <BaseButton
                  variant="text"
                  size="small"
                  @click="goToRestaurant(row)"
                  title="前往餐廳後台"
                  class="go-to-restaurant-btn"
                >
                  <font-awesome-icon icon="store" />
                </BaseButton>
                
                <!-- 切換狀態按鈕 -->
                <BaseButton
                  variant="text"
                  size="small"
                  @click="toggleUserStatus(row)"
                  title="切換狀態"
                  :disabled="loading || isTogglingStatus"
                >
                  <font-awesome-icon
                    :icon="row.status === 'active' ? 'pause' : 'play'"
                  />
                </BaseButton>
                
                <!-- 重置密碼按鈕 -->
                <BaseButton
                  variant="text"
                  size="small"
                  @click="resetPassword(row)"
                  title="重置密碼"
                >
                  <font-awesome-icon icon="key" />
                </BaseButton>

                <!-- 刪除商家按鈕 -->
                <BaseButton
                  variant="text"
                  size="small"
                  @click="deleteUser(row)"
                  title="刪除餐廳"
                  :disabled="loading || isDeleting"
                >
                  <font-awesome-icon icon="trash" />
                </BaseButton>
              </div>
            </template>
          </BaseTable>

          <!-- 分頁組件 -->
          <div v-if="totalPages > 1" class="pagination-wrapper">
            <div class="pagination-info">
              第 {{ currentPage }} 頁，共 {{ totalPages }} 頁
            </div>
            <div class="pagination-controls">
              <BaseButton
                variant="outline"
                size="small"
                @click="handlePageChange(currentPage - 1)"
                :disabled="currentPage <= 1"
              >
                上一頁
              </BaseButton>
              <BaseButton
                variant="outline"
                size="small"
                @click="handlePageChange(currentPage + 1)"
                :disabled="currentPage >= totalPages"
              >
                下一頁
              </BaseButton>
            </div>
          </div>
        </div>
      </BaseCard>
    </div>

    <!-- 新增餐廳對話框 -->
    <BaseDialog
      :model-value="showAddDialog"
      @update:model-value="val => showAddDialog = val"
      title="新增餐廳"
      size="medium"
    >
      <div class="add-merchant-form">
        <div class="form-row">
          <label>餐廳名稱</label>
          <input v-model="newMerchant.businessName" type="text" placeholder="請輸入餐廳名稱" />
        </div>
        <div class="form-row">
          <label>商家代碼</label>
          <input v-model="newMerchant.merchantCode" type="text" placeholder="自行設定商家代碼" />
        </div>
        <div class="form-row">
          <label>餐廳種類</label>
          <input v-model="newMerchant.restaurantType" type="text" placeholder="例：早午餐、火鍋、燒肉..." />
        </div>
        <div class="form-row">
          <label>統編（選填）</label>
          <input v-model="newMerchant.taxId" type="text" placeholder="請輸入 8 位數字" maxlength="8" />
        </div>
        <div class="form-row">
          <label>餐廳電話（選填）</label>
          <input v-model="newMerchant.businessPhone" type="text" placeholder="餐廳聯絡電話" />
        </div>
        <div class="form-row col-span-2">
          <label>餐廳地址（選填）</label>
          <input v-model="newMerchant.businessAddress" type="text" placeholder="餐廳地址" />
        </div>
        <div class="form-row">
          <label>老闆姓名</label>
          <input v-model="newMerchant.ownerName" type="text" placeholder="請輸入老闆姓名" />
        </div>
        <div class="form-row">
          <label>老闆電話（選填）</label>
          <input v-model="newMerchant.ownerPhone" type="text" placeholder="連絡電話" />
        </div>
        <p v-if="addError" class="error-text">{{ addError }}</p>
      </div>

      <template #footer>
        <BaseButton variant="text" @click="showAddDialog = false">取消</BaseButton>
        <BaseButton :disabled="!canSubmitNew || isAddingMerchant" @click="handleAddMerchant">新增</BaseButton>
      </template>
    </BaseDialog>

    <!-- 編輯餐廳對話框 -->
    <BaseDialog
      :model-value="isEditDialogOpen"
      @update:model-value="val => isEditDialogOpen = val"
      title="編輯餐廳"
      size="medium"
    >
      <div v-if="editingUser" class="add-merchant-form">
        <div class="form-row">
          <label>餐廳名稱</label>
          <input v-model="editingUser.businessName" type="text" placeholder="請輸入餐廳名稱" />
        </div>
        <div class="form-row">
          <label>商家代碼</label>
          <input v-model="editingUser.merchantCode" type="text" placeholder="自行設定商家代碼" />
        </div>
        <div class="form-row">
          <label>餐廳種類</label>
          <input v-model="editingUser.restaurantType" type="text" placeholder="例：早午餐、火鍋、燒肉..." />
        </div>
        <div class="form-row">
          <label>統編（選填）</label>
          <input v-model="editingUser.taxId" type="text" placeholder="請輸入 8 位數字" maxlength="8" />
        </div>
        <div class="form-row">
          <label>餐廳電話（選填）</label>
          <input v-model="editingUser.businessPhone" type="text" placeholder="餐廳聯絡電話" />
        </div>
        <div class="form-row col-span-2">
          <label>餐廳地址（選填）</label>
          <input v-model="editingUser.businessAddress" type="text" placeholder="餐廳地址" />
        </div>
        <div class="form-row">
          <label>老闆姓名</label>
          <input v-model="editingUser.ownerName" type="text" placeholder="請輸入老闆姓名" />
        </div>
        <div class="form-row">
          <label>老闆電話（選填）</label>
          <input v-model="editingUser.ownerPhone" type="text" placeholder="連絡電話" />
        </div>
        <div class="form-row col-span-2">
          <label>狀態</label>
          <div class="status-group">
            <button
              type="button"
              class="status-chip success"
              :class="{ active: editingUser.status === 'active' }"
              @click="editingUser.status = 'active'"
            >
              營業中
            </button>
            <button
              type="button"
              class="status-chip danger"
              :class="{ active: editingUser.status === 'suspended' }"
              @click="editingUser.status = 'suspended'"
            >
              暫停營業
            </button>
          </div>
        </div>
      </div>

      <template #footer>
        <BaseButton variant="text" @click="isEditDialogOpen = false">取消</BaseButton>
        <BaseButton :disabled="!editingUser" @click="handleSaveEdit">儲存</BaseButton>
      </template>
    </BaseDialog>

    <!-- 匯入餐廳對話框 -->
    <BaseDialog
      :model-value="showImportDialog"
      @update:model-value="val => showImportDialog = val"
      title="匯入餐廳資料"
      size="medium"
    >
      <div class="import-form">
        <div class="import-instructions">
          <h4>匯入說明：</h4>
          <ul>
            <li>請上傳 Excel 檔案 (.xlsx 或 .xls)</li>
            <li>檔案大小限制：5MB</li>
            <li>支援的欄位：序號、餐廳種類、商家編號、店名、店家電話、地址、統編、老闆名、老闆電話、桌次數量</li>
            <li>第一行應為標題列</li>
            <li>商家編號、店名、老闆名為必填欄位</li>
          </ul>
        </div>
        
        <div class="file-upload-section">
          <input
            ref="fileInput"
            type="file"
            accept=".xlsx,.xls"
            @change="handleFileSelect"
            style="display: none"
          />
          <div class="upload-area" @click="triggerFileInput">
            <div v-if="!selectedFile" class="upload-placeholder">
              <font-awesome-icon icon="file-excel" size="2x" />
              <p>點擊選擇 Excel 檔案</p>
            </div>
            <div v-else class="selected-file">
              <font-awesome-icon icon="file-excel" />
              <span>{{ selectedFile.name }}</span>
            </div>
          </div>
        </div>

        <div v-if="importError" class="import-error">
          <font-awesome-icon icon="exclamation-triangle" />
          {{ importError }}
        </div>

        <div v-if="importResults" class="import-results">
          <h4>匯入結果：</h4>
          <div class="results-summary">
            <p>成功：{{ importResults.success.length }} 筆</p>
            <p>更新：{{ importResults.updatedCount }} 筆</p>
            <p>新建：{{ importResults.createdCount }} 筆</p>
            <p v-if="importResults.errors.length > 0">錯誤：{{ importResults.errors.length }} 筆</p>
          </div>
          
          <div v-if="importResults.errors.length > 0" class="error-list">
            <h5>錯誤詳情：</h5>
            <ul>
              <li v-for="error in importResults.errors" :key="error">{{ error }}</li>
            </ul>
          </div>
        </div>
      </div>

      <template #footer>
        <BaseButton variant="text" @click="showImportDialog = false">取消</BaseButton>
        <BaseButton 
          :disabled="!selectedFile || importing" 
          @click="handleImport"
          :loading="importing"
        >
          {{ importing ? '匯入中...' : '開始匯入' }}
        </BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>

<script setup>
import { columns, useUsers } from './Restaurants.js'
import { ref, computed } from 'vue'
import { merchantAPI } from '@/services/api'

const {
  searchQuery,
  totalUsers,
  filteredUsers,
  loading,
  error,
  currentPage,
  totalPages,
  editUser,
  toggleUserStatus,
  resetPassword,
  deleteUser,
  goToRestaurant,
  handleSearch,
  handlePageChange,
  loadMerchants,
  addMerchant,
  isEditDialogOpen,
  editingUser,
  isDeleting,
  isTogglingStatus,
  isAddingMerchant
} = useUsers()

// 新增餐廳對話框狀態
const showAddDialog = ref(false)
const newMerchant = ref({
  businessName: '',
  merchantCode: '',
  restaurantType: '',
  taxId: '',
  businessPhone: '',
  businessAddress: '',
  ownerName: '',
  ownerPhone: ''
})
const addError = ref('')

const canSubmitNew = computed(() => {
  return (
    newMerchant.value.businessName.trim() &&
    newMerchant.value.merchantCode.trim() &&
    newMerchant.value.ownerName.trim()
  )
})

const handleAddMerchant = async () => {
  addError.value = ''
  if (!canSubmitNew.value) {
    addError.value = '請完整填寫必填欄位'
    return
  }
  try {
    await addMerchant({
      businessName: newMerchant.value.businessName.trim(),
      merchantCode: newMerchant.value.merchantCode.trim(),
      restaurantType: newMerchant.value.restaurantType.trim() || undefined,
      taxId: (newMerchant.value.taxId || '').trim() || undefined,
      businessPhone: newMerchant.value.businessPhone.trim() || undefined,
      businessAddress: newMerchant.value.businessAddress.trim() || undefined,
      ownerName: newMerchant.value.ownerName.trim(),
      ownerPhone: newMerchant.value.ownerPhone.trim() || undefined
    })
    showAddDialog.value = false
    newMerchant.value = { 
      businessName: '', 
      merchantCode: '', 
      restaurantType: '',
      taxId: '',
      businessPhone: '',
      businessAddress: '',
      ownerName: '', 
      ownerPhone: '' 
    }
  } catch (e) {
    addError.value = e.message || '新增餐廳失敗'
  }
}

// 獲取狀態變體
const getStatusVariant = (status) => {
  const variantMap = {
    'active': 'success',
    'suspended': 'danger'
  }
  return variantMap[status] || 'info'
}

// 獲取狀態文字
const getStatusText = (status) => {
  const textMap = {
    'active': '營業中',
    'suspended': '暫停營業'
  }
  return textMap[status] || '未知'
}

// 匯入相關狀態
const showImportDialog = ref(false)
const selectedFile = ref(null)
const importing = ref(false)
const importError = ref('')
const importResults = ref(null)
const fileInput = ref(null)

// 觸發檔案選擇
const triggerFileInput = () => {
  fileInput.value?.click()
}

// 處理檔案選擇
const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (file) {
    // 檢查檔案類型
    const allowedTypes = ['.xlsx', '.xls']
    const fileName = file.name.toLowerCase()
    const isValidType = allowedTypes.some(type => fileName.endsWith(type))
    
    if (!isValidType) {
      importError.value = '請選擇 Excel 檔案 (.xlsx 或 .xls)'
      return
    }
    
    // 檢查檔案大小 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      importError.value = '檔案大小不能超過 5MB'
      return
    }
    
    selectedFile.value = file
    importError.value = ''
    importResults.value = null
  }
}

// 處理匯入
const handleImport = async () => {
  if (!selectedFile.value) {
    importError.value = '請選擇要匯入的檔案'
    return
  }
  
  importing.value = true
  importError.value = ''
  importResults.value = null
  
  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    
    const response = await merchantAPI.importMerchants(formData)
    importResults.value = response.data
    
    // 如果匯入成功，重新載入餐廳列表
    if (response.data.success.length > 0 || response.data.updatedCount > 0) {
      await loadMerchants()
    }
    
  } catch (error) {
    console.error('匯入失敗:', error)
    importError.value = error.response?.data?.message || '匯入失敗，請檢查檔案格式'
  } finally {
    importing.value = false
  }
}

// 儲存編輯
const handleSaveEdit = async () => {
  if (!editingUser.value) return
  try {
    const payload = {
      businessName: (editingUser.value.businessName || '').trim(),
      merchantCode: (editingUser.value.merchantCode || '').trim(),
      restaurantType: (editingUser.value.restaurantType || '').trim() || undefined,
      taxId: (editingUser.value.taxId || '').trim() || undefined,
      businessPhone: (editingUser.value.businessPhone || '').trim() || undefined,
      businessAddress: (editingUser.value.businessAddress || '').trim() || undefined,
      ownerName: (editingUser.value.ownerName || '').trim() || undefined,
      ownerPhone: (editingUser.value.ownerPhone || '').trim() || undefined,
      status: editingUser.value.status
    }
    console.log('更新商家資料:', payload)
    await merchantAPI.updateMerchant(editingUser.value.id, payload)
    // 重新載入列表
    await loadMerchants(currentPage.value, searchQuery.value)
    isEditDialogOpen.value = false
  } catch (e) {
    console.error('更新商家失敗:', e)
  }
}
</script>

<style src="./Restaurants.css" scoped></style>

<style scoped>
.add-merchant-form {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem 1rem;
}
.form-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.col-span-2 {
  grid-column: span 1;
}
@media (min-width: 768px) {
  .add-merchant-form {
    grid-template-columns: 1fr 1fr;
  }
  .col-span-2 {
    grid-column: span 2;
  }
}
.form-row label {
  font-size: 0.875rem;
  color: #666;
}
.form-row input {
  padding: 0.5rem;
  border: 1px solid #e6e6e6;
  border-radius: 4px;
}
.error-text {
  color: #ff4d4f;
  font-size: 0.875rem;
}

/* 狀態樣式 */
.status-group {
  display: inline-flex;
  gap: 0.5rem;
}
.status-chip {
  padding: 0.375rem 0.75rem;
  border-radius: 9999px;
  border: 1px solid transparent;
  background: #f5f5f5;
  color: #555;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
}
.status-chip:hover {
  filter: brightness(0.98);
}
.status-chip.active {
  color: #fff;
}
.status-chip.success.active {
  background: #16a34a;
}
.status-chip.warning.active {
  background: #f59e0b;
}
.status-chip.danger.active {
  background: #ef4444;
}

/* 匯入對話框樣式 */
.import-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.import-instructions {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid #3b82f6;
}

.import-instructions h4 {
  margin: 0 0 0.5rem 0;
  color: #1f2937;
  font-size: 1rem;
}

.import-instructions ul {
  margin: 0;
  padding-left: 1.5rem;
  color: #6b7280;
  font-size: 0.875rem;
}

.import-instructions li {
  margin-bottom: 0.25rem;
}

.file-upload-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.upload-area {
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  background: #f9fafb;
}

.upload-area:hover {
  border-color: #3b82f6;
  background: #f0f9ff;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: #6b7280;
}

.upload-placeholder p {
  margin: 0;
  font-size: 0.875rem;
}

.selected-file {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: #059669;
  font-weight: 500;
}

.import-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  color: #dc2626;
  font-size: 0.875rem;
}

.import-results {
  background: #f0f9ff;
  padding: 1rem;
  border-radius: 8px;
  border-left: 4px solid #3b82f6;
}

.import-results h4 {
  margin: 0 0 0.75rem 0;
  color: #1f2937;
  font-size: 1rem;
}

.results-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.results-summary p {
  margin: 0;
  font-size: 0.875rem;
  color: #374151;
}

.error-list {
  border-top: 1px solid #d1d5db;
  padding-top: 0.75rem;
}

.error-list h5 {
  margin: 0 0 0.5rem 0;
  color: #dc2626;
  font-size: 0.875rem;
}

.error-list ul {
  margin: 0;
  padding-left: 1.5rem;
  font-size: 0.75rem;
  color: #6b7280;
}

.error-list li {
  margin-bottom: 0.25rem;
}
</style>
