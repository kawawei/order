const mongoose = require('mongoose');

// 收據項目 Schema
const receiptItemSchema = new mongoose.Schema({
  dishId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dish',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  selectedOptions: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
});

// 收據 Schema
const receiptSchema = new mongoose.Schema({
  // 收據基本信息
  billNumber: {
    type: String,
    required: true,
    unique: true
  },
  
  // 關聯信息
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  tableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Table',
    required: true
  },
  tableNumber: {
    type: String,
    required: true
  },
  merchantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: true
  },
  
  // 收據詳情
  items: [receiptItemSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: 0
  },
  
  // 員工信息
  employeeId: {
    type: String,
    required: true
  },
  employeeName: {
    type: String,
    default: ''
  },
  
  // 時間信息
  checkoutTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // 餐廳信息
  storeName: {
    type: String,
    required: true
  },
  
  // 收據狀態
  status: {
    type: String,
    enum: ['active', 'void', 'refunded'],
    default: 'active'
  },
  
  // 備註
  notes: {
    type: String,
    default: ''
  },
  
  // 列印信息
  printCount: {
    type: Number,
    default: 0
  },
  lastPrintedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// 建立索引
receiptSchema.index({ merchantId: 1, checkoutTime: -1 });
receiptSchema.index({ tableId: 1, checkoutTime: -1 });
receiptSchema.index({ orderId: 1 });
receiptSchema.index({ billNumber: 1 });
receiptSchema.index({ employeeId: 1, checkoutTime: -1 });

// 生成帳單號碼的靜態方法
receiptSchema.statics.generateBillNumber = function() {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
};

// 從訂單創建收據的靜態方法
receiptSchema.statics.createFromOrder = async function(order, employeeId, employeeName = '') {
  console.log('=== 🛒 結帳收據生成調試信息 ===');
  console.log('📋 操作類型: 結帳按鈕觸發');
  console.log('生成時間:', new Date().toISOString());
  console.log('訂單ID:', order._id);
  console.log('訂單編號:', order.orderNumber);
  console.log('桌號:', order.tableNumber);
  console.log('商家ID:', order.merchantId);
  console.log('員工ID:', employeeId);
  console.log('員工姓名:', employeeName);
  
  const billNumber = this.generateBillNumber();
  console.log('生成的帳單號碼:', billNumber);
  
  // 轉換訂單項目為收據項目
  const receiptItems = order.items.map(item => {
    const receiptItem = {
      dishId: item.dishId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      selectedOptions: item.selectedOptions || new Map()
    };
    
    console.log('收據項目:', {
      dishId: item.dishId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      selectedOptions: item.selectedOptions ? Object.fromEntries(item.selectedOptions) : {}
    });
    
    return receiptItem;
  });
  
  console.log('訂單總金額:', order.totalAmount);
  console.log('收據項目總數:', receiptItems.length);
  console.log('商家名稱:', order.merchantId?.businessName || order.merchantId?.name || '餐廳');
  
  const receipt = new this({
    billNumber,
    orderId: order._id,
    tableId: order.tableId,
    tableNumber: order.tableNumber,
    merchantId: order.merchantId,
    items: receiptItems,
    subtotal: order.totalAmount,
    total: order.totalAmount,
    employeeId,
    employeeName,
    checkoutTime: new Date(),
    storeName: order.merchantId?.businessName || order.merchantId?.name || '餐廳'
  });
  
  console.log('🛒 結帳收據對象創建完成，包含以下數據:');
  console.log('- 帳單號碼:', receipt.billNumber);
  console.log('- 訂單ID:', receipt.orderId);
  console.log('- 桌號:', receipt.tableNumber);
  console.log('- 商家ID:', receipt.merchantId);
  console.log('- 商家名稱:', receipt.storeName);
  console.log('- 員工ID:', receipt.employeeId);
  console.log('- 員工姓名:', receipt.employeeName);
  console.log('- 小計:', receipt.subtotal);
  console.log('- 總計:', receipt.total);
  console.log('- 項目數量:', receipt.items.length);
  
  const savedReceipt = await receipt.save();
  console.log('收據保存成功，收據ID:', savedReceipt._id);
  console.log('=== 🛒 結帳收據生成完成 ===');
  
  return savedReceipt;
};

