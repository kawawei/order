const jwt = require('jsonwebtoken');
const Merchant = require('../models/merchant');
const Employee = require('../models/employee');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

// 生成 JWT Token - Generate JWT Token
const signToken = (id, role = 'merchant', extraPayload = {}) => {
  return jwt.sign({ id, role, ...extraPayload }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

// 發送 JWT Token（商家）
const createSendToken = (merchant, statusCode, res) => {
  const token = signToken(merchant._id, 'merchant');

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

// 發送 JWT Token（員工）
const createSendEmployeeToken = (employee, statusCode, res) => {
  const token = signToken(employee._id, 'employee', { merchantId: employee.merchant });
  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      employee: {
        id: employee._id,
        name: employee.name,
        account: employee.account,
        merchant: employee.merchant,
        role: employee.role || null
      }
    }
  });
};

// 註冊新商家
exports.signup = catchAsync(async (req, res, next) => {
  console.log('收到註冊請求:', req.body);

  const {
    email,
    password,
    name,
    businessName: bodyBusinessName,
    phone,
    address,
    businessType,
    businessHours,
    merchantCode: providedMerchantCode,
    restaurantType,
    taxId
  } = req.body;

  // 兼容前端傳入的 businessName 或 name
  const businessName = (bodyBusinessName || name || '').trim();

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
    // 地址可能是字串或物件，統一處理
    let fullAddress = address;
    let city, district, street, postalCode;
    if (typeof address === 'object' && address !== null) {
      city = address.city || '';
      district = address.district || '';
      street = address.street || '';
      postalCode = address.postalCode || '';
      fullAddress = `${city}${district}${street}`.trim() || '未提供地址';
    }

    // 產生 merchantCode（若未提供）
    const baseCode = (providedMerchantCode || businessName || 'merchant')
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 12);
    let merchantCode = baseCode || 'merchant';

    // 確保 merchantCode 不重複
    let suffix = 1;
    while (await Merchant.findOne({ merchantCode })) {
      merchantCode = `${baseCode}${suffix++}`;
    }

    // 創建新商家
    // 清理與驗證
    const cleanedTaxId = taxId ? String(taxId).replace(/\D/g, '') : '';
    if (taxId && cleanedTaxId.length !== 8) {
      return next(new AppError('統一編號需為 8 位數字', 400));
    }

    const newMerchant = await Merchant.create({
      merchantCode,
      email,
      password,
      businessName,
      businessType: businessType || 'restaurant',
      restaurantType: (restaurantType || '').trim(),
      taxId: cleanedTaxId || undefined,
      phone,
      address: fullAddress,
      ...(city ? { city } : {}),
      ...(district ? { district } : {}),
      ...(street ? { street } : {}),
      ...(postalCode ? { postalCode } : {}),
      businessHours,
      status: 'pending'
    });

    console.log('商家創建成功:', newMerchant._id);

    // 預設建立角色：收銀員、廚師、管理人員
    const Role = require('../models/role');
    const defaultRoles = [
      { name: '收銀員', permissions: ['訂單:查看', '訂單:結帳', '桌位:查看'] },
      { name: '廚師', permissions: ['訂單:查看', '訂單:更新狀態', '桌位:查看'] },
      { name: '管理人員', permissions: ['菜單:查看','菜單:編輯','庫存:查看','庫存:編輯','訂單:查看','訂單:更新狀態','訂單:結帳','桌位:查看','桌位:管理','報表:查看','商家設定:編輯','員工:查看','員工:編輯','角色:管理'], isSystem: true }
    ];
    await Role.insertMany(defaultRoles.map(r => ({ ...r, merchant: newMerchant._id })));

    // 生成並發送 Token
    createSendToken(newMerchant, 201, res);
  } catch (error) {
    console.error('創建商家失敗:', error);
    return next(new AppError('創建商家帳戶失敗，請檢查輸入的數據', 400));
  }
});

// 商家/員工登入
exports.login = catchAsync(async (req, res, next) => {
  const { email, password, merchantCode, employeeCode } = req.body || {};

  // 分支一：使用商家代碼 + 員工編號登入（不需要密碼）
  if (merchantCode && employeeCode) {
    const merchant = await Merchant.findOne({ merchantCode });
    if (!merchant) {
      return next(new AppError('商家代碼或員工編號錯誤', 401));
    }
    const employee = await Employee.findOne({ merchant: merchant._id, account: employeeCode }).populate('role');
    if (!employee || employee.isActive === false) {
      return next(new AppError('商家代碼或員工編號錯誤', 401));
    }
    // 簽發員工 token
    return createSendEmployeeToken(employee, 200, res);
  }

  // 分支二：舊版商家 email/password 登入
  if (!email || !password) {
    return next(new AppError('請提供登入憑證', 400));
  }
  const merchant = await Merchant.findOne({ email }).select('+password');
  if (!merchant || !(await merchant.correctPassword(password, merchant.password))) {
    return next(new AppError('電子郵件或密碼錯誤', 401));
  }
  if (merchant.status === 'suspended') {
    return next(new AppError('您的帳戶已被停用，請聯繫客服', 403));
  }
  return createSendToken(merchant, 200, res);
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
