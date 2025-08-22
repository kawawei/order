<template>
  <div class="receipt-container" ref="receiptContainer">
    <div class="receipt">
      <!-- 收據標題 -->
      <div class="receipt-header">
        <h2>收據</h2>
      </div>

      <!-- 基本資訊 -->
      <div class="receipt-info">
        <div class="info-row">
          <span class="label">桌次:</span>
          <span class="value">{{ receipt.tableNumber }}</span>
        </div>
        <div class="info-row">
          <span class="label">帳單號碼:</span>
          <span class="value">{{ receipt.billNumber }}</span>
        </div>
        <div class="info-row">
          <span class="label">員工編號:</span>
          <span class="value">{{ receipt.employeeId }}</span>
        </div>
        <div class="info-row">
          <span class="label">結帳時間:</span>
          <span class="value">{{ receipt.checkoutTime }}</span>
        </div>
      </div>

      <!-- 分隔線 -->
      <div class="divider"></div>

      <!-- 菜品列表 -->
      <div class="items-section">
        <div class="items-list">
          <div 
            v-for="item in receipt.items" 
            :key="item.id" 
            class="item-row"
          >
            <!-- 主要菜品名稱和數量 -->
            <div class="item-main">
              <span class="item-name">{{ getItemDisplayName(item) }}</span>
              <span class="item-quantity">*{{ item.quantity }}</span>
            </div>
            
            <!-- 選項信息 -->
            <div v-if="item.selectedOptions && Object.keys(item.selectedOptions).length > 0" class="item-options">
              <div 
                v-for="(option, optionKey) in item.selectedOptions" 
                :key="optionKey"
                class="option-row"
              >
                <span class="option-name">{{ getOptionLabel(optionKey) }}: {{ option.label || option }}</span>
                <span v-if="getOptionPrice(option)" class="option-price">+{{ getOptionPrice(option) }}</span>
              </div>
            </div>
            
            <span class="item-price">{{ item.totalPrice }}</span>
          </div>
        </div>
      </div>

      <!-- 分隔線 -->
      <div class="divider"></div>

      <!-- 金額總結 -->
      <div class="amount-section">
        <div class="amount-row">
          <span class="label">小計</span>
          <span class="value">{{ receipt.subtotal }}</span>
        </div>
        <div class="amount-row total">
          <span class="label">總計</span>
          <span class="value">{{ receipt.total }}</span>
        </div>
      </div>

             <!-- 條碼區域 -->
       <div class="barcode-section">
         <div v-if="barcodeImage" class="barcode-image" v-html="barcodeImage"></div>
         <div v-else class="barcode-text">{{ receipt.billNumber }}</div>
         <!-- 條碼數字顯示 -->
         <div class="barcode-number">
           {{ receipt.billNumber }}
         </div>
       </div>

      <!-- 底部資訊 -->
      <div class="receipt-footer">
        <p>感謝您的惠顧</p>
        <p>{{ receipt.storeName }}</p>
      </div>
    </div>
  </div>
</template>

<script>
import api from '../../services/api'

