import { ref, onMounted } from 'vue'
import BaseCard from '@/components/base/BaseCard.vue'

export default {
  name: 'AdminDashboard',
  components: {
    BaseCard
  },
  setup() {
    // 模擬數據
    const stats = ref({
      totalRestaurants: 156,
      newRestaurants: 12,
      activeRestaurants: 98,
      totalUsers: 1234,
      activeUsers: 856,
      newUsers: 45,
      uptime: '15 天 6 小時',
      cpuUsage: 35,
      memoryUsage: 42
    })

    const lastLoginTime = ref('2024-02-08 15:30:25')

    onMounted(() => {
      // 這裡可以添加實際的數據獲取邏輯
    })

    return {
      stats,
      lastLoginTime
    }
  }
}
