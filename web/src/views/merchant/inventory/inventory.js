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
      return sum + item.multiSpecStock.reduce((vSum, v) => vSum + (item.cost.unitPrice * v.quantity), 0)
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
          value: cat,
          label: cat
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

const initializeSystemCategories = async () => {
  try {
    const response = await inventoryCategoryAPI.initializeSystemCategories()
    if (response.data.categories) {
      categories.value = [
        { value: '', label: '全部' },
        ...response.data.categories.map(cat => ({
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
    console.error('初始化系統分類失敗:', err)
  }
}

const filterByCategory = (category) => {
  selectedCategory.value = category
}

const getCategoryLabel = (category) => {
  const found = categories.value.find(c => c.value === category)
  return found ? found.label : category
}

const getCategoryClass = (category) => {
  const classMap = {
    '食品': 'primary',
    '飲料': 'warning',
    '包裝': 'info',
    '設備': 'secondary'
  }
  return classMap[category] || 'default'
}

const hasVariants = (item) => {
  return item && item.type === 'multiSpec' && item.multiSpecStock.length > 0
}

const getTotalQuantity = (item) => {
  if (item.type === 'multiSpec') {
    return item.multiSpecStock.reduce((sum, v) => sum + v.quantity, 0)
  }
  return item.singleStock.quantity
}

const getVariantCostRangeText = (item) => {
  if (item.type !== 'multiSpec') return ''
  const costs = item.multiSpecStock.map(v => item.cost.unitPrice)
  const minCost = Math.min(...costs)
  const maxCost = Math.max(...costs)
  if (minCost === maxCost) {
    return `$${minCost.toFixed(2)}`
  }
  return `$${minCost.toFixed(2)} - $${maxCost.toFixed(2)}`
}

const getQuantityClass = (item) => {
  const totalQty = getTotalQuantity(item)
  if (totalQty === 0) return 'out-of-stock'
  
  if (item.type === 'multiSpec') {
    const hasLowStock = item.multiSpecStock.some(v => v.quantity <= v.minStock && v.quantity > 0)
    if (hasLowStock) return 'low-stock'
  } else if (item.singleStock.quantity <= item.singleStock.minStock) {
    return 'low-stock'
  }
  
  return 'normal'
}

const getStatusClass = (item) => {
  const totalQty = getTotalQuantity(item)
  if (totalQty === 0) return 'danger'
  
  if (item.type === 'multiSpec') {
    const hasLowStock = item.multiSpecStock.some(v => v.quantity <= v.minStock && v.quantity > 0)
    if (hasLowStock) return 'warning'
  } else if (item.singleStock.quantity <= item.singleStock.minStock) {
    return 'warning'
  }
  
  return 'success'
}

const getStatusText = (item) => {
  const totalQty = getTotalQuantity(item)
  if (totalQty === 0) return '缺貨'
  
  if (item.type === 'multiSpec') {
    const hasLowStock = item.multiSpecStock.some(v => v.quantity <= v.minStock && v.quantity > 0)
    if (hasLowStock) return '庫存不足'
  } else if (item.singleStock.quantity <= item.singleStock.minStock) {
    return '庫存不足'
  }
  
  return '正常'
}

const getRowClass = (item) => {
  const totalQty = getTotalQuantity(item)
  if (totalQty === 0) return 'row-out-of-stock'
  
  if (item.type === 'multiSpec') {
    const hasLowStock = item.multiSpecStock.some(v => v.quantity <= v.minStock && v.quantity > 0)
    if (hasLowStock) return 'row-low-stock'
  } else if (item.singleStock.quantity <= item.singleStock.minStock) {
    return 'row-low-stock'
  }
  
  return ''
}

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('zh-TW')
}

const editItem = (item) => {
  selectedItem.value = item
  formData.value = { 
    ...item,
    multiSpecStock: item.multiSpecStock ? [...item.multiSpecStock] : []
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
  if (confirm(`確定要刪除原料「${item.name}」嗎？`)) {
    try {
      await inventoryAPI.deleteInventory(item._id)
      await loadInventory()
    } catch (err) {
      console.error('刪除失敗:', err)
      alert('刪除失敗: ' + (err.message || '未知錯誤'))
    }
  }
}

const closeModal = () => {
  showAddModal.value = false
  showEditModal.value = false
  selectedItem.value = null
  resetForm()
}

const closeStockModal = () => {
  showStockModal.value = false
  selectedItem.value = null
  stockForm.value = {
    type: 'add',
    quantity: 0,
    reason: '',
    variantIndex: 0
  }
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
}

const addVariant = () => {
  formData.value.multiSpecStock.push({
    specName: '',
    quantity: 0,
    unit: formData.value.singleStock.unit || '',
    minStock: 0,
    maxStock: 1000
  })
}

const removeVariant = (index) => {
  formData.value.multiSpecStock.splice(index, 1)
}

const submitForm = async () => {
  try {
    if (showEditModal.value) {
      // 更新現有項目
      await inventoryAPI.updateInventory(selectedItem.value._id, formData.value)
    } else {
      // 創建新項目
      await inventoryAPI.createInventory(formData.value)
    }
    
    await loadInventory()
    closeModal()
  } catch (err) {
    console.error('保存失敗:', err)
    alert('保存失敗: ' + (err.message || '未知錯誤'))
  }
}

const submitStockAdjustment = async () => {
  try {
    const item = selectedItem.value
    let newQuantity = stockForm.value.quantity
    
    if (stockForm.value.type === 'add') {
      newQuantity = stockForm.value.quantity
    } else if (stockForm.value.type === 'subtract') {
      newQuantity = -stockForm.value.quantity
    }
    
    if (item.type === 'single') {
      const updatedData = {
        ...item,
        singleStock: {
          ...item.singleStock,
          quantity: Math.max(0, item.singleStock.quantity + newQuantity)
        }
      }
      await inventoryAPI.updateInventory(item._id, updatedData)
    } else if (item.type === 'multiSpec') {
      const updatedVariants = [...item.multiSpecStock]
      if (updatedVariants[stockForm.value.variantIndex]) {
        updatedVariants[stockForm.value.variantIndex].quantity = Math.max(0, updatedVariants[stockForm.value.variantIndex].quantity + newQuantity)
      }
      
      const updatedData = {
        ...item,
        multiSpecStock: updatedVariants
      }
      await inventoryAPI.updateInventory(item._id, updatedData)
    }
    
    await loadInventory()
    closeStockModal()
  } catch (err) {
    console.error('調整庫存失敗:', err)
    alert('調整庫存失敗: ' + (err.message || '未知錯誤'))
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
    if (showCategoryEditModal.value) {
      // 更新現有分類
      await inventoryCategoryAPI.updateCategory(selectedCategoryForEdit.value.id, categoryForm.value)
    } else {
      // 創建新分類
      await inventoryCategoryAPI.createCategory(categoryForm.value)
    }
    
    await loadInventory() // 重新載入分類
    closeCategoryModal()
  } catch (err) {
    console.error('保存分類失敗:', err)
    alert('保存分類失敗: ' + (err.message || '未知錯誤'))
  }
}

const deleteCategory = async (category) => {
  if (confirm(`確定要刪除分類「${category.label}」嗎？`)) {
    try {
      await inventoryCategoryAPI.deleteCategory(category.id)
      await loadInventory() // 重新載入分類
    } catch (err) {
      console.error('刪除分類失敗:', err)
      alert('刪除分類失敗: ' + (err.message || '未知錯誤'))
    }
  }
}

// 初始化函數
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
  showCategoryModal,
  showCategoryEditModal,
  selectedItem,
  selectedCategoryForEdit,
  loading,
  error,
  formData,
  stockForm,
  categoryForm,
  inventoryItems,
  stats,
  categories,
  
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
  resetForm,
  addVariant,
  removeVariant,
  submitForm,
  submitStockAdjustment,
  openCategoryModal,
  openCategoryEditModal,
  closeCategoryModal,
  resetCategoryForm,
  submitCategoryForm,
  deleteCategory,
  initData
}
