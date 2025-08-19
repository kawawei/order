import { ref, computed, onMounted } from 'vue'
import { useMenu } from './useMenu'
import { inventoryService } from '@/services/api'

export function useMenuPage(restaurantId = null) {
  const {
    categories,
    dishes,
    activeCategory,
    loading,
    error,
    loadCategories,
    loadDishes,
    addCategory,
    updateCategory,
    removeCategory,
    addDish,
    updateDish,
    removeDish,
    initializeData
  } = useMenu(restaurantId)

  // 庫存相關
  const availableInventory = ref([])
  const inventoryLoading = ref(false)

  // 加載可用庫存
  const loadAvailableInventory = async () => {
    try {
      inventoryLoading.value = true
      const response = await inventoryService.getInventory()
      if (response.status === 'success') {
        availableInventory.value = response.data.inventory || []
      }
    } catch (err) {
      console.error('加載庫存失敗:', err)
    } finally {
      inventoryLoading.value = false
    }
  }

  // 根據分類組織菜品數據
  const menuItems = computed(() => {
    const organized = {}
    categories.value.forEach(category => {
      organized[category._id] = dishes.value.filter(dish => 
        dish.category && dish.category._id === category._id
      )
    })
    return organized
  })

  // 對話框控制
  const showAddCategoryDialog = ref(false)

  const handleAddCategory = () => {
    showAddCategoryDialog.value = true
  }

  const handleConfirmAddCategory = async (categoryName) => {
    try {
      // 創建分類數據對象 - Create category data object
      // 生成唯一的 name，使用時間戳確保唯一性
      const timestamp = Date.now()
      const categoryData = {
        name: `${categoryName.trim().replace(/\s+/g, '-')}-${timestamp}`,
        label: categoryName,
        description: `${categoryName}類別菜品`
      }
      await addCategory(categoryData)
      showAddCategoryDialog.value = false
    } catch (err) {
      console.error('創建分類失敗:', err)
      // 可以添加錯誤提示 - Can add error notification
    }
  }

  // 更新種類 - Update category
  const handleUpdateCategory = async (updateData) => {
    try {
      const categoryData = {
        name: updateData.name.toLowerCase().replace(/\s+/g, '-'),
        label: updateData.name,
        description: `${updateData.name}類別菜品`
      }
      await updateCategory(updateData.id, categoryData)
      showAddCategoryDialog.value = false
    } catch (err) {
      console.error('更新分類失敗:', err)
      // 可以添加錯誤提示 - Can add error notification
    }
  }

  // 刪除種類 - Delete category
  const handleDeleteCategory = async (categoryId) => {
    try {
      await removeCategory(categoryId)
      showAddCategoryDialog.value = false
    } catch (err) {
      console.error('刪除分類失敗:', err)
      // 可以添加錯誤提示 - Can add error notification
    }
  }

  const showAddMenuItemDialog = ref(false)
  const currentCategory = ref('')
  const editingItem = ref(null)

  const handleAddMenuItem = (categoryId) => {
    currentCategory.value = categoryId
    editingItem.value = null
    showAddMenuItemDialog.value = true
  }

  const handleConfirmAddMenuItem = async (menuItem) => {
    try {
      // 準備菜品數據
      const dishData = {
        name: menuItem.name,
        price: Number(menuItem.basePrice),
        description: menuItem.description,
        image: menuItem.image,
        category: currentCategory.value,
        customOptions: menuItem.options,
        inventoryConfig: menuItem.inventoryConfig
      }

      if (editingItem.value) {
        // 更新現有菜品
        await updateDish(editingItem.value._id, dishData)
      } else {
        // 創建新菜品
        await addDish(dishData)
      }

      showAddMenuItemDialog.value = false
      editingItem.value = null
    } catch (err) {
      console.error('保存菜品失敗:', err)
      // 可以添加錯誤提示
    }
  }

  const handleEditMenuItem = (categoryId, item) => {
    currentCategory.value = categoryId
    editingItem.value = item
    showAddMenuItemDialog.value = true
  }

  const handleDeleteMenuItem = async (categoryId, item) => {
    if (confirm(`確定要刪除「${item.name}」嗎？`)) {
      try {
        await removeDish(item._id)
      } catch (err) {
        console.error('刪除菜品失敗:', err)
        // 可以添加錯誤提示
      }
    }
  }

  // 初始化數據
  const initializePageData = async () => {
    await Promise.all([
      initializeData(),
      loadAvailableInventory()
    ])
  }

  // 組件掛載時初始化
  onMounted(() => {
    initializePageData()
  })

  return {
    categories,
    activeCategory,
    menuItems,
    loading,
    error,
    availableInventory,
    inventoryLoading,
    showAddCategoryDialog,
    showAddMenuItemDialog,
    currentCategory,
    editingItem,
    handleAddCategory,
    handleConfirmAddCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    handleAddMenuItem,
    handleConfirmAddMenuItem,
    handleEditMenuItem,
    handleDeleteMenuItem,
    loadAvailableInventory
  }
}
