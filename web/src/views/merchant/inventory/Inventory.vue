<template>
  <div class="inventory-container">
    <!-- 頁面標題 -->
    <div class="page-header">
      <h1 class="page-title">庫存管理</h1>
      <button @click="showAddModal = true" class="btn btn-primary">
        <font-awesome-icon icon="plus" class="mr-2" />
        新增原料
      </button>
    </div>

    <!-- 統計卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">
          <font-awesome-icon icon="box" />
        </div>
        <div class="stat-content">
          <h3 class="stat-number">{{ totalItems }}</h3>
          <p class="stat-label">總原料數</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon warning">
          <font-awesome-icon icon="exclamation-triangle" />
        </div>
        <div class="stat-content">
          <h3 class="stat-number">{{ lowStockItems }}</h3>
          <p class="stat-label">庫存不足</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon danger">
          <font-awesome-icon icon="times-circle" />
        </div>
        <div class="stat-content">
          <h3 class="stat-number">{{ outOfStockItems }}</h3>
          <p class="stat-label">缺貨項目</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon success">
          <font-awesome-icon icon="dollar-sign" />
        </div>
        <div class="stat-content">
          <h3 class="stat-number">${{ totalValue.toFixed(2) }}</h3>
          <p class="stat-label">總庫存價值</p>
        </div>
      </div>
    </div>

    <!-- 搜尋和篩選 -->
    <div class="filters-section">
      <div class="search-box">
        <font-awesome-icon icon="search" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜尋原料名稱..."
          class="search-input"
        />
      </div>
      <div class="filter-buttons">
        <button
          v-for="category in categories"
          :key="category.value"
          @click="filterByCategory(category.value)"
          :class="['filter-btn', { active: selectedCategory === category.value }]"
        >
          {{ category.label }}
        </button>
      </div>
    </div>

    <!-- 原料列表 -->
    <div class="inventory-table">
      <table>
        <thead>
          <tr>
            <th>原料名稱</th>
            <th>分類</th>
            <th>型號數量</th>
            <th>總庫存</th>
            <th>單位</th>
            <th>成本範圍</th>
            <th>庫存狀態</th>
            <th>最後更新</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="item in filteredItems" :key="item.id">
          <tr :class="getRowClass(item)">
            <td>
              <div class="item-info">
                <span class="item-name">{{ item.name }}</span>
                <span v-if="item.description" class="item-description">{{ item.description }}</span>
              </div>
            </td>
            <td>
              <span class="category-badge" :class="getCategoryClass(item.category)">
                {{ getCategoryLabel(item.category) }}
              </span>
            </td>
            <td>
              <span class="model-count">{{ item.variants.length }} 個型號</span>
            </td>
            <td>
              <span class="quantity" :class="getQuantityClass(item)">
                {{ getTotalQuantity(item) }}
              </span>
            </td>
            <td>{{ item.unit }}</td>
            <td>
              <div v-if="hasVariants(item)">
                <span class="variant-badge">多規格</span>
                <div class="variant-summary">{{ getVariantCostRangeText(item) }}</div>
              </div>
              <div v-else>
                ${{ item.cost.toFixed(2) }}
              </div>
            </td>
            <td>
              <span class="status-badge" :class="getStatusClass(item)">
                {{ getStatusText(item) }}
              </span>
            </td>
            <td>{{ formatDate(item.updatedAt) }}</td>
            <td>
              <div class="action-buttons">
                <button @click="editItem(item)" class="btn-icon" title="編輯">
                  <font-awesome-icon icon="edit" />
                </button>
                <button @click="adjustStock(item)" class="btn-icon" title="調整庫存">
                  <font-awesome-icon icon="plus-minus" />
                </button>
                <button @click="deleteItem(item)" class="btn-icon danger" title="刪除">
                  <font-awesome-icon icon="trash" />
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="hasVariants(item)" :key="`variants-${item.id}`" class="variant-details-row">
            <td colspan="9">
              <div class="variant-chip-list">
                <span
                  v-for="(v, idx) in item.variants"
                  :key="idx"
                  class="variant-chip"
                >
                  {{ v.name }} ${{ Number(v.cost).toFixed(2) }} × {{ v.quantity }} {{ item.unit }}
                </span>
              </div>
            </td>
          </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- 新增/編輯原料模態框 -->
    <div v-if="showAddModal || showEditModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ showEditModal ? '編輯原料' : '新增原料' }}</h2>
          <button @click="closeModal" class="btn-close">
            <font-awesome-icon icon="times" />
          </button>
        </div>
        <form @submit.prevent="submitForm" class="modal-form">
          <div class="form-group">
            <label for="name">原料名稱 *</label>
            <input
              id="name"
              v-model="formData.name"
              type="text"
              required
              placeholder="例如：杯子、吸管、茶葉"
            />
          </div>
          <div class="form-group">
            <label for="description">描述</label>
            <textarea
              id="description"
              v-model="formData.description"
              placeholder="原料的詳細描述（可選）"
              rows="3"
            ></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="category">分類 *</label>
              <select id="category" v-model="formData.category" required>
                <option value="">請選擇分類</option>
                <option value="ingredient">主要原料</option>
                <option value="consumable">耗材</option>
                <option value="packaging">包裝材料</option>
                <option value="equipment">設備用品</option>
              </select>
            </div>
            <div class="form-group">
              <label for="unit">單位 *</label>
              <input
                id="unit"
                v-model="formData.unit"
                type="text"
                required
                placeholder="例如：包、個、公斤"
              />
            </div>
          </div>
          <div class="form-group">
            <label class="inline-label">
              <input type="checkbox" v-model="formData.hasVariants" />
              此原料有多個型號/規格
            </label>
          </div>
          <div class="form-row" v-if="!formData.hasVariants">
            <div class="form-group">
              <label for="cost">成本 (元) *</label>
              <input
                id="cost"
                v-model.number="formData.cost"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
              />
            </div>
            <div class="form-group">
              <label for="quantity">初始庫存數量 *</label>
              <input
                id="quantity"
                v-model.number="formData.quantity"
                type="number"
                min="0"
                required
                placeholder="0"
              />
            </div>
          </div>
          <div v-else class="form-group">
            <div class="variants-header">
              <span>規格與成本</span>
              <button type="button" class="btn btn-secondary" @click="addVariant">
                <font-awesome-icon icon="plus" class="mr-2" />新增規格
              </button>
            </div>
            <div v-if="formData.variants.length === 0" class="variants-empty">尚未新增任何規格</div>
            <div v-for="(variant, index) in formData.variants" :key="index" class="variant-row">
              <div class="variant-input-group">
                <label :for="`variant-name-${index}`">規格名稱</label>
                <input
                  :id="`variant-name-${index}`"
                  v-model="variant.name"
                  type="text"
                  placeholder="如：大 / 中 / 小"
                />
              </div>
              <div class="variant-input-group">
                <label :for="`variant-cost-${index}`">成本 (元)</label>
                <input
                  :id="`variant-cost-${index}`"
                  v-model.number="variant.cost"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                />
              </div>
              <div class="variant-input-group">
                <label :for="`variant-quantity-${index}`">庫存數量</label>
                <input
                  :id="`variant-quantity-${index}`"
                  v-model.number="variant.quantity"
                  type="number"
                  min="0"
                  placeholder="0"
                />
              </div>
              <button type="button" class="btn-icon danger" @click="removeVariant(index)" title="刪除">
                <font-awesome-icon icon="trash" />
              </button>
            </div>
          </div>
          <div class="form-group">
            <label for="minQuantity">最低庫存警告</label>
            <input
              id="minQuantity"
              v-model="formData.minQuantity"
              type="number"
              min="0"
              placeholder="低於此數量時會顯示警告"
            />
          </div>
          <div class="form-actions">
            <button type="button" @click="closeModal" class="btn btn-secondary">
              取消
            </button>
            <button type="submit" class="btn btn-primary">
              {{ showEditModal ? '更新' : '新增' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 調整庫存模態框 -->
    <div v-if="showStockModal" class="modal-overlay" @click="closeStockModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>調整庫存 - {{ selectedItem?.name }}</h2>
          <button @click="closeStockModal" class="btn-close">
            <font-awesome-icon icon="times" />
          </button>
        </div>
        <form @submit.prevent="submitStockAdjustment" class="modal-form">
          <div class="form-group" v-if="hasVariants(selectedItem)">
            <label for="variantSelect">規格</label>
            <select id="variantSelect" v-model.number="stockForm.variantIndex" required>
              <option v-for="(v, idx) in selectedItem.variants" :key="idx" :value="idx">
                {{ v.name }}（現有：{{ v.quantity }} {{ selectedItem.unit }}）
              </option>
            </select>
          </div>
          <div class="form-group">
            <label for="adjustmentType">調整類型</label>
            <select id="adjustmentType" v-model="stockForm.type" required>
              <option value="add">增加庫存</option>
              <option value="subtract">減少庫存</option>
              <option value="set">設定庫存</option>
            </select>
          </div>
          <div class="form-group">
            <label for="adjustmentQuantity">數量</label>
            <input
              id="adjustmentQuantity"
              v-model="stockForm.quantity"
              type="number"
              min="0"
              required
              :placeholder="stockPlaceholder"
            />
          </div>
          <div class="form-group">
            <label for="adjustmentReason">調整原因</label>
            <textarea
              id="adjustmentReason"
              v-model="stockForm.reason"
              placeholder="例如：採購入庫、盤點調整、損耗等"
              rows="3"
            ></textarea>
          </div>
          <div class="form-actions">
            <button type="button" @click="closeStockModal" class="btn btn-secondary">
              取消
            </button>
            <button type="submit" class="btn btn-primary">
              確認調整
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

// 響應式數據
const searchQuery = ref('')
const selectedCategory = ref('')
const showAddModal = ref(false)
const showEditModal = ref(false)
const showStockModal = ref(false)
const selectedItem = ref(null)

// 表單數據
const formData = ref({
  name: '',
  description: '',
  category: '',
  unit: '',
  hasVariants: false,
  cost: 0,
  quantity: 0,
  minQuantity: 0,
  variants: []
})

const stockForm = ref({
  type: 'add',
  quantity: 0,
  reason: '',
  variantIndex: 0
})

// 模擬數據 - 重新設計為支援多型號的結構
const inventoryItems = ref([
  {
    id: 1,
    name: '果糖',
    description: '飲料用果糖漿',
    category: 'ingredient',
    unit: '公斤',
    hasVariants: false,
    cost: 45.00,
    quantity: 15,
    minQuantity: 5,
    updatedAt: new Date('2024-01-15'),
    variants: []
  },
  {
    id: 2,
    name: '吸管',
    description: '飲料用吸管',
    category: 'consumable',
    unit: '支',
    hasVariants: true,
    cost: 0,
    quantity: 0,
    minQuantity: 0,
    updatedAt: new Date('2024-01-14'),
    variants: [
      { name: '大', cost: 0.15, quantity: 200, minQuantity: 50 },
      { name: '小', cost: 0.12, quantity: 150, minQuantity: 30 }
    ]
  },
  {
    id: 3,
    name: '杯子',
    description: '外帶杯',
    category: 'packaging',
    unit: '包',
    hasVariants: true,
    cost: 0,
    quantity: 0,
    minQuantity: 0,
    updatedAt: new Date('2024-01-13'),
    variants: [
      { name: '大', cost: 2.50, quantity: 8, minQuantity: 10 },
      { name: '中', cost: 2.00, quantity: 12, minQuantity: 8 },
      { name: '小', cost: 1.80, quantity: 15, minQuantity: 6 }
    ]
  },
  {
    id: 4,
    name: '茶葉',
    description: '紅茶茶葉',
    category: 'ingredient',
    unit: '公斤',
    hasVariants: false,
    cost: 120.00,
    quantity: 3,
    minQuantity: 2,
    updatedAt: new Date('2024-01-12'),
    variants: []
  }
])

// 分類選項
const categories = [
  { value: '', label: '全部' },
  { value: 'ingredient', label: '主要原料' },
  { value: 'consumable', label: '耗材' },
  { value: 'packaging', label: '包裝材料' },
  { value: 'equipment', label: '設備用品' }
]

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

const totalItems = computed(() => inventoryItems.value.length)
const lowStockItems = computed(() => 
  inventoryItems.value.filter(item => {
    if (item.hasVariants) {
      return item.variants.some(v => v.quantity <= v.minQuantity && v.quantity > 0)
    }
    return item.quantity <= item.minQuantity && item.quantity > 0
  }).length
)
const outOfStockItems = computed(() => 
  inventoryItems.value.filter(item => {
    if (item.hasVariants) {
      return item.variants.every(v => v.quantity === 0)
    }
    return item.quantity === 0
  }).length
)
const totalValue = computed(() => 
  inventoryItems.value.reduce((sum, item) => {
    if (item.hasVariants) {
      return sum + item.variants.reduce((vSum, v) => vSum + (v.cost * v.quantity), 0)
    }
    return sum + (item.cost * item.quantity)
  }, 0)
)

// 方法
const filterByCategory = (category) => {
  selectedCategory.value = category
}

const getCategoryLabel = (category) => {
  const found = categories.find(c => c.value === category)
  return found ? found.label : category
}

const getCategoryClass = (category) => {
  const classMap = {
    ingredient: 'primary',
    consumable: 'warning',
    packaging: 'info',
    equipment: 'secondary'
  }
  return classMap[category] || 'default'
}

const hasVariants = (item) => {
  return item && item.hasVariants && item.variants.length > 0
}

const getTotalQuantity = (item) => {
  if (hasVariants(item)) {
    return item.variants.reduce((sum, v) => sum + v.quantity, 0)
  }
  return item.quantity
}

const getVariantCostRangeText = (item) => {
  if (!hasVariants(item)) return ''
  const costs = item.variants.map(v => v.cost)
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
  
  if (hasVariants(item)) {
    const hasLowStock = item.variants.some(v => v.quantity <= v.minQuantity && v.quantity > 0)
    if (hasLowStock) return 'low-stock'
  } else if (item.quantity <= item.minQuantity) {
    return 'low-stock'
  }
  
  return 'normal'
}

const getStatusClass = (item) => {
  const totalQty = getTotalQuantity(item)
  if (totalQty === 0) return 'danger'
  
  if (hasVariants(item)) {
    const hasLowStock = item.variants.some(v => v.quantity <= v.minQuantity && v.quantity > 0)
    if (hasLowStock) return 'warning'
  } else if (item.quantity <= item.minQuantity) {
    return 'warning'
  }
  
  return 'success'
}

const getStatusText = (item) => {
  const totalQty = getTotalQuantity(item)
  if (totalQty === 0) return '缺貨'
  
  if (hasVariants(item)) {
    const hasLowStock = item.variants.some(v => v.quantity <= v.minQuantity && v.quantity > 0)
    if (hasLowStock) return '庫存不足'
  } else if (item.quantity <= item.minQuantity) {
    return '庫存不足'
  }
  
  return '正常'
}

const getRowClass = (item) => {
  const totalQty = getTotalQuantity(item)
  if (totalQty === 0) return 'row-out-of-stock'
  
  if (hasVariants(item)) {
    const hasLowStock = item.variants.some(v => v.quantity <= v.minQuantity && v.quantity > 0)
    if (hasLowStock) return 'row-low-stock'
  } else if (item.quantity <= item.minQuantity) {
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
    variants: item.variants ? [...item.variants] : []
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

const deleteItem = (item) => {
  if (confirm(`確定要刪除原料「${item.name}」嗎？`)) {
    const index = inventoryItems.value.findIndex(i => i.id === item.id)
    if (index > -1) {
      inventoryItems.value.splice(index, 1)
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
    unit: '',
    hasVariants: false,
    cost: 0,
    quantity: 0,
    minQuantity: 0,
    variants: []
  }
}

const addVariant = () => {
  formData.value.variants.push({
    name: '',
    cost: 0,
    quantity: 0,
    minQuantity: 0
  })
}

const removeVariant = (index) => {
  formData.value.variants.splice(index, 1)
}

const submitForm = () => {
  if (showEditModal.value) {
    // 更新現有項目
    const index = inventoryItems.value.findIndex(i => i.id === selectedItem.value.id)
    if (index > -1) {
      inventoryItems.value[index] = {
        ...inventoryItems.value[index],
        ...formData.value,
        updatedAt: new Date()
      }
    }
  } else {
    // 新增項目
    const newItem = {
      id: Date.now(),
      ...formData.value,
      updatedAt: new Date()
    }
    inventoryItems.value.push(newItem)
  }
  
  closeModal()
}

const stockPlaceholder = computed(() => {
  if (!selectedItem.value) return '輸入數量'
  
  if (hasVariants(selectedItem.value)) {
    const variant = selectedItem.value.variants[stockForm.value.variantIndex]
    return variant ? `當前庫存: ${variant.quantity} ${selectedItem.value.unit}` : '輸入數量'
  }
  
  return `當前庫存: ${selectedItem.value.quantity} ${selectedItem.value.unit}`
})

const submitStockAdjustment = () => {
  if (!selectedItem.value) return

  const item = inventoryItems.value.find(i => i.id === selectedItem.value.id)
  if (!item) return

  if (hasVariants(item)) {
    // 調整特定型號的庫存
    const variant = item.variants[stockForm.value.variantIndex]
    if (!variant) return

    let newQuantity = variant.quantity

    switch (stockForm.value.type) {
      case 'add':
        newQuantity += parseInt(stockForm.value.quantity)
        break
      case 'subtract':
        newQuantity = Math.max(0, newQuantity - parseInt(stockForm.value.quantity))
        break
      case 'set':
        newQuantity = parseInt(stockForm.value.quantity)
        break
    }

    variant.quantity = newQuantity
  } else {
    // 調整單一物品的庫存
    let newQuantity = item.quantity

    switch (stockForm.value.type) {
      case 'add':
        newQuantity += parseInt(stockForm.value.quantity)
        break
      case 'subtract':
        newQuantity = Math.max(0, newQuantity - parseInt(stockForm.value.quantity))
        break
      case 'set':
        newQuantity = parseInt(stockForm.value.quantity)
        break
    }

    item.quantity = newQuantity
  }

  item.updatedAt = new Date()
  closeStockModal()
}

onMounted(() => {
  // 初始化數據
})
</script>

<style scoped>
.inventory-container {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
}

.page-title {
  font-size: 28px;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.stat-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 16px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: white;
  background: #3b82f6;
}

.stat-icon.warning {
  background: #f59e0b;
}

.stat-icon.danger {
  background: #ef4444;
}

.stat-icon.success {
  background: #10b981;
}

.stat-number {
  font-size: 24px;
  font-weight: 700;
  color: #1f2937;
  margin: 0 0 4px 0;
}

.stat-label {
  color: #6b7280;
  margin: 0;
  font-size: 14px;
}

.filters-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  gap: 20px;
}

.search-box {
  position: relative;
  flex: 1;
  max-width: 400px;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
}

.search-input {
  width: 100%;
  padding: 12px 12px 12px 40px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
}

.filter-buttons {
  display: flex;
  gap: 8px;
}

.filter-btn {
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-btn:hover {
  border-color: #3b82f6;
  color: #3b82f6;
}

.filter-btn.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
}

.inventory-table {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 16px;
  text-align: left;
  border-bottom: 1px solid #f3f4f6;
}

th {
  background: #f9fafb;
  font-weight: 600;
  color: #374151;
  font-size: 14px;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-name {
  font-weight: 500;
  color: #1f2937;
}

.item-description {
  font-size: 12px;
  color: #6b7280;
}

.model-count {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
}

.variant-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  background: #e0e7ff;
  color: #3730a3;
  display: inline-block;
  margin-bottom: 4px;
}

.variant-summary {
  font-size: 12px;
  color: #6b7280;
}

.category-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.category-badge.primary {
  background: #dbeafe;
  color: #1e40af;
}

.category-badge.warning {
  background: #fef3c7;
  color: #92400e;
}

.category-badge.info {
  background: #d1fae5;
  color: #065f46;
}

.category-badge.secondary {
  background: #e5e7eb;
  color: #374151;
}

.quantity {
  font-weight: 600;
}

.quantity.out-of-stock {
  color: #ef4444;
}

.quantity.low-stock {
  color: #f59e0b;
}

.quantity.normal {
  color: #10b981;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.status-badge.success {
  background: #d1fae5;
  color: #065f46;
}

.status-badge.warning {
  background: #fef3c7;
  color: #92400e;
}

.status-badge.danger {
  background: #fee2e2;
  color: #991b1b;
}

.row-out-of-stock {
  background: #fef2f2;
}

.row-low-stock {
  background: #fffbeb;
}

.variant-details-row {
  background: #f8fafc;
}

.variant-details-row td {
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
}

.variant-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.variant-chip {
  padding: 6px 12px;
  background: #e0e7ff;
  color: #3730a3;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.btn-icon {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  background: #f3f4f6;
  color: #6b7280;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.btn-icon:hover {
  background: #e5e7eb;
  color: #374151;
}

.btn-icon.danger:hover {
  background: #fee2e2;
  color: #dc2626;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  padding: 24px 24px 0 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h2 {
  margin: 0;
  color: #1f2937;
}

.btn-close {
  background: none;
  border: none;
  font-size: 20px;
  color: #6b7280;
  cursor: pointer;
  padding: 4px;
}

.modal-form {
  padding: 24px;
}

.form-group {
  margin-bottom: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #374151;
}

.inline-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.inline-label input[type="checkbox"] {
  width: auto;
  margin: 0;
}

input, select, textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
}

textarea {
  resize: vertical;
}

.variants-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.variants-header span {
  font-weight: 500;
  color: #374151;
}

.variants-empty {
  text-align: center;
  padding: 20px;
  color: #6b7280;
  background: #f9fafb;
  border-radius: 6px;
  border: 1px dashed #d1d5db;
}

.variant-row {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr auto;
  gap: 12px;
  align-items: end;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
  margin-bottom: 16px;
  border: 1px solid #e5e7eb;
}

.variant-input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.variant-input-group label {
  font-size: 12px;
  font-weight: 500;
  color: #374151;
  margin: 0;
}

.variant-input-group input {
  margin: 0;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.variant-input-group input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 32px;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
}

.btn-secondary {
  background: #6b7280;
  color: white;
}

.btn-secondary:hover {
  background: #4b5563;
}

.mr-2 {
  margin-right: 8px;
}

@media (max-width: 768px) {
  .inventory-container {
    padding: 16px;
  }
  
  .page-header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }
  
  .filters-section {
    flex-direction: column;
    align-items: stretch;
  }
  
  .form-row {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .variant-row {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .variant-input-group {
    gap: 4px;
  }
  
  .variant-input-group label {
    font-size: 11px;
  }
}
</style>
