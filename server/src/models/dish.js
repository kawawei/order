const mongoose = require('mongoose');

const dishSchema = new mongoose.Schema({
  // 菜品基本信息
  name: {
    type: String,
    required: [true, '請提供菜品名稱'],
    trim: true
  },
  
  // 菜品描述
  description: {
    type: String,
    default: ''
  },
  
  // 價格
  price: {
    type: Number,
    required: [true, '請提供菜品價格'],
    min: [0, '價格不能為負數']
  },
  
  // 所屬分類
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuCategory',
    required: [true, '菜品必須關聯分類']
  },
  
  // 所屬商家
  merchant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: [true, '菜品必須關聯商家']
  },
  
  // 菜品圖片
  image: {
    type: String,
    default: ''
  },
  
  // 是否啟用
  isActive: {
    type: Boolean,
    default: true
  },
  
  // 是否為招牌菜
  isSignature: {
    type: Boolean,
    default: false
  },
  
  // 是否為推薦菜品
  isRecommended: {
    type: Boolean,
    default: false
  },
  
  // 排序順序
  sortOrder: {
    type: Number,
    default: 0
  },
  
  // 菜品標籤（例如：素食、辣、新品等）
  tags: [{
    type: String,
    trim: true
  }],
  
  // 準備時間（分鐘）
  preparationTime: {
    type: Number,
    default: 15,
    min: [1, '準備時間至少為1分鐘']
  },
  
  // 庫存數量（-1表示無限制）
  stock: {
    type: Number,
    default: -1
  },
  
  // 營養信息
  nutrition: {
    calories: {
      type: Number,
      default: 0
    },
    protein: {
      type: Number,
      default: 0
    },
    carbs: {
      type: Number,
      default: 0
    },
    fat: {
      type: Number,
      default: 0
    }
  },
  
  // 過敏原信息
  allergens: [{
    type: String,
    enum: ['花生', '堅果', '蛋類', '乳製品', '海鮮', '麩質', '大豆', '芝麻']
  }],
  
  // 辣度等級
  spiceLevel: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  
  // 份量大小選項
  sizeOptions: [{
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    description: String
  }],
  
  // 可自定義選項（例如：加辣、去冰等）
  customOptions: [{
    name: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['checkbox', 'radio', 'select'],
      default: 'checkbox'
    },
    options: [{
      label: String,
      value: String,
      price: {
        type: Number,
        default: 0
      }
    }],
    required: {
      type: Boolean,
      default: false
    }
  }]
}, {
  timestamps: true
});

// 建立複合索引
dishSchema.index({ merchant: 1, category: 1 });
dishSchema.index({ merchant: 1, isActive: 1 });
dishSchema.index({ merchant: 1, isSignature: 1 });
dishSchema.index({ merchant: 1, isRecommended: 1 });
dishSchema.index({ merchant: 1, sortOrder: 1 });

// 全文搜索索引
dishSchema.index({ 
  name: 'text', 
  description: 'text', 
  tags: 'text' 
});

// 虛擬字段：是否有庫存
dishSchema.virtual('inStock').get(function() {
  return this.stock === -1 || this.stock > 0;
});

// 虛擬字段：基礎價格（用於顯示）
dishSchema.virtual('basePrice').get(function() {
  if (this.sizeOptions && this.sizeOptions.length > 0) {
    return Math.min(...this.sizeOptions.map(option => option.price));
  }
  return this.price;
});

// 設置虛擬字段在 JSON 序列化時包含
dishSchema.set('toJSON', { virtuals: true });
dishSchema.set('toObject', { virtuals: true });

// 中間件：保存前檢查分類和商家的一致性
dishSchema.pre('save', async function(next) {
  if (this.isModified('category') || this.isModified('merchant')) {
    const MenuCategory = mongoose.model('MenuCategory');
    const category = await MenuCategory.findById(this.category);
    
    if (!category) {
      return next(new Error('指定的分類不存在'));
    }
    
    if (category.merchant.toString() !== this.merchant.toString()) {
      return next(new Error('菜品的商家與分類的商家不一致'));
    }
  }
  next();
});

const Dish = mongoose.model('Dish', dishSchema);

module.exports = Dish;
