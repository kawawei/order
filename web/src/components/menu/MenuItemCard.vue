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
          NT$ {{ item.basePrice }}
        </div>
      </div>

      <!-- 選項列表 -->
      <div class="item-options">
        <template v-for="optionType in item.options" :key="optionType">
          <div class="option-group">
            <h4>{{ getOptionGroupLabel(optionType) }}</h4>
            <div class="option-list">
              <BaseTag
                v-for="option in getOptions(optionType)"
                :key="option.name"
                :variant="option.price ? 'price' : 'default'"
              >
                {{ option.label }}
                <template v-if="option.price">
                  +{{ option.price }}
                </template>
              </BaseTag>
            </div>
          </div>
        </template>
      </div>

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
const props = defineProps({
  item: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['edit', 'delete'])

// 選項組標籤映射
const optionGroupLabels = {
  size: '份量',
  extra: '加料',
  sugar: '甜度'
}

// 獲取選項組標籤
const getOptionGroupLabel = (type) => {
  return optionGroupLabels[type] || type
}

// 獲取選項列表
const getOptions = (type) => {
  // 這裡暫時使用寫死的數據，之後可以改為從 props 或 store 中獲取
  const defaultOptions = {
    size: [
      { name: 'large', label: '大份', price: 30 },
      { name: 'small', label: '小份', price: 20 }
    ],
    extra: [
      { name: 'extra_rice', label: '加飯', price: 10 },
      { name: 'extra_noodles', label: '加麵', price: 10 }
    ],
    sugar: [
      { name: 'normal', label: '正常' },
      { name: 'half', label: '半糖' },
      { name: 'less', label: '少糖' },
      { name: 'no', label: '無糖' }
    ]
  }
  return defaultOptions[type] || []
}
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
