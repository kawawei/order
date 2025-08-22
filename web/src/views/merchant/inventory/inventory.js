import { ref, computed, onMounted } from 'vue'
import { inventoryAPI, inventoryCategoryAPI } from '@/services/api'

// 響應式數據
const searchQuery = ref('')
const selectedCategory = ref('')
const showAddModal = ref(false)
const showEditModal = ref(false)
const showStockModal = ref(false)
const showCategoryModal = ref(false)
const showCategoryEditModal = ref(false)
const showImportModal = ref(false)
const selectedItem = ref(null)
const selectedCategoryForEdit = ref(null)
const loading = ref(false)
const error = ref(null)

// 表單數據
const formData = ref({
  name: '',
  description: '',
  category: '',
  type: 'single',
  singleStock: {
    quantity: 0,
    unit: '',
    minStock: 0,
    maxStock: 1000
  },
  multiSpecStock: [],
  cost: {
    unitPrice: 0,
    currency: 'TWD'
  },
  status: 'active',
  isActive: true,
  stockAlert: {
    enabled: true,
    threshold: 10
  },
  notes: ''
})

const stockForm = ref({
  type: 'add',
  quantity: 0,
  reason: '',
  variantIndex: 0
})

const categoryForm = ref({
  name: '',
  description: '',
  icon: ''
})

const importForm = ref({
  file: null,
  preview: [],
  removeMissing: false // 是否刪除不在Excel中的項目
})

// 匯入相關狀態
const importing = ref(false)
const importResult = ref(null)
const fileInput = ref(null)

// 庫存數據
const inventoryItems = ref([])
const stats = ref({
  totalItems: 0,
  activeItems: 0,
  singleTypeItems: 0,
  multiSpecItems: 0,
  outOfStockItems: 0,
  lowStockItems: 0
})
const categories = ref([])

// 計算屬性
const filteredItems = computed(() => {
  let items = inventoryItems.value

  if (searchQuery.value) {
    items = items.filter(item => 
      item.name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.value.toLowerCase())
    )
  }

  if (selectedCategory.value) {
    items = items.filter(item => item.category === selectedCategory.value)
  }

  return items
})

const totalItems = computed(() => stats.value.totalItems)
const lowStockItems = computed(() => stats.value.lowStockItems)
const outOfStockItems = computed(() => stats.value.outOfStockItems)
const totalValue = computed(() => {
  return inventoryItems.value.reduce((sum, item) => {
    if (item.type === 'single') {
      return sum + (item.cost.unitPrice * item.singleStock.quantity)
    } else if (item.type === 'multiSpec') {
      return sum + item.multiSpecStock.reduce((vSum, v) => vSum + (v.unitPrice * v.quantity), 0)
    }
    return sum
  }, 0)
})

const stockPlaceholder = computed(() => {
  if (stockForm.value.type === 'set') {
    return '設定新的庫存數量'
  }
  return '輸入調整數量'
})

