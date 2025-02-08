<![CDATA[<template>
  <div class="restaurants-page">
    <header class="page-header">
      <div class="header-main">
        <h1>餐廳管理</h1>
        <BaseTag variant="info" size="medium">
          <font-awesome-icon icon="store" class="mr-1" />
          {{ totalRestaurants }} 家餐廳
        </BaseTag>
      </div>
      <div class="header-actions">
        <BaseButton variant="primary" size="medium" @click="showAddRestaurantModal = true">
          <font-awesome-icon icon="plus" class="mr-1" />
          新增餐廳
        </BaseButton>
      </div>
    </header>

    <div class="restaurants-grid">
      <BaseCard class="restaurant-list" elevation="low">
        <template #header>
          <div class="card-header-content">
            <h3>餐廳列表</h3>
            <div class="search-box">
              <input
                type="text"
                v-model="searchQuery"
                placeholder="搜尋餐廳..."
                class="search-input"
              />
            </div>
          </div>
        </template>

        <div class="restaurants-table">
          <table>
            <thead>
              <tr>
                <th>餐廳名稱</th>
                <th>聯絡人</th>
                <th>電話</th>
                <th>地址</th>
                <th>狀態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="restaurant in filteredRestaurants" :key="restaurant.id">
                <td>
                  <div class="restaurant-name">
                    <font-awesome-icon icon="store" class="mr-2" />
                    {{ restaurant.name }}
                  </div>
                </td>
                <td>{{ restaurant.contact }}</td>
                <td>{{ restaurant.phone }}</td>
                <td>{{ restaurant.address }}</td>
                <td>
                  <BaseTag
                    :variant="restaurant.status === 'active' ? 'success' : 'warning'"
                    size="small"
                  >
                    {{ restaurant.status === 'active' ? '營業中' : '暫停營業' }}
                  </BaseTag>
                </td>
                <td>
                  <div class="action-buttons">
                    <BaseButton
                      variant="text"
                      size="small"
                      @click="editRestaurant(restaurant)"
                    >
                      <font-awesome-icon icon="pen" />
                    </BaseButton>
                    <BaseButton
                      variant="text"
                      size="small"
                      @click="toggleRestaurantStatus(restaurant)"
                    >
                      <font-awesome-icon
                        :icon="restaurant.status === 'active' ? 'pause' : 'play'"
                      />
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

// 模擬餐廳數據
const restaurants = ref([
  {
    id: 1,
    name: '好味餐廳',
    contact: '張小明',
    phone: '0912-345-678',
    address: '台北市中山區中山北路一段1號',
    status: 'active'
  },
  {
    id: 2,
    name: '美食天地',
    contact: '李大華',
    phone: '0923-456-789',
    address: '台北市信義區信義路五段2號',
    status: 'inactive'
  },
  // 更多餐廳...
])

const searchQuery = ref('')
const showAddRestaurantModal = ref(false)
const totalRestaurants = computed(() => restaurants.value.length)

const filteredRestaurants = computed(() => {
  return restaurants.value.filter(restaurant => {
    return restaurant.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
           restaurant.contact.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
           restaurant.phone.includes(searchQuery.value) ||
           restaurant.address.toLowerCase().includes(searchQuery.value.toLowerCase())
  })
})

const editRestaurant = (restaurant) => {
  // TODO: 實現編輯餐廳功能
  console.log('編輯餐廳:', restaurant)
}

const toggleRestaurantStatus = (restaurant) => {
  restaurant.status = restaurant.status === 'active' ? 'inactive' : 'active'
}
</script>

<style scoped>
.restaurants-page {
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

.restaurants-grid {
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

.restaurants-table {
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

.restaurant-name {
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
