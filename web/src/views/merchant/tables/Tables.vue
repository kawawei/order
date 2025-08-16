<template>
  <div class="tables-container">
    <div class="header">
      <h1>桌次管理</h1>
      <button class="add-table-btn" @click="showAddTableDialog = true">
        <font-awesome-icon icon="plus" />
        新增桌次
      </button>
    </div>

    <div class="tables-grid">
      <div 
        v-for="table in tables" 
        :key="table.id"
        class="table-card"
        :class="{ 
          'occupied': table.status === 'occupied',
          'reserved': table.status === 'reserved',
          'available': table.status === 'available'
        }"
      >
        <div class="table-header">
          <h3>桌號 {{ table.number }}</h3>
          <div class="table-actions">
            <button @click="editTable(table)" class="edit-btn">
              <font-awesome-icon icon="pen" />
            </button>
            <button @click="deleteTable(table.id)" class="delete-btn">
              <font-awesome-icon icon="trash" />
            </button>
          </div>
        </div>
        
        <div class="table-info">
          <p><strong>座位數:</strong> {{ table.seats }}人</p>
          <p><strong>狀態:</strong> 
            <span class="status-badge" :class="table.status">
              {{ getStatusText(table.status) }}
            </span>
          </p>
          <p v-if="table.customerName"><strong>客戶:</strong> {{ table.customerName }}</p>
        </div>

        <div class="table-footer">
          <button 
            v-if="table.status === 'available'" 
            @click="setTableOccupied(table.id)"
            class="status-btn occupy-btn"
          >
            設為已入座
          </button>
          <button 
            v-if="table.status === 'occupied'" 
            @click="setTableAvailable(table.id)"
            class="status-btn clear-btn"
          >
            清理桌次
          </button>
          <button 
            v-if="table.status === 'available'" 
            @click="setTableReserved(table.id)"
            class="status-btn reserve-btn"
          >
            設為預約
          </button>
        </div>
      </div>
    </div>

    <!-- 新增桌次對話框 -->
    <div v-if="showAddTableDialog" class="dialog-overlay" @click="showAddTableDialog = false">
      <div class="dialog" @click.stop>
        <div class="dialog-header">
          <h2>新增桌次</h2>
          <button @click="showAddTableDialog = false" class="close-btn">
            <font-awesome-icon icon="xmark" />
          </button>
        </div>
        
        <form @submit.prevent="addTable">
          <div class="form-group">
            <label for="tableNumber">桌號</label>
            <input 
              id="tableNumber"
              v-model="newTable.number" 
              type="number" 
              required 
              min="1"
            />
          </div>
          
          <div class="form-group">
            <label for="tableSeats">座位數</label>
            <input 
              id="tableSeats"
              v-model="newTable.seats" 
              type="number" 
              required 
              min="1"
              max="20"
            />
          </div>
          
          <div class="dialog-actions">
            <button type="button" @click="showAddTableDialog = false" class="cancel-btn">
              取消
            </button>
            <button type="submit" class="confirm-btn">
              新增
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 編輯桌次對話框 -->
    <div v-if="showEditTableDialog" class="dialog-overlay" @click="showEditTableDialog = false">
      <div class="dialog" @click.stop>
        <div class="dialog-header">
          <h2>編輯桌次</h2>
          <button @click="showEditTableDialog = false" class="close-btn">
            <font-awesome-icon icon="xmark" />
          </button>
        </div>
        
        <form @submit.prevent="updateTable">
          <div class="form-group">
            <label for="editTableNumber">桌號</label>
            <input 
              id="editTableNumber"
              v-model="editingTable.number" 
              type="number" 
              required 
              min="1"
            />
          </div>
          
          <div class="form-group">
            <label for="editTableSeats">座位數</label>
            <input 
              id="editTableSeats"
              v-model="editingTable.seats" 
              type="number" 
              required 
              min="1"
              max="20"
            />
          </div>
          
          <div class="dialog-actions">
            <button type="button" @click="showEditTableDialog = false" class="cancel-btn">
              取消
            </button>
            <button type="submit" class="confirm-btn">
              更新
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import './Tables.css'

