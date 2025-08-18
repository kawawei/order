const jwt = require('jsonwebtoken');
const Admin = require('../models/admin');
const Merchant = require('../models/merchant');
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
  const { email, username, password, verificationCode } = req.body;

  // 驗證必要欄位
  if ((!email && !username) || !password || !verificationCode) {
    return next(new AppError('請提供帳號、密碼和驗證碼', 400));
  }

  // 查找管理員
  const admin = await Admin.findOne({
    $or: [
      { email: email },
      { username: username || email }
    ]
  }).select('+password');

  if (!admin) {
    return next(new AppError('管理員帳號不存在', 401));
  }

  // 驗證密碼
  const isPasswordCorrect = await admin.correctPassword(password, admin.password);
  if (!isPasswordCorrect) {
    return next(new AppError('密碼錯誤', 401));
  }

  // 驗證碼驗證
  if (verificationCode !== '654321') {
    return next(new AppError('驗證碼錯誤', 401));
  }

  // 生成 JWT token
  const token = jwt.sign(
    { id: admin._id, role: admin.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  const response = {
    status: 'success',
    token,
    data: {
      admin: {
        username: admin.username,
        email: admin.email,
        role: admin.role
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

// 獲取所有商家（超級管理員專用）
exports.getAllMerchants = catchAsync(async (req, res, next) => {
  const { status, search, page = 1, limit = 20 } = req.query;
  
  // 構建查詢條件
  const queryObj = {};
  
  // 狀態篩選
  if (status && status !== 'all') {
    queryObj.status = status;
  }
  
  // 搜索功能
  if (search) {
    queryObj.$or = [
      { businessName: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } }
    ];
  }
  
  // 分頁
  const skip = (page - 1) * limit;
  
  // 執行查詢
  const merchants = await Merchant.find(queryObj)
    .select('-password')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
  
  // 獲取總數
  const total = await Merchant.countDocuments(queryObj);
  
  res.status(200).json({
    status: 'success',
    results: merchants.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: {
      merchants
    }
  });
});

// 獲取單個商家詳情
exports.getMerchant = catchAsync(async (req, res, next) => {
  const merchant = await Merchant.findById(req.params.id).select('-password');
  
  if (!merchant) {
    return next(new AppError('找不到指定的商家', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      merchant
    }
  });
});

// 更新商家狀態
exports.updateMerchantStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  
  if (!['pending', 'active', 'suspended'].includes(status)) {
    return next(new AppError('無效的狀態值', 400));
  }
  
  const merchant = await Merchant.findByIdAndUpdate(
    req.params.id,
    { status },
    { new: true, runValidators: true }
  ).select('-password');
  
  if (!merchant) {
    return next(new AppError('找不到指定的商家', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      merchant
    }
  });
});

// 刪除商家
exports.deleteMerchant = catchAsync(async (req, res, next) => {
  const merchant = await Merchant.findByIdAndDelete(req.params.id);
  
  if (!merchant) {
    return next(new AppError('找不到指定的商家', 404));
  }
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// 獲取特定商家的桌次統計
exports.getMerchantTableStats = catchAsync(async (req, res, next) => {
  const { id: merchantId } = req.params;
  
  // 檢查商家是否存在
  const merchant = await Merchant.findById(merchantId);
  if (!merchant) {
    return next(new AppError('找不到指定的商家', 404));
  }
  
  const mongoose = require('mongoose');
  const Table = require('../models/table');
  
  const stats = await Table.aggregate([
    { $match: { merchant: new mongoose.Types.ObjectId(merchantId) } },
    {
      $group: {
        _id: null,
        totalTables: { $sum: 1 },
        availableTables: {
          $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] }
        },
        occupiedTables: {
          $sum: { $cond: [{ $eq: ['$status', 'occupied'] }, 1, 0] }
        },
        reservedTables: {
          $sum: { $cond: [{ $eq: ['$status', 'reserved'] }, 1, 0] }
        },
        maintenanceTables: {
          $sum: { $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0] }
        },
        inactiveTables: {
          $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] }
        },
        totalCapacity: { $sum: '$capacity' },
        averageCapacity: { $avg: '$capacity' }
      }
    }
  ]);
  
  const result = stats[0] || {
    totalTables: 0,
    availableTables: 0,
    occupiedTables: 0,
    reservedTables: 0,
    maintenanceTables: 0,
    inactiveTables: 0,
    totalCapacity: 0,
    averageCapacity: 0
  };
  
  res.status(200).json({
    status: 'success',
    data: {
      stats: result
    }
  });
});

// 獲取特定商家的訂單統計
exports.getMerchantOrderStats = catchAsync(async (req, res, next) => {
  const { id: merchantId } = req.params;
  const { date, startDate, endDate } = req.query;
  
  // 檢查商家是否存在
  const merchant = await Merchant.findById(merchantId);
  if (!merchant) {
    return next(new AppError('找不到指定的商家', 404));
  }
  
  const Order = require('../models/order');
  const mongoose = require('mongoose');
  
  // 構建日期查詢條件
  let dateQuery = {};
  if (date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    dateQuery.createdAt = { $gte: startOfDay, $lte: endOfDay };
  } else if (startDate && endDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    dateQuery.createdAt = { $gte: start, $lte: end };
  }
  
  const stats = await Order.aggregate([
    { $match: { merchant: new mongoose.Types.ObjectId(merchantId), ...dateQuery } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        averageOrderValue: { $avg: '$totalAmount' }
      }
    }
  ]);
  
  const result = stats[0] || {
    totalOrders: 0,
    totalRevenue: 0,
    averageOrderValue: 0
  };
  
  res.status(200).json({
    status: 'success',
    data: {
      stats: result
    }
  });
});
