<template>
  <Teleport to="body">
    <Transition name="dialog">
      <div v-if="modelValue" class="dialog-wrapper" @click.self="handleClose">
        <div class="dialog" :class="size">
          <!-- 標題區 -->
          <div class="dialog-header">
            <h3 class="dialog-title">
              <slot name="title">{{ title }}</slot>
            </h3>
            <button v-if="showClose" class="close-button" @click="handleClose">
              <font-awesome-icon icon="xmark" />
            </button>
          </div>

          <!-- 內容區 -->
          <div class="dialog-body">
            <slot></slot>
          </div>

          <!-- 按鈕區 -->
          <div class="dialog-footer">
            <slot name="footer">
              <BaseButton variant="text" @click="handleClose">取消</BaseButton>
              <BaseButton variant="primary" @click="$emit('confirm')">確認</BaseButton>
            </slot>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    required: true
  },
  title: {
    type: String,
    default: ''
  },
  showClose: {
    type: Boolean,
    default: true
  },
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  }
})

const emit = defineEmits(['update:modelValue', 'confirm'])

const handleClose = () => {
  emit('update:modelValue', false)
}

// 處理 ESC 鍵關閉
const handleEscape = (e) => {
  if (e.key === 'Escape' && props.modelValue) {
    handleClose()
  }
}

// 禁止背景滾動
const preventScroll = (e) => {
  if (props.modelValue) {
    e.preventDefault()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleEscape)
  document.body.style.overflow = 'hidden'
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
  document.body.style.overflow = ''
})
</script>

<style scoped>
.dialog-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.dialog {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  max-width: 90vw;
}

.dialog.small {
  width: 400px;
}

.dialog.medium {
  width: 600px;
}

.dialog.large {
  width: 800px;
}

.dialog-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dialog-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1d1d1f;
}

.close-button {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-button:hover {
  background-color: #f5f5f7;
  color: #1d1d1f;
}

.dialog-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
}

.dialog-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid #e6e6e6;
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

/* 過渡動畫 */
.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.3s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}

.dialog-enter-active .dialog,
.dialog-leave-active .dialog {
  transition: transform 0.3s ease-out;
}

.dialog-enter-from .dialog {
  transform: translateY(-20px);
}

.dialog-leave-to .dialog {
  transform: translateY(20px);
}
</style>
