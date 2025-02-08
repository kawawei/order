<template>
  <Transition name="toast">
    <div 
      v-if="visible"
      :class="[
        'toast',
        `toast-${type}`,
        position
      ]"
    >
      <div class="toast-icon">
        <font-awesome-icon :icon="icon" />
      </div>
      <div class="toast-content">
        {{ message }}
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'info',
    validator: (value) => ['success', 'error', 'info', 'warning'].includes(value)
  },
  position: {
    type: String,
    default: 'toast-top',
    validator: (value) => ['toast-top', 'toast-bottom'].includes(value)
  }
})

const icon = computed(() => {
  switch (props.type) {
    case 'success':
      return 'circle-check'
    case 'error':
      return 'circle-xmark'
    case 'warning':
      return 'triangle-exclamation'
    default:
      return 'circle-info'
  }
})
</script>

<style>
.toast {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  padding: 0.875rem 1.25rem;
  border-radius: 12px;
  color: #ffffff;
  font-size: 0.9rem;
  font-weight: 500;
  z-index: 9999;
  min-width: 320px;
  max-width: 90%;
  backdrop-filter: blur(8px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.12);
  letter-spacing: 0.3px;
}

.toast-top {
  top: 1.5rem;
}

.toast-bottom {
  bottom: 1.5rem;
}

.toast-icon {
  margin-right: 0.875rem;
  font-size: 1.25rem;
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  padding: 5px;
}

.toast-content {
  flex-grow: 1;
}

.toast-success {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.toast-error {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.toast-warning {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.toast-info {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* 過渡動畫 */
.toast-enter-active {
  transition: all 0.4s cubic-bezier(0.33, 1, 0.68, 1);
}

.toast-leave-active {
  transition: all 0.2s cubic-bezier(0.32, 0, 0.67, 0);
}

.toast-enter-from {
  opacity: 0;
  transform: translate(-50%, -20px);
}

.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -10px);
}
</style>