export default {
  name: 'BaseReceipt',
  props: {
    receipt: {
      type: Object,
      required: true,
      default: () => ({
        tableNumber: '',
        billNumber: '',
        employeeId: '',
        checkoutTime: '',
        items: [],
        subtotal: 0,
        total: 0,
        storeName: '餐廳名稱'
      })
    }
  },
  data() {
    return {
      barcodeImage: null,
      isLoadingBarcode: false
    }
  },
  async mounted() {
    // 組件掛載時生成條碼
    await this.generateBarcode()
  },
  methods: {
    // 獲取項目顯示名稱
    getItemDisplayName(item) {
      // 如果有 displayName，使用它（來自合併邏輯）
      if (item.displayName) {
        return item.displayName
      }
      return item.name || item.dishName
    },
    
    // 獲取選項標籤
    getOptionLabel(optionKey) {
      const optionLabels = {
        'sweetness': '甜度',
        'ice': '冰塊',
        'size': '尺寸',
        'temperature': '溫度',
        'spiceLevel': '辣度',
        'sugar': '糖度',
        'milk': '奶精',
        'toppings': '配料',
        'sauce': '醬料',
        'cooking': '烹調方式'
      }
      return optionLabels[optionKey] || optionKey
    },
    
    // 獲取選項價格
    getOptionPrice(option) {
      if (typeof option === 'object' && option.price) {
        return option.price > 0 ? option.price : null
      }
      return null
    },
    
    // 生成條碼
    async generateBarcode() {
      if (!this.receipt.billNumber) {
        console.warn('沒有帳單號碼，無法生成條碼')
        return
      }

      try {
        this.isLoadingBarcode = true
        
        const response = await api.post('/barcode/generate', {
          text: this.receipt.billNumber,
                      options: {
              bcid: 'code128',
              width: 150,
              height: 30,
              includetext: false,
              scale: 1.5
            }
        })

        console.log('條碼 API 響應:', response)
        if (response.success && response.data.barcode) {
          this.barcodeImage = response.data.barcode
          console.log('條碼生成成功:', this.receipt.billNumber)
        } else {
          console.warn('條碼生成失敗，使用文字顯示')
          console.warn('響應數據:', response.data)
        }
      } catch (error) {
        console.error('生成條碼時發生錯誤:', error)
        // 如果條碼生成失敗，保持文字顯示
      } finally {
        this.isLoadingBarcode = false
      }
    },

    // 列印收據
    printReceipt() {
      const printWindow = window.open('', '_blank')
      const receiptContent = this.$refs.receiptContainer.innerHTML
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>收據</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              margin: 0;
              padding: 20px;
              background: white;
            }
            .receipt {
              background: white;
              padding: 20px;
              width: 300px;
              margin: 0 auto;
            }
            .receipt-header {
              text-align: center;
              margin-bottom: 15px;
            }
            .receipt-header h2 {
              margin: 0;
              font-size: 18px;
              font-weight: bold;
            }
            .receipt-info {
              margin-bottom: 15px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 5px;
              font-size: 12px;
            }
            .label {
              font-weight: bold;
            }
            .value {
              text-align: right;
            }
            .divider {
              border-top: 1px dashed #ccc;
              margin: 15px 0;
            }
            .items-section {
              margin-bottom: 15px;
            }
            .items-list {
              font-size: 12px;
            }
            .item-row {
              display: flex;
              flex-direction: column;
              margin-bottom: 8px;
              border-bottom: 1px dotted #eee;
              padding-bottom: 5px;
            }
            .item-main {
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .item-name {
              flex: 2;
              font-weight: bold;
            }
            .item-quantity {
              flex: 1;
              text-align: center;
              font-weight: bold;
            }
            .item-price {
              flex: 1;
              text-align: right;
              font-weight: bold;
            }
            .item-options {
              margin-top: 3px;
              margin-left: 10px;
            }
            .option-row {
              display: flex;
              justify-content: space-between;
              font-size: 10px;
              color: #666;
              margin-bottom: 2px;
            }
            .option-name {
              flex: 2;
            }
            .option-price {
              flex: 1;
              text-align: right;
              color: #e74c3c;
              font-weight: bold;
            }
            .amount-section {
              margin-bottom: 15px;
            }
            .amount-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 5px;
              font-size: 12px;
            }
            .amount-row.total {
              font-weight: bold;
              font-size: 14px;
              border-top: 1px solid #ccc;
              padding-top: 5px;
              margin-top: 5px;
            }
            .barcode-section {
              text-align: center;
              margin-bottom: 15px;
            }
            .barcode-image {
              display: flex;
              justify-content: center;
              margin-bottom: 5px;
            }
            .barcode-image img {
              max-width: 100%;
              height: auto;
            }
            .barcode-text {
              font-size: 10px;
              color: #666;
            }
            .receipt-footer {
              text-align: center;
              font-size: 10px;
              color: #666;
            }
            .receipt-footer p {
              margin: 2px 0;
            }
            @media print {
              body {
                padding: 0;
              }
              .receipt {
                box-shadow: none;
                border: none;
              }
            }
          </style>
        </head>
        <body>
          ${receiptContent}
        </body>
        </html>
      `)
      
      printWindow.document.close()
      printWindow.focus()
      
      // 自動列印
      setTimeout(() => {
        printWindow.print()
        printWindow.close()
      }, 500)
    }
  }
}
</script>

<style scoped>
.receipt-container {
  display: flex;
  justify-content: center;
  padding: 20px;
}

.receipt {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  width: 300px;
  font-family: 'Courier New', monospace;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.receipt-header {
  text-align: center;
  margin-bottom: 15px;
}

.receipt-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: bold;
}

.receipt-info {
  margin-bottom: 15px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  font-size: 12px;
}

.label {
  font-weight: bold;
}

.value {
  text-align: right;
}

.divider {
  border-top: 1px dashed #ccc;
  margin: 15px 0;
}

.items-section {
  margin-bottom: 15px;
}

.items-list {
  font-size: 12px;
}

.item-row {
  display: flex;
  flex-direction: column;
  margin-bottom: 8px;
  border-bottom: 1px dotted #eee;
  padding-bottom: 5px;
}

.item-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-name {
  flex: 2;
  font-weight: bold;
}

.item-quantity {
  flex: 1;
  text-align: center;
  font-weight: bold;
}

.item-price {
  flex: 1;
  text-align: right;
  font-weight: bold;
}

.item-options {
  margin-top: 3px;
  margin-left: 10px;
}

.option-row {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #666;
  margin-bottom: 2px;
}

.option-name {
  flex: 2;
}

.option-price {
  flex: 1;
  text-align: right;
  color: #e74c3c;
  font-weight: bold;
}

.amount-section {
  margin-bottom: 15px;
}

.amount-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  font-size: 12px;
}

.amount-row.total {
  font-weight: bold;
  font-size: 14px;
  border-top: 1px solid #ccc;
  padding-top: 5px;
  margin-top: 5px;
}

.barcode-section {
  text-align: center;
  margin-bottom: 15px;
}

.barcode-image {
  display: flex;
  justify-content: center;
  margin-bottom: 10px;
  min-height: 40px;
  max-width: 170px;
  margin: 0 auto 10px auto;
}

.barcode-number {
  font-size: 14px;
  font-weight: bold;
  color: #333;
  text-align: center;
  letter-spacing: 1px;
  margin-top: 5px;
}

.barcode-image svg {
  max-width: 100%;
  height: auto;
}

.barcode-text {
  font-size: 10px;
  color: #666;
}

.receipt-footer {
  text-align: center;
  font-size: 10px;
  color: #666;
}

.receipt-footer p {
  margin: 2px 0;
}
</style>
