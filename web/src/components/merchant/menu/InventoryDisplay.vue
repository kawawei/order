<template>
  <div class="inventory-display">
    <div v-if="inventoryConfig && hasInventory" class="inventory-info">
      <h4 class="inventory-title">
        <font-awesome-icon icon="box" class="mr-2" />
        庫存關聯
      </h4>
      
      <!-- 基礎庫存 -->
      <div v-if="baseInventory.length > 0" class="inventory-section">
        <h5 class="section-title">基礎庫存</h5>
        <div class="inventory-list">
          <div 
            v-for="item in baseInventory" 
            :key="item.inventoryId" 
            class="inventory-item"
          >
            <span class="item-name">{{ getInventoryName(item.inventoryId) }}</span>
            <span class="item-quantity">{{ item.quantity }} {{ getInventoryUnit(item.inventoryId) }}</span>
          </div>
        </div>
      </div>
      
      <!-- 條件庫存 -->
      <div v-if="conditionalInventory.length > 0" class="inventory-section">
        <h5 class="section-title">條件庫存</h5>
        <div class="inventory-list">
          <div 
            v-for="item in conditionalInventory" 
            :key="item.inventoryId" 
            class="inventory-item"
          >
            <div class="conditional-header">
              <span class="item-name">{{ getInventoryName(item.inventoryId) }}</span>
              <span class="base-quantity">基礎: {{ item.baseQuantity }} {{ getInventoryUnit(item.inventoryId) }}</span>
            </div>
            <div v-if="item.conditions.length > 0" class="conditions-list">
              <div 
                v-for="condition in item.conditions" 
                :key="`${condition.optionType}-${condition.optionValue}`"
                class="condition-item"
              >
                <span class="condition-text">
                  {{ condition.optionType }}: {{ condition.optionValue }}
                </span>
                <span class="condition-quantity">
                  {{ condition.multiplier > 1 ? `×${condition.multiplier}` : '' }}
                  {{ condition.additionalQuantity > 0 ? `+${condition.additionalQuantity}` : '' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else class="no-inventory">
      <span class="no-inventory-text">未配置庫存</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  inventoryConfig: {
    type: Object,
    default: null
  },
  availableInventory: {
    type: Array,
    default: () => []
  }
})

// 計算是否有庫存配置
const hasInventory = computed(() => {
  if (!props.inventoryConfig) return false
  
  const hasBase = props.inventoryConfig.baseInventory && 
                  props.inventoryConfig.baseInventory.length > 0
  const hasConditional = props.inventoryConfig.conditionalInventory && 
                         props.inventoryConfig.conditionalInventory.length > 0
  
  return hasBase || hasConditional
})

// 基礎庫存列表
const baseInventory = computed(() => {
  return props.inventoryConfig?.baseInventory || []
})

// 條件庫存列表
const conditionalInventory = computed(() => {
  return props.inventoryConfig?.conditionalInventory || []
})

// 獲取庫存名稱
const getInventoryName = (inventoryId) => {
  const inventory = props.availableInventory.find(inv => inv._id === inventoryId)
  return inventory ? inventory.name : '未知庫存'
}

// 獲取庫存單位
const getInventoryUnit = (inventoryId) => {
  const inventory = props.availableInventory.find(inv => inv._id === inventoryId)
  return inventory ? inventory.unit : ''
}
</script>

<style scoped>
.inventory-display {
  margin-top: 1rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.inventory-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #495057;
  margin: 0 0 0.75rem 0;
  display: flex;
  align-items: center;
}

.inventory-title .mr-2 {
  margin-right: 0.5rem;
}

.inventory-section {
  margin-bottom: 1rem;
}

.inventory-section:last-child {
  margin-bottom: 0;
}

.section-title {
  font-size: 0.75rem;
  font-weight: 500;
  color: #6c757d;
  margin: 0 0 0.5rem 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.inventory-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.inventory-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background-color: white;
  border-radius: 4px;
  border: 1px solid #dee2e6;
}

.conditional-header {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.item-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #495057;
}

.item-quantity, .base-quantity {
  font-size: 0.75rem;
  color: #6c757d;
  font-weight: 500;
}

.conditions-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: 0.5rem;
}

.condition-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.25rem 0.5rem;
  background-color: #f8f9fa;
  border-radius: 3px;
  font-size: 0.75rem;
}

.condition-text {
  color: #495057;
}

.condition-quantity {
  color: #6c757d;
  font-weight: 500;
}

.no-inventory {
  text-align: center;
  padding: 1rem;
}

.no-inventory-text {
  font-size: 0.875rem;
  color: #6c757d;
  font-style: italic;
}
</style>
