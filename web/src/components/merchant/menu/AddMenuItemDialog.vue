<template>
  <BaseDialog
    v-model="dialogVisible"
    :title="`${props.editingItem ? '編輯' : '添加'}菜品`"
    class="add-menu-item-dialog"
  >
    <!-- 分頁導航 -->
    <div class="tab-navigation">
      <button 
        v-for="tab in tabs" 
        :key="tab.key"
        :class="['tab-button', { active: currentTab === tab.key }]"
        @click="currentTab = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- 分頁內容 -->
    <div class="tab-content">
      <!-- 基本信息頁面 -->
      <div v-show="currentTab === 'basic'" class="tab-pane">
        <div class="add-menu-item-form">
          <!-- 基本信息 -->
          <div class="form-section">
            <h3>基本信息</h3>
            <div class="form-group">
              <label>菜品名稱</label>
              <input type="text" v-model="form.name" placeholder="請輸入菜品名稱" />
            </div>
            <div class="form-group">
              <label>基本售價</label>
              <input type="number" v-model="form.basePrice" placeholder="請輸入基本售價" />
            </div>
            <div class="form-group">
              <label>描述</label>
              <textarea v-model="form.description" placeholder="請輸入菜品描述（可選）" rows="2"></textarea>
            </div>
          </div>

          <!-- 圖片上傳 -->
          <div class="form-section">
            <h3>菜品圖片</h3>
            <div class="image-upload" @click="triggerFileInput">
              <div v-if="!form.image" class="upload-placeholder">
                <font-awesome-icon icon="upload" size="2x" />
                <span>點擊上傳圖片</span>
              </div>
              <img v-else :src="form.image" alt="預覽圖" class="preview-image" />
              <input
                type="file"
                ref="fileInput"
                accept="image/*"
                @change="handleImageUpload"
                class="hidden"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- 選項設置頁面 -->
      <div v-show="currentTab === 'options'" class="tab-pane">
        <div class="add-menu-item-form">
          <!-- 選項設置 -->
          <div class="form-section">
            <h3>可選項目</h3>
            <div class="options-list">
              <div v-for="(option, index) in form.options" :key="index" class="option-item">
                <div class="option-header">
                  <div class="form-group">
                    <input 
                      type="text" 
                      v-model="option.name" 
                      placeholder="輸入選項名稱（如：甜度）" 
                      class="option-name-input"
                    />
                  </div>
                  <BaseButton 
                    variant="text" 
                    class="delete-button"
                    @click="form.options.splice(index, 1)"
                  >
                    <font-awesome-icon icon="trash" />
                  </BaseButton>
                </div>

                <div class="option-content">
                  <div class="choices-list">
                    <template v-for="(choice, choiceIndex) in option.choices" :key="choiceIndex">
                      <div class="choice-item">
                        <input 
                          type="text" 
                          v-model="choice.label" 
                          placeholder="選項值（如：正常糖）"
                        />
                        <input 
                          v-if="option.priceEnabled"
                          type="number" 
                          v-model="choice.price" 
                          placeholder="加價"
                        />
                        <BaseButton 
                          variant="text" 
                          class="delete-button"
                          @click="option.choices.splice(choiceIndex, 1)"
                        >
                          <font-awesome-icon icon="trash" />
                        </BaseButton>
                      </div>
                    </template>
                  </div>
                  
                  <div class="option-actions">
                    <BaseButton 
                      variant="text" 
                      class="add-choice-button"
                      @click="addChoice(option)"
                    >
                      <font-awesome-icon icon="plus" />
                      添加選項值
                    </BaseButton>
                    <label class="checkbox-item">
                      <input 
                        type="checkbox" 
                        v-model="option.priceEnabled"
                      />
                      <span>啟用加價</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <BaseButton 
              variant="text" 
              class="add-option-button"
              @click="addOption"
            >
              <font-awesome-icon icon="plus" />
              添加選項
            </BaseButton>
          </div>
        </div>
      </div>

      <!-- 庫存配置頁面 -->
      <div v-show="currentTab === 'inventory'" class="tab-pane">
        <div class="add-menu-item-form">
          <!-- 庫存配置 -->
          <div class="form-section">
            <h3>庫存配置</h3>
            
            <!-- 基礎庫存 -->
            <div class="inventory-section">
              <h4>基礎庫存（固定消耗）</h4>
              <div class="base-inventory-list">
                <div v-for="(item, index) in form.baseInventory" :key="index" class="inventory-item">
                  <div class="inventory-selector">
                    <select v-model="item.inventoryId" class="inventory-select">
                      <option value="">選擇庫存項目</option>
                      <option v-for="inv in availableInventory" :key="inv._id" :value="inv._id">
                        {{ inv.name }} ({{ inv.category }})
                      </option>
                    </select>
                    <input 
                      type="number" 
                      v-model="item.quantity" 
                      placeholder="數量" 
                      class="quantity-input"
                      min="0"
                      step="0.1"
                    />
                    <span class="unit-display">{{ getInventoryUnit(item.inventoryId) }}</span>
                    <BaseButton 
                      variant="text" 
                      class="delete-button"
                      @click="form.baseInventory.splice(index, 1)"
                    >
                      <font-awesome-icon icon="trash" />
                    </BaseButton>
                  </div>
                </div>
              </div>
              <BaseButton 
                variant="text" 
                class="add-inventory-button"
                @click="addBaseInventory"
              >
                <font-awesome-icon icon="plus" />
                添加基礎庫存
              </BaseButton>
            </div>

            <!-- 條件庫存 -->
            <div class="inventory-section">
              <h4>條件庫存（根據選項變化）</h4>
              <div class="conditional-inventory-list">
                <div v-for="(item, index) in form.conditionalInventory" :key="index" class="inventory-item">
                  <div class="inventory-header">
                    <div class="inventory-selector">
                      <select v-model="item.inventoryId" class="inventory-select">
                        <option value="">選擇庫存項目</option>
                        <option v-for="inv in availableInventory" :key="inv._id" :value="inv._id">
                          {{ inv.name }} ({{ inv.category }})
                        </option>
                      </select>
                      <input 
                        type="number" 
                        v-model="item.baseQuantity" 
                        placeholder="基礎數量" 
                        class="quantity-input"
                        min="0"
                        step="0.1"
                      />
                      <span class="unit-display">{{ getInventoryUnit(item.inventoryId) }}</span>
                    </div>
                    <BaseButton 
                      variant="text" 
                      class="delete-button"
                      @click="form.conditionalInventory.splice(index, 1)"
                    >
                      <font-awesome-icon icon="trash" />
                    </BaseButton>
                  </div>
                  
                  <!-- 條件規則 -->
                  <div class="conditions-list">
                    <div v-for="(condition, condIndex) in item.conditions" :key="condIndex" class="condition-item">
                      <select v-model="condition.optionType" class="option-type-select">
                        <option value="">選擇選項類型</option>
                        <option v-for="opt in form.options" :key="opt.name" :value="opt.name">
                          {{ opt.name }}
                        </option>
                      </select>
                      <select v-model="condition.optionValue" class="option-value-select">
                        <option value="">選擇選項值</option>
                        <option v-for="choice in getOptionChoices(condition.optionType)" :key="choice.label" :value="choice.label">
                          {{ choice.label }}
                        </option>
                      </select>
                      <input 
                        type="number" 
                        v-model="condition.multiplier" 
                        placeholder="倍數" 
                        class="multiplier-input"
                        min="0"
                        step="0.1"
                      />
                      <input 
                        type="number" 
                        v-model="condition.additionalQuantity" 
                        placeholder="額外數量" 
                        class="additional-input"
                        min="0"
                        step="0.1"
                      />
                      <BaseButton 
                        variant="text" 
                        class="delete-button"
                        @click="item.conditions.splice(condIndex, 1)"
                      >
                        <font-awesome-icon icon="trash" />
                      </BaseButton>
                    </div>
                    <BaseButton 
                      variant="text" 
                      class="add-condition-button"
                      @click="addCondition(item)"
                    >
                      <font-awesome-icon icon="plus" />
                      添加條件
                    </BaseButton>
                  </div>
                </div>
              </div>
              <BaseButton 
                variant="text" 
                class="add-inventory-button"
                @click="addConditionalInventory"
              >
                <font-awesome-icon icon="plus" />
                添加條件庫存
              </BaseButton>
            </div>

            <!-- 庫存消耗預覽 -->
            <div class="inventory-preview">
              <h4>庫存消耗預覽</h4>
              <div class="preview-options">
                <div v-for="option in form.options" :key="option.name" class="preview-option">
                  <label>{{ option.name }}:</label>
                  <select v-model="previewOptions[option.name]" @change="updateInventoryPreview">
                    <option value="">請選擇</option>
                    <option v-for="choice in option.choices" :key="choice.label" :value="choice.label">
                      {{ choice.label }}
                    </option>
                  </select>
                </div>
              </div>
              <div class="preview-results">
                <h5>預估庫存消耗：</h5>
                <div v-for="(quantity, inventoryId) in inventoryPreview" :key="inventoryId" class="preview-item">
                  <span>{{ getInventoryName(inventoryId) }}:</span>
                  <span class="preview-quantity">{{ quantity }} {{ getInventoryUnit(inventoryId) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>



    <template #footer>
      <BaseButton variant="text" @click="dialogVisible = false">取消</BaseButton>
      <BaseButton
        v-if="currentTab === 'inventory'"
        variant="primary"
        :disabled="!isValid"
        @click="handleConfirm"
      >確認</BaseButton>
    </template>
  </BaseDialog>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { inventoryService } from '@/services/api'
import { useInventoryCalculation } from '@/composables/merchant/useInventoryCalculation'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  initialCategory: {
    type: String,
    required: true
  },
  editingItem: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

const fileInput = ref(null)
const form = ref({
  name: '',
  basePrice: '',
  description: '',
  image: '',
  options: [],
  baseInventory: [],
  conditionalInventory: []
})

// 分頁相關
const tabs = [
  { key: 'basic', label: '基本信息' },
  { key: 'options', label: '選項設置' },
  { key: 'inventory', label: '庫存配置' }
]
const currentTab = ref('basic')



// 可用庫存列表
const availableInventory = ref([])
const previewOptions = ref({})
const inventoryPreview = ref({})

// 使用庫存計算 composable
const { estimateDishInventoryUsage } = useInventoryCalculation()

// 加載可用庫存
const loadAvailableInventory = async () => {
  try {
    const response = await inventoryService.getInventory()
    if (response.status === 'success') {
      availableInventory.value = response.data.inventory || []
    }
  } catch (err) {
    console.error('加載庫存失敗:', err)
  }
}

// 獲取庫存單位
const getInventoryUnit = (inventoryId) => {
  const inventory = availableInventory.value.find(inv => inv._id === inventoryId)
  return inventory ? inventory.unit : ''
}

// 獲取庫存名稱
const getInventoryName = (inventoryId) => {
  const inventory = availableInventory.value.find(inv => inv._id === inventoryId)
  return inventory ? inventory.name : ''
}

// 獲取選項的選擇值
const getOptionChoices = (optionType) => {
  const option = form.value.options.find(opt => opt.name === optionType)
  return option ? option.choices : []
}

// 添加基礎庫存
const addBaseInventory = () => {
  form.value.baseInventory.push({
    inventoryId: '',
    quantity: 1
  })
}

// 添加條件庫存
const addConditionalInventory = () => {
  form.value.conditionalInventory.push({
    inventoryId: '',
    baseQuantity: 1,
    conditions: []
  })
}

// 添加條件
const addCondition = (inventoryItem) => {
  inventoryItem.conditions.push({
    optionType: '',
    optionValue: '',
    multiplier: 1,
    additionalQuantity: 0
  })
}

// 更新庫存預覽
const updateInventoryPreview = () => {
  // 構建臨時的菜品對象用於計算
  const tempDish = {
    inventoryConfig: {
      baseInventory: form.value.baseInventory,
      conditionalInventory: form.value.conditionalInventory
    }
  }
  
  // 使用 composable 計算庫存消耗
  inventoryPreview.value = estimateDishInventoryUsage(tempDish, previewOptions.value)
}

const addChoice = (option) => {
  option.choices = option.choices || []
  if (option.choices.length === 0 || option.choices[option.choices.length - 1].label) {
    option.choices.push({
      label: '',
      price: 0
    })
  }
}

const levels = [
  { value: '100', label: '正常' },
  { value: '70', label: '70%' },
  { value: '50', label: '50%' },
  { value: '30', label: '30%' },
  { value: '0', label: '無' }
]

const addOption = () => {
  form.value.options.push({
    name: '',
    priceEnabled: false,
    choices: []
  })
}

// 當前分類不需要在表單中選擇，由父組件傳入

// 監聽編輯的菜品數據
watch(() => props.editingItem, (item) => {
  if (item) {
    // 將後端的 customOptions 轉換為前端期望的格式
    const transformedOptions = (item.customOptions || []).map(option => ({
      name: option.name,
      priceEnabled: option.options && option.options.some(opt => opt.price > 0),
      choices: option.options ? option.options.map(opt => ({
        label: opt.label,
        price: opt.price || 0
      })) : []
    }))

    form.value = {
      name: item.name,
      basePrice: item.price || item.basePrice,
      description: item.description || '',
      image: item.image || '',
      options: transformedOptions,
      baseInventory: item.baseInventory || [],
      conditionalInventory: item.conditionalInventory || []
    }
    
    // 初始化預覽選項
    transformedOptions.forEach(option => {
      if (option.choices.length > 0) {
        previewOptions.value[option.name] = option.choices[0].label
      }
    })
    
    // 更新庫存預覽
    updateInventoryPreview()
  }
}, { immediate: true })

// 監聽選項變化，更新預覽選項
watch(() => form.value.options, (newOptions) => {
  // 清理不存在的選項
  Object.keys(previewOptions.value).forEach(key => {
    if (!newOptions.find(opt => opt.name === key)) {
      delete previewOptions.value[key]
    }
  })
  
  // 為新選項設置預設值
  newOptions.forEach(option => {
    if (!previewOptions.value[option.name] && option.choices.length > 0) {
      previewOptions.value[option.name] = option.choices[0].label
    }
  })
  
  updateInventoryPreview()
}, { deep: true })

// 監聽庫存配置變化，更新預覽
watch([() => form.value.baseInventory, () => form.value.conditionalInventory], () => {
  updateInventoryPreview()
}, { deep: true })

const isValid = computed(() => {
  return form.value.name && 
         form.value.basePrice &&
         form.value.options.every(option => 
           option.name && 
           (!option.choices || option.choices.length === 0 || 
            (option.choices.length > 0 && option.choices.every(choice => choice.label))
           )
         )
})

const triggerFileInput = () => {
  fileInput.value.click()
}

const handleImageUpload = (event) => {
  const file = event.target.files[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      form.value.image = e.target.result
    }
    reader.readAsDataURL(file)
  }
}

const resetForm = () => {
  form.value = {
    name: '',
    basePrice: '',
    description: '',
    image: '',
    options: [],
    baseInventory: [],
    conditionalInventory: []
  }
  previewOptions.value = {}
  inventoryPreview.value = {}
}

const handleConfirm = () => {
  if (isValid.value) {
    // 轉換選項數據為後端期望的格式
    const transformedOptions = form.value.options.map(option => ({
      name: option.name,
      type: 'checkbox', // 默認類型
      required: false,   // 默認非必需
      options: option.choices ? option.choices
        .filter(choice => choice.label) // 過濾掉空的選項
        .map(choice => ({
          label: choice.label,
          value: choice.label, // 使用 label 作為 value
          price: option.priceEnabled ? (choice.price || 0) : 0
        })) : []
    }))

    // 轉換庫存配置數據
    const transformedInventory = {
      baseInventory: form.value.baseInventory
        .filter(item => item.inventoryId && item.quantity)
        .map(item => ({
          inventoryId: item.inventoryId,
          quantity: item.quantity
        })),
      conditionalInventory: form.value.conditionalInventory
        .filter(item => item.inventoryId && item.baseQuantity)
        .map(item => ({
          inventoryId: item.inventoryId,
          baseQuantity: item.baseQuantity,
          conditions: item.conditions
            .filter(cond => cond.optionType && cond.optionValue)
            .map(cond => ({
              optionType: cond.optionType,
              optionValue: cond.optionValue,
              multiplier: cond.multiplier || 1,
              additionalQuantity: cond.additionalQuantity || 0
            }))
        }))
    }

    emit('confirm', { 
      ...form.value,
      options: transformedOptions,
      inventoryConfig: transformedInventory
    })

    dialogVisible.value = false
  }
}

// 監聽對話框的顯示狀態，當關閉時重置表單
watch(dialogVisible, (newValue) => {
  if (!newValue && !props.editingItem) {
    resetForm()
  }
})

// 組件掛載時加載庫存數據
onMounted(() => {
  loadAvailableInventory()
})
</script>

<style scoped>
.add-menu-item-form {
  padding: 1rem;
}

.form-section {
  margin-bottom: 1.5rem;
}

.form-section h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #1d1d1f;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  color: #666;
}

