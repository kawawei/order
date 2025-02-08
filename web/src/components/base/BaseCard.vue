<template>
  <div class="base-card" :class="[elevation, { hoverable }]">
    <div v-if="$slots.header" class="card-header">
      <slot name="header"></slot>
    </div>
    <div class="card-body">
      <slot></slot>
    </div>
    <div v-if="$slots.footer" class="card-footer">
      <slot name="footer"></slot>
    </div>
  </div>
</template>

<script setup>
defineProps({
  elevation: {
    type: String,
    default: 'low',
    validator: (value) => ['none', 'low', 'medium', 'high'].includes(value)
  },
  hoverable: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped>
.base-card {
  background-color: white;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
}

/* Elevation Levels */
.base-card.none {
  border: 1px solid #e6e6e6;
}

.base-card.low {
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05),
              0 0 2px rgba(0, 0, 0, 0.03);
}

.base-card.medium {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08),
              0 0 3px rgba(0, 0, 0, 0.04);
}

.base-card.high {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12),
              0 0 4px rgba(0, 0, 0, 0.05);
}

/* Hover Effect */
.base-card.hoverable:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.15),
              0 0 6px rgba(0, 0, 0, 0.06);
}

/* Card Sections */
.card-header {
  padding: 16px 20px;
  border-bottom: 1px solid #f5f5f7;
  font-weight: 500;
}

.card-body {
  padding: 20px;
}

.card-footer {
  padding: 16px 20px;
  border-top: 1px solid #f5f5f7;
  background-color: #fafafa;
}
</style>
