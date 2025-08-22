<template>
  <div class="date-picker-container">
    <!-- 日期選擇器觸發按鈕 -->
    <div class="date-picker-trigger" @click="togglePicker">
      <div class="trigger-content">
        <font-awesome-icon icon="calendar" class="trigger-icon" />
        <span class="trigger-text">{{ displayText }}</span>
      </div>
    </div>

    <!-- 日期選擇器彈出層 -->
    <div v-if="isOpen" class="date-picker-dropdown">
      <!-- 模式切換 -->
      <div class="mode-selector">
        <button 
          v-for="mode in modes" 
          :key="mode.value"
          class="mode-button"
          :class="{ 'active': currentMode === mode.value }"
          @click="switchMode(mode.value)"
        >
          {{ mode.label }}
        </button>
      </div>

      <!-- 日期選擇器內容 -->
      <div class="picker-content">
        <!-- 年選擇器 -->
        <div v-if="currentMode === 'year'" class="year-picker">
          <div class="picker-header">
            <button class="nav-button" @click="previousDecade">
              <font-awesome-icon icon="chevron-left" />
            </button>
            <span class="current-range">{{ decadeStart }} - {{ decadeEnd }}</span>
            <button class="nav-button" @click="nextDecade">
              <font-awesome-icon icon="chevron-right" />
            </button>
          </div>
          <div class="year-grid">
            <button 
              v-for="year in yearList" 
              :key="year"
              class="year-item"
              :class="{ 
                'selected': year === selectedDate.getFullYear(),
                'current': year === currentYear,
                'disabled': year < minYear || year > maxYear
              }"
              @click="selectYear(year)"
              :disabled="year < minYear || year > maxYear"
            >
              {{ year }}
            </button>
          </div>
        </div>

        <!-- 月選擇器 -->
        <div v-else-if="currentMode === 'month'" class="month-picker">
          <div class="picker-header">
            <button class="nav-button" @click="previousYear">
              <font-awesome-icon icon="chevron-left" />
            </button>
            <span class="current-year">{{ selectedDate.getFullYear() }}</span>
            <button class="nav-button" @click="nextYear">
              <font-awesome-icon icon="chevron-right" />
            </button>
          </div>
          <div class="month-grid">
            <button 
              v-for="(month, index) in months" 
              :key="index"
              class="month-item"
              :class="{ 
                'selected': index === selectedDate.getMonth(),
                'current': index === currentMonth && selectedDate.getFullYear() === currentYear
              }"
              @click="selectMonth(index)"
            >
              {{ month }}
            </button>
          </div>
        </div>

        <!-- 日選擇器 -->
        <div v-else class="day-picker">
          <div class="picker-header">
            <button class="nav-button" @click="previousMonth">
              <font-awesome-icon icon="chevron-left" />
            </button>
            <span class="current-month-year">
              {{ months[selectedDate.getMonth()] }} {{ selectedDate.getFullYear() }}
            </span>
            <button class="nav-button" @click="nextMonth">
              <font-awesome-icon icon="chevron-right" />
            </button>
          </div>
          
          <!-- 星期標題 -->
          <div class="weekdays">
            <span v-for="day in weekdays" :key="day" class="weekday">{{ day }}</span>
          </div>
          
          <!-- 日期網格 -->
          <div class="days-grid">
            <button 
              v-for="day in calendarDays" 
              :key="day.key"
              class="day-item"
              :class="{
                'other-month': !day.isCurrentMonth,
                'selected': day.isSelected,
                'current': day.isCurrent,
                'disabled': day.isDisabled
              }"
              @click="selectDay(day)"
              :disabled="day.isDisabled"
            >
              {{ day.day }}
            </button>
          </div>
        </div>
      </div>

      <!-- 快速選擇按鈕 -->
      <div class="quick-actions">
        <button class="quick-button" @click="selectToday">今天</button>
        <button class="quick-button" @click="clearSelection">清除</button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'

