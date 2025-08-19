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
                    @click="removeOption(index)"
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
                          @click="removeChoice(option, choiceIndex)"
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
              <p class="section-description">
                選擇庫存項目和具體值，這些庫存將在每次點餐時固定消耗
              </p>
              <div class="base-inventory-list">
                <div v-for="(item, index) in form.baseInventory" :key="index" class="inventory-item">
                  <div class="inventory-selector">
                    <select v-model="item.inventoryId" class="inventory-select" @change="onBaseInventoryChange(item)">
                      <option value="">選擇庫存項目</option>
                      <option v-for="inv in availableInventory" :key="inv._id" :value="inv._id">
                        {{ inv.name }} ({{ inv.category }})
                      </option>
                    </select>
                    
                    <!-- 庫存值選擇器 -->
                    <select v-if="item.inventoryId && getInventoryValues(item.inventoryId).length > 0" 
                            v-model="item.inventoryValueId" 
                            class="inventory-value-select"
                            @change="onBaseInventoryValueChange(item)">
                      <option value="">選擇具體值</option>
                      <option v-for="value in getInventoryValues(item.inventoryId)" :key="value._id" :value="value._id">
                        {{ value.specName }} (庫存: {{ value.quantity }})
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
                      @click="removeBaseInventory(index)"
                    >
                      <font-awesome-icon icon="trash" />
                    </BaseButton>
                  </div>
                  
                  <!-- 庫存信息顯示 -->
                  <div v-if="item.inventoryValueId" class="inventory-info">
                    <span class="stock-info">
                      當前庫存: {{ getCurrentStock(item.inventoryValueId) }} {{ getInventoryUnit(item.inventoryId) }}
                    </span>
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
              <p class="section-description">
                根據顧客選擇的選項動態調整庫存消耗，例如：選擇大杯時消耗大杯庫存，選擇中杯時消耗中杯庫存
              </p>
              <div class="conditional-inventory-list">
                <div v-for="(item, index) in form.conditionalInventory" :key="index" class="inventory-item">
                  <div class="inventory-header">
                    <div class="inventory-selector">
                      <select v-model="item.inventoryId" class="inventory-select" @change="onConditionalInventoryChange(item)">
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
                      @click="removeConditionalInventory(index)"
                    >
                      <font-awesome-icon icon="trash" />
                    </BaseButton>
                  </div>
                  
                  <!-- 條件規則 -->
                  <div class="conditions-list">
                    <div v-for="(condition, condIndex) in item.conditions" :key="condIndex" class="condition-item">
                      <select v-model="condition.optionType" class="option-type-select" @change="onConditionOptionTypeChange(condition, item)">
                        <option value="">選擇選項類型</option>
                        <option v-for="opt in form.options" :key="opt.name" :value="opt.name">
                          {{ opt.name }}
                        </option>
                      </select>
                      
                      <select v-model="condition.optionValue" class="option-value-select" @change="onConditionOptionValueChange(condition, item)">
                        <option value="">選擇選項值</option>
                        <option v-for="choice in getOptionChoices(condition.optionType)" :key="choice.label" :value="choice.label">
                          {{ choice.label }}
                        </option>
                      </select>
                      
                      <!-- 庫存值選擇器 -->
                      <select v-if="condition.optionValue && item.inventoryId && getInventoryValues(item.inventoryId).length > 0" 
                              v-model="condition.inventoryValueId" 
                              class="inventory-value-select"
                              @change="onConditionInventoryValueChange(condition)">
                        <option value="">選擇對應庫存值</option>
                        <option v-for="value in getInventoryValues(item.inventoryId)" :key="value._id" :value="value._id">
                          {{ value.specName }} (庫存: {{ value.quantity }})
                        </option>
                      </select>
                      
                      <input 
                        type="number" 
                        v-model="condition.quantity" 
                        placeholder="數量" 
                        class="quantity-input"
                        min="0"
                        step="0.1"
                      />
                      <span class="unit-display">{{ getInventoryUnit(item.inventoryId) }}</span>
                      <BaseButton 
                        variant="text" 
                        class="delete-button"
                        @click="removeCondition(item, condIndex)"
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
              <p class="section-description">
                選擇不同的選項組合，預覽對應的庫存消耗情況
              </p>
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
                <div v-if="Object.keys(inventoryPreview).length === 0" class="no-preview">
                  請選擇選項來預覽庫存消耗
                </div>
                <div v-else>
                  <div v-for="(quantity, key) in inventoryPreview" :key="key" class="preview-item">
                    <span>{{ getInventoryDisplayName(key) }}:</span>
                    <span class="preview-quantity">{{ quantity }} {{ getInventoryDisplayUnit(key) }}</span>
                  </div>
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
import './AddMenuItemDialog.styles.css'
import { useAddMenuItemDialog } from './AddMenuItemDialog.script.js'

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

// 使用分離的腳本邏輯
const {
  dialogVisible,
  fileInput,
  form,
  tabs,
  currentTab,
  availableInventory,
  previewOptions,
  inventoryPreview,
  loadAvailableInventory,
  getInventoryUnit,
  getInventoryName,
  getInventoryDisplayName,
  getInventoryDisplayUnit,
  getOptionChoices,
  addBaseInventory,
  addConditionalInventory,
  addCondition,
  updateInventoryPreview,
  triggerFileInput,
  handleImageUpload,
  addOption,
  addChoice,
  removeChoice,
  removeOption,
  removeBaseInventory,
  removeConditionalInventory,
  removeCondition,
  resetForm,
  isValid,
  handleConfirm,
  initializeEditData,
  onBaseInventoryChange,
  onBaseInventoryValueChange,
  onConditionalInventoryChange,
  onConditionOptionTypeChange,
  onConditionOptionValueChange,
  onConditionInventoryValueChange,
  getInventoryValues,
  getCurrentStock
} = useAddMenuItemDialog(props, emit)
</script>
