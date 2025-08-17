import { ref, computed, onMounted } from 'vue'
import { useMenu } from './useMenu'

export function useMenuPage() {
  const {
    categories,
    dishes,
    activeCategory,
    loading,
    error,
    loadCategories,
    loadDishes,
    addCategory,
    addDish,
    updateDish,
    removeDish,
    initializeData
  } = useMenu()

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
      // 創建分類數據對象
      const categoryData = {
        name: categoryName.toLowerCase().replace(/\s+/g, '-'),
        label: categoryName,
        description: `${categoryName}類別菜品`
      }
      await addCategory(categoryData)
      showAddCategoryDialog.value = false
    } catch (err) {
      console.error('創建分類失敗:', err)
      // 可以添加錯誤提示
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
        category: currentCategory.value,
        description: menuItem.description || '',
        image: menuItem.image || '',
        customOptions: menuItem.options || [],
        isActive: true
      }

      if (editingItem.value) {
        // 編輯現有菜品
        await updateDish(editingItem.value._id, dishData)
      } else {
        // 添加新菜品
        await addDish(dishData)
      }
      
      editingItem.value = null
      showAddMenuItemDialog.value = false
    } catch (err) {
      console.error('保存菜品失敗:', err)
      // 可以添加錯誤提示
    }
  }

  // 編輯菜品
  const handleEditMenuItem = (categoryId, item) => {
    currentCategory.value = categoryId
    editingItem.value = item
    showAddMenuItemDialog.value = true
  }

  // 刪除菜品
  const handleDeleteMenuItem = async (categoryId, item) => {
    try {
      await removeDish(item._id)
    } catch (err) {
      console.error('刪除菜品失敗:', err)
      // 可以添加錯誤提示
    }
  }

  // 初始化數據
  onMounted(() => {
    initializeData()
  })

  return {
    categories,
    activeCategory,
    menuItems,
    loading,
    error,
    showAddCategoryDialog,
    showAddMenuItemDialog,
    currentCategory,
    editingItem,
    handleAddCategory,
    handleConfirmAddCategory,
    handleAddMenuItem,
    handleConfirmAddMenuItem,
    handleEditMenuItem,
    handleDeleteMenuItem
  }
}