export default {
  name: 'BaseDatePicker',
  props: {
    modelValue: {
      type: Date,
      default: null
    },
    mode: {
      type: String,
      default: 'day',
      validator: (value) => ['day', 'month', 'year'].includes(value)
    },
    minDate: {
      type: Date,
      default: null
    },
    maxDate: {
      type: Date,
      default: null
    },
    placeholder: {
      type: String,
      default: '選擇日期'
    }
  },
  emits: ['update:modelValue', 'change', 'modeChange'],
  setup(props, { emit }) {
    const isOpen = ref(false)
    const currentMode = ref(props.mode)
    const selectedDate = ref(props.modelValue ? new Date(props.modelValue) : new Date())
    const currentYear = ref(new Date().getFullYear())
    const currentMonth = ref(new Date().getMonth())
    const decadeStart = ref(Math.floor(currentYear.value / 10) * 10)

    // 模式選項
    const modes = [
      { value: 'day', label: '日' },
      { value: 'month', label: '月' },
      { value: 'year', label: '年' }
    ]

    // 月份名稱
    const months = [
      '一月', '二月', '三月', '四月', '五月', '六月',
      '七月', '八月', '九月', '十月', '十一月', '十二月'
    ]

    // 星期名稱
    const weekdays = ['日', '一', '二', '三', '四', '五', '六']

    // 計算屬性
    const decadeEnd = computed(() => decadeStart.value + 9)
    
    const yearList = computed(() => {
      const years = []
      for (let i = decadeStart.value - 1; i <= decadeStart.value + 10; i++) {
        years.push(i)
      }
      return years
    })

    const minYear = computed(() => props.minDate ? props.minDate.getFullYear() : 1900)
    const maxYear = computed(() => props.maxDate ? props.maxDate.getFullYear() : 2100)

    const displayText = computed(() => {
      if (!props.modelValue) return props.placeholder
      
      const date = new Date(props.modelValue)
      switch (currentMode.value) {
        case 'year':
          return `${date.getFullYear()}年`
        case 'month':
          return `${date.getFullYear()}年${months[date.getMonth()]}`
        case 'day':
        default:
          return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
      }
    })

    const calendarDays = computed(() => {
      const year = selectedDate.value.getFullYear()
      const month = selectedDate.value.getMonth()
      const firstDay = new Date(year, month, 1)
      const lastDay = new Date(year, month + 1, 0)
      const startDate = new Date(firstDay)
      startDate.setDate(startDate.getDate() - firstDay.getDay())
      
      const days = []
      const currentDate = new Date()
      
      for (let i = 0; i < 42; i++) {
        const day = new Date(startDate)
        day.setDate(startDate.getDate() + i)
        
        const isCurrentMonth = day.getMonth() === month
        const isSelected = props.modelValue && 
          day.getDate() === props.modelValue.getDate() &&
          day.getMonth() === props.modelValue.getMonth() &&
          day.getFullYear() === props.modelValue.getFullYear()
        const isCurrent = day.getDate() === currentDate.getDate() &&
          day.getMonth() === currentDate.getMonth() &&
          day.getFullYear() === currentDate.getFullYear()
        const isDisabled = (props.minDate && day < props.minDate) ||
          (props.maxDate && day > props.maxDate)
        
        days.push({
          key: `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`,
          day: day.getDate(),
          date: day,
          isCurrentMonth,
          isSelected,
          isCurrent,
          isDisabled
        })
      }
      
      return days
    })

    // 方法
    const togglePicker = () => {
      isOpen.value = !isOpen.value
    }

    const closePicker = () => {
      isOpen.value = false
    }

    const switchMode = (mode) => {
      currentMode.value = mode
      emit('modeChange', mode)
    }

    const previousDecade = () => {
      decadeStart.value -= 10
    }

    const nextDecade = () => {
      decadeStart.value += 10
    }

    const previousYear = () => {
      const newDate = new Date(selectedDate.value)
      newDate.setFullYear(newDate.getFullYear() - 1)
      selectedDate.value = newDate
    }

    const nextYear = () => {
      const newDate = new Date(selectedDate.value)
      newDate.setFullYear(newDate.getFullYear() + 1)
      selectedDate.value = newDate
    }

    const previousMonth = () => {
      const newDate = new Date(selectedDate.value)
      newDate.setMonth(newDate.getMonth() - 1)
      selectedDate.value = newDate
    }

    const nextMonth = () => {
      const newDate = new Date(selectedDate.value)
      newDate.setMonth(newDate.getMonth() + 1)
      selectedDate.value = newDate
    }

    const selectYear = (year) => {
      const newDate = new Date(selectedDate.value)
      newDate.setFullYear(year)
      selectedDate.value = newDate
      if (currentMode.value === 'year') {
        emitDate()
        closePicker()
      } else {
        currentMode.value = 'month'
      }
    }

    const selectMonth = (month) => {
      const newDate = new Date(selectedDate.value)
      newDate.setMonth(month)
      selectedDate.value = newDate
      if (currentMode.value === 'month') {
        emitDate()
        closePicker()
      } else {
        currentMode.value = 'day'
      }
    }

    const selectDay = (day) => {
      if (day.isDisabled) return
      
      const newDate = new Date(day.date)
      selectedDate.value = newDate
      emitDate()
      closePicker()
    }

    const selectToday = () => {
      const today = new Date()
      selectedDate.value = today
      emitDate()
      closePicker()
    }

    const clearSelection = () => {
      emit('update:modelValue', null)
      emit('change', null)
      closePicker()
    }

    const emitDate = () => {
      const date = new Date(selectedDate.value)
      emit('update:modelValue', date)
      emit('change', date)
    }

    // 監聽外部點擊
    const handleClickOutside = (event) => {
      const picker = document.querySelector('.date-picker-container')
      if (picker && !picker.contains(event.target)) {
        closePicker()
      }
    }

    // 監聽文檔點擊事件
    watch(isOpen, (newValue) => {
      if (newValue) {
        document.addEventListener('click', handleClickOutside)
      } else {
        document.removeEventListener('click', handleClickOutside)
      }
    })

    // 監聽 props 變化
    watch(() => props.modelValue, (newValue) => {
      if (newValue) {
        selectedDate.value = new Date(newValue)
      }
    })

    watch(() => props.mode, (newValue) => {
      currentMode.value = newValue
    })

    return {
      isOpen,
      currentMode,
      selectedDate,
      currentYear,
      currentMonth,
      decadeStart,
      modes,
      months,
      weekdays,
      decadeEnd,
      yearList,
      minYear,
      maxYear,
      displayText,
      calendarDays,
      togglePicker,
      closePicker,
      switchMode,
      previousDecade,
      nextDecade,
      previousYear,
      nextYear,
      previousMonth,
      nextMonth,
      selectYear,
      selectMonth,
      selectDay,
      selectToday,
      clearSelection
    }
  }
}
</script>

