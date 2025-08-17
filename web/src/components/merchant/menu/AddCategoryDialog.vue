<template>
  <BaseDialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="菜單種類管理"
    size="small"
  >
    <div class="add-category-dialog">
      <!-- 當前種類列表 -->
      <div class="current-categories">
        <h4>當前種類</h4>
        <div class="category-tags">
          <div
            v-for="category in categories"
            :key="category._id"
            class="category-item"
            :class="{ 'selected': selectedCategory?._id === category._id }"
            @click="selectCategory(category)"
          >
            <BaseTag>
              {{ category.label }}
            </BaseTag>
          </div>
        </div>
      </div>

      <!-- 編輯選中的種類 -->
      <div v-if="selectedCategory" class="edit-category">
        <h4>編輯種類</h4>
        <div class="input-group">
          <input
            v-model="editingName"
            type="text"
            placeholder="請輸入種類名稱"
            @keyup.enter="handleUpdateCategory"
          >
          <p v-if="error" class="error-message">{{ error }}</p>
        </div>
        <div class="edit-actions">
          <BaseButton variant="text" @click="clearSelection">取消編輯</BaseButton>
          <BaseButton variant="danger" @click="handleDeleteCategory">刪除</BaseButton>
          <BaseButton
            :disabled="!editingName.trim()"
            @click="handleUpdateCategory"
          >
            更新
          </BaseButton>
        </div>
      </div>

      <!-- 輸入新種類 -->
      <div v-else class="new-category">
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
        v-if="!selectedCategory"
        :disabled="!categoryName.trim()"
        @click="handleConfirm"
      >
        新增
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

const emit = defineEmits(['update:modelValue', 'confirm', 'update-category', 'delete-category'])

const categoryName = ref('') // 新增種類名稱 - For adding new categories
const editingName = ref('') // 編輯中的種類名稱 - For editing existing categories
const error = ref('') // 錯誤訊息 - Error message
const selectedCategory = ref(null) // 選中的種類 - Currently selected category for editing

// 監聽對話框開關，重置表單 - Reset form when dialog opens/closes
watch(() => props.modelValue, (newVal) => {
  if (!newVal) {
    categoryName.value = ''
    editingName.value = ''
    error.value = ''
    selectedCategory.value = null
  }
})

// 選中種類進行編輯 - Select a category for editing
const selectCategory = (category) => {
  selectedCategory.value = category
  editingName.value = category.label
  error.value = ''
}

// 清除選中狀態 - Clear selection and return to add mode
const clearSelection = () => {
  selectedCategory.value = null
  editingName.value = ''
  error.value = ''
}

// 關閉對話框 - Close dialog
const handleClose = () => {
  emit('update:modelValue', false)
}

// 新增種類 - Add new category
const handleConfirm = () => {
  const name = categoryName.value.trim()
  
  // 驗證 - Validation
  if (!name) {
    error.value = '請輸入種類名稱'
    return
  }
  
  // 檢查是否重複 - Check for duplicates
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

// 更新種類名稱 - Update category name
const handleUpdateCategory = () => {
  const name = editingName.value.trim()
  
  // 驗證 - Validation
  if (!name) {
    error.value = '請輸入種類名稱'
    return
  }
  
  // 檢查是否與其他種類重複 - Check for duplicates with other categories
  const isDuplicate = props.categories.some(
    category => category._id !== selectedCategory.value._id && 
    (category.label === name || category.name === name.toLowerCase().replace(/\s+/g, '-'))
  )
  
  if (isDuplicate) {
    error.value = '此種類名稱已存在'
    return
  }

  emit('update-category', {
    id: selectedCategory.value._id,
    name: name
  })
  handleClose()
}

// 刪除種類 - Delete category
const handleDeleteCategory = () => {
  if (confirm(`確定要刪除「${selectedCategory.value.label}」種類嗎？`)) {
    emit('delete-category', selectedCategory.value._id)
    handleClose()
  }
}
</script>

<style scoped>
.add-category-dialog {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.current-categories,
.new-category,
.edit-category {
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

/* 種類項目樣式 - Category item styles */
.category-item {
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 4px;
  padding: 2px;
}

.category-item:hover {
  background-color: #f0f8ff;
}

.category-item.selected {
  background-color: #e6f3ff;
  border: 2px solid #0066ff;
  padding: 0px; /* 調整 padding 以補償 border */
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

/* 編輯操作按鈕 - Edit action buttons */
.edit-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}

.edit-actions .base-button {
  flex: 1;
  min-width: fit-content;
}

/* 編輯區域樣式 - Edit section styles */
.edit-category {
  background-color: #f8f9fa;
  border: 1px solid #e6e6e6;
  border-radius: 6px;
  padding: 1rem;
}

.edit-category h4 {
  color: #0066ff;
}
</style>
