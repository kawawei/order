const jwt = require('jsonwebtoken');
const XLSX = require('xlsx');
const fs = require('fs');
const Admin = require('../models/admin');
const Merchant = require('../models/merchant');
const Role = require('../models/role');
const Employee = require('../models/employee');
const Table = require('../models/table');
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

  // 預設「老闆」「管理人員」「工作人員」角色
  const ownerRole = await Role.create({
    merchant: merchant._id,
    name: '老闆',
    permissions: [
      '菜單:查看','菜單:編輯','庫存:查看','庫存:編輯','訂單:查看','訂單:更新狀態','訂單:結帳','桌位:查看','桌位:管理','報表:查看','商家設定:編輯','員工:查看','員工:編輯','角色:管理'
    ],
    isSystem: true
  });

  // 同步建立管理人員與工作人員
  await Role.insertMany([
    {
      merchant: merchant._id,
      name: '管理人員',
      permissions: [
        '菜單:查看','庫存:查看','訂單:查看','訂單:更新狀態','桌位:查看','桌位:管理','報表:查看','員工:查看','員工:編輯'
      ],
      isSystem: true
    },
    {
      merchant: merchant._id,
      name: '工作人員',
      permissions: [
        '訂單:查看','訂單:更新狀態','訂單:結帳','桌位:查看'
      ],
      isSystem: true
    }
  ]);

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
  const cleanedOwnerPhone = ownerPhone ? String(ownerPhone).replace(/\D/g, '') : undefined;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      employeeCode = generateEmployeeCode();
      owner = await Employee.create({
        merchant: merchant._id,
        name: ownerName || '老闆',
        employeeNumber: employeeCode,
        account: employeeCode,
        email: undefined,
        phone: cleanedOwnerPhone || undefined,
        password: `${merchantCode}_Owner1234`,
        role: ownerRole._id,
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
        phone: owner.phone || ''
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
      let ownerName = null;
      let ownerPhone = null;
      try {
        // 先以 isOwner 尋找
        const ownerByFlag = await Employee.findOne({
          merchant: m._id,
          isOwner: true
        }).select('account name phone').lean();

        if (ownerByFlag) {
          ownerEmployeeCode = ownerByFlag.account;
          ownerName = ownerByFlag.name || null;
          ownerPhone = ownerByFlag.phone || null;
        } else {
          // 向後相容：使用舊規則找尋
          const ownerLegacy = await Employee.findOne({
            merchant: m._id,
            account: `${m.merchantCode}-001`
          }).select('account name phone').lean();
          ownerEmployeeCode = ownerLegacy?.account || null;
          ownerName = ownerLegacy?.name || null;
          ownerPhone = ownerLegacy?.phone || null;
        }
      } catch (e) {
        ownerEmployeeCode = null;
      }
      return { ...m, ownerEmployeeCode, ownerName, ownerPhone };
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

// 更新商家（狀態與其他欄位）
exports.updateMerchant = catchAsync(async (req, res, next) => {
  const {
    businessName,
    merchantCode,
    restaurantType,
    taxId,
    businessPhone,
    businessAddress,
    status,
    ownerName,
    ownerPhone
  } = req.body || {};

  const update = {};
  if (businessName != null) update.businessName = String(businessName).trim();
  if (merchantCode != null) update.merchantCode = String(merchantCode).trim();
  if (restaurantType != null) update.restaurantType = String(restaurantType).trim();
  if (typeof taxId !== 'undefined' && taxId !== null && taxId !== '') {
    const cleanedTaxId = String(taxId).replace(/\D/g, '');
    if (cleanedTaxId && cleanedTaxId.length !== 8) {
      return next(new AppError('統一編號需為 8 位數字', 400));
    }
    update.taxId = cleanedTaxId || undefined;
  }
  if (typeof businessPhone !== 'undefined') {
    const cleanedPhone = String(businessPhone || '').replace(/\D/g, '').slice(0, 10);
    if (cleanedPhone && !/^\d{10}$/.test(cleanedPhone)) {
      return next(new AppError('請提供有效的電話號碼（10位數字）', 400));
    }
    update.phone = cleanedPhone || '0000000000';
  }
  if (typeof businessAddress !== 'undefined') {
    update.address = String(businessAddress || '').trim() || '未提供地址';
  }
  if (typeof status !== 'undefined') {
    if (!['pending', 'active', 'suspended'].includes(status)) {
      return next(new AppError('無效的狀態值', 400));
    }
    update.status = status;
  }

  // 若嘗試更新商家代碼，需檢查重複
  if (update.merchantCode) {
    const duplicated = await Merchant.findOne({ merchantCode: update.merchantCode, _id: { $ne: req.params.id } });
    if (duplicated) {
      return next(new AppError('商家代碼已存在', 400));
    }
  }

  const merchant = await Merchant.findByIdAndUpdate(
    req.params.id,
    update,
    { new: true, runValidators: true }
  ).select('-password');

  if (!merchant) {
    return next(new AppError('找不到指定的商家', 404));
  }

  // 更新老闆資料（若提供）
  if (ownerName != null || ownerPhone != null) {
    const owner = await Employee.findOne({ merchant: merchant._id, isOwner: true });
    if (owner) {
      if (ownerName != null) owner.name = String(ownerName).trim() || owner.name;
      if (ownerPhone != null) owner.phone = (ownerPhone || '').toString().trim() || owner.phone;
      await owner.save();
    }
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

// 匯入餐廳（Excel）
exports.importMerchants = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('請上傳 Excel 檔案', 400));
  }

  console.log('=== Excel 匯入開始 ===');
  console.log('檔案路徑:', req.file.path);
  console.log('檔案名稱:', req.file.originalname);

  try {
    // 讀取 Excel 檔案
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    console.log('工作表名稱:', sheetName);
    
    // 轉換為 JSON 格式
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log('=== 原始資料結構 ===');
    console.log('總行數:', data.length);
    console.log('標題列:', data[0]);
    console.log('前3行資料範例:');
    for (let i = 0; i < Math.min(3, data.length); i++) {
      console.log(`第${i+1}行:`, data[i]);
    }
    
    // 移除標題列
    const rows = data.slice(1);
    
    if (rows.length === 0) {
      return next(new AppError('Excel 檔案中沒有資料', 400));
    }

    console.log('=== 處理資料 ===');
    console.log('實際資料行數:', rows.length);
    console.log('預期欄位順序: [序號, 餐廳種類, 商家編號, 店名, 地址, 統編, 老闆名, 老闆電話, 桌次數量]');

    const results = {
      success: [],
      errors: [],
      updatedCount: 0,
      createdCount: 0
    };

    // 處理每一行資料
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // Excel 行號（從第2行開始）

      try {
        console.log(`\n--- 處理第 ${rowNumber} 行 ---`);
        console.log('原始資料:', row);
        
        // 檢查必要欄位
        if (!row[0] || !row[1] || !row[2] || !row[3]) {
          const errorMsg = `第 ${rowNumber} 行：缺少必要欄位（序號、餐廳種類、商家編號、店名）`;
          console.log('❌ 欄位檢查失敗:', errorMsg);
          results.errors.push(errorMsg);
          continue;
        }

        const [
          sequenceNumber,   // 序號
          restaurantType,   // 餐廳種類
          merchantCode,     // 商家編號
          businessName,     // 店名
          businessPhone,    // 店家電話
          address,          // 地址
          taxId,           // 統編
          ownerName,       // 老闆名
          ownerPhone,      // 老闆電話
          tableCount       // 桌次數量
        ] = row;

        console.log('解析後的資料:');
        console.log('  序號:', sequenceNumber);
        console.log('  餐廳種類:', restaurantType);
        console.log('  商家編號:', merchantCode);
        console.log('  店名:', businessName);
        console.log('  店家電話:', businessPhone);
        console.log('  地址:', address);
        console.log('  統編:', taxId);
        console.log('  老闆名:', ownerName);
        console.log('  老闆電話:', ownerPhone);
        console.log('  桌次數量:', tableCount);

        // 清理和驗證資料
        const cleanedTaxId = taxId ? String(taxId).replace(/\D/g, '') : '';
        if (taxId && cleanedTaxId.length !== 8) {
          const errorMsg = `第 ${rowNumber} 行：統一編號需為 8 位數字`;
          console.log('❌ 統編驗證失敗:', errorMsg);
          results.errors.push(errorMsg);
          continue;
        }

        // 處理店家電話，如果為空則保持為空
        let cleanedBusinessPhone = undefined;
        if (businessPhone && businessPhone !== '' && businessPhone !== null && businessPhone !== undefined) {
          const phoneStr = String(businessPhone).replace(/\D/g, '');
          if (phoneStr.length > 0) {
            cleanedBusinessPhone = phoneStr.slice(0, 10).padEnd(10, '0');
          }
        }
        // 處理老闆電話，如果為空則保持為空
        let cleanedOwnerPhone = undefined;
        if (ownerPhone && ownerPhone !== '' && ownerPhone !== null && ownerPhone !== undefined) {
          const phoneStr = String(ownerPhone).replace(/\D/g, '');
          if (phoneStr.length > 0) {
            cleanedOwnerPhone = phoneStr.slice(0, 10).padEnd(10, '0');
          }
        }

        console.log('清理後的資料:');
        console.log('  清理後統編:', cleanedTaxId);
        console.log('  清理後店家電話:', cleanedBusinessPhone);
        console.log('  清理後老闆電話:', cleanedOwnerPhone);

        // 檢查商家是否已存在
        const existingMerchant = await Merchant.findOne({ 
          merchantCode: String(merchantCode).trim() 
        });

        console.log('商家檢查結果:', existingMerchant ? '已存在' : '不存在');

        if (existingMerchant) {
          console.log('🔄 執行更新操作...');
          
          // 更新現有餐廳資料
          const updateData = {
            businessName: String(businessName).trim(),
            restaurantType: String(restaurantType || '').trim() || undefined,
            taxId: cleanedTaxId || undefined,
            phone: cleanedBusinessPhone,
            address: String(address || '').trim() || undefined
          };

          console.log('更新資料:', updateData);
          await Merchant.findByIdAndUpdate(existingMerchant._id, updateData);

          // 更新老闆員工資料
          const ownerEmployee = await Employee.findOne({ 
            merchant: existingMerchant._id, 
            isOwner: true 
          });
          
          if (ownerEmployee) {
            console.log('更新老闆員工資料:', {
              name: String(ownerName || '').trim() || undefined,
              phone: cleanedOwnerPhone
            });
            await Employee.findByIdAndUpdate(ownerEmployee._id, {
              name: String(ownerName || '').trim() || undefined,
              phone: cleanedOwnerPhone || undefined
            });
          } else {
            // 如果沒有老闆員工，創建一個
            console.log('創建老闆員工帳號...');
            const ownerRole = await Role.findOne({ 
              merchant: existingMerchant._id, 
              name: '老闆' 
            });
            
            if (ownerRole) {
              // 生成員工編號
              const generateEmployeeNumber = async (merchantId) => {
                const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
                const digits = '23456789';
                let code = '';
                let exists = true;
                while (exists) {
                  code = '';
                  for (let i = 0; i < 3; i++) {
                    code += letters[Math.floor(Math.random() * letters.length)];
                    code += digits[Math.floor(Math.random() * digits.length)];
                  }
                  const found = await Employee.findOne({ merchant: merchantId, employeeNumber: code }).lean();
                  exists = !!found;
                }
                return code;
              };
              
              const employeeNumber = await generateEmployeeNumber(existingMerchant._id);
              
              const ownerEmployeeData = {
                merchant: existingMerchant._id,
                employeeNumber: employeeNumber,
                account: employeeNumber,
                password: employeeNumber,
                name: String(ownerName || '').trim() || undefined,
                phone: cleanedOwnerPhone || undefined,
                email: `${existingMerchant.merchantCode}_owner@example.com`,
                role: ownerRole._id,
                isOwner: true
              };
              console.log('老闆員工資料:', ownerEmployeeData);
              await Employee.create(ownerEmployeeData);
              console.log('✅ 老闆員工帳號創建成功');
            }
          }

          const successMsg = `第 ${rowNumber} 行：成功更新餐廳 "${businessName}" (序號: ${sequenceNumber})`;
          console.log('✅ 更新成功:', successMsg);
          results.success.push(successMsg);
          results.updatedCount++;

        } else {
          console.log('🆕 執行新建操作...');
          
          // 建立新餐廳
          const internalEmail = `${merchantCode}@example.com`;
          const internalPassword = `${merchantCode}_Pass1234`;

          const merchantData = {
            merchantCode: String(merchantCode).trim(),
            email: internalEmail,
            password: internalPassword,
            businessName: String(businessName).trim(),
            businessType: 'restaurant',
            restaurantType: String(restaurantType || '').trim() || undefined,
            taxId: cleanedTaxId || undefined,
            phone: cleanedBusinessPhone,
            address: String(address || '').trim() || undefined,
            status: 'active'
          };

          console.log('新建商家資料:', merchantData);
          const merchant = await Merchant.create(merchantData);
          console.log('✅ 商家創建成功, ID:', merchant._id);

          // 建立預設角色
          console.log('創建老闆角色...');
          const ownerRole = await Role.create({
            merchant: merchant._id,
            name: '老闆',
            permissions: [
              '菜單:查看','菜單:編輯','庫存:查看','庫存:編輯','訂單:查看','訂單:更新狀態','訂單:結帳','桌位:查看','桌位:管理','報表:查看','商家設定:編輯','員工:查看','員工:編輯','角色:管理'
            ],
            isSystem: true
          });
          console.log('✅ 老闆角色創建成功, ID:', ownerRole._id);

          // 建立管理人員與工作人員角色
          console.log('創建管理人員與工作人員角色...');
          await Role.insertMany([
            {
              merchant: merchant._id,
              name: '管理人員',
              permissions: [
                '菜單:查看','庫存:查看','訂單:查看','訂單:更新狀態','桌位:查看','桌位:管理','報表:查看','員工:查看','員工:編輯'
              ],
              isSystem: true
            },
            {
              merchant: merchant._id,
              name: '工作人員',
              permissions: [
                '菜單:查看','訂單:查看','訂單:更新狀態','桌位:查看'
              ],
              isSystem: true
            }
          ]);
          console.log('✅ 角色創建完成');

          // 建立老闆員工帳號
          console.log('創建老闆員工帳號...');
          
          // 生成員工編號
          const generateEmployeeNumber = async (merchantId) => {
            const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
            const digits = '23456789';
            let code = '';
            let exists = true;
            while (exists) {
              code = '';
              for (let i = 0; i < 3; i++) {
                code += letters[Math.floor(Math.random() * letters.length)];
                code += digits[Math.floor(Math.random() * digits.length)];
              }
              const found = await Employee.findOne({ merchant: merchantId, employeeNumber: code }).lean();
              exists = !!found;
            }
            return code;
          };
          
          const employeeNumber = await generateEmployeeNumber(merchant._id);
          
          const ownerEmployeeData = {
            merchant: merchant._id,
            employeeNumber: employeeNumber,
            account: employeeNumber,
            password: employeeNumber,
            name: String(ownerName || '').trim() || undefined,
            phone: cleanedOwnerPhone || undefined,
            email: `${merchantCode}_owner@example.com`,
            role: ownerRole._id,
            isOwner: true
          };
          console.log('老闆員工資料:', ownerEmployeeData);
          const createdOwner = await Employee.create(ownerEmployeeData);
          console.log('✅ 老闆員工帳號創建成功, ID:', createdOwner._id);
          
          // 將老闆員工編號保存到商家資料中
          await Merchant.findByIdAndUpdate(merchant._id, {
            ownerEmployeeCode: createdOwner.employeeNumber
          });
          console.log('✅ 老闆員工編號已保存到商家資料');

          const successMsg = `第 ${rowNumber} 行：成功建立餐廳 "${businessName}" (序號: ${sequenceNumber})`;
          console.log('✅ 新建成功:', successMsg);
          results.success.push(successMsg);
          results.createdCount++;
        }

        // 處理桌次創建（無論是新建還是更新）
        const currentMerchant = existingMerchant || await Merchant.findOne({ merchantCode: String(merchantCode).trim() });
        
        if (tableCount && parseInt(tableCount) > 0) {
          const tableCountNum = parseInt(tableCount);
          console.log(`處理桌次創建，指定數量: ${tableCountNum}`);
          
          // 檢查是否已有桌次
          const existingTables = await Table.find({ merchant: currentMerchant._id });
          console.log(`現有桌次數量: ${existingTables.length}`);
          
          if (existingTables.length === 0) {
            // 如果沒有桌次，創建新的桌次
            console.log('創建新桌次...');
            const tables = [];
            
            for (let j = 1; j <= tableCountNum; j++) {
              tables.push({
                tableNumber: String(j),
                merchant: currentMerchant._id,
                capacity: 4, // 預設容量
                isActive: true,
                status: 'available'
              });
            }
            
            const createdTables = await Table.insertMany(tables);
            const tableMsg = `第 ${rowNumber} 行：為餐廳 "${businessName}" 創建了 ${tableCountNum} 個桌次`;
            console.log('✅ 桌次創建成功:', tableMsg);
            console.log('創建的桌次:', createdTables.map(t => t.tableNumber));
            results.success.push(tableMsg);
          } else {
            console.log('餐廳已有桌次，跳過桌次創建');
            const tableMsg = `第 ${rowNumber} 行：餐廳 "${businessName}" 已有 ${existingTables.length} 個桌次，跳過創建`;
            results.success.push(tableMsg);
          }
        } else {
          console.log('未指定桌次數量，跳過桌次創建');
          const tableMsg = `第 ${rowNumber} 行：餐廳 "${businessName}" 未指定桌次數量，跳過創建`;
          results.success.push(tableMsg);
        }

      } catch (error) {
        console.error(`❌ 處理第 ${rowNumber} 行時發生錯誤:`, error);
        const errorMsg = `第 ${rowNumber} 行：${error.message || '未知錯誤'}`;
        console.log('錯誤詳情:', errorMsg);
        results.errors.push(errorMsg);
      }
    }

    // 清理上傳的檔案
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (error) {
        console.error('清理上傳檔案時發生錯誤:', error);
      }
    }

    // 回傳結果
    console.log('\n=== 匯入完成總結 ===');
    console.log(`新增餐廳: ${results.createdCount} 間`);
    console.log(`更新餐廳: ${results.updatedCount} 間`);
    console.log(`失敗筆數: ${results.errors.length} 間`);
    console.log('成功訊息:', results.success);
    console.log('錯誤訊息:', results.errors);
    
    res.status(200).json({
      status: 'success',
      message: `匯入完成，新增 ${results.createdCount} 間，更新 ${results.updatedCount} 間，失敗 ${results.errors.length} 間`,
      data: {
        createdCount: results.createdCount,
        updatedCount: results.updatedCount,
        success: results.success,
        errors: results.errors
      }
    });

  } catch (error) {
    // 清理上傳的檔案
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error('清理上傳檔案時發生錯誤:', cleanupError);
      }
    }
    
    console.error('❌ 匯入 Excel 檔案時發生錯誤:', error);
    console.error('錯誤堆疊:', error.stack);
    return next(new AppError('處理 Excel 檔案時發生錯誤', 500));
  }
});
