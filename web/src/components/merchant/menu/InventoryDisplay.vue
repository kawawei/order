<template>
  <div class="inventory-display">
    <div v-if="inventoryConfig && hasInventory" class="inventory-info">
      <h4 class="inventory-title">
        <font-awesome-icon icon="box" class="mr-2" />
        庫存關聯
      </h4>
      
      <!-- 使用標籤顯示庫存 -->
      <div class="inventory-tags">
        <BaseTag
          v-for="item in allInventoryItems" 
          :key="item.inventoryId" 
          variant="default"
          size="small"
        >
          {{ getInventoryName(item.inventoryId) }} {{ item.totalQuantity }}{{ getInventoryUnit(item.inventoryId) }}
        </BaseTag>
      </div>
    </div>
    
    <div v-else class="no-inventory">
      <span class="no-inventory-text">未配置庫存</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import BaseTag from '@/components/base/BaseTag.vue'

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

// 合併所有庫存項目，簡化顯示
const allInventoryItems = computed(() => {
  const items = []
  
  // 添加基礎庫存
  if (props.inventoryConfig?.baseInventory) {
    props.inventoryConfig.baseInventory.forEach(item => {
      const existing = items.find(i => i.inventoryId === item.inventoryId)
      if (existing) {
        existing.totalQuantity += item.quantity
      } else {
        items.push({
          inventoryId: item.inventoryId,
          totalQuantity: item.quantity
        })
      }
    })
  }
  
  // 添加條件庫存（只計算基礎數量）
  if (props.inventoryConfig?.conditionalInventory) {
    props.inventoryConfig.conditionalInventory.forEach(item => {
      const existing = items.find(i => i.inventoryId === item.inventoryId)
      if (existing) {
        existing.totalQuantity += item.baseQuantity
      } else {
        items.push({
          inventoryId: item.inventoryId,
          totalQuantity: item.baseQuantity
        })
      }
    })
  }
  
  return items
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
  margin-top: 0.75rem;
  padding: 0.5rem;
  background-color: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.inventory-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: #495057;
  margin: 0 0 0.5rem 0;
  display: flex;
  align-items: center;
}

.inventory-title .mr-2 {
  margin-right: 0.5rem;
}

.inventory-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.no-inventory {
  text-align: center;
  padding: 0.25rem;
}

.no-inventory-text {
  font-size: 0.75rem;
  color: #6c757d;
  font-style: italic;
}
</style>
