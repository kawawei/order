const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  // 原料名稱
  name: {
    type: String,
    required: [true, '請提供原料名稱'],
    trim: true
  },
  
  // 原料描述
  description: {
    type: String,
    default: ''
  },
  
  // 所屬商家
  merchant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: [true, '原料必須關聯商家']
  },
  
  // 原料分類
  category: {
    type: String,
    required: [true, '請提供原料分類'],
    trim: true
  },
  
  // 原料類型：單一原料或多規格原料
  type: {
    type: String,
    enum: ['single', 'multiSpec'],
    default: 'single'
  },
  
  // 單一原料的庫存信息
  singleStock: {
    quantity: {
      type: Number,
      default: 0,
      min: [0, '庫存數量不能為負數']
    },
    unit: {
      type: String,
      required: [true, '請提供計量單位'],
      trim: true
    },
    minStock: {
      type: Number,
      default: 0,
      min: [0, '最低庫存不能為負數']
    },
    maxStock: {
      type: Number,
      default: 1000,
      min: [0, '最高庫存不能為負數']
    }
  },
  
  // 多規格原料的庫存信息
  multiSpecStock: [{
    specName: {
      type: String,
      required: true,
      trim: true
    },
    quantity: {
      type: Number,
      default: 0,
      min: [0, '庫存數量不能為負數']
    },
    unit: {
      type: String,
      required: true,
      trim: true
    },
    minStock: {
      type: Number,
      default: 0,
      min: [0, '最低庫存不能為負數']
    },
    maxStock: {
      type: Number,
      default: 1000,
      min: [0, '最高庫存不能為負數']
    }
  }],
  
  // 供應商信息
  supplier: {
    name: {
      type: String,
      default: '',
      trim: true
    },
    contact: {
      type: String,
      default: '',
      trim: true
    },
    phone: {
      type: String,
      default: '',
      trim: true
    }
  },
  
  // 成本信息
  cost: {
    unitPrice: {
      type: Number,
      default: 0,
      min: [0, '單價不能為負數']
    },
    currency: {
      type: String,
      default: 'TWD',
      enum: ['TWD', 'USD', 'CNY']
    }
  },
  
  // 庫存狀態
  status: {
    type: String,
    enum: ['active', 'inactive', 'discontinued'],
    default: 'active'
  },
  
  // 是否啟用
  isActive: {
    type: Boolean,
    default: true
  },
  
  // 庫存警告
  stockAlert: {
    enabled: {
      type: Boolean,
      default: true
    },
    threshold: {
      type: Number,
      default: 10,
      min: [0, '警告閾值不能為負數']
    }
  },
  
  // 備註
  notes: {
    type: String,
    default: ''
  },
  
  // 圖片
  image: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// 建立索引
inventorySchema.index({ merchant: 1, category: 1 });
inventorySchema.index({ merchant: 1, type: 1 });
inventorySchema.index({ merchant: 1, status: 1 });
inventorySchema.index({ merchant: 1, isActive: 1 });
inventorySchema.index({ 
  name: 'text', 
  description: 'text', 
  category: 'text' 
});

// 虛擬字段：總庫存數量
inventorySchema.virtual('totalQuantity').get(function() {
  if (this.type === 'single') {
    return this.singleStock.quantity;
  } else if (this.type === 'multiSpec') {
    return this.multiSpecStock.reduce((total, spec) => total + spec.quantity, 0);
  }
  return 0;
});

// 虛擬字段：是否需要補貨
inventorySchema.virtual('needsRestock').get(function() {
  if (this.type === 'single') {
    return this.singleStock.quantity <= this.singleStock.minStock;
  } else if (this.type === 'multiSpec') {
    return this.multiSpecStock.some(spec => spec.quantity <= spec.minStock);
  }
  return false;
});

// 虛擬字段：庫存狀態描述
inventorySchema.virtual('stockStatus').get(function() {
  if (this.type === 'single') {
    if (this.singleStock.quantity === 0) return 'outOfStock';
    if (this.singleStock.quantity <= this.singleStock.minStock) return 'lowStock';
    return 'inStock';
  } else if (this.type === 'multiSpec') {
    const hasOutOfStock = this.multiSpecStock.some(spec => spec.quantity === 0);
    const hasLowStock = this.multiSpecStock.some(spec => spec.quantity <= spec.minStock);
    
    if (hasOutOfStock) return 'outOfStock';
    if (hasLowStock) return 'lowStock';
    return 'inStock';
  }
  return 'unknown';
});

// 設置虛擬字段在 JSON 序列化時包含
inventorySchema.set('toJSON', { virtuals: true });
inventorySchema.set('toObject', { virtuals: true });

// 中間件：保存前驗證
inventorySchema.pre('save', function(next) {
  // 驗證單一原料類型
  if (this.type === 'single') {
    if (!this.singleStock.unit) {
      return next(new Error('單一原料必須提供計量單位'));
    }
  }
  
  // 驗證多規格原料類型
  if (this.type === 'multiSpec') {
    if (!this.multiSpecStock || this.multiSpecStock.length === 0) {
      return next(new Error('多規格原料必須提供至少一個規格'));
    }
    
    // 檢查規格名稱是否重複
    const specNames = this.multiSpecStock.map(spec => spec.specName);
    const uniqueSpecNames = [...new Set(specNames)];
    if (specNames.length !== uniqueSpecNames.length) {
      return next(new Error('多規格原料的規格名稱不能重複'));
    }
  }
  
  next();
});

// 實例方法：更新庫存
inventorySchema.methods.updateStock = function(specName, quantity, operation = 'set') {
  if (this.type === 'single') {
    if (operation === 'add') {
      this.singleStock.quantity += quantity;
    } else if (operation === 'subtract') {
      this.singleStock.quantity = Math.max(0, this.singleStock.quantity - quantity);
    } else {
      this.singleStock.quantity = Math.max(0, quantity);
    }
  } else if (this.type === 'multiSpec') {
    const spec = this.multiSpecStock.find(s => s.specName === specName);
    if (!spec) {
      throw new Error(`規格 "${specName}" 不存在`);
    }
    
    if (operation === 'add') {
      spec.quantity += quantity;
    } else if (operation === 'subtract') {
      spec.quantity = Math.max(0, spec.quantity - quantity);
    } else {
      spec.quantity = Math.max(0, quantity);
    }
  }
  
  return this.save();
};

const Inventory = mongoose.model('Inventory', inventorySchema);

module.exports = Inventory;