input[type="text"],
input[type="number"],
textarea,
select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.875rem;
}

.image-upload {
  border: 2px dashed #ddd;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.image-upload:hover {
  border-color: #007AFF;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  color: #666;
}

.preview-image {
  max-width: 100%;
  max-height: 200px;
  border-radius: 4px;
}

.hidden {
  display: none;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
}

.option-item {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 1rem;
}

.option-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.option-name-input {
  width: 100%;
  margin-right: 1rem;
}

.choice-item {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
  align-items: center;
}

.choice-item input {
  flex: 1;
}

.option-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.add-choice-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.delete-button {
  color: #ef4444;
}

.option-content {
  margin-top: 1rem;
}

.price-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.level-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 1rem;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
}

.add-option-button {
  width: 100%;
  justify-content: center;
  border: 2px dashed #e5e7eb;
  padding: 0.75rem;
  margin-top: 1rem;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.price-options {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

/* 新增庫存配置樣式 */
.inventory-section {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.inventory-section h4 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: #1d1d1f;
}

.base-inventory-list, .conditional-inventory-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.inventory-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid #f0f0f0;
}

.inventory-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.inventory-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.inventory-select {
  width: 150px;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.875rem;
}

.quantity-input {
  width: 80px;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.875rem;
}

.unit-display {
  font-size: 0.875rem;
  color: #666;
  margin-left: 0.5rem;
}

.conditions-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
}

