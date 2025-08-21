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
            <span class="item-name">{{ item.name }}</span>
            <span class="item-quantity">*{{ item.quantity }}</span>
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
        <div class="barcode-text">{{ receipt.billNumber }}</div>
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
  methods: {
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
              justify-content: space-between;
              margin-bottom: 5px;
            }
            .item-name {
              flex: 2;
            }
            .item-quantity {
              flex: 1;
              text-align: center;
            }
            .item-price {
              flex: 1;
              text-align: right;
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
  justify-content: space-between;
  margin-bottom: 5px;
}

.item-name {
  flex: 2;
}

.item-quantity {
  flex: 1;
  text-align: center;
}

.item-price {
  flex: 1;
  text-align: right;
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
