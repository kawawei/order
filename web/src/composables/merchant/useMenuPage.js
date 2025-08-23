import { ref, computed, onMounted } from 'vue'
import { useMenu } from './useMenu'
import { inventoryService } from '@/services/api'
import { menuAPI } from '@/services/api' // Added import for menuAPI

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
  const showImportImagesDialog = ref(false)
  
  // 範本數據
  const templateData = [
    {
      '品名': '奶茶',
      '分類': '飲料',
      '基礎價格': '30',
      '描述': '香濃奶茶',
      '容量': '容量',
      '容量數量': '1',
      '容量加價': '10',
      '甜度': '果糖',
      '甜度數量': '2',
      '甜度加價': '0',
      '加料': '珍珠',
      '加料數量': '1',
      '加料加價': '5'
    },
    {
      '品名': '綠茶',
      '分類': '飲料',
      '基礎價格': '25',
      '描述': '清香綠茶',
      '容量': '容量',
      '容量數量': '1',
      '容量加價': '0',
      '甜度': '果糖',
      '甜度數量': '1',
      '甜度加價': '0',
      '加料': '',
      '加料數量': '',
      '加料加價': ''
    }
  ]
  
  // 匯入說明
  const importInstructions = [
    '請確保檔案格式正確，支援 Excel (.xlsx) 和 CSV (.csv) 格式',
    '必填欄位：品名、分類、基礎價格',
    '分類名稱必須與現有分類匹配',
    '選項名稱會自動對應庫存原料進行關聯',
    '單一規格庫存（如：果糖）會根據數量欄位扣減',
    '多規格庫存（如：珍珠）會根據選項值對應規格扣減',
    '建議先下載範本檔案進行編輯'
  ]

  // 菜單匯入格式指南
  const menuFormatGuide = [
    {
      name: '品名',
      required: true,
      description: '菜品的基礎名稱',
      example: '奶茶'
    },
    {
      name: '分類',
      required: true,
      description: '菜品所屬的分類',
      example: '飲料'
    },
    {
      name: '基礎價格',
      required: true,
      description: '菜品的基礎價格（數字）',
      example: '30'
    },
    {
      name: '描述',
      required: false,
      description: '菜品的描述',
      example: '香濃奶茶'
    },
    {
      name: '容量',
      required: false,
      description: '容量選項名稱（對應庫存原料）',
      example: '容量'
    },
    {
      name: '容量數量',
      required: false,
      description: '容量選項的數量（用於單一規格庫存扣減）',
      example: '1'
    },
    {
      name: '容量加價',
      required: false,
      description: '容量選項的加價金額',
      example: '10'
    },
    {
      name: '甜度',
      required: false,
      description: '甜度選項名稱（對應庫存原料，如：果糖）',
      example: '果糖'
    },
    {
      name: '甜度數量',
      required: false,
      description: '甜度選項的數量（用於單一規格庫存扣減）',
      example: '2'
    },
    {
      name: '甜度加價',
      required: false,
      description: '甜度選項的加價金額',
      example: '0'
    },
    {
      name: '加料',
      required: false,
      description: '加料選項名稱（對應庫存原料）',
      example: '珍珠'
    },
    {
      name: '加料數量',
      required: false,
      description: '加料選項的數量',
      example: '1'
    },
    {
      name: '加料加價',
      required: false,
      description: '加料選項的加價金額',
      example: '5'
    }
  ]

  // 匯入菜單處理函數
  const handleImportMenu = () => {
    showImportDialog.value = true
  }

  // 處理菜單匯入數據
  const handleImportMenuData = async (file) => {
    console.log('🚀 [菜單匯入] 開始處理檔案:', file.name)
    
    try {
      // 創建 FormData 對象
      const formData = new FormData()
      formData.append('file', file)
      
      // 發送到後端處理
      const response = await menuAPI.importMenu(formData)
      
      if (response.status === 'success') {
        return response.data
      } else {
        throw new Error(response.message || '匯入失敗')
      }
    } catch (error) {
      console.error('❌ [菜單匯入] 匯入失敗:', error)
      throw error
    }
  }

  // 匯入成功處理
  const handleImportSuccess = (result) => {
    console.log('匯入成功:', result)
    // 重新載入數據
    initializePageData()
  }

  // 圖片匯入處理
  const handleImportImages = () => {
    showImportImagesDialog.value = true
  }

  const handleImportImagesSuccess = (result) => {
    console.log('圖片匯入成功:', result)
    // 重新載入數據以顯示新圖片
    initializePageData()
  }

  
  
  // 處理選項和庫存關聯
  const processOptionsAndInventory = async (options) => {
    console.log('🔍 [庫存關聯] 開始處理選項和庫存關聯...')
    
    if (!options || options.length === 0) {
      console.log('ℹ️ [庫存關聯] 無選項需要處理')
      return []
    }
    
    const processedOptions = []
    
    for (const option of options) {
      console.log(`🔍 [庫存關聯] 處理選項: ${option.name}`)
      
      // 檢查庫存中是否存在對應的原料
      const inventoryItem = availableInventory.value.find(inv => 
        inv.name === option.name || inv.label === option.name
      )
      
      if (inventoryItem) {
        console.log(`✅ [庫存關聯] 找到庫存項目: ${inventoryItem.name}`)
        
        // 檢查是否為多規格庫存
        if (inventoryItem.specifications && inventoryItem.specifications.length > 0) {
          console.log(`📦 [庫存關聯] 多規格庫存: ${inventoryItem.name}`)
          
          const processedValues = option.values.map(value => {
            // 查找對應的規格
            const spec = inventoryItem.specifications.find(s => 
              s.name === value.value || s.label === value.value
            )
            
            if (spec) {
              console.log(`✅ [庫存關聯] 找到規格: ${spec.name}`)
              return {
                ...value,
                inventoryId: inventoryItem._id,
                specificationId: spec._id,
                inventoryType: 'multi-spec'
              }
            } else {
              console.warn(`⚠️ [庫存關聯] 未找到規格: ${value.value}`)
              return {
                ...value,
                inventoryId: inventoryItem._id,
                inventoryType: 'multi-spec'
              }
            }
          })
          
          processedOptions.push({
            ...option,
            values: processedValues,
            inventoryId: inventoryItem._id,
            inventoryType: 'multi-spec'
          })
        } else {
          console.log(`📦 [庫存關聯] 單一規格庫存: ${inventoryItem.name}`)
          
          const processedValues = option.values.map(value => ({
            ...value,
            inventoryId: inventoryItem._id,
            inventoryType: 'single-spec'
          }))
          
          processedOptions.push({
            ...option,
            values: processedValues,
            inventoryId: inventoryItem._id,
            inventoryType: 'single-spec'
          })
        }
      } else {
        console.warn(`⚠️ [庫存關聯] 未找到庫存項目: ${option.name}`)
        
        // 即使沒有找到庫存項目，也要保留選項（可能用於顯示）
        processedOptions.push({
          ...option,
          inventoryId: null,
          inventoryType: 'none'
        })
      }
    }
    
    console.log('✅ [庫存關聯] 處理完成:', processedOptions)
    return processedOptions
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
    templateData,
    handleImportMenuData,
    handleImportSuccess,
    handleImportImages,
    showImportImagesDialog,
    handleImportImagesSuccess,
    loadAvailableInventory
  }
}
