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
        <div v-else>
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
                  :disabled="loading"
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
        <BaseButton :disabled="!canSubmitNew" @click="handleAddMerchant">新增</BaseButton>
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
  editingUser
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

// 儲存編輯
const handleSaveEdit = async () => {
  if (!editingUser.value) return
  try {
    // 目前後端僅提供狀態更新 API，其餘欄位後續擴充
    await merchantAPI.updateMerchantStatus(editingUser.value.id, editingUser.value.status)
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
</style>