// 方法
const loadInventory = async () => {
  try {
    loading.value = true
    error.value = null
    
    const [inventoryResponse, statsResponse] = await Promise.all([
      inventoryAPI.getAllInventory(),
      inventoryAPI.getInventoryStats()
    ])
    
    inventoryItems.value = inventoryResponse.data.inventory || []
    stats.value = statsResponse.data.overview || {}
    
    // 調試：打印所有商品的庫存狀態
    console.log(`[DEBUG] 總共有 ${inventoryItems.value.length} 個商品`)
    inventoryItems.value.forEach((item, index) => {
      console.log(`[DEBUG] 商品 ${index + 1}: ${item.name}, 類型: ${item.type}`)
      if (item.type === 'single') {
        console.log(`  - 庫存: ${item.singleStock.quantity}, 最低庫存: ${item.singleStock.minStock}`)
      } else if (item.type === 'multiSpec') {
        item.multiSpecStock.forEach(spec => {
          console.log(`  - 規格 ${spec.specName}: 庫存 ${spec.quantity}, 最低庫存 ${spec.minStock}`)
        })
      }
    })
    
    // 嘗試載入新的分類管理系統
    try {
      const categoriesResponse = await inventoryCategoryAPI.getAllCategories()
      if (categoriesResponse.data.categories && categoriesResponse.data.categories.length > 0) {
        categories.value = [
          { value: '', label: '全部' },
          ...categoriesResponse.data.categories.map(cat => ({
            value: cat.name,
            label: cat.name,
            id: cat._id,
            description: cat.description,
            color: cat.color,
            isSystem: cat.isSystem
          }))
        ]
      } else {
        // 如果沒有分類，嘗試初始化系統預設分類
        await initializeSystemCategories()
      }
    } catch (err) {
      console.log('使用舊的分類系統')
      // 回退到舊的分類系統
      const categoriesResponse = await inventoryAPI.getInventoryCategories()
      categories.value = [
        { value: '', label: '全部' },
        ...(categoriesResponse.data.categories || []).map(cat => ({
          value: cat.name,
          label: cat.name,
          id: cat._id,
          description: cat.description,
          color: cat.color,
          isSystem: cat.isSystem
        }))
      ]
    }
  } catch (err) {
    console.error('載入庫存失敗:', err)
    error.value = err.message || '載入庫存失敗'
  } finally {
    loading.value = false
  }
}

// 初始化系統預設分類
const initializeSystemCategories = async () => {
  try {
    await inventoryCategoryAPI.initializeSystemCategories()
    const categoriesResponse = await inventoryCategoryAPI.getAllCategories()
    categories.value = [
      { value: '', label: '全部' },
      ...categoriesResponse.data.categories.map(cat => ({
        value: cat.name,
        label: cat.name,
        id: cat._id,
        description: cat.description,
        color: cat.color,
        isSystem: cat.isSystem
      }))
    ]
  } catch (err) {
    console.error('初始化系統分類失敗:', err)
  }
}

// 篩選方法
const filterByCategory = (category) => {
  selectedCategory.value = category
}

// 顯示方法
const getCategoryLabel = (category) => {
  const cat = categories.value.find(c => c.value === category)
  return cat ? cat.label : category
}

const getCategoryClass = (category) => {
  const cat = categories.value.find(c => c.value === category)
  return cat?.color || 'default'
}

const hasVariants = (item) => {
  return item.type === 'multiSpec' && item.multiSpecStock && item.multiSpecStock.length > 1
}

const getTotalQuantity = (item) => {
  if (item.type === 'single') {
    return item.singleStock.quantity
  } else if (item.type === 'multiSpec') {
    return item.multiSpecStock.reduce((sum, spec) => sum + spec.quantity, 0)
  }
  return 0
}

const getVariantCostRangeText = (item) => {
  if (item.type === 'multiSpec' && item.multiSpecStock.length > 0) {
    const prices = item.multiSpecStock.map(spec => spec.unitPrice)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    if (minPrice === maxPrice) {
      return `$${minPrice.toFixed(2)}`
    }
    return `$${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}`
  }
  return ''
}

const getQuantityClass = (item) => {
  const totalQuantity = getTotalQuantity(item)
  if (totalQuantity === 0) return 'out-of-stock'
  if (item.type === 'single') {
    return totalQuantity < item.singleStock.minStock ? 'low-stock' : 'normal'
  } else if (item.type === 'multiSpec') {
    const hasLowStock = item.multiSpecStock.some(spec => spec.quantity < spec.minStock)
    return hasLowStock ? 'low-stock' : 'normal'
  }
  return 'normal'
}

