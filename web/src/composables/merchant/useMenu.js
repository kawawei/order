import { ref, onMounted } from 'vue'
import { menuService } from '@/services/api'

const defaultOptions = {
  size: [
    { name: 'large', label: '大份', price: 30 },
    { name: 'small', label: '小份', price: 20 }
  ],
  extra: [
    { name: 'extra_rice', label: '加飯', price: 10 },
    { name: 'extra_noodles', label: '加麵', price: 10 }
  ],
  sugar: [
    { name: 'normal', label: '正常' },
    { name: 'half', label: '半糖' },
    { name: 'less', label: '少糖' },
    { name: 'no', label: '無糖' }
  ]
}

export function useMenu(restaurantId = null) {
  const categories = ref([])
  const dishes = ref([])
  const activeCategory = ref('')
  const loading = ref(false)
  const error = ref(null)

  // 加載分類
  const loadCategories = async () => {
    try {
      loading.value = true
      const params = { isActive: true }
      if (restaurantId) {
        params.merchantId = restaurantId
      }
      console.log('=== loadCategories 調試信息 ===');
      console.log('restaurantId:', restaurantId);
      console.log('params:', params);
      console.log('==============================');
      const response = await menuService.getCategories(params)
      if (response.status === 'success') {
        categories.value = response.data.categories
        if (categories.value.length > 0 && !activeCategory.value) {
          activeCategory.value = categories.value[0]._id
        }
      }
    } catch (err) {
      console.error('加載分類失敗:', err)
      error.value = '加載分類失敗'
    } finally {
      loading.value = false
    }
  }

  // 加載菜品
  const loadDishes = async (categoryId = null) => {
    try {
      loading.value = true
      const params = { isActive: true }
      if (categoryId) {
        params.category = categoryId
      }
      if (restaurantId) {
        params.merchantId = restaurantId
      }
      console.log('=== loadDishes 調試信息 ===');
      console.log('restaurantId:', restaurantId);
      console.log('categoryId:', categoryId);
      console.log('params:', params);
      console.log('==============================');
      const response = await menuService.getDishes(params)
      if (response.status === 'success') {
        dishes.value = response.data.dishes
      }
    } catch (err) {
      console.error('加載菜品失敗:', err)
      error.value = '加載菜品失敗'
    } finally {
      loading.value = false
    }
  }

  // 創建分類
  const addCategory = async (categoryData) => {
    try {
      const response = await menuService.createCategory(categoryData)
      if (response.status === 'success') {
        categories.value.push(response.data.category)
        if (categories.value.length === 1) {
          activeCategory.value = response.data.category._id
        }
        return response.data.category
      }
    } catch (err) {
      console.error('創建分類失敗:', err)
      throw new Error('創建分類失敗')
    }
  }

  // 更新分類
  const updateCategory = async (categoryId, categoryData) => {
    try {
      const response = await menuService.updateCategory(categoryId, categoryData)
      if (response.status === 'success') {
        const index = categories.value.findIndex(c => c._id === categoryId)
        if (index !== -1) {
          categories.value[index] = response.data.category
        }
        return response.data.category
      }
    } catch (err) {
      console.error('更新分類失敗:', err)
      throw new Error('更新分類失敗')
    }
  }

  // 刪除分類
  const removeCategory = async (categoryId) => {
    try {
      await menuService.deleteCategory(categoryId)
      const index = categories.value.findIndex(c => c._id === categoryId)
      if (index !== -1) {
        categories.value.splice(index, 1)
        if (activeCategory.value === categoryId) {
          activeCategory.value = categories.value[0]?._id || ''
        }
      }
    } catch (err) {
      console.error('刪除分類失敗:', err)
      throw new Error('刪除分類失敗')
    }
  }

  // 創建菜品
  const addDish = async (dishData) => {
    try {
      const response = await menuService.createDish(dishData)
      if (response.status === 'success') {
        dishes.value.push(response.data.dish)
        return response.data.dish
      }
    } catch (err) {
      console.error('創建菜品失敗:', err)
      throw new Error('創建菜品失敗')
    }
  }

  // 更新菜品
  const updateDish = async (dishId, dishData) => {
    try {
      const response = await menuService.updateDish(dishId, dishData)
      if (response.status === 'success') {
        const index = dishes.value.findIndex(d => d._id === dishId)
        if (index !== -1) {
          dishes.value[index] = response.data.dish
        }
        return response.data.dish
      }
    } catch (err) {
      console.error('更新菜品失敗:', err)
      throw new Error('更新菜品失敗')
    }
  }

  // 刪除菜品
  const removeDish = async (dishId) => {
    try {
      await menuService.deleteDish(dishId)
      const index = dishes.value.findIndex(d => d._id === dishId)
      if (index !== -1) {
        dishes.value.splice(index, 1)
      }
    } catch (err) {
      console.error('刪除菜品失敗:', err)
      throw new Error('刪除菜品失敗')
    }
  }

  // 批量更新菜品
  const batchUpdateDishes = async (dishIds, updateData) => {
    try {
      const response = await menuService.batchUpdateDishes(dishIds, updateData)
      if (response.status === 'success') {
        // 更新本地數據
        response.data.dishes.forEach(updatedDish => {
          const index = dishes.value.findIndex(d => d._id === updatedDish._id)
          if (index !== -1) {
            dishes.value[index] = updatedDish
          }
        })
        return response.data.dishes
      }
    } catch (err) {
      console.error('批量更新菜品失敗:', err)
      throw new Error('批量更新菜品失敗')
    }
  }

  // 獲取當前分類的菜品
  const getCurrentCategoryDishes = () => {
    if (!activeCategory.value) return []
    return dishes.value.filter(dish => dish.category._id === activeCategory.value)
  }

  // 初始化數據
  const initializeData = async () => {
    await loadCategories()
    await loadDishes()
  }

  return {
    // 響應式數據
    categories,
    dishes,
    activeCategory,
    loading,
    error,
    
    // 方法
    loadCategories,
    loadDishes,
    addCategory,
    updateCategory,
    removeCategory,
    addDish,
    updateDish,
    removeDish,
    batchUpdateDishes,
    getCurrentCategoryDishes,
    initializeData,
    
    // 默認選項
    defaultOptions
  }
}
