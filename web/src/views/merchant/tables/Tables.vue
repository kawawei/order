<template>
  <div class="tables-container">
    <div class="header">
      <h1>桌次管理</h1>
      <div class="header-actions">
        <button class="add-table-btn" @click="showAddTableDialog = true">
          <font-awesome-icon icon="plus" />
          新增桌次
        </button>
        <button class="batch-download-btn" @click="batchDownloadQRCodes" :disabled="isBatchDownloading">
          <font-awesome-icon icon="download" />
          {{ isBatchDownloading ? '下載中...' : '批量下載 QR Code' }}
        </button>
      </div>
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
          <div class="info-row">
            <span class="info-label">座位數:</span>
            <span class="info-value">{{ table.capacity }}人</span>
          </div>
          <div class="info-row">
            <span class="info-label">狀態:</span>
            <span class="status-badge" :class="table.status">
              {{ getStatusText(table.status) }}
            </span>
          </div>
          <div v-if="table.currentSession?.customerName" class="info-row">
            <span class="info-label">客戶:</span>
            <span class="info-value">{{ table.currentSession.customerName }}</span>
          </div>
          
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
            title="清理桌次並刪除所有訂單記錄"
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
import { ref, onMounted, onUnmounted } from 'vue'
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

// 批量下載狀態管理
const isBatchDownloading = ref(false)

