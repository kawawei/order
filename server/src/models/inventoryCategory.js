const mongoose = require('mongoose');

const inventoryCategorySchema = new mongoose.Schema({
  // 分類名稱
  name: {
    type: String,
    required: [true, '請提供分類名稱'],
    trim: true,
    maxlength: [50, '分類名稱不能超過50個字符']
  },
  
  // 分類描述
  description: {
    type: String,
    default: '',
    maxlength: [200, '分類描述不能超過200個字符']
  },
  
  // 所屬商家
  merchant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: [true, '分類必須關聯商家']
  },
  
  // 排序順序
  sortOrder: {
    type: Number,
    default: 0
  },
  
  // 是否啟用
  isActive: {
    type: Boolean,
    default: true
  },
  
  // 是否為系統預設分類
  isSystem: {
    type: Boolean,
    default: false
  },
  
  // 顏色標籤（用於UI顯示）
  color: {
    type: String,
    default: '#3B82F6', // 預設藍色
    validate: {
      validator: function(v) {
        return /^#[0-9A-F]{6}$/i.test(v);
      },
      message: '顏色必須是有效的十六進制顏色碼'
    }
  },
  
  // 圖標（可選）
  icon: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// 複合索引：商家 + 分類名稱必須唯一
inventoryCategorySchema.index({ merchant: 1, name: 1 }, { unique: true });

// 虛擬字段：該分類下的原料數量
inventoryCategorySchema.virtual('itemCount', {
  ref: 'Inventory',
  localField: '_id',
  foreignField: 'category',
  count: true
});

// 預保存中間件：確保系統預設分類不能被刪除或停用
inventoryCategorySchema.pre('save', function(next) {
  if (this.isSystem && !this.isActive) {
    this.isActive = true;
  }
  next();
});

// 預刪除中間件：防止刪除系統預設分類
inventoryCategorySchema.pre('remove', function(next) {
  if (this.isSystem) {
    return next(new Error('系統預設分類不能刪除'));
  }
  next();
});

// 靜態方法：創建系統預設分類
inventoryCategorySchema.statics.createSystemCategories = async function(merchantId) {
  const systemCategories = [
    { name: '食品', description: '食品原料', color: '#10B981', icon: 'utensils', sortOrder: 1 },
    { name: '包裝', description: '包裝材料', color: '#3B82F6', icon: 'box', sortOrder: 2 },
    { name: '耗材', description: '日常耗材', color: '#F59E0B', icon: 'tools', sortOrder: 3 }
  ];
  
  const categories = [];
  for (const cat of systemCategories) {
    const existing = await this.findOne({ merchant: merchantId, name: cat.name });
    if (!existing) {
      categories.push(await this.create({
        ...cat,
        merchant: merchantId,
        isSystem: true
      }));
    }
  }
  
  return categories;
};

// 實例方法：檢查是否可以刪除
inventoryCategorySchema.methods.canDelete = async function() {
  if (this.isSystem) return false;
  
  // 檢查是否有原料使用此分類
  const Inventory = mongoose.model('Inventory');
  const count = await Inventory.countDocuments({ category: this.name, merchant: this.merchant });
  return count === 0;
};

module.exports = mongoose.model('InventoryCategory', inventoryCategorySchema);

