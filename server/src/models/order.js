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
orderSchema.statics.generateOrderNumber = async function(tableId, tableNumber) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  // 獲取桌號（去掉可能的T前綴）
  const cleanTableNumber = tableNumber.replace(/^T/i, '');
  
  // 查找該桌今天的最後一組客人編號
  const todayOrders = await this.find({
    tableId: tableId,
    createdAt: {
      $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
    }
  }).sort({ createdAt: -1 });
  
  let currentGroupNumber = 1;
  let currentBatchNumber = 1;
  
  if (todayOrders.length > 0) {
    // 檢查最後一個訂單的編號格式
    const lastOrder = todayOrders[0];
    const orderNumberMatch = lastOrder.orderNumber.match(/^T\d+-\d{8}(\d{4})(\d{3})$/);
    
    if (orderNumberMatch) {
      // 檢查最後一個訂單的狀態，如果已完成或取消，則是新的一組客人
      if (['completed', 'cancelled'].includes(lastOrder.status)) {
        // 新的一組客人，組別號+1，批次號重置為1
        currentGroupNumber = parseInt(orderNumberMatch[1]) + 1;
        currentBatchNumber = 1;
      } else {
        // 同一組客人加點，批次號+1
        currentGroupNumber = parseInt(orderNumberMatch[1]);
        currentBatchNumber = parseInt(orderNumberMatch[2]) + 1;
      }
    }
  } else {
    // 如果沒有今天的訂單，從第1組第1批次開始
    currentGroupNumber = 1;
    currentBatchNumber = 1;
  }
  
  // 生成新的訂單編號
  const orderNumber = `T${cleanTableNumber}-${dateStr}${currentGroupNumber.toString().padStart(4, '0')}${currentBatchNumber.toString().padStart(3, '0')}`;
  
  // 檢查這個訂單號是否已經存在
  const existingOrder = await this.findOne({ orderNumber });
  if (existingOrder) {
    // 如果重複，批次號+1
    currentBatchNumber++;
    return `T${cleanTableNumber}-${dateStr}${currentGroupNumber.toString().padStart(4, '0')}${currentBatchNumber.toString().padStart(3, '0')}`;
  }
  
  return orderNumber;
};

// 獲取同一桌同一組客人的所有批次訂單
orderSchema.statics.getOrdersByGroup = async function(tableId, groupNumber) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  const table = await this.findOne({ tableId }).populate('tableId');
  const tableNumber = table?.tableId?.tableNumber || '1';
  const cleanTableNumber = tableNumber.replace(/^T/i, '');
  
  const groupPattern = `T${cleanTableNumber}-${dateStr}${groupNumber.toString().padStart(4, '0')}`;
  
  return this.find({
    orderNumber: { $regex: `^${groupPattern}` },
    status: { $nin: ['completed', 'cancelled'] }
  }).sort({ createdAt: 1 });
};

// 獲取同一桌今天的所有組別
orderSchema.statics.getTodayGroupsByTable = async function(tableId) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  const table = await this.findOne({ tableId }).populate('tableId');
  const tableNumber = table?.tableId?.tableNumber || '1';
  const cleanTableNumber = tableNumber.replace(/^T/i, '');
  
  const groupPattern = `T${cleanTableNumber}-${dateStr}`;
  
  const orders = await this.find({
    orderNumber: { $regex: `^${groupPattern}` },
    createdAt: {
      $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
      $lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)
    }
  }).sort({ createdAt: -1 });
  
  // 提取組別號碼
  const groups = new Set();
  orders.forEach(order => {
    const match = order.orderNumber.match(/^T\d+-\d{8}(\d{4})/);
    if (match) {
      groups.add(parseInt(match[1]));
    }
  });
  
  return Array.from(groups).sort((a, b) => a - b);
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
