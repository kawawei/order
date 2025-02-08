import { ref, computed } from 'vue'
import { useToast } from '@/composables/useToast'

// 表格列定義
export const columns = [
  { key: 'name', label: '用戶名稱' },
  { key: 'email', label: '電子郵件' },
  { key: 'role', label: '角色' },
  { key: 'status', label: '狀態' },
  { key: 'lastLogin', label: '最後登入' },
  { key: 'actions', label: '操作', width: '150px' }
]

// 模擬用戶數據
export const users = ref([
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

export const useUsers = () => {
  const toast = useToast()
  const searchQuery = ref('')
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

  return {
    searchQuery,
    totalUsers,
    filteredUsers,
    editUser,
    toggleUserStatus,
    resetPassword
  }
}
