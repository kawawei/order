const Table = require('../models/table');
const Merchant = require('../models/merchant');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const QRCode = require('qrcode');

// 獲取商家的所有桌次
exports.getAllTables = catchAsync(async (req, res, next) => {
  const merchantId = req.merchant.id;
  
  // 支援查詢參數
  const queryObj = { merchant: merchantId };
  
  // 狀態篩選
  if (req.query.status) {
    queryObj.status = req.query.status;
  }
  
  // 是否啟用篩選
  if (req.query.isActive !== undefined) {
    queryObj.isActive = req.query.isActive === 'true';
  }
  
  // 容量篩選
  if (req.query.minCapacity) {
    queryObj.capacity = { $gte: parseInt(req.query.minCapacity) };
  }
  if (req.query.maxCapacity) {
    queryObj.capacity = { 
      ...queryObj.capacity, 
      $lte: parseInt(req.query.maxCapacity) 
    };
  }
  
  // 排序
  let sortBy = {};
  if (req.query.sort) {
    const sortField = req.query.sort.replace('-', '');
    const sortOrder = req.query.sort.startsWith('-') ? -1 : 1;
    sortBy[sortField] = sortOrder;
  } else {
    sortBy = { tableNumber: 1 }; // 預設按桌號排序
  }
  
  const tables = await Table.find(queryObj)
    .sort(sortBy)
    .populate('merchant', 'businessName');
  
  res.status(200).json({
    status: 'success',
    results: tables.length,
    data: {
      tables
    }
  });
});

// 獲取單個桌次
exports.getTable = catchAsync(async (req, res, next) => {
  const table = await Table.findById(req.params.id)
    .populate('merchant', 'businessName businessType');
  
  if (!table) {
    return next(new AppError('找不到指定的桌次', 404));
  }
  
  // 檢查桌次是否屬於當前商家
  if (table.merchant._id.toString() !== req.merchant.id) {
    return next(new AppError('您沒有權限訪問此桌次', 403));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      table
    }
  });
});

// 透過唯一代碼獲取桌次（客戶端使用）
exports.getTableByCode = catchAsync(async (req, res, next) => {
  const { code } = req.params;
  
  const table = await Table.findOne({ uniqueCode: code })
    .populate('merchant', 'businessName businessType businessHours address phone');
  
  if (!table) {
    return next(new AppError('找不到指定的桌次', 404));
  }
  
  if (!table.isActive) {
    return next(new AppError('此桌次目前未開放使用', 400));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      table: {
        id: table._id,
        tableNumber: table.tableNumber,
        tableName: table.tableName,
        capacity: table.capacity,
        status: table.status,
        merchant: table.merchant,
        amenities: table.amenities,
        isAvailable: table.isAvailable()
      }
    }
  });
});

// 創建新桌次
exports.createTable = catchAsync(async (req, res, next) => {
  const merchantId = req.merchant.id;
  
  // 檢查桌號是否已存在
  const existingTable = await Table.findOne({
    merchant: merchantId,
    tableNumber: req.body.tableNumber
  });
  
  if (existingTable) {
    return next(new AppError('此桌號已存在', 400));
  }
  
  // 創建桌次數據
  const tableData = {
    ...req.body,
    merchant: merchantId
  };
  
  const table = await Table.create(tableData);
  
  // 生成二維碼
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(table.customerUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    table.qrCodeDataUrl = qrCodeDataUrl;
    await table.save();
  } catch (error) {
    console.error('生成二維碼失敗:', error);
  }
  
  res.status(201).json({
    status: 'success',
    data: {
      table
    }
  });
});

// 更新桌次
exports.updateTable = catchAsync(async (req, res, next) => {
  const table = await Table.findById(req.params.id);
  
  if (!table) {
    return next(new AppError('找不到指定的桌次', 404));
  }
  
  // 檢查桌次是否屬於當前商家
  if (table.merchant.toString() !== req.merchant.id) {
    return next(new AppError('您沒有權限修改此桌次', 403));
  }
  
  // 如果修改了桌號，檢查是否與其他桌次衝突
  if (req.body.tableNumber && req.body.tableNumber !== table.tableNumber) {
    const existingTable = await Table.findOne({
      merchant: req.merchant.id,
      tableNumber: req.body.tableNumber,
      _id: { $ne: table._id }
    });
    
    if (existingTable) {
      return next(new AppError('此桌號已存在', 400));
    }
  }
  
  // 不允許直接修改某些敏感欄位
  const restrictedFields = ['uniqueCode', 'merchant', 'stats'];
  restrictedFields.forEach(field => delete req.body[field]);
  
  const updatedTable = await Table.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  );
  
  res.status(200).json({
    status: 'success',
    data: {
      table: updatedTable
    }
  });
});

