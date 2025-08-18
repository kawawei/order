const jwt = require('jsonwebtoken');
const Merchant = require('../models/merchant');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

// 生成 JWT Token - Generate JWT Token
const signToken = (id, role = 'merchant') => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

// 發送 JWT Token
const createSendToken = (merchant, statusCode, res) => {
  const token = signToken(merchant._id);

  // 移除密碼
  merchant.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      merchant
    }
  });
};

// 註冊新商家
exports.signup = catchAsync(async (req, res, next) => {
  console.log('收到註冊請求:', req.body);

  const {
    email,
    password,
    name: businessName,
    phone,
    address,
    businessType,
    businessHours
  } = req.body;

  // 基本欄位驗證
  if (!email || !password || !businessName || !phone || !address) {
    console.error('缺少必要欄位');
    return next(new AppError('請填寫所有必要欄位', 400));
  }

  // 檢查是否已存在相同郵箱
  const existingMerchant = await Merchant.findOne({ email });
  if (existingMerchant) {
    console.error('電子郵件已存在:', email);
    return next(new AppError('該電子郵件已被註冊', 400));
  }

  try {
    // 創建新商家
    const newMerchant = await Merchant.create({
      email,
      password,
      businessName,
      businessType: businessType || 'restaurant',
      phone,
      address,
      businessHours,
      status: 'pending'
    });

    console.log('商家創建成功:', newMerchant._id);

    // 生成並發送 Token
    createSendToken(newMerchant, 201, res);
  } catch (error) {
    console.error('創建商家失敗:', error);
    return next(new AppError('創建商家帳戶失敗，請檢查輸入的數據', 400));
  }
});

// 商家登入
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 檢查是否提供郵箱和密碼
  if (!email || !password) {
    return next(new AppError('請提供電子郵件和密碼', 400));
  }

  // 查找商家並選擇密碼字段
  const merchant = await Merchant.findOne({ email }).select('+password');

  // 檢查商家是否存在及密碼是否正確
  if (!merchant || !(await merchant.correctPassword(password, merchant.password))) {
    return next(new AppError('電子郵件或密碼錯誤', 401));
  }

  // 檢查商家狀態
  if (merchant.status === 'suspended') {
    return next(new AppError('您的帳戶已被停用，請聯繫客服', 403));
  }

  // 生成並發送 Token
  createSendToken(merchant, 200, res);
});

// 保護路由中間件
exports.protect = catchAsync(async (req, res, next) => {
  // 獲取 Token
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('您尚未登入，請先登入', 401));
  }

  // 驗證 Token
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // 檢查用戶是否仍然存在
  if (decoded.role === 'merchant') {
    const merchant = await Merchant.findById(decoded.id);
    if (!merchant) {
      return next(new AppError('此 Token 對應的商家不存在', 401));
    }
    // 將商家信息添加到請求對象
    req.merchant = merchant;
    req.user = merchant;
  } else if (decoded.role === 'admin' || decoded.role === 'superadmin') {
    const Admin = require('../models/admin');
    const admin = await Admin.findById(decoded.id);
    if (!admin) {
      return next(new AppError('此 Token 對應的管理員不存在', 401));
    }
    // 將管理員信息添加到請求對象
    req.admin = admin;
    req.user = admin;
  } else {
    // 默認情況下，假設是商家用戶（向後兼容）
    const merchant = await Merchant.findById(decoded.id);
    if (!merchant) {
      return next(new AppError('此 Token 對應的用戶不存在', 401));
    }
    // 將商家信息添加到請求對象
    req.merchant = merchant;
    req.user = merchant;
  }
  
  next();
});

// 更新密碼
exports.updatePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  // 獲取商家（包含密碼）
  const merchant = await Merchant.findById(req.merchant.id).select('+password');

  // 檢查當前密碼是否正確
  if (!(await merchant.correctPassword(currentPassword, merchant.password))) {
    return next(new AppError('當前密碼錯誤', 401));
  }

  // 更新密碼
  merchant.password = newPassword;
  await merchant.save();

  // 生成新的 Token
  createSendToken(merchant, 200, res);
});
