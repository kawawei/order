const jwt = require('jsonwebtoken');
const Admin = require('../models/admin');
const Merchant = require('../models/merchant');
const Role = require('../models/role');
const Employee = require('../models/employee');
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

// 新增商家（超級管理員）
exports.createMerchant = catchAsync(async (req, res, next) => {
  const {
    businessName,
    merchantCode,
    businessPhone,
    businessAddress,
    ownerName,
    ownerPhone,
    restaurantType,
    taxId
  } = req.body || {};

  if (!businessName || !merchantCode) {
    return next(new AppError('缺少必要欄位：businessName 或 merchantCode', 400));
  }

  const duplicated = await Merchant.findOne({ merchantCode });
  if (duplicated) {
    return next(new AppError('商家代碼已存在', 400));
  }

  // 建立商家（為滿足既有 schema 的 email/password 必填，使用內部預設）
  const internalEmail = `${merchantCode}@example.com`;
  const internalPassword = `${merchantCode}_Pass1234`;

  // 轉換與驗證
  const cleanedPhone = (businessPhone && String(businessPhone).replace(/\D/g, '').slice(0,10).padEnd(10, '0')) || '0000000000';
  const cleanedTaxId = taxId ? String(taxId).replace(/\D/g, '') : '';
  if (taxId && cleanedTaxId.length !== 8) {
    return next(new AppError('統一編號需為 8 位數字', 400));
  }

  const merchant = await Merchant.create({
    merchantCode,
    email: internalEmail,
    password: internalPassword,
    businessName,
    businessType: 'restaurant',
    restaurantType: (restaurantType || '').trim(),
    taxId: cleanedTaxId || undefined,
    phone: cleanedPhone,
    address: businessAddress || '未提供地址',
    status: 'active'
  });

  // 預設「管理人員」角色
  const managerRole = await Role.create({
    merchant: merchant._id,
    name: '管理人員',
    permissions: [
      '菜單:查看','菜單:編輯','庫存:查看','庫存:編輯','訂單:查看','訂單:更新狀態','訂單:結帳','桌位:查看','桌位:管理','報表:查看','商家設定:編輯','員工:查看','員工:編輯','角色:管理'
    ],
    isSystem: true
  });

  // 產生 6 碼英數交錯（字母-數字-字母-數字-字母-數字）的員工編號（不含商家前綴）
  const generateEmployeeCode = () => {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const digits = '23456789';
    let code = '';
    for (let i = 0; i < 3; i++) {
      code += letters[Math.floor(Math.random() * letters.length)];
      code += digits[Math.floor(Math.random() * digits.length)];
    }
    return code;
  };

  // 嘗試建立老闆帳號（避免隨機碼碰撞，最多嘗試 5 次）
  let owner;
  let employeeCode;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      employeeCode = generateEmployeeCode();
      owner = await Employee.create({
        merchant: merchant._id,
        name: ownerName || '老闆',
        account: employeeCode,
        email: undefined,
        password: `${merchantCode}_Owner1234`,
        role: managerRole._id,
        isOwner: true
      });
      break;
    } catch (err) {
      // 若為唯一索引衝突則重試
      if (err && err.code === 11000) continue;
      throw err;
    }
  }
  if (!owner) {
    return next(new AppError('生成員工編號失敗，請重試', 500));
  }

  res.status(201).json({
    status: 'success',
    data: {
      merchant: {
        id: merchant._id,
        businessName: merchant.businessName,
        merchantCode: merchant.merchantCode
      },
      owner: {
        id: owner._id,
        employeeCode,
        name: owner.name,
        phone: ownerPhone || ''
      }
    }
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
      { merchantCode: { $regex: search, $options: 'i' } },
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
    .limit(parseInt(limit))
    .lean();

  // 附加老闆員工代碼（以 isOwner 為主，向後相容舊規則 merchantCode-001）
  const merchantsWithOwner = await Promise.all(
    merchants.map(async (m) => {
      let ownerEmployeeCode = null;
      try {
        // 先以 isOwner 尋找
        const ownerByFlag = await Employee.findOne({
          merchant: m._id,
          isOwner: true
        }).select('account').lean();

        if (ownerByFlag) {
          ownerEmployeeCode = ownerByFlag.account;
        } else {
          // 向後相容：使用舊規則找尋
          const ownerLegacy = await Employee.findOne({
            merchant: m._id,
            account: `${m.merchantCode}-001`
          }).select('account').lean();
          ownerEmployeeCode = ownerLegacy?.account || null;
        }
      } catch (e) {
        ownerEmployeeCode = null;
      }
      return { ...m, ownerEmployeeCode };
    })
  );
  
  // 獲取總數
  const total = await Merchant.countDocuments(queryObj);
  
  res.status(200).json({
    status: 'success',
    results: merchants.length,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    data: {
      merchants: merchantsWithOwner
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