.condition-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 0;
  border-bottom: 1px solid #f0f0f0;
}

.option-type-select, .option-value-select {
  width: 120px;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.875rem;
}

.multiplier-input, .additional-input {
  width: 80px;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.875rem;
}

.add-inventory-button, .add-condition-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.inventory-preview {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
}

.preview-options {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;
}

.preview-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.preview-option label {
  font-size: 0.875rem;
  color: #666;
}

.preview-option select {
  width: 150px;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.875rem;
}

.preview-results {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.preview-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.preview-item span:first-child {
  font-size: 0.875rem;
  color: #666;
}

.preview-quantity {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1d1d1f;
}

/* 分頁樣式 */
.add-menu-item-dialog {
  max-width: 800px;
  width: 90vw;
}

.tab-navigation {
  display: flex;
  border-bottom: 1px solid #e5e7eb;
  margin-bottom: 1.5rem;
}

.tab-button {
  padding: 0.75rem 1.5rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.875rem;
  color: #666;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
}

.tab-button:hover {
  color: #1d1d1f;
}

.tab-button.active {
  color: #007aff;
  border-bottom-color: #007aff;
}

.tab-content {
  min-height: 400px;
}

.tab-pane {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.tab-navigation-buttons {
  display: flex;
  justify-content: space-between;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}
</style>