<style scoped>
.date-picker-container {
  position: relative;
  display: inline-block;
}

.date-picker-trigger {
  cursor: pointer;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 8px 12px;
  background: white;
  transition: all 0.2s ease;
  min-width: 140px;
}

.date-picker-trigger:hover {
  border-color: #cbd5e1;
}

.trigger-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.trigger-icon {
  color: #64748b;
  font-size: 14px;
}

.trigger-text {
  flex: 1;
  font-size: 14px;
  color: #1e293b;
}



.date-picker-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1000;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  min-width: 280px;
  margin-top: 4px;
}

.mode-selector {
  display: flex;
  border-bottom: 1px solid #e2e8f0;
}

.mode-button {
  flex: 1;
  padding: 8px 12px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  color: #64748b;
  transition: all 0.2s ease;
}

.mode-button:hover {
  background: #f8fafc;
}

.mode-button.active {
  color: #1e40af;
  background: #eff6ff;
  border-bottom: 2px solid #3b82f6;
  font-weight: 600;
}

.picker-content {
  padding: 16px;
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.nav-button {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  color: #64748b;
  transition: all 0.2s ease;
}

.nav-button:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.current-range,
.current-year,
.current-month-year {
  font-weight: 600;
  color: #1e293b;
  font-size: 14px;
  background: #f8fafc;
  padding: 4px 8px;
  border-radius: 4px;
}

.year-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.year-item {
  padding: 8px 12px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 4px;
  font-size: 14px;
  transition: all 0.2s ease;
}

.year-item:hover:not(.disabled) {
  background: #f1f5f9;
}

.year-item.selected {
  background: #3b82f6;
  color: white;
  font-weight: 600;
}

.year-item.current {
  border: 2px solid #3b82f6;
  color: #1e40af;
  background: #eff6ff;
  font-weight: 600;
}

.year-item.disabled {
  color: #cbd5e1;
  cursor: not-allowed;
}

.month-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.month-item {
  padding: 8px 12px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 4px;
  font-size: 14px;
  transition: all 0.2s ease;
}

.month-item:hover {
  background: #f1f5f9;
}

.month-item.selected {
  background: #3b82f6;
  color: white;
  font-weight: 600;
}

.month-item.current {
  border: 2px solid #3b82f6;
  color: #1e40af;
  background: #eff6ff;
  font-weight: 600;
}

.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 8px;
}

.weekday {
  text-align: center;
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
  padding: 4px;
}

.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.day-item {
  aspect-ratio: 1;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 4px;
  font-size: 14px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.day-item:hover:not(.disabled) {
  background: #f1f5f9;
}

.day-item.selected {
  background: #3b82f6;
  color: white;
  font-weight: 600;
}

.day-item.current {
  border: 2px solid #3b82f6;
  color: #1e40af;
  background: #eff6ff;
  font-weight: 600;
}

.day-item.other-month {
  color: #cbd5e1;
}

.day-item.disabled {
  color: #cbd5e1;
  cursor: not-allowed;
}

.quick-actions {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #e2e8f0;
}

.quick-button {
  flex: 1;
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: #64748b;
  transition: all 0.2s ease;
}

.quick-button:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
}
</style>
