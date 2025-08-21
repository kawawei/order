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
                @click="enterTable(table._id || table.id, table.tableNumber)" 
                class="action-btn enter-btn"
                title="進入桌次"
              >
                <font-awesome-icon icon="chevron-right" />
                進入桌次
              </button>
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
            v-if="table.status === 'occupied'" 
            @click="checkoutTable(table._id || table.id)"
            class="status-btn checkout-btn"
          >
            結帳
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

    <!-- 收據模態框 -->
    <div v-if="showReceiptModal" class="receipt-modal-overlay" @click="closeReceipt">
      <div class="receipt-modal" @click.stop>
        <div class="receipt-modal-header">
          <h3>結帳收據</h3>
          <button class="close-button" @click="closeReceipt">
            <font-awesome-icon icon="times" />
          </button>
        </div>
        <div class="receipt-modal-content">
          <BaseReceipt 
            v-if="currentReceiptData" 
            :receipt="currentReceiptData" 
            ref="receiptComponent"
          />
        </div>
        <div class="receipt-modal-actions">
          <BaseButton variant="secondary" @click="closeReceipt">
            關閉
          </BaseButton>
          <BaseButton variant="primary" @click="printReceipt">
            <font-awesome-icon icon="print" />
            列印收據
          </BaseButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { tableAPI, orderAPI } from '@/services/api'
import BaseReceipt from '../../../components/base/BaseReceipt.vue'
import BaseButton from '../../../components/base/BaseButton.vue'
import { generateReceiptData } from '../../../utils/receiptUtils'
import './Tables.css'

const route = useRoute()
const router = useRouter()

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

// 收據相關
const showReceiptModal = ref(false)
const currentReceiptData = ref(null)
const receiptComponent = ref(null)

// 結帳狀態管理
const isCheckingOut = ref(false)

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