// 刪除桌次
exports.deleteTable = catchAsync(async (req, res, next) => {
  const table = await Table.findById(req.params.id);
  
  if (!table) {
    return next(new AppError('找不到指定的桌次', 404));
  }
  
  // 檢查桌次是否屬於當前商家
  if (table.merchant.toString() !== req.merchant.id) {
    return next(new AppError('您沒有權限刪除此桌次', 403));
  }
  
  // 檢查桌次是否正在使用中
  if (table.status === 'occupied') {
    return next(new AppError('無法刪除正在使用中的桌次', 400));
  }
  
  await Table.findByIdAndDelete(req.params.id);
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// 更新桌次狀態
exports.updateTableStatus = catchAsync(async (req, res, next) => {
  const { status, sessionData } = req.body;
  
  const table = await Table.findById(req.params.id);
  
  if (!table) {
    return next(new AppError('找不到指定的桌次', 404));
  }
  
  // 檢查桌次是否屬於當前商家
  if (table.merchant.toString() !== req.merchant.id) {
    return next(new AppError('您沒有權限修改此桌次狀態', 403));
  }
  
  // 驗證狀態轉換是否合理
  const validTransitions = {
    'available': ['occupied', 'reserved', 'maintenance', 'inactive'],
    'occupied': ['available', 'maintenance'],
    'reserved': ['available', 'occupied', 'maintenance'],
    'maintenance': ['available', 'inactive'],
    'inactive': ['available', 'maintenance']
  };
  
  if (!validTransitions[table.status]?.includes(status)) {
    return next(new AppError(`無法從 ${table.status} 狀態轉換到 ${status} 狀態`, 400));
  }
  
  await table.updateStatus(status, sessionData);
  
  res.status(200).json({
    status: 'success',
    data: {
      table
    }
  });
});

// 批量更新桌次狀態
exports.batchUpdateStatus = catchAsync(async (req, res, next) => {
  const { tableIds, status, sessionData } = req.body;
  
  if (!Array.isArray(tableIds) || tableIds.length === 0) {
    return next(new AppError('請提供有效的桌次 ID 列表', 400));
  }
  
  const tables = await Table.find({
    _id: { $in: tableIds },
    merchant: req.merchant.id
  });
  
  if (tables.length !== tableIds.length) {
    return next(new AppError('部分桌次不存在或您沒有權限操作', 400));
  }
  
  const updatePromises = tables.map(table => table.updateStatus(status, sessionData));
  const updatedTables = await Promise.all(updatePromises);
  
  res.status(200).json({
    status: 'success',
    data: {
      tables: updatedTables,
      updated: updatedTables.length
    }
  });
});

// 重新生成桌次二維碼
exports.regenerateQRCode = catchAsync(async (req, res, next) => {
  const table = await Table.findById(req.params.id);
  
  if (!table) {
    return next(new AppError('找不到指定的桌次', 404));
  }
  
  // 檢查桌次是否屬於當前商家
  if (table.merchant.toString() !== req.merchant.id) {
    return next(new AppError('您沒有權限操作此桌次', 403));
  }
  
  try {
    // 重新生成唯一代碼和 URL
    table.uniqueCode = table.generateUniqueCode();
    table.customerUrl = table.generateCustomerUrl();
    
    // 生成新的二維碼
    const qrCodeDataUrl = await QRCode.toDataURL(table.customerUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    table.qrCodeDataUrl = qrCodeDataUrl;
    await table.save();
    
    res.status(200).json({
      status: 'success',
      message: '二維碼重新生成成功',
      data: {
        table
      }
    });
  } catch (error) {
    return next(new AppError('生成二維碼失敗', 500));
  }
});

// 獲取桌次統計
exports.getTableStats = catchAsync(async (req, res, next) => {
  const merchantId = req.merchant.id;
  
  const mongoose = require('mongoose');
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
