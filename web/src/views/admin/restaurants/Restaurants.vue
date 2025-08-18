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
  </div>
</template>

<script setup>
import { columns, useUsers } from './Restaurants.js'

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
  goToRestaurant,
  handleSearch,
  handlePageChange,
  loadMerchants
} = useUsers()

// 獲取狀態變體
const getStatusVariant = (status) => {
  const variantMap = {
    'active': 'success',
    'pending': 'warning',
    'suspended': 'danger'
  }
  return variantMap[status] || 'info'
}

// 獲取狀態文字
const getStatusText = (status) => {
  const textMap = {
    'active': '營業中',
    'pending': '待審核',
    'suspended': '暫停營業'
  }
  return textMap[status] || '未知'
}
</script>

<style src="./Restaurants.css" scoped></style>
