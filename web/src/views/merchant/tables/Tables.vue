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
          <h3>桌號 {{ table.tableNumber }}</h3>
          <div class="table-actions">
            <button @click="editTable(table)" class="edit-btn">
              <font-awesome-icon icon="pen" />
            </button>
            <button @click="deleteTable(table._id || table.id)" class="delete-btn">
              <font-awesome-icon icon="trash" />
            </button>
          </div>
        </div>
        
        <div class="table-info">
          <p><strong>座位數:</strong> {{ table.capacity }}人</p>
          <p><strong>狀態:</strong> 
            <span class="status-badge" :class="table.status">
              {{ getStatusText(table.status) }}
            </span>
          </p>
          <p v-if="table.currentSession?.customerName"><strong>客戶:</strong> {{ table.currentSession.customerName }}</p>
          
          <!-- QR Code 和客戶端連結區域 -->
          <div class="customer-access-section">
            <div class="access-header">
              <strong>客戶端連結</strong>
              <button 
                @click="toggleQRCode(table._id || table.id)" 
                class="toggle-qr-btn"
                :class="{ active: showQRCode[table._id || table.id] }"
              >
                <font-awesome-icon icon="qrcode" />
              </button>
            </div>
            
            <!-- QR Code 顯示區域 -->
            <div v-if="showQRCode[table._id || table.id] && table.qrCodeDataUrl" class="qr-code-section">
              <img :src="table.qrCodeDataUrl" alt="QR Code" class="qr-code-image" />
              <p class="qr-description">客戶掃描此 QR Code 即可點餐</p>
            </div>
            
            <!-- 連結操作區域 -->
            <div class="link-actions">
              <button 
                @click="copyCustomerLink(table.customerUrl)" 
                class="action-btn copy-btn"
                title="複製連結"
              >
                <font-awesome-icon icon="copy" />
                複製連結
              </button>
              <button 
                v-if="table.qrCodeDataUrl"
                @click="downloadQRCode(table, table.qrCodeDataUrl)" 
                class="action-btn download-btn"
                title="下載 QR Code"
              >
                <font-awesome-icon icon="download" />
                下載 QR
              </button>
              <button 
                @click="regenerateQRCode(table._id || table.id)" 
                class="action-btn regenerate-btn"
                title="重新生成 QR Code"
              >
                <font-awesome-icon icon="refresh" />
                重新生成
              </button>
            </div>
          </div>
        </div>

        <div class="table-footer">
          <button 
            v-if="table.status === 'available'" 
            @click="setTableOccupied(table._id || table.id)"
            class="status-btn occupy-btn"
          >
            設為已入座
          </button>
          <button 
            v-if="table.status === 'occupied'" 
            @click="setTableAvailable(table._id || table.id)"
            class="status-btn clear-btn"
          >
            清理桌次
          </button>
          <button 
            v-if="table.status === 'available'" 
            @click="setTableReserved(table._id || table.id)"
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
              v-model="newTable.tableNumber" 
              type="text" 
              required 
              min="1"
            />
          </div>
          
          <div class="form-group">
            <label for="tableSeats">座位數</label>
            <input 
              id="tableSeats"
              v-model="newTable.capacity" 
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
              v-model="editingTable.tableNumber" 
              type="text" 
              required 
              min="1"
            />
          </div>
          
          <div class="form-group">
            <label for="editTableSeats">座位數</label>
            <input 
              id="editTableSeats"
              v-model="editingTable.capacity" 
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
import { useRoute } from 'vue-router'
import { tableAPI } from '@/services/api'
import './Tables.css'

const route = useRoute()

// 響應式數據
const tables = ref([])
const showAddTableDialog = ref(false)
const showEditTableDialog = ref(false)
const showQRCode = ref({}) // 控制 QR Code 顯示狀態
const newTable = ref({
  tableNumber: '',
  capacity: ''
})
const editingTable = ref({
  id: null,
  tableNumber: '',
  capacity: ''
})