const getStatusClass = (item) => {
  if (!item.isActive) return 'inactive'
  if (item.status === 'discontinued') return 'discontinued'
  
  if (item.type === 'single') {
    const totalQuantity = getTotalQuantity(item)
    
    if (totalQuantity === 0) {
      return 'danger' // 缺貨時顯示紅色
    }
    
    const minStock = item.singleStock.minStock
    const isLowStock = totalQuantity <= minStock
    return isLowStock ? 'warning' : 'success'
  } else if (item.type === 'multiSpec') {
    // 先檢查是否有任何規格缺貨
    const hasOutOfStock = item.multiSpecStock.some(spec => spec.quantity === 0)
    if (hasOutOfStock) {
      return 'danger' // 缺貨時顯示紅色
    }
    
    // 再檢查是否有任何規格庫存不足
    const hasLowStock = item.multiSpecStock.some(spec => spec.quantity <= spec.minStock)
    return hasLowStock ? 'warning' : 'success'
  }
  
  return 'success'
}

const getStatusText = (item) => {
  console.log(`[DEBUG] 計算狀態文字 - 商品: ${item.name}, 類型: ${item.type}, 啟用狀態: ${item.isActive}, 商品狀態: ${item.status}`)
  
  if (!item.isActive) {
    console.log(`[DEBUG] 商品未啟用，返回: 停用`)
    return '停用'
  }
  if (item.status === 'discontinued') {
    console.log(`[DEBUG] 商品已停產，返回: 停產`)
    return '停產'
  }
  
  if (item.type === 'single') {
    const totalQuantity = getTotalQuantity(item)
    console.log(`[DEBUG] 單一規格 - 總庫存量: ${totalQuantity}`)
    
    if (totalQuantity === 0) {
      console.log(`[DEBUG] 單一規格庫存為0，返回: 缺貨`)
      return '缺貨'
    }
    
    const minStock = item.singleStock.minStock
    const isLowStock = totalQuantity <= minStock
    console.log(`[DEBUG] 單一規格 - 最低庫存: ${minStock}, 是否庫存不足: ${isLowStock}`)
    return isLowStock ? '庫存不足' : '正常'
  } else if (item.type === 'multiSpec') {
    console.log(`[DEBUG] 多規格檢查 - 規格數量: ${item.multiSpecStock.length}`)
    
    // 先檢查是否有任何規格缺貨
    const hasOutOfStock = item.multiSpecStock.some(spec => {
      const isOut = spec.quantity === 0
      console.log(`[DEBUG] 規格 ${spec.specName}: 庫存 ${spec.quantity}, 是否缺貨: ${isOut}`)
      return isOut
    })
    
    if (hasOutOfStock) {
      console.log(`[DEBUG] 多規格有缺貨，返回: 缺貨`)
      return '缺貨'
    }
    
    // 再檢查是否有任何規格庫存不足
    const hasLowStock = item.multiSpecStock.some(spec => {
      const isLow = spec.quantity <= spec.minStock
      console.log(`[DEBUG] 規格 ${spec.specName}: 庫存 ${spec.quantity}, 最低庫存 ${spec.minStock}, 是否不足: ${isLow}`)
      return isLow
    })
    console.log(`[DEBUG] 多規格是否有庫存不足: ${hasLowStock}`)
    return hasLowStock ? '庫存不足' : '正常'
  }
  
  console.log(`[DEBUG] 預設返回: 正常`)
  return '正常'
}

const getRowClass = (item) => {
  const quantityClass = getQuantityClass(item)
  const statusClass = getStatusClass(item)
  return `${quantityClass} ${statusClass}`
}

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('zh-TW')
}

// 操作方法
const editItem = (item) => {
  selectedItem.value = item
  formData.value = {
    name: item.name,
    description: item.description || '',
    category: item.category,
    type: item.type,
    singleStock: item.type === 'single' ? { ...item.singleStock } : {
      quantity: 0,
      unit: '',
      minStock: 0,
      maxStock: 1000
    },
    multiSpecStock: item.type === 'multiSpec' ? [...item.multiSpecStock] : [],
    cost: { ...item.cost },
    status: item.status,
    isActive: item.isActive,
    stockAlert: { ...item.stockAlert },
    notes: item.notes || ''
  }
  showEditModal.value = true
}

