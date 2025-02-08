<template>
  <span class="base-tag" :class="[variant, size, { clickable: onClick }]" @click="handleClick">
    <font-awesome-icon v-if="icon" :icon="icon" class="tag-icon" />
    <slot></slot>
    <font-awesome-icon 
      v-if="dismissible" 
      icon="xmark" 
      class="dismiss-icon"
      @click.stop="$emit('dismiss')" 
    />
  </span>
</template>

<script setup>
const props = defineProps({
  variant: {
    type: String,
    default: 'default',
    validator: (value) => [
      'default', 'primary', 'success', 'warning', 'danger', 'info', 'price'
    ].includes(value)
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
  dismissible: {
    type: Boolean,
    default: false
  },
  onClick: {
    type: Function,
    default: null
  }
})

const handleClick = (event) => {
  if (props.onClick) {
    props.onClick(event)
  }
}
</script>

<style scoped>
.base-tag {
  display: inline-flex;
  align-items: center;
  border-radius: 6px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  transition: all 0.2s ease;
}

/* Sizes */
.base-tag.small {
  padding: 4px 8px;
  font-size: 0.75rem;
}

.base-tag.medium {
  padding: 6px 10px;
  font-size: 0.8125rem;
}

.base-tag.large {
  padding: 8px 12px;
  font-size: 0.875rem;
}

/* Variants */
.base-tag.default {
  background-color: #f5f5f7;
  color: #1d1d1f;
}

.base-tag.primary {
  background-color: #e3f2fd;
  color: #007AFF;
}

.base-tag.success {
  background-color: #e8f5e9;
  color: #34c759;
}

.base-tag.warning {
  background-color: #fff3e0;
  color: #ff9500;
}

.base-tag.danger {
  background-color: #fdecea;
  color: #ff3b30;
}

.base-tag.price {
  background-color: #e6f4ff;
  color: #0066ff;
}

.base-tag.info {
  background-color: #e8f4fd;
  color: #5856d6;
}

/* Clickable State */
.base-tag.clickable {
  cursor: pointer;
}

.base-tag.clickable:hover {
  filter: brightness(0.95);
}

.base-tag.clickable:active {
  filter: brightness(0.9);
}

/* Icons */
.tag-icon {
  margin-right: 6px;
  font-size: 0.875em;
}

.dismiss-icon {
  margin-left: 6px;
  font-size: 0.875em;
  opacity: 0.7;
  cursor: pointer;
}

.dismiss-icon:hover {
  opacity: 1;
}
</style>