// 載入桌次數據
const loadTables = async () => {
  try {
    const params = {}
    if (route.query.restaurantId) {
      params.merchantId = route.query.restaurantId
    }
    const response = await tableAPI.getTables(params)
    tables.value = response.data.tables || []
  } catch (error) {
    console.error('載入桌次失敗:', error)
    alert('載入桌次失敗：' + (error.message || '未知錯誤'))
  }
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
const addTable = async () => {
  if (newTable.value.tableNumber && newTable.value.capacity) {
    try {
      const tableData = {
        tableNumber: newTable.value.tableNumber,
        capacity: parseInt(newTable.value.capacity)
      }
      
      await tableAPI.createTable(tableData)
      
      // 重新載入桌次列表
      await loadTables()
      
      // 重置表單
      newTable.value = { tableNumber: '', capacity: '' }
      showAddTableDialog.value = false
      
      alert('桌次新增成功！')
    } catch (error) {
      console.error('新增桌次失敗:', error)
      alert('新增桌次失敗：' + (error.message || '未知錯誤'))
    }
  }
}

// 編輯桌次
const editTable = (table) => {
  editingTable.value = {
    id: table._id || table.id,
    tableNumber: table.tableNumber,
    capacity: table.capacity
  }
  showEditTableDialog.value = true
}

// 更新桌次
const updateTable = async () => {
  if (editingTable.value.tableNumber && editingTable.value.capacity) {
    try {
      const tableData = {
        tableNumber: editingTable.value.tableNumber,
        capacity: parseInt(editingTable.value.capacity)
      }
      
      await tableAPI.updateTable(editingTable.value.id, tableData)
      
      // 重新載入桌次列表
      await loadTables()
      
      showEditTableDialog.value = false
      
      alert('桌次更新成功！')
    } catch (error) {
      console.error('更新桌次失敗:', error)
      alert('更新桌次失敗：' + (error.message || '未知錯誤'))
    }
  }
}

// 刪除桌次
const deleteTable = async (tableId) => {
  if (confirm('確定要刪除這個桌次嗎？')) {
    try {
      await tableAPI.deleteTable(tableId)
      
      // 重新載入桌次列表
      await loadTables()
      
      alert('桌次刪除成功！')
    } catch (error) {
      console.error('刪除桌次失敗:', error)
      alert('刪除桌次失敗：' + (error.message || '未知錯誤'))
    }
  }
}

// 設置桌次為已入座
const setTableOccupied = async (tableId) => {
  try {
    const statusData = {
      status: 'occupied',
      sessionData: {
        customerName: null, // 不需要客户姓名
        customerCount: 1
      }
    }
    
    await tableAPI.updateTableStatus(tableId, statusData)
    
    // 重新載入桌次列表
    await loadTables()
    
    alert('桌次狀態更新成功！')
  } catch (error) {
    console.error('更新桌次狀態失敗:', error)
    alert('更新桌次狀態失敗：' + (error.message || '未知錯誤'))
  }
}

// 設置桌次為可用
const setTableAvailable = async (tableId) => {
  if (confirm('確定要清理此桌次嗎？')) {
    try {
      const statusData = {
        status: 'available'
      }
      
      const response = await tableAPI.updateTableStatus(tableId, statusData)
      
      // 重新載入桌次列表
      await loadTables()
      
      // 顯示詳細的清理結果訊息
      const message = response.message || '桌次已清理！'
      alert(message)
    } catch (error) {
      console.error('清理桌次失敗:', error)
      alert('清理桌次失敗：' + (error.message || '未知錯誤'))
    }
  }
}

// 設置桌次為預約
const setTableReserved = async (tableId) => {
  const customerName = prompt('請輸入預約客戶姓名：')
  if (customerName) {
    try {
      const statusData = {
        status: 'reserved',
        sessionData: {
          customerName: customerName,
          customerCount: 1
        }
      }
      
      await tableAPI.updateTableStatus(tableId, statusData)
      
      // 重新載入桌次列表
      await loadTables()
      
      alert('桌次預約成功！')
    } catch (error) {
      console.error('設置桌次預約失敗:', error)
      alert('設置桌次預約失敗：' + (error.message || '未知錯誤'))
    }
  }
}

// QR Code 相關功能
// 切換 QR Code 顯示狀態
const toggleQRCode = (tableId) => {
  showQRCode.value[tableId] = !showQRCode.value[tableId]
}

// 複製客戶端連結
const copyCustomerLink = async (customerUrl) => {
  if (!customerUrl) {
    alert('此桌次暫無客戶端連結')
    return
  }
  
  try {
    await navigator.clipboard.writeText(customerUrl)
    alert('連結已複製到剪貼板！')
  } catch (error) {
    // 如果 Clipboard API 不可用，使用備用方法
    const textArea = document.createElement('textarea')
    textArea.value = customerUrl
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    alert('連結已複製到剪貼板！')
  }
}

// 下載 QR Code
const downloadQRCode = (table, qrCodeDataUrl) => {
  if (!qrCodeDataUrl) {
    alert('此桌次暫無 QR Code')
    return
  }
  
  try {
    const link = document.createElement('a')
    link.href = qrCodeDataUrl
    link.download = `桌號${table.tableNumber}_QRCode.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    alert('QR Code 下載成功！')
  } catch (error) {
    console.error('下載 QR Code 失敗:', error)
    alert('下載 QR Code 失敗')
  }
}

// 重新生成 QR Code
const regenerateQRCode = async (tableId) => {
  if (confirm('確定要重新生成此桌次的 QR Code 嗎？重新生成後舊的連結將失效。')) {
    try {
      // 調用後端 API 重新生成 QR Code
      await tableAPI.regenerateQRCode(tableId)
      
      // 重新載入桌次列表
      await loadTables()
      
      alert('QR Code 重新生成成功！')
    } catch (error) {
      console.error('重新生成 QR Code 失敗:', error)
      alert('重新生成 QR Code 失敗：' + (error.message || '未知錯誤'))
    }
  }
}

// 組件掛載時載入數據
onMounted(() => {
  loadTables()
})
</script>


