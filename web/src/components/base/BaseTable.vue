<template>
  <div class="table-container" :class="{ 'is-loading': loading }">
    <div class="table-wrapper">
      <table class="base-table" :class="{ hoverable, bordered }">
        <thead>
          <tr>
            <th v-for="column in columns" :key="column.key" :style="{ width: column.width }">
              {{ column.label }}
              <font-awesome-icon 
                v-if="column.sortable" 
                :icon="getSortIcon(column.key)"
                class="sort-icon"
                @click="handleSort(column.key)"
              />
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading">
            <tr v-for="n in 3" :key="n" class="loading-row">
              <td v-for="column in columns" :key="column.key">
                <div class="loading-cell"></div>
              </td>
            </tr>
          </template>
          <template v-else>
            <tr v-for="(row, index) in data" :key="index">
              <td v-for="column in columns" :key="column.key">
                <slot :name="column.key" :row="row">
                  {{ row[column.key] }}
                </slot>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <div v-if="!loading && data.length === 0" class="empty-state">
      <slot name="empty">
        <p>暫無數據</p>
      </slot>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  columns: {
    type: Array,
    required: true
  },
  data: {
    type: Array,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  hoverable: {
    type: Boolean,
    default: true
  },
  bordered: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['sort'])

const sortKey = ref(null)
const sortOrder = ref('asc')

const getSortIcon = (columnKey) => {
  if (sortKey.value !== columnKey) return 'sort'
  return sortOrder.value === 'asc' ? 'sort-up' : 'sort-down'
}

const handleSort = (columnKey) => {
  if (sortKey.value === columnKey) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = columnKey
    sortOrder.value = 'asc'
  }
  emit('sort', { key: columnKey, order: sortOrder.value })
}
</script>

<style scoped>
.table-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05),
              0 0 2px rgba(0, 0, 0, 0.03);
  overflow: hidden;
}

.table-wrapper {
  flex: 1;
  overflow: auto;
  min-height: 0;
}

.base-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9375rem;
}

/* Header */
.base-table thead {
  background-color: #f5f5f7;
  position: sticky;
  top: 0;
  z-index: 10;
}

.base-table th {
  padding: 12px 16px;
  text-align: left;
  font-weight: 600;
  color: #1d1d1f;
  border-bottom: 1px solid #e6e6e6;
  white-space: nowrap;
}

/* Body */
.base-table td {
  padding: 14px 16px;
  color: #1d1d1f;
  border-bottom: 1px solid #f5f5f7;
}

.base-table tr:last-child td {
  border-bottom: none;
}

/* Hoverable */
.base-table.hoverable tbody tr:hover {
  background-color: #f8f8fa;
}

/* Bordered */
.base-table.bordered td,
.base-table.bordered th {
  border: 1px solid #e6e6e6;
}

/* Sort Icon */
.sort-icon {
  margin-left: 4px;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.2s ease;
}

.sort-icon:hover {
  opacity: 1;
}

/* Loading State */
.loading-cell {
  height: 20px;
  background: linear-gradient(90deg, #f0f0f0 25%, #f8f8f8 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s infinite;
  border-radius: 4px;
}

@keyframes loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* Empty State */
.empty-state {
  padding: 40px;
  text-align: center;
  color: #86868b;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 自定義捲動條樣式 */
.table-wrapper::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.table-wrapper::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.table-wrapper::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.table-wrapper::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
