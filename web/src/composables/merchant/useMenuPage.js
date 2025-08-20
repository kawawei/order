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
        // 傳遞原始檔案，以便 multipart 上傳 - send File for multipart
        image: menuItem.imageFile || null,
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

  // 匯入相關狀態
  const showImportDialog = ref(false)
  
  // 匯入說明
  const importInstructions = [
    '請確保檔案包含所有必填欄位',
    '菜品名稱不能重複',
    '價格必須為數字格式',
    '分類名稱必須與現有分類匹配',
    '建議先下載範本檔案進行編輯'
  ]

  // 菜單匯入格式指南
  const menuFormatGuide = [
    {
      name: '菜品名稱',
      required: true,
      description: '菜品的顯示名稱',
      example: '宮保雞丁'
    },
    {
      name: '分類',
      required: true,
      description: '菜品所屬分類',
      example: '主菜'
    },
    {
      name: '價格',
      required: true,
      description: '菜品價格（數字）',
      example: '120'
    },
    {
      name: '描述',
      required: false,
      description: '菜品詳細描述',
      example: '經典川菜，雞肉配花生'
    },
    {
      name: '庫存配置',
      required: false,
      description: '庫存扣減配置（JSON格式）',
      example: '{"雞肉":1,"花生":0.5}'
    }
  ]

  // 匯入菜單處理函數
  const handleImportMenu = () => {
    showImportDialog.value = true
  }

  // 處理菜單匯入數據
  const handleImportMenuData = async (file) => {
    try {
      // 讀取檔案內容
      const data = await readFileContent(file)
      
      // 解析數據
      const menuItems = parseMenuData(data)
      
      // 驗證數據
      const validationResult = validateMenuData(menuItems)
      if (!validationResult.valid) {
        throw new Error(`數據驗證失敗：${validationResult.errors.join(', ')}`)
      }

      // 執行匯入
      const result = await importMenuItems(menuItems)
      
      return {
        created: result.created,
        updated: result.updated,
        failed: result.failed,
        results: result.results
      }
    } catch (error) {
      console.error('匯入失敗:', error)
      throw error
    }
  }

  // 匯入成功處理
  const handleImportSuccess = (result) => {
    console.log('匯入成功:', result)
    // 重新載入數據
    initializePageData()
  }

  // 讀取檔案內容
  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const content = e.target.result
          if (file.name.toLowerCase().endsWith('.csv')) {
            resolve(parseCSV(content))
          } else {
            // Excel 檔案處理
            resolve(parseExcel(content))
          }
        } catch (error) {
          reject(error)
        }
      }
      
      reader.onerror = () => reject(new Error('讀取檔案失敗'))
      
      if (file.name.toLowerCase().endsWith('.csv')) {
        reader.readAsText(file)
      } else {
        reader.readAsArrayBuffer(file)
      }
    })
  }

  // 解析 CSV
  const parseCSV = (csvText) => {
    const lines = csvText.split('\n')
    if (lines.length < 2) return []

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    const data = []

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim()) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
        const row = {}
        headers.forEach((header, index) => {
          row[header] = values[index] || ''
        })
        data.push(row)
      }
    }

    return data
  }

  // 解析 Excel（簡化版本）
  const parseExcel = (data) => {
    // 這裡需要額外的 xlsx 庫支援
    console.warn('Excel 解析需要額外的 xlsx 庫支援')
    return []
  }

  // 解析菜單數據
  const parseMenuData = (data) => {
    return data.map(row => ({
      name: row['菜品名稱'] || row['name'] || '',
      category: row['分類'] || row['category'] || '',
      price: parseFloat(row['價格'] || row['price'] || 0),
      description: row['描述'] || row['description'] || '',
      inventoryConfig: row['庫存配置'] || row['inventoryConfig'] || '{}'
    }))
  }

  // 驗證菜單數據
  const validateMenuData = (menuItems) => {
    const errors = []
    
    menuItems.forEach((item, index) => {
      if (!item.name.trim()) {
        errors.push(`第 ${index + 1} 行：菜品名稱不能為空`)
      }
      if (!item.category.trim()) {
        errors.push(`第 ${index + 1} 行：分類不能為空`)
      }
      if (isNaN(item.price) || item.price <= 0) {
        errors.push(`第 ${index + 1} 行：價格必須為正數`)
      }
      
      // 檢查分類是否存在
      const categoryExists = categories.value.some(cat => 
        cat.label === item.category || cat.name === item.category
      )
      if (!categoryExists) {
        errors.push(`第 ${index + 1} 行：分類「${item.category}」不存在`)
      }
    })

    return {
      valid: errors.length === 0,
      errors
    }
  }

  // 匯入菜單項目
  const importMenuItems = async (menuItems) => {
    const result = {
      created: 0,
      updated: 0,
      failed: 0,
      results: []
    }

    for (const item of menuItems) {
      try {
        // 查找對應的分類
        const category = categories.value.find(cat => 
          cat.label === item.category || cat.name === item.category
        )
        
        if (!category) {
          result.failed++
          result.results.push({
            name: item.name,
            category: item.category,
            success: false,
            error: '分類不存在'
          })
          continue
        }

        // 檢查是否已存在相同名稱的菜品
        const existingDish = dishes.value.find(dish => 
          dish.name === item.name && dish.category._id === category._id
        )

        const dishData = {
          name: item.name,
          price: item.price,
          description: item.description,
          category: category._id,
          inventoryConfig: item.inventoryConfig
        }

        if (existingDish) {
          // 更新現有菜品
          await updateDish(existingDish._id, dishData)
          result.updated++
          result.results.push({
            name: item.name,
            category: item.category,
            success: true,
            action: 'updated'
          })
        } else {
          // 創建新菜品
          await addDish(dishData)
          result.created++
          result.results.push({
            name: item.name,
            category: item.category,
            success: true,
            action: 'created'
          })
        }
      } catch (error) {
        result.failed++
        result.results.push({
          name: item.name,
          category: item.category,
          success: false,
          error: error.message || '未知錯誤'
        })
      }
    }

    return result
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
    handleImportMenu,
    showImportDialog,
    importInstructions,
    menuFormatGuide,
    handleImportMenuData,
    handleImportSuccess,
    loadAvailableInventory
  }
}
