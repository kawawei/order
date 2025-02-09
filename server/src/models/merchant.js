const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const jwt = require('jsonwebtoken');

const merchantSchema = new mongoose.Schema({
  // 基本信息
  email: {
    type: String,
    required: [true, '請提供電子郵件'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, '請提供有效的電子郵件']
  },
  password: {
    type: String,
    required: [true, '請提供密碼'],
    minlength: [8, '密碼至少需要8個字符'],
    select: false // 查詢時默認不返回密碼
  },
  
  // 商家信息
  businessName: {
    type: String,
    required: [true, '請提供商家名稱'],
    trim: true
  },
  businessType: {
    type: String,
    default: 'restaurant',
    enum: ['restaurant', 'cafe', 'fastFood', 'other']
  },
  phone: {
    type: String,
    required: [true, '請提供聯繫電話'],
    validate: {
      validator: function(v) {
        // 允許任何 10 位數字
        return /^\d{10}$/.test(v);
      },
      message: '請提供有效的電話號碼（10位數字）'
    }
  },

  // 地址信息
  address: {
    type: String,
    required: [true, '請提供地址']
  },
  city: {
    type: String,
    default: ''
  },
  district: {
    type: String,
    default: ''
  },
  street: {
    type: String,
    default: ''
  },
  postalCode: {
    type: String,
    default: ''
  },

  // 營業信息
  businessHours: {
    monday: { open: String, close: String },
    tuesday: { open: String, close: String },
    wednesday: { open: String, close: String },
    thursday: { open: String, close: String },
    friday: { open: String, close: String },
    saturday: { open: String, close: String },
    sunday: { open: String, close: String }
  },

  // 狀態信息
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended'],
    default: 'pending'
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },

  // 時間戳
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // 自動管理 createdAt 和 updatedAt
});

// 密碼加密中間件
merchantSchema.pre('save', async function(next) {
  // 只有在密碼被修改時才重新加密
  if (!this.isModified('password')) return next();
  
  // 加密密碼
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// 驗證密碼的實例方法
merchantSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// 創建商家 Token 的實例方法
merchantSchema.methods.createToken = function() {
  return jwt.sign(
    { id: this._id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

const Merchant = mongoose.model('Merchant', merchantSchema);

module.exports = Merchant;
