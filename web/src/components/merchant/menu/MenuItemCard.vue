<template>
  <div class="menu-item-card">
    <!-- 菜品圖片 -->
    <div class="item-image">
      <img :src="item.image" :alt="item.name">
    </div>

    <!-- 菜品信息 -->
    <div class="item-info">
      <div class="item-header">
        <h3>{{ item.name }}</h3>
        <div class="price">
          NT$ {{ item.price || item.basePrice }}
        </div>
      </div>

      <!-- 選項列表 -->
      <div class="item-options" v-if="item.customOptions && item.customOptions.length > 0">
        <template v-for="optionGroup in item.customOptions" :key="optionGroup.name">
          <div class="option-group">
            <h4>{{ optionGroup.name }}</h4>
            <div class="option-list">
              <BaseTag
                v-for="option in optionGroup.options"
                :key="option.label"
                :variant="option.price > 0 ? 'price' : 'default'"
              >
                {{ option.label }}
                <template v-if="option.price > 0">
                  +{{ option.price }}
                </template>
              </BaseTag>
            </div>
          </div>
        </template>
      </div>
      
      <!-- 菜品描述 -->
      <div class="item-description" v-if="item.description">
        <p>{{ item.description }}</p>
      </div>

      <!-- 庫存關聯顯示 -->
      <InventoryDisplay 
        :inventory-config="item.inventoryConfig"
        :available-inventory="availableInventory"
      />

      <!-- 操作按鈕 -->
      <div class="item-actions">
        <BaseButton variant="text" size="small" @click="$emit('edit', item)">
          <font-awesome-icon icon="pen" />
          編輯
        </BaseButton>
        <BaseButton variant="text" size="small" class="delete" @click="$emit('delete', item)">
          <font-awesome-icon icon="trash" />
          刪除
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<script setup>
import InventoryDisplay from './InventoryDisplay.vue'

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  availableInventory: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['edit', 'delete'])

// 組件正在處理後端返回的数据结构，不再需要静态映射
</script>

<style scoped>
.menu-item-card {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  width: 400px;
}

.item-image {
  width: 120px;
  height: 120px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
}

.item-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.item-header h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1d1d1f;
}

.price {
  font-weight: 600;
  color: #0066ff;
}

.item-options {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.option-group h4 {
  margin: 0 0 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #666;
}

.option-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.item-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: auto;
}

.delete {
  color: #ff4d4f;
}
</style>
