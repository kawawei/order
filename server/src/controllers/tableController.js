const mongoose = require('mongoose');
const Table = require('../models/table');
const Merchant = require('../models/merchant');
const Order = require('../models/order');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const QRCode = require('qrcode');

// 輔助函數：獲取商家ID（支持超級管理員訪問特定商家）
const getMerchantId = (req) => {
  // 如果是超級管理員且指定了商家ID，使用指定的商家ID
  if (req.admin && (req.query.merchantId || req.params.merchantId)) {
    return req.query.merchantId || req.params.merchantId;
  }
  // 如果是超級管理員但沒有指定商家ID，返回錯誤信息
  if (req.admin && !req.query.merchantId && !req.params.merchantId) {
    throw new AppError('超級管理員訪問商家後台需要指定merchantId參數', 400);
  }
  // 否則使用當前登入的商家ID（支援員工從 token 進來）
  if (req.merchant) {
    return req.merchant.id;
  }
  if (req.employee) {
    // req.employee.merchant 可能是 ObjectId 或字串
    return req.employee.merchant?.toString();
  }
  throw new AppError('無法獲取商家信息', 401);
};

// 獲取商家的所有桌次
exports.getAllTables = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  
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
  
  // 為每個桌次生成 customerUrl
  const tablesWithUrls = tables.map(table => {
    const tableObj = table.toObject();
    tableObj.customerUrl = table.generateCustomerUrl();
    return tableObj;
  });
  
  res.status(200).json({
    status: 'success',
    results: tablesWithUrls.length,
    data: {
      tables: tablesWithUrls
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
  
  // 檢查桌次是否屬於當前商家（超級管理員可以訪問所有桌次）
  if (req.merchant && table.merchant._id.toString() !== req.merchant.id) {
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

// 客戶端開始點餐（更新桌次狀態為已入座）
exports.startOrdering = catchAsync(async (req, res, next) => {
  const table = await Table.findById(req.params.id);
  
  if (!table) {
    return next(new AppError('找不到指定的桌次', 404));
  }
  
  if (!table.isActive) {
    return next(new AppError('此桌次目前未開放使用', 400));
  }
  
  // 添加調試信息
  console.log(`開始點餐 - 桌次 ${table.tableNumber} 狀態: ${table.status}, 是否啟用: ${table.isActive}`);
  
  // 檢查桌次狀態，只有 available 或 reserved 狀態才能開始點餐
  if (!['available', 'reserved'].includes(table.status)) {
    console.log(`桌次狀態檢查失敗 - 當前狀態: ${table.status}, 允許的狀態: available, reserved`);
    return next(new AppError('此桌次目前無法開始點餐', 400));
  }
  
  // 更新桌次狀態為已入座
  await table.updateStatus('occupied', {
    sessionId: new Date().getTime().toString(), // 使用時間戳作為會話ID
    startTime: new Date(),
    customerCount: 1,
    customerName: null
  });
  
  res.status(200).json({
    status: 'success',
    message: '開始點餐成功，桌次狀態已更新',
    data: {
      table: {
        id: table._id,
        tableNumber: table.tableNumber,
        status: table.status,
        currentSession: table.currentSession
      }
    }
  });
});

// 創建新桌次
exports.createTable = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  
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
    // 確保 uniqueCode 和 customerUrl 已經生成
    if (!table.uniqueCode) {
      table.uniqueCode = table.generateUniqueCode();
    }
    if (!table.customerUrl) {
      table.customerUrl = table.generateCustomerUrl();
    }
    
    console.log(`桌次 ${table.tableNumber} 的 customerUrl: ${table.customerUrl}`);
    
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
    
    console.log(`桌次 ${table.tableNumber} QR Code 生成成功`);
  } catch (error) {
    console.error('生成二維碼失敗:', error);
    console.error('錯誤詳情:', error.message);
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
  
  // 檢查桌次是否屬於當前商家（超級管理員可以修改所有桌次）
  if (req.merchant && table.merchant.toString() !== req.merchant.id) {
    return next(new AppError('您沒有權限修改此桌次', 403));
  }
  
  // 如果修改了桌號，檢查是否與其他桌次衝突
  if (req.body.tableNumber && req.body.tableNumber !== table.tableNumber) {
    const existingTable = await Table.findOne({
      merchant: getMerchantId(req),
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
  
  // 檢查桌次是否屬於當前商家（超級管理員可以刪除所有桌次）
  if (req.merchant && table.merchant.toString() !== req.merchant.id) {
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
  
  // 檢查桌次是否屬於當前商家（超級管理員可以修改所有桌次狀態）
  if (req.merchant && table.merchant.toString() !== req.merchant.id) {
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
  
  // 如果桌次狀態變更為可用（清理桌次），清空該桌次的所有相關數據
  if (status === 'available' && table.status === 'occupied') {
    try {
      // 清空該桌次的所有訂單（無論狀態如何）
      const deleteResult = await Order.deleteMany({ tableId: table._id });
      
      console.log(`桌次 ${table.tableNumber} 清理完成，已刪除 ${deleteResult.deletedCount} 筆訂單記錄`);
    } catch (error) {
      console.error('清理桌次訂單時發生錯誤:', error);
      // 即使清理訂單失敗，仍然繼續更新桌次狀態
    }
  }
  
  await table.updateStatus(status, sessionData);
  
  res.status(200).json({
    status: 'success',
    message: status === 'available' && table.status === 'occupied' 
      ? '桌次已清理，所有訂單記錄已完全刪除' 
      : '桌次狀態更新成功',
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
    merchant: getMerchantId(req)
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
  
  // 檢查桌次是否屬於當前商家（超級管理員可以操作所有桌次）
  if (req.merchant && table.merchant.toString() !== req.merchant.id) {
    return next(new AppError('您沒有權限操作此桌次', 403));
  }
  
  try {
    // 重新生成唯一代碼和 URL
    table.uniqueCode = table.generateUniqueCode();
    table.customerUrl = table.generateCustomerUrl();
    
    console.log(`重新生成桌次 ${table.tableNumber} 的 QR Code，URL: ${table.customerUrl}`);
    
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
    
    console.log(`桌次 ${table.tableNumber} QR Code 重新生成成功`);
    
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
  const merchantId = getMerchantId(req);
  
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

// 批量生成 QR Code（為現有桌次生成 QR Code）
exports.batchGenerateQRCode = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  
  // 查找該商家的所有桌次
  const tables = await Table.find({ merchant: merchantId });
  
  let successCount = 0;
  let errorCount = 0;
  const results = [];
  
  for (const table of tables) {
    try {
      // 確保 uniqueCode 和 customerUrl 已經生成
      if (!table.uniqueCode) {
        table.uniqueCode = table.generateUniqueCode();
      }
      if (!table.customerUrl) {
        table.customerUrl = table.generateCustomerUrl();
      }
      
      // 生成 QR Code
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
      
      successCount++;
      results.push({
        tableNumber: table.tableNumber,
        status: 'success',
        message: 'QR Code 生成成功'
      });
      
      console.log(`桌次 ${table.tableNumber} QR Code 生成成功`);
    } catch (error) {
      errorCount++;
      results.push({
        tableNumber: table.tableNumber,
        status: 'error',
        message: error.message
      });
      
      console.error(`桌次 ${table.tableNumber} QR Code 生成失敗:`, error.message);
    }
  }
  
  res.status(200).json({
    status: 'success',
    message: `批量生成完成，成功: ${successCount}，失敗: ${errorCount}`,
    data: {
      total: tables.length,
      success: successCount,
      error: errorCount,
      results
    }
  });
});
