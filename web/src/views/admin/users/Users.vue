<![CDATA[<template>
  <div class="users-page">
    <header class="page-header">
      <div class="header-main">
        <h1>用戶管理</h1>
        <BaseTag variant="info" size="medium">
          <font-awesome-icon icon="users" class="mr-1" />
          {{ totalUsers }} 位用戶
        </BaseTag>
      </div>
      <div class="header-actions">
        <BaseButton variant="primary" size="medium" @click="showAddUserModal = true">
          <font-awesome-icon icon="plus" class="mr-1" />
          新增用戶
        </BaseButton>
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

        <div class="users-table">
          <table>
            <thead>
              <tr>
                <th>用戶名稱</th>
                <th>電子郵件</th>
                <th>角色</th>
                <th>狀態</th>
                <th>最後登入</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in filteredUsers" :key="user.id">
                <td>
                  <div class="user-name">
                    <font-awesome-icon :icon="user.role === 'admin' ? 'user-shield' : 'user'" class="mr-2" />
                    {{ user.name }}
                  </div>
                </td>
                <td>{{ user.email }}</td>
                <td>
                  <BaseTag
                    :variant="user.role === 'admin' ? 'warning' : 'info'"
                    size="small"
                  >
                    {{ user.role === 'admin' ? '管理員' : '餐廳管理員' }}
                  </BaseTag>
                </td>
                <td>
                  <BaseTag
                    :variant="user.status === 'active' ? 'success' : 'error'"
                    size="small"
                  >
                    {{ user.status === 'active' ? '啟用' : '停用' }}
                  </BaseTag>
                </td>
                <td>{{ user.lastLogin }}</td>
                <td>
                  <div class="action-buttons">
                    <BaseButton
                      variant="text"
                      size="small"
                      @click="editUser(user)"
                    >
                      <font-awesome-icon icon="pen" />
                    </BaseButton>
                    <BaseButton
                      variant="text"
                      size="small"
                      @click="toggleUserStatus(user)"
                    >
                      <font-awesome-icon
                        :icon="user.status === 'active' ? 'ban' : 'check'"
                      />
                    </BaseButton>
                    <BaseButton
                      variant="text"
                      size="small"
                      @click="resetPassword(user)"
                    >
                      <font-awesome-icon icon="key" />
                    </BaseButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </BaseCard>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useToast } from '../../../composables/useToast'

const toast = useToast()

// 模擬用戶數據
const users = ref([
  {
    id: 1,
    name: '系統管理員',
    email: 'admin@example.com',
    role: 'admin',
    status: 'active',
    lastLogin: '2024-02-08 14:30'
  },
  {
    id: 2,
    name: '張小明',
    email: 'merchant1@example.com',
    role: 'merchant',
    status: 'active',
    lastLogin: '2024-02-08 12:15'
  },
  {
    id: 3,
    name: '李大華',
    email: 'merchant2@example.com',
    role: 'merchant',
    status: 'inactive',
    lastLogin: '2024-02-07 18:45'
  }
])

const searchQuery = ref('')
const showAddUserModal = ref(false)
const totalUsers = computed(() => users.value.length)

const filteredUsers = computed(() => {
  return users.value.filter(user => {
    return user.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
           user.email.toLowerCase().includes(searchQuery.value.toLowerCase())
  })
})

const editUser = (user) => {
  // TODO: 實現編輯用戶功能
  console.log('編輯用戶:', user)
}

const toggleUserStatus = (user) => {
  user.status = user.status === 'active' ? 'inactive' : 'active'
  toast.success(`已${user.status === 'active' ? '啟用' : '停用'}用戶 ${user.name}`)
}

const resetPassword = (user) => {
  // TODO: 實現重置密碼功能
  toast.success(`已發送密碼重置郵件至 ${user.email}`)
}
</script>

<style scoped>
.users-page {
  padding: 1.5rem;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.header-main {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header-main h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.users-grid {
  display: grid;
  gap: 1.5rem;
}

.card-header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-box {
  position: relative;
}

.search-input {
  padding: 0.5rem 1rem;
  border: 1px solid #e5e7eb;
  border-radius: 0.375rem;
  width: 240px;
  font-size: 0.875rem;
}

.users-table {
  width: 100%;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  text-align: left;
  padding: 0.75rem;
  font-weight: 600;
  color: #374151;
  background-color: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}

td {
  padding: 0.75rem;
  border-bottom: 1px solid #e5e7eb;
}

.user-name {
  display: flex;
  align-items: center;
  font-weight: 500;
}

.action-buttons {
  display: flex;
  gap: 0.5rem;
}

.mr-1 {
  margin-right: 0.25rem;
}

.mr-2 {
  margin-right: 0.5rem;
}
</style>]]>