// 響應式數據
const tables = ref([])
const showAddTableDialog = ref(false)
const showEditTableDialog = ref(false)
const newTable = ref({
  number: '',
  seats: ''
})
const editingTable = ref({
  id: null,
  number: '',
  seats: ''
})

// 初始化示例數據
const initTables = () => {
  tables.value = [
    { id: 1, number: 1, seats: 2, status: 'available', customerName: null },
    { id: 2, number: 2, seats: 4, status: 'occupied', customerName: '王小明' },
    { id: 3, number: 3, seats: 6, status: 'reserved', customerName: '李小華' },
    { id: 4, number: 4, seats: 2, status: 'available', customerName: null },
    { id: 5, number: 5, seats: 8, status: 'available', customerName: null },
    { id: 6, number: 6, seats: 4, status: 'occupied', customerName: '張三' }
  ]
}

// 取得狀態文字
const getStatusText = (status) => {
  const statusMap = {
    'available': '可用',
    'occupied': '已入座',
    'reserved': '已預約'
  }
  return statusMap[status] || '未知'
}

// 新增桌次
const addTable = () => {
  if (newTable.value.number && newTable.value.seats) {
    // 檢查桌號是否已存在
    const existingTable = tables.value.find(table => table.number === parseInt(newTable.value.number))
    if (existingTable) {
      alert('該桌號已存在！')
      return
    }

    const table = {
      id: Date.now(),
      number: parseInt(newTable.value.number),
      seats: parseInt(newTable.value.seats),
      status: 'available',
      customerName: null
    }
    
    tables.value.push(table)
    tables.value.sort((a, b) => a.number - b.number)
    
    // 重置表單
    newTable.value = { number: '', seats: '' }
    showAddTableDialog.value = false
  }
}

// 編輯桌次
const editTable = (table) => {
  editingTable.value = {
    id: table.id,
    number: table.number,
    seats: table.seats
  }
  showEditTableDialog.value = true
}

// 更新桌次
const updateTable = () => {
  if (editingTable.value.number && editingTable.value.seats) {
    // 檢查桌號是否已被其他桌次使用
    const existingTable = tables.value.find(table => 
      table.number === parseInt(editingTable.value.number) && 
      table.id !== editingTable.value.id
    )
    if (existingTable) {
      alert('該桌號已被其他桌次使用！')
      return
    }

    const index = tables.value.findIndex(table => table.id === editingTable.value.id)
    if (index !== -1) {
      tables.value[index].number = parseInt(editingTable.value.number)
      tables.value[index].seats = parseInt(editingTable.value.seats)
      tables.value.sort((a, b) => a.number - b.number)
    }
    
    showEditTableDialog.value = false
  }
}

// 刪除桌次
const deleteTable = (tableId) => {
  if (confirm('確定要刪除這個桌次嗎？')) {
    const index = tables.value.findIndex(table => table.id === tableId)
    if (index !== -1) {
      tables.value.splice(index, 1)
    }
  }
}

// 設置桌次為已入座
const setTableOccupied = (tableId) => {
  const customerName = prompt('請輸入客戶姓名：')
  if (customerName) {
    const table = tables.value.find(table => table.id === tableId)
    if (table) {
      table.status = 'occupied'
      table.customerName = customerName
    }
  }
}

// 設置桌次為可用
const setTableAvailable = (tableId) => {
  if (confirm('確定要清理此桌次嗎？')) {
    const table = tables.value.find(table => table.id === tableId)
    if (table) {
      table.status = 'available'
      table.customerName = null
    }
  }
}

// 設置桌次為預約
const setTableReserved = (tableId) => {
  const customerName = prompt('請輸入預約客戶姓名：')
  if (customerName) {
    const table = tables.value.find(table => table.id === tableId)
    if (table) {
      table.status = 'reserved'
      table.customerName = customerName
    }
  }
}

// 組件掛載時初始化數據
onMounted(() => {
  initTables()
})
</script>


