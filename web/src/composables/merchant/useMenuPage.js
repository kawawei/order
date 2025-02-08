import { ref } from 'vue'
import { useMenu } from './useMenu'

const generateId = () => {
  return Math.floor(Math.random() * 10000)
}

export function useMenuPage() {
  const {
    categories,
    activeCategory,
    addCategory,
    menuItems
  } = useMenu()

  // 對話框控制
  const showAddCategoryDialog = ref(false)

  const handleAddCategory = () => {
    showAddCategoryDialog.value = true
  }

  const handleConfirmAddCategory = (categoryName) => {
    addCategory(categoryName)
  }

  const showAddMenuItemDialog = ref(false)
  const currentCategory = ref('rice')

  const handleAddMenuItem = (categoryName) => {
    currentCategory.value = categoryName
    showAddMenuItemDialog.value = true
  }

  const handleConfirmAddMenuItem = (menuItem) => {
    if (menuItems.value[currentCategory.value]) {
      if (editingItem.value) {
        // 編輯現有菜品
        const index = menuItems.value[currentCategory.value].findIndex(i => i.id === editingItem.value.id)
        if (index !== -1) {
          menuItems.value[currentCategory.value][index] = {
            ...editingItem.value,
            name: menuItem.name,
            image: menuItem.image,
            basePrice: Number(menuItem.basePrice),
            options: menuItem.options
          }
        }
      } else {
        // 添加新的菜品
        menuItems.value[currentCategory.value].push({
          id: generateId(),
          name: menuItem.name,
          image: menuItem.image,
          basePrice: Number(menuItem.basePrice),
          options: menuItem.options
        })
      }
    }
    editingItem.value = null
    showAddMenuItemDialog.value = false
  }

  const editingItem = ref(null)

  // 編輯菜品
  const handleEditMenuItem = (categoryName, item) => {
    currentCategory.value = categoryName
    editingItem.value = item
    showAddMenuItemDialog.value = true
  }

  // 刪除菜品
  const handleDeleteMenuItem = (categoryName, item) => {
    if (menuItems.value[categoryName]) {
      const index = menuItems.value[categoryName].findIndex(i => i.id === item.id)
      if (index !== -1) {
        menuItems.value[categoryName].splice(index, 1)
      }
    }
  }

  return {
    categories,
    activeCategory,
    menuItems,
    showAddCategoryDialog,
    showAddMenuItemDialog,
    handleAddCategory,
    handleConfirmAddCategory,
    handleAddMenuItem,
    handleConfirmAddMenuItem,
    handleEditMenuItem,
    handleDeleteMenuItem,
    currentCategory,
    editingItem
  }
}