// 進入桌次
const enterTable = (tableId, tableNumber) => {
  // 找到對應的桌次數據
  const table = tables.value.find(t => (t._id || t.id) === tableId)
  
  if (!table) {
    alert('找不到指定的桌次')
    return
  }
  
  console.log('桌次數據:', table) // 調試信息
  
  // 使用桌次的 customerUrl 或 uniqueCode 來構建正確的連結
  if (table.customerUrl) {
    console.log('使用 customerUrl:', table.customerUrl)
    // 從商家後台進入，直接跳轉到點餐頁面
    const directUrl = `${table.customerUrl}?from=merchant`
    window.open(directUrl, '_blank')
  } else if (table.uniqueCode) {
    // 使用 uniqueCode 構建連結
    const baseUrl = window.location.origin
    const tableUrl = `${baseUrl}/table/${table.uniqueCode}?from=merchant`
    console.log('使用 uniqueCode 構建連結:', tableUrl)
    window.open(tableUrl, '_blank')
  } else {
    console.log('桌次缺少 customerUrl 和 uniqueCode')
    alert('此桌次暫無客戶端連結，請重新生成 QR Code')
  }
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

// 結帳功能
const checkoutTable = async (tableId) => {
  // 防重複調用檢查
  if (isCheckingOut.value) {
    console.log('正在結帳中，忽略重複調用')
    return
  }
  
  try {
    isCheckingOut.value = true
    console.log('開始結帳流程，設置 isCheckingOut 為 true')
    
    // 先獲取桌子的總金額
    const totalResponse = await orderAPI.getTableTotal(tableId)
    
    if (!totalResponse.data || totalResponse.data.totalAmount === 0) {
      alert('此桌次目前沒有任何餐點可以結帳')
      return
    }

    const totalAmount = totalResponse.data.totalAmount
    const batchCount = totalResponse.data.batchCount
    
    const confirmMessage = batchCount > 1 
      ? `確定要為此桌次結帳嗎？\n共有 ${batchCount} 批次訂單\n總金額：NT$ ${totalAmount}`
      : `確定要為此桌次結帳嗎？\n總金額：NT$ ${totalAmount}`
    
    if (confirm(confirmMessage)) {
      // 調用結帳 API
      const response = await orderAPI.checkoutTable(tableId)
      
      if (response.status === 'success') {
        const checkoutData = response.data
        
        // 重新載入桌次列表
        await loadTables()
        
        // 生成收據
        await generateAndShowReceipt(tableId, checkoutData)
        
        // 顯示結帳成功訊息
        const successMessage = batchCount > 1 
          ? `結帳成功！\n共有 ${batchCount} 批次訂單\n總金額：NT$ ${checkoutData.totalAmount}\n桌次已自動設為可用狀態`
          : `結帳成功！\n總金額：NT$ ${checkoutData.totalAmount}\n桌次已自動設為可用狀態`
        
        alert(successMessage)
      } else {
        alert('結帳失敗，請稍後再試')
      }
    }
  } catch (error) {
    console.error('結帳失敗:', error)
    alert('結帳失敗：' + (error.message || '請稍後再試'))
  } finally {
    // 延遲重置標誌，防止快速重複點擊
    setTimeout(() => {
      isCheckingOut.value = false
      console.log('延遲重置 isCheckingOut 為 false')
    }, 1000) // 1秒延遲
  }
}

// 生成並顯示收據
const generateAndShowReceipt = async (tableId, checkoutData) => {
  try {
    // 獲取桌次資訊
    const table = tables.value.find(t => (t._id || t.id) === tableId)
    if (!table) {
      console.error('找不到桌次資訊')
      return
    }
    
    console.log('=== 收據調試信息 ===')
    
    // 檢查多種用戶身份
    const merchantUser = JSON.parse(localStorage.getItem('merchant_user') || '{}')
    const adminUser = JSON.parse(localStorage.getItem('admin_user') || '{}')
    
    console.log('merchant_user:', merchantUser)
    console.log('admin_user:', adminUser)
    
    // 檢查是否為超級管理員
    const isSuperAdmin = adminUser.role === 'superadmin' || adminUser.username === 'superadmin' || 
                        merchantUser.role === 'superadmin' || merchantUser.username === 'superadmin'
    console.log('是否為超級管理員:', isSuperAdmin)
    
    let employeeId = '001' // 預設員工編號
    let storeName = '餐廳名稱' // 預設餐廳名稱
    
    if (isSuperAdmin) {
      employeeId = 'admin'
      console.log('超級管理員，員工編號設為: admin')
      
      // 從 URL 獲取餐廳名稱
      const urlParams = new URLSearchParams(window.location.search)
      const restaurantName = urlParams.get('restaurantName')
      if (restaurantName) {
        storeName = restaurantName
        console.log('從 URL 獲取餐廳名稱:', storeName)
      }
    } else {
      // 普通員工或商家
      employeeId = merchantUser.employeeNumber || merchantUser.employeeId || '001'
      storeName = merchantUser.businessName || merchantUser.name || '餐廳名稱'
      console.log('普通員工，員工編號:', employeeId)
    }
    
    console.log('最終餐廳名稱:', storeName)
    
    // 處理結帳數據格式，確保有 items 屬性和ID信息
    const orderData = {
      ...checkoutData,
      items: checkoutData.allItems || checkoutData.items || [],
      // 確保包含訂單ID和編號信息（同時設置 _id 和 id 字段以兼容不同函數）
      _id: checkoutData.orderId,
      id: checkoutData.orderId,
      orderId: checkoutData.orderId,
      orderNumber: checkoutData.orderNumber
    }
    
    console.log('處理後的訂單數據:', {
      orderId: orderData.orderId,
      orderNumber: orderData.orderNumber,
      tableNumber: orderData.tableNumber,
      totalAmount: orderData.totalAmount,
      itemsCount: orderData.items.length
    })
    
    console.log('=== 收據數據 ===')
    console.log('員工編號:', employeeId)
    console.log('餐廳名稱:', storeName)
    console.log('桌號:', `桌號 ${table.tableNumber}`)
    
    // 生成收據數據
    const receiptData = generateReceiptData(orderData, employeeId, `桌號 ${table.tableNumber}`, storeName)
    
    console.log('生成的收據數據:', receiptData)
    
    // 顯示收據模態框
    showReceiptModal.value = true
    currentReceiptData.value = receiptData
  } catch (error) {
    console.error('生成收據失敗:', error)
    alert('生成收據失敗，請稍後再試')
  }
}

// 列印收據
const printReceipt = () => {
  if (currentReceiptData.value && receiptComponent.value) {
    // 調用收據組件的列印方法
    receiptComponent.value.printReceipt()
  }
}

// 關閉收據模態框
const closeReceipt = () => {
  showReceiptModal.value = false
  currentReceiptData.value = null
}

// 組件掛載時載入數據
onMounted(() => {
  loadTables()
})
</script>


