<template>
  <div 
    class="tab-pane"
    v-show="isActive"
  >
    <slot></slot>
  </div>
</template>

<script setup>
const props = defineProps({
  name: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped>
.tab-pane {
  width: 100%;
}
</style>