const adjustStock = (item) => {
  selectedItem.value = item
  stockForm.value = {
    type: 'add',
    quantity: 0,
    reason: '',
    variantIndex: 0
  }
  showStockModal.value = true
}

const deleteItem = async (item) => {
  if (!confirm(`確定要刪除「${item.name}」嗎？`)) return
  
  try {
    await inventoryAPI.deleteInventory(item._id)
    await loadInventory()
  } catch (err) {
    console.error('刪除失敗:', err)
    alert('刪除失敗：' + (err.message || '未知錯誤'))
  }
}

// 模態框方法
const closeModal = () => {
  showAddModal.value = false
  showEditModal.value = false
  resetForm()
}

const closeStockModal = () => {
  showStockModal.value = false
  selectedItem.value = null
}

const closeImportModal = () => {
  showImportModal.value = false
  importForm.value = { file: null, preview: [] }
  importResult.value = null
  importing.value = false
}

const resetForm = () => {
  formData.value = {
    name: '',
    description: '',
    category: '',
    type: 'single',
    singleStock: {
      quantity: 0,
      unit: '',
      minStock: 0,
      maxStock: 1000
    },
    multiSpecStock: [],
    cost: {
      unitPrice: 0,
      currency: 'TWD'
    },
    status: 'active',
    isActive: true,
    stockAlert: {
      enabled: true,
      threshold: 10
    },
    notes: ''
  }
  selectedItem.value = null
}

// 表單操作方法
const addVariant = () => {
  formData.value.multiSpecStock.push({
    specName: '',
    quantity: 0,
    unit: '',
    minStock: 0,
    maxStock: 1000,
    unitPrice: 0
  })
}

const removeVariant = (index) => {
  formData.value.multiSpecStock.splice(index, 1)
}

const submitForm = async () => {
  try {
    if (selectedItem.value) {
      await inventoryAPI.updateInventory(selectedItem.value._id, formData.value)
    } else {
      await inventoryAPI.createInventory(formData.value)
    }
    await loadInventory()
    closeModal()
  } catch (err) {
    console.error('保存失敗:', err)
    alert('保存失敗：' + (err.message || '未知錯誤'))
  }
}

const submitStockAdjustment = async () => {
  try {
    const { type, quantity, reason, variantIndex } = stockForm.value
    const item = selectedItem.value
    
    if (item.type === 'single') {
      await inventoryAPI.updateInventory(item._id, {
        singleStock: {
          ...item.singleStock,
          quantity: type === 'set' ? quantity : item.singleStock.quantity + (type === 'add' ? quantity : -quantity)
        }
      })
    } else if (item.type === 'multiSpec') {
      const updatedSpecs = [...item.multiSpecStock]
      const spec = updatedSpecs[variantIndex]
      if (spec) {
        spec.quantity = type === 'set' ? quantity : spec.quantity + (type === 'add' ? quantity : -quantity)
        await inventoryAPI.updateInventory(item._id, {
          multiSpecStock: updatedSpecs
        })
      }
    }
    
    await loadInventory()
    closeStockModal()
  } catch (err) {
    console.error('調整庫存失敗:', err)
    alert('調整庫存失敗：' + (err.message || '未知錯誤'))
  }
}

// 匯入相關方法
const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleFileSelect = (event) => {
  const file = event.target.files[0]
  if (file) {
    importForm.value.file = file
    importResult.value = null
  }
}

const handleFileDrop = (event) => {
  event.preventDefault()
  const files = event.dataTransfer.files
  if (files.length > 0) {
    const file = files[0]
    if (file.type.includes('excel') || file.type.includes('csv') || 
        file.name.match(/\.(xlsx|xls|csv)$/)) {
      importForm.value.file = file
      importResult.value = null
    }
  }
}

