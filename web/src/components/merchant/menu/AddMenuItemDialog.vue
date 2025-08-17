<template>
  <BaseDialog
    v-model="dialogVisible"
    :title="`${props.editingItem ? '編輯' : '添加'}菜品`"
  >

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
    <template #footer>
      <BaseButton variant="text" @click="dialogVisible = false">取消</BaseButton>
      <BaseButton
        variant="primary"
        :disabled="!isValid"
        @click="handleConfirm"
      >確認</BaseButton>
    </template>
  </BaseDialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

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
  options: []
})

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
      options: transformedOptions
    }
  }
}, { immediate: true })

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
    options: []
  }
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

    emit('confirm', { 
      ...form.value,
      options: transformedOptions
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
</style>
