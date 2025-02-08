const jwt = require('jsonwebtoken');
const Admin = require('../models/admin');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

// 創建超級管理員
exports.createSuperAdmin = catchAsync(async (req, res, next) => {
  // 檢查是否已存在超級管理員
  const existingSuperAdmin = await Admin.findOne({ role: 'superadmin' });
  if (existingSuperAdmin) {
    return next(new AppError('超級管理員已存在', 400));
  }

  const admin = await Admin.create({
    username: process.env.SUPER_ADMIN_USERNAME,
    email: process.env.SUPER_ADMIN_EMAIL,
    password: process.env.SUPER_ADMIN_PASSWORD,
    role: 'superadmin'
  });

  admin.password = undefined;
  res.status(201).json({
    status: 'success',
    data: { admin }
  });
});

// 管理員登入
exports.login = catchAsync(async (req, res, next) => {
  console.log('收到管理員登入請求:', req.body);
  const { email, password, verificationCode } = req.body;

  // 驗證必要欄位
  if (!email || !password || !verificationCode) {
    return next(new AppError('請提供帳號、密碼和驗證碼', 400));
  }

  // 驗證管理員帳號
  const adminUsername = process.env.SUPER_ADMIN_USERNAME;
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD;

  console.log('檢查管理員帳號:', {
    inputEmail: email,
    adminUsername,
    match: email === adminUsername
  });

  if (email !== adminUsername) {
    return next(new AppError('管理員帳號不存在', 401));
  }

  // 驗證密碼
  console.log('檢查密碼:', {
    inputPassword: password,
    adminPassword,
    match: password === adminPassword
  });

  if (password !== adminPassword) {
    return next(new AppError('密碼錯誤', 401));
  }

  // 驗證碼驗證
  if (verificationCode !== '654321') {
    return next(new AppError('驗證碼錯誤', 401));
  }

  // 生成 JWT token
  const token = jwt.sign(
    { id: 'admin', role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  const response = {
    status: 'success',
    token,
    data: {
      admin: {
        username: adminUsername,
        role: 'admin'
      }
    }
  };

  console.log('登入成功回應:', response);
  res.status(200).json(response);
});

// 創建新管理員（只有超級管理員可以創建）
exports.createAdmin = catchAsync(async (req, res, next) => {
  const admin = await Admin.create({
    username: req.body.username,
    email: req.body.email,
    password: req.body.password,
    role: 'admin'
  });

  admin.password = undefined;
  res.status(201).json({
    status: 'success',
    data: { admin }
  });
});

// 獲取所有管理員
exports.getAllAdmins = catchAsync(async (req, res, next) => {
  const admins = await Admin.find().select('-password');
  
  res.status(200).json({
    status: 'success',
    results: admins.length,
    data: { admins }
  });
});