// 自動刷新相關
const refreshInterval = ref(null)
const autoRefreshEnabled = ref(true)

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
  const confirmMessage = '確定要清理此桌次嗎？\n\n⚠️ 注意：此操作將刪除該桌次的所有訂單記錄，包括：\n• 未送出的訂單\n• 已送出的訂單\n• 已完成的訂單\n• 已取消的訂單\n\n此操作無法復原！'
  
  if (confirm(confirmMessage)) {
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
const toggleQRCode = async (tableId) => {
  const table = tables.value.find(t => (t._id || t.id) === tableId)
  
  if (!table) {
    console.error('找不到桌次:', tableId)
    return
  }
  
  // 如果 QR Code 已顯示，則隱藏
  if (showQRCode.value[tableId]) {
    showQRCode.value[tableId] = false
    return
  }
  
  // 如果沒有 QR Code，立即生成
  if (!table.qrCodeDataUrl) {
    try {
      console.log('桌次', table.tableNumber, '沒有 QR Code，正在生成...')
      
      // 調用重新生成 QR Code API
      const response = await tableAPI.regenerateQRCode(tableId)
      
      // 更新本地桌次數據（後端返回 { table } 結構）
      const updatedTable = tables.value.find(t => (t._id || t.id) === tableId)
      if (updatedTable && response.data.table) {
        updatedTable.qrCodeDataUrl = response.data.table.qrCodeDataUrl
        updatedTable.uniqueCode = response.data.table.uniqueCode
        updatedTable.customerUrl = response.data.table.customerUrl
      }
      
      console.log('QR Code 生成成功')
    } catch (error) {
      console.error('生成 QR Code 失敗:', error)
      alert('生成 QR Code 失敗：' + (error.message || '未知錯誤'))
      return
    }
  }
  
  // 顯示 QR Code
  showQRCode.value[tableId] = true
}

// 進入桌次
const enterTable = async (tableId, tableNumber) => {
  // 找到對應的桌次數據
  const table = tables.value.find(t => (t._id || t.id) === tableId)
  
  if (!table) {
    alert('找不到指定的桌次')
    return
  }
  
  console.log('桌次數據:', table) // 調試信息
  
  try {
    // 如果桌次狀態是 available，自動設為 occupied
    if (table.status === 'available') {
      console.log('桌次狀態為可用，自動設為已入座')
      await setTableOccupied(tableId)
    }
    
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
  } catch (error) {
    console.error('進入桌次失敗:', error)
    alert('進入桌次失敗：' + (error.message || '未知錯誤'))
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
    // 獲取商家信息
    let businessName = '餐廳'
    try {
      // 優先從 URL 查詢參數獲取餐廳名稱
      const urlParams = new URLSearchParams(window.location.search)
      const restaurantName = urlParams.get('restaurantName')
      if (restaurantName) {
        businessName = restaurantName
        console.log('從 URL 查詢參數獲取商家名稱:', businessName)
      } else {
        // 如果 URL 中沒有，再嘗試從 localStorage 獲取
        const merchantRaw = localStorage.getItem('merchant_user')
        if (merchantRaw) {
          const merchant = JSON.parse(merchantRaw)
          console.log('完整的商家信息:', merchant)
          
          // 嘗試多個可能的字段名稱
          businessName = merchant.businessName || merchant.name || merchant.merchantName || merchant.restaurantName || '餐廳'
          console.log('從 localStorage 獲取商家名稱:', businessName)
        }
      }
    } catch (error) {
      console.warn('無法獲取商家名稱，使用預設名稱:', error)
    }
    
    // 生成檔案名稱：餐廳名稱-桌次
    const fileName = `${businessName}-桌次${table.tableNumber}.png`
    console.log('生成的檔案名稱:', fileName)
    console.log('businessName:', businessName)
    console.log('table.tableNumber:', table.tableNumber)
    
    const link = document.createElement('a')
    link.href = qrCodeDataUrl
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    alert('QR Code 下載成功！')
  } catch (error) {
    console.error('下載 QR Code 失敗:', error)
    alert('下載 QR Code 失敗')
  }
}

// 批量下載 QR Code
const batchDownloadQRCodes = async () => {
  if (isBatchDownloading.value) {
    console.log('正在批量下載中，忽略重複調用')
    return
  }
  
  try {
    isBatchDownloading.value = true
    console.log('開始批量下載 QR Code')
    
    // 獲取商家信息
    let businessName = '餐廳'
    try {
      // 優先從 URL 查詢參數獲取餐廳名稱
      const urlParams = new URLSearchParams(window.location.search)
      const restaurantName = urlParams.get('restaurantName')
      if (restaurantName) {
        businessName = restaurantName
        console.log('從 URL 查詢參數獲取商家名稱:', businessName)
      } else {
        // 如果 URL 中沒有，再嘗試從 localStorage 獲取
        const merchantRaw = localStorage.getItem('merchant_user')
        if (merchantRaw) {
          const merchant = JSON.parse(merchantRaw)
          console.log('完整的商家信息:', merchant)
          
          // 嘗試多個可能的字段名稱
          businessName = merchant.businessName || merchant.name || merchant.merchantName || merchant.restaurantName || '餐廳'
          console.log('從 localStorage 獲取商家名稱:', businessName)
        }
      }
    } catch (error) {
      console.warn('無法獲取商家名稱，使用預設名稱:', error)
    }
    
    // 檢查是否有桌次
    if (tables.value.length === 0) {
      alert('目前沒有任何桌次可以下載 QR Code')
      return
    }
    
    // 確認批量下載
    const confirmMessage = `確定要批量下載所有桌次的 QR Code 嗎？\n共 ${tables.value.length} 個桌次\n將打包成一個 ZIP 檔案：${businessName}-桌次qrcode.zip`
    
    if (!confirm(confirmMessage)) {
      return
    }
    
    // 導入 JSZip
    const JSZip = (await import('jszip')).default
    const zip = new JSZip()
    
    let successCount = 0
    let errorCount = 0
    const errors = []
    
    // 遍歷所有桌次
    for (const table of tables.value) {
      try {
        console.log(`處理桌次 ${table.tableNumber} 的 QR Code`)
        
        // 如果沒有 QR Code，先生成
        if (!table.qrCodeDataUrl) {
          console.log(`桌次 ${table.tableNumber} 沒有 QR Code，正在生成...`)
          await tableAPI.regenerateQRCode(table._id || table.id)
          
          // 重新載入桌次列表以獲取新的 QR Code
          await loadTables()
          
          // 重新獲取桌次數據
          const updatedTable = tables.value.find(t => (t._id || t.id) === (table._id || table.id))
          if (!updatedTable || !updatedTable.qrCodeDataUrl) {
            throw new Error(`無法為桌次 ${table.tableNumber} 生成 QR Code`)
          }
          table.qrCodeDataUrl = updatedTable.qrCodeDataUrl
        }
        
        // 將 QR Code 添加到 ZIP 檔案
        const fileName = `${businessName}-桌次${table.tableNumber}.png`
        
        // 從 Data URL 提取 base64 數據
        const base64Data = table.qrCodeDataUrl.split(',')[1]
        zip.file(fileName, base64Data, { base64: true })
        
        successCount++
        console.log(`桌次 ${table.tableNumber} QR Code 已添加到 ZIP`)
        
      } catch (error) {
        console.error(`桌次 ${table.tableNumber} QR Code 處理失敗:`, error)
        errorCount++
        errors.push(`桌次 ${table.tableNumber}: ${error.message || '未知錯誤'}`)
      }
    }
    
    // 生成並下載 ZIP 檔案
    if (successCount > 0) {
      try {
        console.log('正在生成 ZIP 檔案...')
        const zipBlob = await zip.generateAsync({ type: 'blob' })
        
        // 下載 ZIP 檔案
        const zipFileName = `${businessName}-桌次qrcode.zip`
        const link = document.createElement('a')
        link.href = URL.createObjectURL(zipBlob)
        link.download = zipFileName
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        // 清理 URL 對象
        URL.revokeObjectURL(link.href)
        
        console.log('ZIP 檔案下載成功')
      } catch (error) {
        console.error('ZIP 檔案生成失敗:', error)
        errorCount++
        errors.push(`ZIP 檔案生成: ${error.message || '未知錯誤'}`)
      }
    }
    
    // 顯示結果
    let resultMessage = `批量下載完成！\n成功：${successCount} 個 QR Code 已打包\n失敗：${errorCount} 個`
    
    if (errorCount > 0) {
      resultMessage += `\n\n失敗詳情：\n${errors.join('\n')}`
    }
    
    alert(resultMessage)
    
  } catch (error) {
    console.error('批量下載 QR Code 失敗:', error)
    alert('批量下載 QR Code 失敗：' + (error.message || '未知錯誤'))
  } finally {
    isBatchDownloading.value = false
    console.log('批量下載完成，重置狀態')
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
    
    // 先獲取桌子的總金額和訂單狀態
    const totalResponse = await orderAPI.getTableTotal(tableId)
    
    if (!totalResponse.data || totalResponse.data.totalAmount === 0) {
      alert('此桌次目前沒有任何餐點可以結帳')
      return
    }

    const totalAmount = totalResponse.data.totalAmount
    const batchCount = totalResponse.data.batchCount
    const hasUndeliveredOrders = totalResponse.data.hasUndeliveredOrders
    const canCheckout = totalResponse.data.canCheckout
    
    // 檢查是否有未送出的訂單
    if (hasUndeliveredOrders) {
      const orderStatuses = totalResponse.data.orderStatuses || []
      const undeliveredBatches = orderStatuses
        .filter(order => order.status !== 'delivered')
        .map(order => `批次 ${order.batchNumber} (${order.status})`)
        .join('\n')
      
      alert(`無法結帳：以下訂單尚未送出\n${undeliveredBatches}\n\n請等待所有餐點送出後再進行結帳。`)
      return
    }
    
    // 檢查是否可以結帳
    if (!canCheckout) {
      alert('此桌次目前無法結帳，請確認所有餐點都已送出')
      return
    }
    
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
    // 顯示更詳細的錯誤訊息
    if (error.response?.data?.message) {
      alert('結帳失敗：' + error.response.data.message)
    } else {
      alert('結帳失敗：' + (error.message || '請稍後再試'))
    }
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
    
    // 生成收據數據，使用後端返回的收據號碼
    const receiptData = generateReceiptData(
      orderData, 
      employeeId, 
      `桌號 ${table.tableNumber}`, 
      storeName,
      checkoutData.receiptOrderNumber // 使用後端生成的收據號碼
    )
    
    // 修改收據格式以與歷史訂單保持一致
    const formattedReceiptData = {
      ...receiptData,
      // 確保項目格式與歷史訂單一致
      items: receiptData.items.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        totalPrice: item.totalPrice,
        // 添加選項信息（如果有）
        selectedOptions: item.selectedOptions || null
      })),
      // 添加員工姓名（如果有）
      employeeName: merchantUser.name || merchantUser.employeeName || '',
      // 確保時間格式一致
      checkoutTime: receiptData.checkoutTime,
      // 確保收據號碼格式一致
      billNumber: receiptData.billNumber,
      // 確保訂單號碼格式一致
      orderNumber: receiptData.orderNumber
    }
    
    console.log('生成的收據數據:', receiptData)
    console.log('格式化後的收據數據:', formattedReceiptData)
    
    // 顯示收據模態框
    showReceiptModal.value = true
    currentReceiptData.value = formattedReceiptData
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
  startAutoRefresh()
})

// 組件卸載時清理定時器
onUnmounted(() => {
  stopAutoRefresh()
})

// 開始自動刷新
const startAutoRefresh = () => {
  if (autoRefreshEnabled.value && !refreshInterval.value) {
    refreshInterval.value = setInterval(() => {
      loadTables()
    }, 3000) // 每3秒刷新一次
    console.log('桌次管理自動刷新已啟動 (3秒間隔)')
  }
}

// 停止自動刷新
const stopAutoRefresh = () => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
    refreshInterval.value = null
    console.log('桌次管理自動刷新已停止')
  }
}


</script>


