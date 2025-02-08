import { ref, onMounted } from 'vue'

export function useDashboard() {
  const currentDate = ref('')
  const liveOrders = ref([
    {
      id: 1,
      tableNumber: '3',
      status: '待處理',
      items: [
        { name: '炸雞套餐', quantity: 2 },
        { name: '可樂', quantity: 2 }
      ]
    },
    {
      id: 2,
      tableNumber: '5',
      status: '製作中',
      items: [
        { name: '牛肉麵', quantity: 1 },
        { name: '紅茶', quantity: 1 }
      ]
    },
    {
      id: 3,
      tableNumber: '8',
      status: '待送達',
      items: [
        { name: '滷肉飯', quantity: 1 },
        { name: '味增湯', quantity: 1 }
      ]
    }
  ])

  const popularItemsColumns = [
    { key: 'name', label: '品項', width: '50%' },
    { key: 'quantity', label: '數量', width: '25%' },
    { key: 'trend', label: '趨勢', width: '25%' }
  ]

  const popularItems = [
    { name: '炸雞套餐', quantity: '12份', trend: '↑' },
    { name: '牛肉麵', quantity: '8份', trend: '→' },
    { name: '滷肉飯', quantity: '6份', trend: '↓' }
  ]

  onMounted(() => {
    updateCurrentDate()
    // 每分鐘更新一次時間
    setInterval(updateCurrentDate, 60000)
    // 每5分鐘更新一次數據
    setInterval(refreshData, 300000)
  })

  function updateCurrentDate() {
    const now = new Date()
    const options = { 
      month: 'long',
      day: 'numeric',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit'
    }
    currentDate.value = now.toLocaleDateString('zh-TW', options)
  }

  function refreshItems() {
    // TODO: 實現即時更新熱門品項的邏輯
    console.log('更新熱門品項')
  }

  function refreshData() {
    // TODO: 實現定期更新所有數據的邏輯
    console.log('更新所有數據')
  }

  return {
    currentDate,
    liveOrders,
    popularItemsColumns,
    popularItems,
    refreshItems
  }
}