const removeFile = () => {
  importForm.value.file = null
  importResult.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const submitImport = async () => {
  if (!importForm.value.file) return
  
  try {
    importing.value = true
    importResult.value = null
    
    const formData = new FormData()
    formData.append('file', importForm.value.file)
    
    const response = await inventoryAPI.importInventory(formData)
    
    // 檢查響應狀態 - axios 響應攔截器已經返回 response.data
    if (response && response.status === 'success') {
      importResult.value = response.data
      await loadInventory() // 重新載入庫存列表
    } else {
      throw new Error(response?.message || '匯入失敗')
    }
  } catch (err) {
    console.error('匯入失敗:', err)
    importResult.value = {
      created: 0,
      updated: 0,
      failed: 1,
      results: [{
        name: '匯入失敗',
        category: '',
        success: false,
        error: err.message || '未知錯誤'
      }]
    }
  } finally {
    importing.value = false
  }
}

// 分類管理方法
const openCategoryModal = () => {
  showCategoryModal.value = true
  resetCategoryForm()
}

const openCategoryEditModal = (category) => {
  selectedCategoryForEdit.value = category
  categoryForm.value = {
    name: category.label,
    description: category.description || '',
    icon: category.icon || ''
  }
  showCategoryEditModal.value = true
}

const closeCategoryModal = () => {
  showCategoryModal.value = false
  showCategoryEditModal.value = false
  selectedCategoryForEdit.value = null
  resetCategoryForm()
}

const resetCategoryForm = () => {
  categoryForm.value = {
    name: '',
    description: '',
    icon: ''
  }
}

const submitCategoryForm = async () => {
  try {
    if (selectedCategoryForEdit.value) {
      await inventoryCategoryAPI.updateCategory(selectedCategoryForEdit.value.id, categoryForm.value)
    } else {
      await inventoryCategoryAPI.createCategory(categoryForm.value)
    }
    await loadInventory() // 重新載入以更新分類列表
    closeCategoryModal()
  } catch (err) {
    console.error('保存分類失敗:', err)
    alert('保存分類失敗：' + (err.message || '未知錯誤'))
  }
}

const deleteCategory = async (category) => {
  if (!confirm(`確定要刪除分類「${category.label}」嗎？`)) return
  
  try {
    await inventoryCategoryAPI.deleteCategory(category.id)
    await loadInventory() // 重新載入以更新分類列表
  } catch (err) {
    console.error('刪除分類失敗:', err)
    alert('刪除分類失敗：' + (err.message || '未知錯誤'))
  }
}

// 初始化
const initData = () => {
  loadInventory()
}

export {
  // 響應式數據
  searchQuery,
  selectedCategory,
  showAddModal,
  showEditModal,
  showStockModal,
  showImportModal,
  showCategoryModal,
  showCategoryEditModal,
  selectedItem,
  selectedCategoryForEdit,
  loading,
  error,
  formData,
  stockForm,
  importForm,
  categoryForm,
  inventoryItems,
  stats,
  categories,
  importing,
  importResult,
  fileInput,
  
  // 計算屬性
  filteredItems,
  totalItems,
  lowStockItems,
  outOfStockItems,
  totalValue,
  stockPlaceholder,
  
  // 方法
  filterByCategory,
  getCategoryLabel,
  getCategoryClass,
  hasVariants,
  getTotalQuantity,
  getVariantCostRangeText,
  getQuantityClass,
  getStatusClass,
  getStatusText,
  getRowClass,
  formatDate,
  editItem,
  adjustStock,
  deleteItem,
  closeModal,
  closeStockModal,
  closeImportModal,
  resetForm,
  addVariant,
  removeVariant,
  submitForm,
  submitStockAdjustment,
  triggerFileInput,
  handleFileSelect,
  handleFileDrop,
  removeFile,
  formatFileSize,
  submitImport,
  openCategoryModal,
  openCategoryEditModal,
  closeCategoryModal,
  resetCategoryForm,
  submitCategoryForm,
  deleteCategory,
  initData
}
