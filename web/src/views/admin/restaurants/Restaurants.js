import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { merchantAPI } from '@/services/api'

// 表格列定義
export const columns = [
  { key: 'businessName', label: '餐廳名稱' },
  { key: 'email', label: '電子郵件' },
  { key: 'phone', label: '聯絡電話' },
  { key: 'status', label: '狀態' },
  { key: 'createdAt', label: '註冊時間' },
  { key: 'actions', label: '操作', width: '200px' }
]

export const useUsers = () => {
  const toast = useToast()
  const router = useRouter()
  const searchQuery = ref('')
  const loading = ref(false)
  const error = ref(null)
  
  // 真實的商家數據
  const users = ref([])
  const totalUsers = ref(0)
  const currentPage = ref(1)
  const totalPages = ref(1)

  // 加載商家數據
  const loadMerchants = async (page = 1, search = '') => {
    try {
      loading.value = true
      error.value = null
      
      const params = {
        page,
        limit: 20,
        ...(search && { search })
      }
      
      const response = await merchantAPI.getAllMerchants(params)
      
      if (response.status === 'success') {
        users.value = response.data.merchants.map(merchant => ({
          id: merchant._id,
          businessName: merchant.businessName,
          email: merchant.email,
          phone: merchant.phone,
          status: merchant.status,
          createdAt: new Date(merchant.createdAt).toLocaleDateString('zh-TW'),
          role: 'merchant'
        }))
        
        totalUsers.value = response.data.total
        currentPage.value = response.data.page
        totalPages.value = response.data.pages
      }
    } catch (err) {
      console.error('加載商家數據失敗:', err)
      error.value = '加載商家數據失敗'
      toast.error('加載商家數據失敗')
    } finally {
      loading.value = false
    }
  }

  // 搜索功能
  const handleSearch = () => {
    currentPage.value = 1
    loadMerchants(1, searchQuery.value)
  }

  // 分頁功能
  const handlePageChange = (page) => {
    currentPage.value = page
    loadMerchants(page, searchQuery.value)
  }

  // 過濾後的商家列表
  const filteredUsers = computed(() => {
    if (!searchQuery.value) return users.value
    
    return users.value.filter(user => {
      return user.businessName.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
             user.email.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
             user.phone.includes(searchQuery.value)
    })
  })

  const editUser = (user) => {
    // TODO: 實現編輯商家功能
    console.log('編輯商家:', user)
    toast.info('編輯功能開發中...')
  }

  const toggleUserStatus = async (user) => {
    try {
      const newStatus = user.status === 'active' ? 'suspended' : 'active'
      
      await merchantAPI.updateMerchantStatus(user.id, newStatus)
      
      // 更新本地狀態
      user.status = newStatus
      
      toast.success(`已${newStatus === 'active' ? '啟用' : '停用'}商家 ${user.businessName}`)
    } catch (err) {
      console.error('更新商家狀態失敗:', err)
      toast.error('更新商家狀態失敗')
    }
  }

  const resetPassword = (user) => {
    // TODO: 實現重置密碼功能
    toast.info('重置密碼功能開發中...')
  }

  const goToRestaurant = (user) => {
    // 跳轉到餐廳後台，傳遞餐廳ID和名稱
    if (user.role === 'merchant') {
      const restaurantId = user.id
      const restaurantName = user.businessName
      
      // 使用 router 導航到餐廳後台，傳遞餐廳ID
      router.push({
        name: 'MerchantDashboard',
        query: {
          restaurantId: restaurantId,
          restaurantName: restaurantName
        }
      })
      toast.success(`正在前往 ${restaurantName} 的後台`)
    } else {
      toast.warning('系統管理員無法前往餐廳後台')
    }
  }

  // 初始化時加載數據
  onMounted(() => {
    loadMerchants()
  })

  return {
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
  }
}
