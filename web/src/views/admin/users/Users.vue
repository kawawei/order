<template>
  <div class="users-page">
    <header class="page-header">
      <div class="header-main">
        <h1>用戶管理</h1>
        <BaseTag variant="info" size="medium">
          <font-awesome-icon icon="users" class="mr-1" />
          {{ totalUsers }} 位用戶
        </BaseTag>
      </div>
    </header>

    <div class="users-grid">
      <BaseCard class="users-list" elevation="low">
        <template #header>
          <div class="card-header-content">
            <h3>用戶列表</h3>
            <div class="search-box">
              <input
                type="text"
                v-model="searchQuery"
                placeholder="搜尋用戶..."
                class="search-input"
              />
            </div>
          </div>
        </template>

        <BaseTable
          :columns="columns"
          :data="filteredUsers"
          hoverable
          class="users-table"
        >
          <!-- 用戶名稱列 -->
          <template #name="{ row }">
            <div class="user-name">
              <font-awesome-icon :icon="row.role === 'admin' ? 'user-shield' : 'user'" class="mr-2" />
              {{ row.name }}
            </div>
          </template>

          <!-- 角色列 -->
          <template #role="{ row }">
            <BaseTag
              :variant="row.role === 'admin' ? 'warning' : 'info'"
              size="small"
            >
              {{ row.role === 'admin' ? '管理員' : '餐廳管理員' }}
            </BaseTag>
          </template>

          <!-- 狀態列 -->
          <template #status="{ row }">
            <BaseTag
              :variant="row.status === 'active' ? 'success' : 'danger'"
              size="small"
            >
              {{ row.status === 'active' ? '啟用' : '停用' }}
            </BaseTag>
          </template>

          <!-- 操作列 -->
          <template #actions="{ row }">
            <div class="action-buttons">
              <BaseButton
                variant="text"
                size="small"
                @click="editUser(row)"
              >
                <font-awesome-icon icon="pen" />
              </BaseButton>
              <BaseButton
                variant="text"
                size="small"
                @click="toggleUserStatus(row)"
              >
                <font-awesome-icon
                  :icon="row.status === 'active' ? 'ban' : 'check'"
                />
              </BaseButton>
              <BaseButton
                variant="text"
                size="small"
                @click="resetPassword(row)"
              >
                <font-awesome-icon icon="key" />
              </BaseButton>
            </div>
          </template>
        </BaseTable>
      </BaseCard>
    </div>
  </div>
</template>

<script setup>
import { columns, useUsers } from './Users.js'

const {
  searchQuery,
  totalUsers,
  filteredUsers,
  editUser,
  toggleUserStatus,
  resetPassword
} = useUsers()
</script>

<style src="./Users.css" scoped></style>
