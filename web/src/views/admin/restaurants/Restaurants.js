import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from '@/composables/useToast'
import { merchantAPI } from '@/services/api'

// 表格列定義
export const columns = [
  { key: 'businessName', label: '餐廳名稱' },
  { key: 'merchantCode', label: '商家代碼' },
  { key: 'restaurantType', label: '餐廳種類' },
  { key: 'ownerEmployeeCode', label: '老闆員工代碼' },
  { key: 'businessPhone', label: '店家電話' },
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
  const isEditDialogOpen = ref(false)
  const editingUser = ref(null)
  
  // 真實的商家數據
  const users = ref([])
  const totalUsers = ref(0)
  const currentPage = ref(1)
  const totalPages = ref(1)

  const sanitizePhoneForDisplay = (value) => {
    const phone = String(value || '').trim()
    if (!phone) return ''
    // 若為全 0 或非數字，視為無電話
    if (/^0+$/.test(phone)) return ''
    // 移除尾部的 0，但保留原始長度
    return phone.replace(/0+$/, '') || phone
  }

  const formatAddress = (address) => {
    if (!address) return ''
    if (typeof address === 'string') return address
    const parts = [address.city, address.district, address.street, address.address]
      .filter(Boolean)
    return parts.join(' ')
  }

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
        users.value = response.data.merchants.map(merchant => {
          const businessPhone = sanitizePhoneForDisplay(merchant.phone || merchant.businessPhone)
          const ownerPhone = sanitizePhoneForDisplay(merchant.owner?.phone || merchant.ownerPhone)
          return {
            id: merchant._id,
            businessName: merchant.businessName,
            merchantCode: merchant.merchantCode,
            restaurantType: merchant.restaurantType || merchant.category || merchant.businessType || '',
            ownerEmployeeCode: merchant.ownerEmployeeCode || '',
            phone: businessPhone,
            businessPhone: businessPhone,
            taxId: merchant.taxId || merchant.vatId || '',
            businessAddress: formatAddress(merchant.address || merchant.businessAddress),
            ownerName: merchant.owner?.name || merchant.ownerName || '',
            ownerPhone: ownerPhone,
            status: merchant.status,
            createdAt: new Date(merchant.createdAt).toLocaleDateString('zh-TW'),
            role: 'merchant'
          }
        })
        
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
      const q = searchQuery.value.toLowerCase()
      return user.businessName.toLowerCase().includes(q) ||
             (user.merchantCode || '').toLowerCase().includes(q) ||
             (user.restaurantType || '').toLowerCase().includes(q) ||
             (user.ownerEmployeeCode || '').toLowerCase().includes(q) ||
             (user.phone || '').includes(searchQuery.value)
    })
  })

  const editUser = (user) => {
    editingUser.value = {
      ...user,
      phone: sanitizePhoneForDisplay(user.phone),
      businessPhone: sanitizePhoneForDisplay(user.businessPhone),
      ownerPhone: sanitizePhoneForDisplay(user.ownerPhone)
    }
    console.log('編輯用戶資料:', editingUser.value)
    isEditDialogOpen.value = true
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

  // 新增商家
  const addMerchant = async (merchantData) => {
    try {
      loading.value = true
      const response = await merchantAPI.createMerchant(merchantData)
      if (response.status === 'success') {
        toast.success('新增餐廳成功')
        // 重新載入列表以取得最新資料
        await loadMerchants(currentPage.value, searchQuery.value)
        // 若後端回傳老闆員工編號，提示管理員記錄
        const generatedCode = response.data?.owner?.employeeCode || response.data?.employeeCode
        if (generatedCode) {
          toast.info(`請記下老闆員工編號：${generatedCode}`)
        }
        return response
      }
      throw new Error(response.message || '新增餐廳失敗')
    } catch (err) {
      console.error('新增商家失敗:', err)
      toast.error(err.message || '新增餐廳失敗')
      throw err
    } finally {
      loading.value = false
    }
  }

  // 刪除商家
  const deleteUser = async (user) => {
    try {
      if (!confirm(`確定要刪除「${user.businessName}」嗎？`)) return
      loading.value = true
      await merchantAPI.deleteMerchant(user.id)
      // 從本地列表移除，或重新載入
      users.value = users.value.filter(u => u.id !== user.id)
      totalUsers.value = Math.max(0, totalUsers.value - 1)
      toast.success('已刪除餐廳')
    } catch (err) {
      console.error('刪除商家失敗:', err)
      toast.error('刪除餐廳失敗')
    } finally {
      loading.value = false
    }
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
          merchantId: restaurantId,
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
    isEditDialogOpen,
    editingUser,
    editUser,
    toggleUserStatus,
    resetPassword,
    deleteUser,
    goToRestaurant,
    handleSearch,
    handlePageChange,
    loadMerchants,
    addMerchant
  }
}
