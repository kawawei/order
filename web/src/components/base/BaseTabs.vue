<template>
  <div class="tabs-container">
    <div class="tabs-header">
      <div class="tabs-list">
        <button
          v-for="tab in tabs"
          :key="tab.name"
          class="tab-button"
          :class="{ 'active': modelValue === tab.name }"
          @click="$emit('update:modelValue', tab.name)"
        >
          {{ tab.label }}
        </button>
      </div>
      <slot name="actions"></slot>
    </div>
    
    <div class="tab-content">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: {
    type: String,
    required: true
  },
  tabs: {
    type: Array,
    required: true,
    validator: (value) => {
      return value.every(tab => 
        typeof tab === 'object' && 
        'name' in tab && 
        'label' in tab
      )
    }
  }
})

defineEmits(['update:modelValue'])
</script>

<style scoped>
.tabs-container {
  width: 100%;
}

.tabs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e6e6e6;
  margin-bottom: 1rem;
  padding: 0 0.5rem;
}

.tabs-list {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.tabs-list::-webkit-scrollbar {
  display: none;
}

.tab-button {
  padding: 0.75rem 1.25rem;
  border: none;
  background: none;
  color: #666;
  font-size: 0.9375rem;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.tab-button:hover {
  color: #1a73e8;
}

.tab-button.active {
  color: #1a73e8;
  border-bottom-color: #1a73e8;
}

.tab-content {
  padding: 1rem 0.5rem;
}
</style>
