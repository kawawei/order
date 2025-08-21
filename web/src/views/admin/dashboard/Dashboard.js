import { ref, onMounted, computed, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { adminDashboardAPI, merchantAPI } from '@/services/api'
import { useToast } from '@/composables/useToast'

export default {
  name: 'AdminDashboard',
      setup() {
      const router = useRouter()
      const { error: showToast } = useToast()
      const loading = ref(false)
    const stats = ref({
      todayOrders: 0,
      todayRevenue: 0,
      totalRevenue: 0,
      popularRestaurants: [],
      restaurantRevenue: [],
      activeTables: [],
      profitMargin: 0
    })

    // 新增的響應式數據
    const userInfo = ref({
      name: 'superadmin',
      role: '系統管理員'
    })

    const currentDate = ref('')
    const totalActiveTables = ref(0)
    const totalTables = ref(0)



    // 計算屬性
    const lastLoginTime = computed(() => {
      const now = new Date()
      return now.toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      })
    })

    // 方法
    const getRestaurantRevenue = (restaurantId) => {
      const restaurant = stats.value.restaurantRevenue.find(r => r.id === restaurantId)
      return restaurant ? restaurant.revenue : 0
    }

    const getMaxTables = (restaurantId) => {
      // 從後端獲取的真實桌位數據
      const restaurant = stats.value.activeTables.find(r => r.id === restaurantId)
      return restaurant ? restaurant.totalTables : 0
    }

    const updateTableStats = () => {
      totalActiveTables.value = stats.value.activeTables.reduce((sum, restaurant) => sum + restaurant.activeTables, 0)
      totalTables.value = stats.value.activeTables.reduce((sum, restaurant) => sum + restaurant.totalTables, 0)
    }





    // 獲取儀表板數據
    const fetchDashboardStats = async () => {
      try {
        loading.value = true
        
        console.log('=== 開始比較兩個 API 的數據 ===')
        
        // 1. 獲取餐廳管理 API 數據
        console.log('1. 調用餐廳管理 API...')
        const merchantParams = {
          page: 1,
          limit: 100,
          status: 'all'
        }
        const merchantResponse = await merchantAPI.getAllMerchants(merchantParams)
        
        console.log('=== 餐廳管理 API 結果 ===')
        console.log('餐廳管理 API 回應:', merchantResponse)
        console.log('返回的餐廳數量:', merchantResponse.data.merchants.length)
        console.log('總餐廳數量:', merchantResponse.data.total)
        
        // 詳細的餐廳信息
        if (merchantResponse.data.merchants && merchantResponse.data.merchants.length > 0) {
          console.log('=== 餐廳管理詳細列表 ===')
          let totalTablesInMerchant = 0
          merchantResponse.data.merchants.forEach((merchant, index) => {
            console.log(`${index + 1}. ${merchant.businessName} (ID: ${merchant._id})`)
            console.log(`   狀態: ${merchant.status}`)
            console.log(`   桌次數量: ${merchant.tableCount || '未設定'}`)
            totalTablesInMerchant += merchant.tableCount || 0
          })
          console.log(`餐廳管理總桌數: ${totalTablesInMerchant}`)
          console.log('=== 餐廳管理列表結束 ===')
        }
        
        // 2. 獲取儀表板 API 數據
        console.log('2. 調用儀表板 API...')
        const statsResponse = await adminDashboardAPI.getDashboardStats()
        const statsData = statsResponse.data
        
        console.log('=== 儀表板 API 結果 ===')
        console.log('儀表板 API 回應:', statsResponse)
        console.log('桌次統計餐廳數量:', statsData.restaurants?.activeTables?.length || 0)
        console.log('營收統計餐廳數量:', statsData.restaurants?.restaurantRevenue?.length || 0)
        console.log('熱門餐廳數量:', statsData.restaurants?.popularRestaurants?.length || 0)
        
        // 詳細的桌次統計信息
        if (statsData.restaurants?.activeTables && statsData.restaurants.activeTables.length > 0) {
          console.log('=== 儀表板桌次統計詳細列表 ===')
          let totalTablesInStats = 0
          statsData.restaurants.activeTables.forEach((restaurant, index) => {
            console.log(`${index + 1}. ${restaurant.name} (ID: ${restaurant.id})`)
            console.log(`   使用中桌次: ${restaurant.activeTables}`)
            console.log(`   總桌次: ${restaurant.totalTables}`)
            totalTablesInStats += restaurant.totalTables || 0
          })
          console.log(`儀表板桌次統計總桌數: ${totalTablesInStats}`)
          console.log('=== 儀表板桌次統計結束 ===')
        }
        
        // 3. 比較兩個 API 的結果
        console.log('=== API 數據比較 ===')
        console.log(`餐廳管理 API 餐廳數量: ${merchantResponse.data.merchants.length}`)
        console.log(`儀表板 API 桌次統計餐廳數量: ${statsData.restaurants?.activeTables?.length || 0}`)
        console.log(`餐廳管理 API 總桌數: ${merchantResponse.data.merchants.reduce((sum, m) => sum + (m.tableCount || 0), 0)}`)
        console.log(`儀表板 API 總桌數: ${statsData.restaurants?.activeTables?.reduce((sum, r) => sum + (r.totalTables || 0), 0) || 0}`)
        
        // 檢查餐廳名稱是否匹配
        const merchantNames = merchantResponse.data.merchants.map(m => m.businessName).sort()
        const dashboardNames = (statsData.restaurants?.activeTables || []).map(r => r.name).sort()
        
        console.log('餐廳管理 API 餐廳名稱:', merchantNames)
        console.log('儀表板 API 餐廳名稱:', dashboardNames)
        
        const missingInDashboard = merchantNames.filter(name => !dashboardNames.includes(name))
        const missingInMerchant = dashboardNames.filter(name => !merchantNames.includes(name))
        
        if (missingInDashboard.length > 0) {
          console.log('在儀表板中缺失的餐廳:', missingInDashboard)
        }
        if (missingInMerchant.length > 0) {
          console.log('在餐廳管理中缺失的餐廳:', missingInMerchant)
        }
        
        console.log('=== API 數據比較結束 ===')
        
        // 更新統計數據
        stats.value = {
          todayOrders: statsData.orders?.todayOrders || 0,
          todayRevenue: statsData.orders?.todayRevenue || 0,
          totalRevenue: statsData.orders?.totalRevenue || 0,
          popularRestaurants: statsData.restaurants?.popularRestaurants || [],
          restaurantRevenue: statsData.restaurants?.restaurantRevenue || [],
          activeTables: statsData.restaurants?.activeTables || [],
          profitMargin: statsData.analytics?.profitMargin || 0
        }
        
        // 更新相關統計
        updateTableStats()
        
      } catch (error) {
        console.error('獲取儀表板數據失敗:', error)
        showToast('獲取儀表板數據失敗', 'error')
        
        // 使用模擬數據進行測試
        stats.value = {
          todayOrders: 156,
          todayRevenue: 125000,
          totalRevenue: 125000,
          popularRestaurants: [
            { id: 1, name: '台北美食館', orderCount: 45 },
            { id: 2, name: '高雄海鮮餐廳', orderCount: 38 },
            { id: 3, name: '台中燒烤店', orderCount: 32 },
            { id: 4, name: '台南小吃店', orderCount: 28 },
            { id: 5, name: '新竹客家菜', orderCount: 13 }
          ],
          restaurantRevenue: [
            { id: 1, name: '台北美食館', revenue: 45000, percentage: 36 },
            { id: 2, name: '高雄海鮮餐廳', revenue: 38000, percentage: 30 },
            { id: 3, name: '台中燒烤店', revenue: 25000, percentage: 20 },
            { id: 4, name: '台南小吃店', revenue: 12000, percentage: 10 },
            { id: 5, name: '新竹客家菜', revenue: 5000, percentage: 4 }
          ],
          activeTables: [
            { id: 1, name: '台北美食館', activeTables: 12 },
            { id: 2, name: '高雄海鮮餐廳', activeTables: 8 },
            { id: 3, name: '台中燒烤店', activeTables: 15 },
            { id: 4, name: '台南小吃店', activeTables: 6 },
            { id: 5, name: '新竹客家菜', activeTables: 4 }
          ],
          profitMargin: 68.5
        }
        
        // 更新相關統計
        updateTableStats()
      } finally {
        loading.value = false
      }
    }

    // 快速操作按鈕處理函數
    const handleViewReports = () => {
      router.push('/admin/reports')
    }

    const handleManageUsers = () => {
      router.push('/admin/restaurants')
    }

    // 初始化
    onMounted(() => {
      // 設置當前日期
      const now = new Date()
      currentDate.value = now.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      })
      
      // 獲取數據
      fetchDashboardStats()
    })

    return {
      loading,
      stats,
      userInfo,
      currentDate,
      lastLoginTime,
      totalActiveTables,
      totalTables,
      getRestaurantRevenue,
      getMaxTables,
      fetchDashboardStats,
      handleViewReports,
      handleManageUsers
    }
  }
}