// 從訂單創建收據的靜態方法（使用指定的 billNumber）
receiptSchema.statics.createFromOrderWithBillNumber = async function(order, employeeId, employeeName = '', billNumber) {
  console.log('=== 🖨️ 歷史訂單收據列印調試信息 ===');
  console.log('📋 操作類型: 歷史訂單列印收據');
  console.log('生成時間:', new Date().toISOString());
  console.log('訂單ID:', order._id);
  console.log('訂單編號:', order.orderNumber);
  console.log('桌號:', order.tableNumber);
  console.log('商家ID:', order.merchantId);
  console.log('員工ID:', employeeId);
  console.log('員工姓名:', employeeName);
  console.log('指定的帳單號碼:', billNumber);
  
  // 轉換訂單項目為收據項目
  const receiptItems = order.items.map(item => {
    const receiptItem = {
      dishId: item.dishId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      selectedOptions: item.selectedOptions || new Map()
    };
    
    console.log('收據項目:', {
      dishId: item.dishId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      selectedOptions: item.selectedOptions ? Object.fromEntries(item.selectedOptions) : {}
    });
    
    return receiptItem;
  });
  
  console.log('訂單總金額:', order.totalAmount);
  console.log('收據項目總數:', receiptItems.length);
  console.log('商家名稱:', order.merchantId?.businessName || '餐廳');
  
  const receipt = new this({
    billNumber,
    orderId: order._id,
    tableId: order.tableId,
    tableNumber: order.tableNumber,
    merchantId: order.merchantId,
    items: receiptItems,
    subtotal: order.totalAmount,
    total: order.totalAmount,
    employeeId,
    employeeName,
    checkoutTime: new Date(),
    storeName: order.merchantId?.businessName || '餐廳'
  });
  
  console.log('🖨️ 歷史訂單收據對象創建完成，包含以下數據:');
  console.log('- 帳單號碼:', receipt.billNumber);
  console.log('- 訂單ID:', receipt.orderId);
  console.log('- 訂單編號:', order.orderNumber);
  console.log('- 桌號:', receipt.tableNumber);
  console.log('- 商家ID:', receipt.merchantId);
  console.log('- 商家名稱:', receipt.storeName);
  console.log('- 員工ID:', receipt.employeeId);
  console.log('- 員工姓名:', receipt.employeeName);
  console.log('- 小計:', receipt.subtotal);
  console.log('- 總計:', receipt.total);
  console.log('- 項目數量:', receipt.items.length);
  
  console.log('=== 收據與訂單關聯驗證 ===');
  console.log('收據 orderId:', receipt.orderId);
  console.log('原始訂單 _id:', order._id);
  console.log('原始訂單 orderNumber:', order.orderNumber);
  console.log('關聯是否正確:', receipt.orderId.toString() === order._id.toString());
  
  const savedReceipt = await receipt.save();
  console.log('收據保存成功，收據ID:', savedReceipt._id);
  console.log('=== 🖨️ 歷史訂單收據列印完成 ===');
  
  return savedReceipt;
};

// 獲取收據統計的靜態方法
receiptSchema.statics.getStats = async function(merchantId, startDate, endDate) {
  const matchQuery = {
    merchantId: new mongoose.Types.ObjectId(merchantId),
    status: 'active'
  };
  
  if (startDate && endDate) {
    matchQuery.checkoutTime = {
      $gte: new Date(startDate),
      $lt: new Date(new Date(endDate).setDate(new Date(endDate).getDate() + 1))
    };
  }
  
  const stats = await this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: null,
        totalReceipts: { $sum: 1 },
        totalRevenue: { $sum: '$total' },
        averageAmount: { $avg: '$total' }
      }
    }
  ]);
  
  return stats[0] || {
    totalReceipts: 0,
    totalRevenue: 0,
    averageAmount: 0
  };
};

module.exports = mongoose.model('Receipt', receiptSchema);
