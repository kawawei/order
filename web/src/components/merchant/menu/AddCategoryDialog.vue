<template>
  <BaseDialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="添加菜單種類"
    size="small"
  >
    <div class="add-category-dialog">
      <!-- 當前種類列表 -->
      <div class="current-categories">
        <h4>當前種類</h4>
        <div class="category-tags">
          <BaseTag
            v-for="category in categories"
            :key="category._id"
          >
            {{ category.label }}
          </BaseTag>
        </div>
      </div>

      <!-- 輸入新種類 -->
      <div class="new-category">
        <h4>新增種類</h4>
        <div class="input-group">
          <input
            v-model="categoryName"
            type="text"
            placeholder="請輸入種類名稱"
            @keyup.enter="handleConfirm"
          >
          <p v-if="error" class="error-message">{{ error }}</p>
        </div>
      </div>
    </div>

    <template #footer>
      <BaseButton variant="text" @click="handleClose">取消</BaseButton>
      <BaseButton
        :disabled="!categoryName.trim()"
        @click="handleConfirm"
      >
        確認
      </BaseButton>
    </template>
  </BaseDialog>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  categories: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const categoryName = ref('')
const error = ref('')

// 監聽對話框開關，重置表單
watch(() => props.modelValue, (newVal) => {
  if (!newVal) {
    categoryName.value = ''
    error.value = ''
  }
})

const handleClose = () => {
  emit('update:modelValue', false)
}

const handleConfirm = () => {
  const name = categoryName.value.trim()
  
  // 驗證
  if (!name) {
    error.value = '請輸入種類名稱'
    return
  }
  
  // 檢查是否重複
  const isDuplicate = props.categories.some(
    category => category.label === name || category.name === name.toLowerCase().replace(/\s+/g, '-')
  )
  
  if (isDuplicate) {
    error.value = '此種類名稱已存在'
    return
  }

  emit('confirm', name)
  handleClose()
}
</script>

<style scoped>
.add-category-dialog {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.current-categories,
.new-category {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

h4 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #666;
}

.category-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

input {
  padding: 0.5rem;
  border: 1px solid #e6e6e6;
  border-radius: 4px;
  font-size: 0.875rem;
}

input:focus {
  outline: none;
  border-color: #0066ff;
}

.error-message {
  margin: 0;
  font-size: 0.75rem;
  color: #ff4d4f;
}
</style>
