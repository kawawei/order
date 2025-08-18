const mongoose = require('mongoose');

// 訂單項目 Schema
const orderItemSchema = new mongoose.Schema({
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
  },
  notes: {
    type: String,
    default: ''
  }
});

// 訂單 Schema
const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true
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
  batchNumber: {
    type: Number,
    required: true,
    default: 1
  },
  parentOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  isMainOrder: {
    type: Boolean,
    default: true
  },
  items: [orderItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'served', 'completed', 'cancelled'],
    default: 'pending'
  },
  customerNotes: {
    type: String,
    default: ''
  },
  estimatedTime: {
    type: Number, // 預估製作時間（分鐘）
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  confirmedAt: Date,
  readyAt: Date,
  deliveredAt: Date,
  servedAt: Date,
  completedAt: Date
}, {
  timestamps: true
});

// 生成訂單編號的靜態方法
orderSchema.statics.generateOrderNumber = async function() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  // 使用重試機制來處理併發情況
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    try {
      // 使用 findOneAndUpdate 的原子操作來獲取下一個序號
      // 先嘗試找到今天的計數器文檔，如果不存在則創建
      const counterCollection = this.db.collection('ordercounters');
      
      const result = await counterCollection.findOneAndUpdate(
        { date: dateStr },
        { $inc: { sequence: 1 } },
        { 
          upsert: true, 
          returnDocument: 'after',
          returnOriginal: false 
        }
      );
      
      const sequence = result.value ? result.value.sequence : 1;
      const orderNumber = `${dateStr}${sequence.toString().padStart(4, '0')}`;
      
      // 檢查這個訂單號是否已經存在（雙重檢查）
      const existingOrder = await this.findOne({ orderNumber });
      if (!existingOrder) {
        return orderNumber;
      }
      
      // 如果還是重複，繼續重試
      attempts++;
    } catch (error) {
      attempts++;
      if (attempts >= maxAttempts) {
        // 如果重試次數用完，回退到時間戳方案
        const timestamp = Date.now().toString();
        const randomSuffix = Math.random().toString(36).substring(2, 6);
        return `${dateStr}${timestamp.slice(-4)}${randomSuffix}`.toUpperCase();
      }
      
      // 短暫延遲後重試
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
    }
  }
  
  // 最後的備用方案：使用時間戳和隨機數
  const timestamp = Date.now().toString();
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  return `${dateStr}${timestamp.slice(-4)}${randomSuffix}`.toUpperCase();
};

// 更新時間的中間件
orderSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// 計算總金額的方法
orderSchema.methods.calculateTotal = function() {
  this.totalAmount = this.items.reduce((total, item) => {
    return total + item.totalPrice;
  }, 0);
  return this.totalAmount;
};

// 更新狀態的方法
orderSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  
  if (newStatus === 'confirmed') {
    this.confirmedAt = new Date();
  } else if (newStatus === 'ready') {
    this.readyAt = new Date();
  } else if (newStatus === 'delivered') {
    this.deliveredAt = new Date();
  } else if (newStatus === 'served') {
    this.servedAt = new Date();
  } else if (newStatus === 'completed') {
    this.completedAt = new Date();
  }
  
  return this.save();
};

// 獲取下一個批次號碼的靜態方法
orderSchema.statics.getNextBatchNumber = async function(tableId) {
  const lastOrder = await this.findOne({ 
    tableId, 
    status: { $nin: ['completed', 'cancelled'] } 
  }).sort({ batchNumber: -1 });
  
  return lastOrder ? lastOrder.batchNumber + 1 : 1;
};

// 獲取同一桌所有批次的靜態方法
orderSchema.statics.getAllBatchesByTable = async function(tableId, excludeStatuses = ['completed', 'cancelled']) {
  return this.find({ 
    tableId,
    status: { $nin: excludeStatuses }
  }).sort({ batchNumber: 1, createdAt: 1 });
};

// 計算同一桌所有批次總金額的靜態方法
orderSchema.statics.calculateTableTotal = async function(tableId) {
  const batches = await this.getAllBatchesByTable(tableId);
  return batches.reduce((total, batch) => total + batch.totalAmount, 0);
};

// 合併同一桌所有批次進行結帳的靜態方法
orderSchema.statics.mergeBatchesForCheckout = async function(tableId) {
  const batches = await this.getAllBatchesByTable(tableId);
  
  if (batches.length === 0) {
    return null;
  }
  
  // 合併所有項目
  const allItems = [];
  let totalAmount = 0;
  
  batches.forEach(batch => {
    allItems.push(...batch.items);
    totalAmount += batch.totalAmount;
  });
  
  return {
    tableId,
    tableNumber: batches[0].tableNumber,
    merchantId: batches[0].merchantId,
    batches: batches,
    allItems,
    totalAmount,
    batchCount: batches.length
  };
};

module.exports = mongoose.model('Order', orderSchema);
