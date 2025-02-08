<template>
  <button
    :class="[
      'base-button',
      variant,
      size,
      { 'is-loading': loading, 'is-disabled': disabled }
    ]"
    :disabled="disabled || loading"
    @click="$emit('click', $event)"
  >
    <span v-if="loading" class="loader"></span>
    <font-awesome-icon v-if="icon && !loading" :icon="icon" :class="{ 'with-text': $slots.default }" />
    <span v-if="$slots.default" class="button-text">
      <slot></slot>
    </span>
  </button>
</template>

<script setup>
defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (value) => ['primary', 'secondary', 'danger', 'text'].includes(value)
  },
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  },
  icon: {
    type: String,
    default: ''
  },
  loading: {
    type: Boolean,
    default: false
  },
  disabled: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-weight: 500;
  transition: all 0.2s ease;
  cursor: pointer;
  border: none;
  background: none;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif;
}

/* Sizes */
.base-button.small {
  padding: 6px 12px;
  font-size: 0.875rem;
  min-height: 32px;
}

.base-button.medium {
  padding: 8px 16px;
  font-size: 0.9375rem;
  min-height: 36px;
}

.base-button.large {
  padding: 10px 20px;
  font-size: 1rem;
  min-height: 44px;
}

/* Variants */
.base-button.primary {
  background-color: #007AFF;
  color: white;
}

.base-button.primary:hover {
  background-color: #0066d6;
}

.base-button.primary:active {
  background-color: #0055b3;
}

.base-button.secondary {
  background-color: #f5f5f7;
  color: #1d1d1f;
}

.base-button.secondary:hover {
  background-color: #e8e8ed;
}

.base-button.secondary:active {
  background-color: #dcdce2;
}

.base-button.danger {
  background-color: #FF3B30;
  color: white;
}

.base-button.danger:hover {
  background-color: #e6352b;
}

.base-button.danger:active {
  background-color: #cc2f26;
}

.base-button.text {
  color: #007AFF;
  padding-left: 8px;
  padding-right: 8px;
}

.base-button.text:hover {
  color: #0066d6;
  background-color: #f5f5f7;
}

/* States */
.base-button.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.base-button.is-loading {
  cursor: wait;
}

/* Icon */
.base-button .with-text {
  margin-right: 8px;
}

/* Loader */
.loader {
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-bottom-color: transparent;
  border-radius: 50%;
  display: inline-block;
  animation: rotation 1s linear infinite;
  margin-right: 8px;
}

@keyframes rotation {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
