const mongoose = require('mongoose');

const menuCategorySchema = new mongoose.Schema({
  // 分類基本信息
  name: {
    type: String,
    required: [true, '請提供分類名稱'],
    trim: true
  },
  label: {
    type: String,
    required: [true, '請提供分類顯示名稱'],
    trim: true
  },
  
  // 所屬商家
  merchant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Merchant',
    required: [true, '分類必須關聯商家']
  },
  
  // 分類描述
  description: {
    type: String,
    default: ''
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
  
  // 分類圖標或圖片
  icon: {
    type: String,
    default: ''
  },
  
  // 分類顏色（用於UI區分）
  color: {
    type: String,
    default: '#6366f1'
  }
}, {
  timestamps: true
});

// 建立複合索引
menuCategorySchema.index({ merchant: 1, name: 1 }, { unique: true });
menuCategorySchema.index({ merchant: 1, sortOrder: 1 });

// 虛擬字段：該分類下的菜品數量
menuCategorySchema.virtual('dishCount', {
  ref: 'Dish',
  localField: '_id',
  foreignField: 'category',
  count: true
});

// 設置虛擬字段在 JSON 序列化時包含
menuCategorySchema.set('toJSON', { virtuals: true });
menuCategorySchema.set('toObject', { virtuals: true });

const MenuCategory = mongoose.model('MenuCategory', menuCategorySchema);

module.exports = MenuCategory;
