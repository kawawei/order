const mongoose = require('mongoose');
const Inventory = require('../models/inventory');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// 輔助函數：將中文狀態轉換為英文枚舉值
const convertStatusToEnum = (status) => {
  if (!status) return 'active';
  
  const statusMap = {
    '正常': 'active',
    '啟用': 'active',
    '活躍': 'active',
    '停用': 'inactive',
    '禁用': 'inactive',
    '非活躍': 'inactive',
    '停產': 'discontinued',
    '下架': 'discontinued',
    '停售': 'discontinued'
  };
  
  return statusMap[status] || 'active';
};

// 輔助函數：獲取商家ID（支持超級管理員與員工訪問特定商家）
const getMerchantId = (req) => {
  // 如果是超級管理員且指定了商家ID，使用指定的商家ID
  if (req.admin && req.query.merchantId) {
    return req.query.merchantId;
  }
  // 如果是超級管理員但沒有指定商家ID，返回錯誤信息
  if (req.admin && !req.query.merchantId) {
    throw new AppError('超級管理員訪問商家後台需要指定merchantId參數', 400);
  }
  // 員工：從所屬商家取得 ID
  if (req.employee) {
    return req.employee.merchant?.toString();
  }
  // 商家：使用當前登入商家 ID
  if (req.merchant) {
    return req.merchant.id;
  }
  throw new AppError('無法獲取商家信息', 401);
};

// 獲取商家的所有庫存項目
exports.getAllInventory = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  
  const queryObj = { merchant: merchantId };
  
  // 分類篩選
  if (req.query.category) {
    queryObj.category = req.query.category;
  }
  
  // 類型篩選
  if (req.query.type) {
    queryObj.type = req.query.type;
  }
  
  // 狀態篩選
  if (req.query.status) {
    queryObj.status = req.query.status;
  }
  
  // 是否啟用篩選
  if (req.query.isActive !== undefined) {
    queryObj.isActive = req.query.isActive === 'true';
  }
  
  // 庫存狀態篩選
  if (req.query.stockStatus) {
    if (req.query.stockStatus === 'outOfStock') {
      queryObj.$or = [
        { 'singleStock.quantity': 0 },
        { 'multiSpecStock.quantity': 0 }
      ];
    } else if (req.query.stockStatus === 'lowStock') {
      queryObj.$or = [
        { $expr: { $lte: ['$singleStock.quantity', '$singleStock.minStock'] } },
        { $expr: { $lte: ['$multiSpecStock.quantity', '$multiSpecStock.minStock'] } }
      ];
    }
  }
  
  // 搜索關鍵字
  if (req.query.search) {
    queryObj.$text = { $search: req.query.search };
  }
  
  // 排序
  let sortBy = {};
  if (req.query.sort) {
    const sortField = req.query.sort.replace('-', '');
    const sortOrder = req.query.sort.startsWith('-') ? -1 : 1;
    sortBy[sortField] = sortOrder;
  } else {
    sortBy = { category: 1, name: 1 };
  }
  
  // 分頁
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  
  // 執行查詢
  const inventory = await Inventory.find(queryObj)
    .sort(sortBy)
    .skip(skip)
    .limit(limit)
    .populate('merchant', 'businessName');
  
  // 獲取總數
  const total = await Inventory.countDocuments(queryObj);
  
  res.status(200).json({
    status: 'success',
    results: inventory.length,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    data: {
      inventory
    }
  });
});

// 獲取單個庫存項目
exports.getInventory = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  
  const inventory = await Inventory.findOne({
    _id: req.params.id,
    merchant: merchantId
  }).populate('merchant', 'businessName');
  
  if (!inventory) {
    return next(new AppError('找不到該庫存項目', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      inventory
    }
  });
});

// 創建新的庫存項目
exports.createInventory = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  
  // 添加商家ID到請求體
  req.body.merchant = merchantId;
  
  // 驗證必填字段
  if (!req.body.name || !req.body.category) {
    return next(new AppError('原料名稱和分類為必填項', 400));
  }
  
  // 驗證庫存類型
  if (req.body.type === 'single') {
    if (!req.body.singleStock || !req.body.singleStock.unit) {
      return next(new AppError('單一原料必須提供計量單位', 400));
    }
  } else if (req.body.type === 'multiSpec') {
    if (!req.body.multiSpecStock || req.body.multiSpecStock.length === 0) {
      return next(new AppError('多規格原料必須提供至少一個規格', 400));
    }
    
    // 檢查每個規格的必填字段
    for (let i = 0; i < req.body.multiSpecStock.length; i++) {
      const spec = req.body.multiSpecStock[i];
      if (!spec.specName) {
        return next(new AppError(`第${i + 1}個規格必須提供規格名稱`, 400));
      }
      if (!spec.unit) {
        return next(new AppError(`第${i + 1}個規格必須提供計量單位`, 400));
      }
      if (spec.unitPrice === undefined || spec.unitPrice < 0) {
        return next(new AppError(`第${i + 1}個規格必須提供有效的單價`, 400));
      }
    }
    
    // 檢查規格名稱是否重複
    const specNames = req.body.multiSpecStock.map(spec => spec.specName);
    const uniqueSpecNames = [...new Set(specNames)];
    if (specNames.length !== uniqueSpecNames.length) {
      return next(new AppError('多規格原料的規格名稱不能重複', 400));
    }
  }
  
  const inventory = await Inventory.create(req.body);
  
  res.status(201).json({
    status: 'success',
    data: {
      inventory
    }
  });
});

// 更新庫存項目
exports.updateInventory = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  
  // 檢查庫存項目是否存在且屬於該商家
  const inventory = await Inventory.findOne({
    _id: req.params.id,
    merchant: merchantId
  });
  
  if (!inventory) {
    return next(new AppError('找不到該庫存項目', 404));
  }
  
  // 驗證更新數據
  if (req.body.type === 'single') {
    if (req.body.singleStock && !req.body.singleStock.unit) {
      return next(new AppError('單一原料必須提供計量單位', 400));
    }
  } else if (req.body.type === 'multiSpec') {
    if (req.body.multiSpecStock) {
      if (req.body.multiSpecStock.length === 0) {
        return next(new AppError('多規格原料必須提供至少一個規格', 400));
      }
      
      // 檢查每個規格的必填字段
      for (let i = 0; i < req.body.multiSpecStock.length; i++) {
        const spec = req.body.multiSpecStock[i];
        if (!spec.specName) {
          return next(new AppError(`第${i + 1}個規格必須提供規格名稱`, 400));
        }
        if (!spec.unit) {
          return next(new AppError(`第${i + 1}個規格必須提供計量單位`, 400));
        }
        if (spec.unitPrice === undefined || spec.unitPrice < 0) {
          return next(new AppError(`第${i + 1}個規格必須提供有效的單價`, 400));
        }
      }
      
      // 檢查規格名稱是否重複
      const specNames = req.body.multiSpecStock.map(spec => spec.specName);
      const uniqueSpecNames = [...new Set(specNames)];
      if (specNames.length !== uniqueSpecNames.length) {
        return next(new AppError('多規格原料的規格名稱不能重複', 400));
      }
    }
  }
  
  // 更新庫存項目
  const updatedInventory = await Inventory.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  ).populate('merchant', 'businessName');
  
  res.status(200).json({
    status: 'success',
    data: {
      inventory: updatedInventory
    }
  });
});

// 刪除庫存項目
exports.deleteInventory = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  
  const inventory = await Inventory.findOneAndDelete({
    _id: req.params.id,
    merchant: merchantId
  });
  
  if (!inventory) {
    return next(new AppError('找不到該庫存項目', 404));
  }
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// 批量更新庫存
exports.batchUpdateInventory = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  const { updates } = req.body;
  
  if (!updates || !Array.isArray(updates)) {
    return next(new AppError('請提供有效的更新數據', 400));
  }
  
  const results = [];
  
  for (const update of updates) {
    try {
      const { id, specName, quantity, operation } = update;
      
      const inventory = await Inventory.findOne({
        _id: id,
        merchant: merchantId
      });
      
      if (!inventory) {
        results.push({
          id,
          success: false,
          error: '找不到該庫存項目'
        });
        continue;
      }
      
      // 使用實例方法更新庫存
      await inventory.updateStock(specName, quantity, operation);
      
      results.push({
        id,
        success: true,
        newQuantity: inventory.type === 'single' 
          ? inventory.singleStock.quantity 
          : inventory.multiSpecStock.find(s => s.specName === specName)?.quantity
      });
    } catch (error) {
      results.push({
        id: update.id,
        success: false,
        error: error.message
      });
    }
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      results
    }
  });
});

// 獲取庫存統計信息
exports.getInventoryStats = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  
  const stats = await Inventory.aggregate([
    { $match: { merchant: new mongoose.Types.ObjectId(merchantId) } },
    {
      $group: {
        _id: null,
        totalItems: { $sum: 1 },
        activeItems: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        singleTypeItems: {
          $sum: { $cond: [{ $eq: ['$type', 'single'] }, 1, 0] }
        },
        multiSpecItems: {
          $sum: { $cond: [{ $eq: ['$type', 'multiSpec'] }, 1, 0] }
        },
        outOfStockItems: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$singleStock.quantity', 0] },
                  { $eq: ['$multiSpecStock.quantity', 0] }
                ]
              },
              1,
              0
            ]
          }
        },
        lowStockItems: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $lte: ['$singleStock.quantity', '$singleStock.minStock'] },
                  { $lte: ['$multiSpecStock.quantity', '$multiSpecStock.minStock'] }
                ]
              },
              1,
              0
            ]
          }
        }
      }
    }
  ]);
  
  // 按分類統計
  const categoryStats = await Inventory.aggregate([
    { $match: { merchant: new mongoose.Types.ObjectId(merchantId) } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        totalValue: {
          $sum: {
            $multiply: [
              { $ifNull: ['$cost.unitPrice', 0] },
              {
                $cond: [
                  { $eq: ['$type', 'single'] },
                  '$singleStock.quantity',
                  {
                    $reduce: {
                      input: '$multiSpecStock',
                      initialValue: 0,
                      in: { $add: ['$$value', '$$this.quantity'] }
                    }
                  }
                ]
              }
            ]
          }
        }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  res.status(200).json({
    status: 'success',
    data: {
      overview: stats[0] || {
        totalItems: 0,
        activeItems: 0,
        singleTypeItems: 0,
        multiSpecItems: 0,
        outOfStockItems: 0,
        lowStockItems: 0
      },
      categoryStats
    }
  });
});

// 獲取庫存分類列表
exports.getInventoryCategories = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  
  // 嘗試從新的分類模型獲取分類
  try {
    const InventoryCategory = require('../models/inventoryCategory');
    const categories = await InventoryCategory.find({ merchant: merchantId })
      .sort({ sortOrder: 1, name: 1 })
      .select('name description color icon isSystem');
    
    if (categories.length > 0) {
      return res.status(200).json({
        status: 'success',
        data: {
          categories: categories.map(cat => cat.name)
        }
      });
    }
  } catch (error) {
    // 如果新模型不存在，回退到舊方法
    console.log('使用舊方法獲取分類');
  }
  
  // 回退到舊方法：從庫存項目中提取分類
  const categories = await Inventory.distinct('category', { merchant: merchantId });
  
  res.status(200).json({
    status: 'success',
    data: {
      categories
    }
  });
});

// 搜索庫存項目
exports.searchInventory = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  const { q } = req.query;
  
  if (!q) {
    return next(new AppError('請提供搜索關鍵字', 400));
  }
  
  const inventory = await Inventory.find({
    merchant: merchantId,
    $text: { $search: q }
  })
  .populate('merchant', 'businessName')
  .limit(20);
  
  res.status(200).json({
    status: 'success',
    results: inventory.length,
    data: {
      inventory
    }
  });
});

// 匯入庫存項目
exports.importInventory = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  
  if (!req.file) {
    return next(new AppError('請上傳檔案', 400));
  }

  // 匯入選項：預設刪除不在Excel中的項目
  const removeMissing = true; // 始終刪除不在Excel中的項目

  try {
    console.log(`開始處理匯入檔案：${req.file.originalname}`);
    
    // 讀取檔案
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    console.log(`檔案包含工作表：${workbook.SheetNames.join(', ')}`);
    console.log(`使用工作表：${sheetName}`);
    
    // 轉換為 JSON
    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    console.log(`解析到 ${rawData.length} 行數據（包含標題行）`);
    
    // 檢查標題行
    const headers = rawData[0];
    console.log(`標題行：${headers.join(', ')}`);
    
    const requiredHeaders = ['原料名稱', '庫存分類', '原料類型'];
    const optionalHeaders = ['規格名稱', '單位', '庫存', '單價', '最低庫存', '最高庫存', '狀態', '描述'];
    
    // 檢查必要欄位
    const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
    if (missingHeaders.length > 0) {
      console.error(`缺少必要欄位：${missingHeaders.join(', ')}`);
      return next(new AppError(`缺少必要欄位：${missingHeaders.join(', ')}`, 400));
    }
    
    console.log('所有必要欄位檢查通過');
    
    // 解析數據
    const inventoryData = [];
    const errors = [];
    let processedRows = 0;
    let skippedRows = 0;
    
    console.log('開始解析數據行...');
    
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      
      // 檢查是否為空行
      if (row.length === 0 || row.every(cell => !cell)) {
        skippedRows++;
        continue;
      }
      
      processedRows++;
      console.log(`處理第 ${i + 1} 行：${row.slice(0, 3).join(', ')}...`);
      
      try {
        const rowData = {};
        headers.forEach((header, index) => {
          rowData[header] = row[index] || '';
        });
        
        // 驗證必要欄位
        const missingFields = [];
        if (!rowData['原料名稱']) missingFields.push('原料名稱');
        if (!rowData['庫存分類']) missingFields.push('庫存分類');
        if (!rowData['原料類型']) missingFields.push('原料類型');
        
        if (missingFields.length > 0) {
          const errorMsg = `第${i + 1}行：缺少必要欄位 [${missingFields.join(', ')}]`;
          console.error(errorMsg);
          errors.push(errorMsg);
          continue;
        }
        
        // 驗證原料類型
        if (!['單一規格', '多規格'].includes(rowData['原料類型'])) {
          const errorMsg = `第${i + 1}行：原料類型「${rowData['原料類型']}」無效，必須是「單一規格」或「多規格」`;
          console.error(errorMsg);
          errors.push(errorMsg);
          continue;
        }
        
        // 多規格必須有規格名稱
        if (rowData['原料類型'] === '多規格' && !rowData['規格名稱']) {
          const errorMsg = `第${i + 1}行：多規格原料「${rowData['原料名稱']}」必須提供規格名稱`;
          console.error(errorMsg);
          errors.push(errorMsg);
          continue;
        }
        
        // 單一規格不能有規格名稱
        if (rowData['原料類型'] === '單一規格' && rowData['規格名稱']) {
          const errorMsg = `第${i + 1}行：單一規格原料「${rowData['原料名稱']}」不應有規格名稱「${rowData['規格名稱']}」`;
          console.error(errorMsg);
          errors.push(errorMsg);
          continue;
        }
        
        // 驗證數字欄位
        const quantity = parseFloat(rowData['庫存']);
        const unitPrice = parseFloat(rowData['單價']);
        const minStock = parseFloat(rowData['最低庫存']);
        const maxStock = parseFloat(rowData['最高庫存']);
        
        // 檢查數字格式
        const numericErrors = [];
        if (rowData['庫存'] && isNaN(quantity)) numericErrors.push('庫存格式錯誤');
        if (rowData['單價'] && isNaN(unitPrice)) numericErrors.push('單價格式錯誤');
        if (rowData['最低庫存'] && isNaN(minStock)) numericErrors.push('最低庫存格式錯誤');
        if (rowData['最高庫存'] && isNaN(maxStock)) numericErrors.push('最高庫存格式錯誤');
        
        if (numericErrors.length > 0) {
          const errorMsg = `第${i + 1}行：${numericErrors.join(', ')}`;
          console.error(errorMsg);
          errors.push(errorMsg);
          continue;
        }
        
        // 使用預設值
        const finalQuantity = quantity || 0;
        const finalUnitPrice = unitPrice || 0;
        const finalMinStock = minStock || 0;
        const finalMaxStock = maxStock || 1000;
        
        // 檢查數值範圍
        if (finalQuantity < 0 || finalUnitPrice < 0 || finalMinStock < 0 || finalMaxStock < 0) {
          const errorMsg = `第${i + 1}行：數量(${finalQuantity})、單價(${finalUnitPrice})、最低庫存(${finalMinStock})、最高庫存(${finalMaxStock})不能為負數`;
          console.error(errorMsg);
          errors.push(errorMsg);
          continue;
        }
        
        if (finalMinStock > finalMaxStock) {
          const errorMsg = `第${i + 1}行：最低庫存(${finalMinStock})不能大於最高庫存(${finalMaxStock})`;
          console.error(errorMsg);
          errors.push(errorMsg);
          continue;
        }
        
        const inventoryItem = {
          rowIndex: i + 1,
          name: rowData['原料名稱'].toString().trim(),
          category: rowData['庫存分類'].toString().trim(),
          type: rowData['原料類型'] === '單一規格' ? 'single' : 'multiSpec',
          specName: rowData['規格名稱']?.toString().trim() || null,
          unit: rowData['單位']?.toString().trim() || '',
          quantity: finalQuantity,
          unitPrice: finalUnitPrice,
          minStock: finalMinStock,
          maxStock: finalMaxStock,
          status: convertStatusToEnum(rowData['狀態']?.toString().trim()) || 'active',
          description: rowData['描述']?.toString().trim() || ''
        };
        
        inventoryData.push(inventoryItem);
        console.log(`✓ 第${i + 1}行解析成功：${inventoryItem.name} (${inventoryItem.category})`);
        
      } catch (error) {
        const errorMsg = `第${i + 1}行：數據格式錯誤 - ${error.message}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }
    
    console.log(`數據解析完成：處理 ${processedRows} 行，跳過 ${skippedRows} 空行，成功解析 ${inventoryData.length} 個項目`);
    
    if (errors.length > 0) {
      console.error(`發現 ${errors.length} 個錯誤：`);
      errors.forEach(error => console.error(`  - ${error}`));
      return next(new AppError(`匯入失敗：\n${errors.join('\n')}`, 400));
    }
    
    if (errors.length > 0) {
      return next(new AppError(`匯入失敗：\n${errors.join('\n')}`, 400));
    }
    
    // 檢查並自動創建不存在的分類
    console.log('開始檢查分類...');
    const InventoryCategory = require('../models/inventoryCategory');
    const existingCategories = await InventoryCategory.find({ merchant: merchantId });
    const existingCategoryNames = existingCategories.map(cat => cat.name);
    
    console.log(`現有分類：${existingCategoryNames.join(', ')}`);
    
    // 收集所有需要的分類名稱
    const requiredCategories = [...new Set(inventoryData.map(item => item.category))];
    const newCategories = requiredCategories.filter(catName => !existingCategoryNames.includes(catName));
    
    console.log(`需要的分類：${requiredCategories.join(', ')}`);
    console.log(`需要創建的新分類：${newCategories.join(', ')}`);
    
    // 自動創建新分類
    const createdCategories = [];
    for (const categoryName of newCategories) {
      try {
        console.log(`正在創建分類：${categoryName}`);
        
        // 獲取最大排序順序
        const maxSortOrder = await InventoryCategory.findOne({ merchant: merchantId })
          .sort({ sortOrder: -1 })
          .select('sortOrder');
        const newSortOrder = maxSortOrder ? maxSortOrder.sortOrder + 1 : 1;
        
        const newCategory = await InventoryCategory.create({
          name: categoryName,
          merchant: merchantId,
          sortOrder: newSortOrder,
          description: `自動創建的分類：${categoryName}`,
          icon: '📦' // 預設圖標
        });
        
        createdCategories.push(newCategory);
        console.log(`✓ 成功創建分類：${categoryName} (ID: ${newCategory._id})`);
      } catch (error) {
        console.error(`✗ 創建分類失敗：${categoryName}`, error);
        errors.push(`無法創建分類「${categoryName}」：${error.message}`);
      }
    }
    
    if (errors.length > 0) {
      console.error(`分類創建階段發現 ${errors.length} 個錯誤：`);
      errors.forEach(error => console.error(`  - ${error}`));
      return next(new AppError(`匯入失敗：\n${errors.join('\n')}`, 400));
    }
    
    // 分組處理多規格原料
    console.log('開始處理庫存項目數據...');
    const processedInventory = [];
    const multiSpecGroups = {};
    let singleSpecCount = 0;
    let multiSpecCount = 0;
    
    for (const item of inventoryData) {
      if (item.type === 'single') {
        // 單一規格直接處理
        singleSpecCount++;
        console.log(`處理單一規格項目：${item.name} (${item.category})`);
        
        processedInventory.push({
          name: item.name,
          category: item.category,
          type: 'single',
          description: item.description,
          singleStock: {
            quantity: item.quantity,
            unit: item.unit,
            minStock: item.minStock,
            maxStock: item.maxStock
          },
          cost: {
            unitPrice: item.unitPrice,
            currency: 'TWD'
          },
          status: item.status,
          isActive: true,
          stockAlert: {
            enabled: true,
            threshold: 10
          }
        });
      } else {
        // 多規格需要分組
        const key = `${item.name}_${item.category}`;
        if (!multiSpecGroups[key]) {
          multiSpecGroups[key] = {
            name: item.name,
            category: item.category,
            type: 'multiSpec',
            description: item.description,
            multiSpecStock: [],
            cost: {
              unitPrice: 0,
              currency: 'TWD'
            },
            status: item.status,
            isActive: true,
            stockAlert: {
              enabled: true,
              threshold: 10
            }
          };
          multiSpecCount++;
          console.log(`開始處理多規格項目：${item.name} (${item.category})`);
        }
        
        // 檢查規格名稱是否重複
        const existingSpec = multiSpecGroups[key].multiSpecStock.find(
          spec => spec.specName === item.specName
        );
        if (existingSpec) {
          const errorMsg = `原料「${item.name}」的規格「${item.specName}」重複`;
          console.error(errorMsg);
          errors.push(errorMsg);
          continue;
        }
        
        console.log(`  添加規格：${item.specName} (數量: ${item.quantity}, 單價: ${item.unitPrice})`);
        multiSpecGroups[key].multiSpecStock.push({
          specName: item.specName,
          quantity: item.quantity,
          unit: item.unit,
          minStock: item.minStock,
          maxStock: item.maxStock,
          unitPrice: item.unitPrice
        });
      }
    }
    
    // 將多規格分組添加到處理列表
    for (const group of Object.values(multiSpecGroups)) {
      processedInventory.push(group);
    }
    
    console.log(`數據處理完成：單一規格 ${singleSpecCount} 個，多規格 ${multiSpecCount} 個，總計 ${processedInventory.length} 個項目`);
    
    if (errors.length > 0) {
      console.error(`數據處理階段發現 ${errors.length} 個錯誤：`);
      errors.forEach(error => console.error(`  - ${error}`));
      return next(new AppError(`匯入失敗：\n${errors.join('\n')}`, 400));
    }
    
    if (errors.length > 0) {
      return next(new AppError(`匯入失敗：\n${errors.join('\n')}`, 400));
    }

    // 收集所有不在Excel中的現有項目進行刪除
    console.log('檢查需要刪除的項目...');
    const allExistingItems = await Inventory.find({ merchant: merchantId });
    const importedItemNames = processedInventory.map(item => item.name);
    
    const existingItemsToDelete = allExistingItems.filter(item => 
      !importedItemNames.includes(item.name)
    );
    
    console.log(`找到 ${existingItemsToDelete.length} 個不在Excel中的現有項目將被刪除`);
    if (existingItemsToDelete.length > 0) {
      console.log('將刪除的項目：', existingItemsToDelete.map(item => item.name).join(', '));
    }
    
    // 批量創建庫存項目
    console.log('開始創建庫存項目...');
    const results = [];
    const createdItems = [];
    const failedItems = [];
    let processedCount = 0;
    
    for (const item of processedInventory) {
      processedCount++;
      console.log(`[${processedCount}/${processedInventory.length}] 處理項目：${item.name} (${item.category})`);
      
      try {
        // 設置商家ID
        item.merchant = merchantId;
        
        // 檢查是否已存在相同名稱的庫存項目（不考慮分類，因為分類可能會變更）
        const existingItem = await Inventory.findOne({
          merchant: merchantId,
          name: item.name
        });
        
        if (existingItem) {
          console.log(`  更新現有庫存項目：${item.name}`);
          
          // 檢查分類是否有變更
          if (existingItem.category !== item.category) {
            console.log(`    分類變更：${existingItem.category} -> ${item.category}`);
          }
          
          // 更新基本信息
          existingItem.description = item.description;
          existingItem.category = item.category; // 更新分類
          existingItem.status = item.status;
          existingItem.isActive = item.isActive;
          
          if (item.type === 'single') {
            // 更新單一規格
            existingItem.singleStock = item.singleStock;
            existingItem.cost = item.cost;
          } else {
            // 更新多規格 - 完全替換規格列表
            existingItem.multiSpecStock = item.multiSpecStock;
            
            // 重新計算成本範圍
            if (item.multiSpecStock.length > 0) {
              const prices = item.multiSpecStock.map(spec => spec.unitPrice);
              existingItem.cost = {
                unitPrice: Math.min(...prices),
                currency: 'TWD'
              };
            }
          }
          
          await existingItem.save();
          createdItems.push(existingItem);
          results.push({
            name: item.name,
            category: item.category,
            type: item.type,
            success: true,
            action: 'updated'
          });
          console.log(`✓ 成功更新：${item.name} (ID: ${existingItem._id})`);
        } else {
          console.log(`  創建庫存項目：${item.name}`);
          const newInventory = await Inventory.create(item);
          createdItems.push(newInventory);
          results.push({
            name: item.name,
            category: item.category,
            type: item.type,
            success: true,
            action: 'created'
          });
          console.log(`✓ 成功創建：${item.name} (ID: ${newInventory._id})`);
        }
        
      } catch (error) {
        const errorMsg = `創建失敗：${error.message}`;
        console.error(`✗ ${item.name} - ${errorMsg}`);
        failedItems.push({
          name: item.name,
          category: item.category,
          error: error.message
        });
        results.push({
          name: item.name,
          category: item.category,
          success: false,
          error: error.message
        });
      }
    }
    
    console.log(`庫存項目創建完成：成功 ${createdItems.length} 個，失敗 ${failedItems.length} 個`);
    
    // 刪除不在Excel中的項目
    let deletedCount = 0;
    if (existingItemsToDelete.length > 0) {
      console.log('開始刪除不在Excel中的項目...');
      for (const item of existingItemsToDelete) {
        try {
          await Inventory.findByIdAndDelete(item._id);
          deletedCount++;
          console.log(`✓ 已刪除：${item.name}`);
        } catch (error) {
          console.error(`✗ 刪除失敗：${item.name} - ${error.message}`);
        }
      }
      console.log(`刪除完成：成功刪除 ${deletedCount} 個項目`);
    }
    
    // 清理暫存檔案
    console.log('清理暫存檔案...');
    try {
      fs.unlinkSync(req.file.path);
      console.log('✓ 暫存檔案清理成功');
    } catch (error) {
      console.warn('⚠ 清理暫存檔案失敗:', error);
    }
    
    // 生成最終統計
    const totalProcessed = processedInventory.length;
    const createdCount = results.filter(r => r.success && r.action === 'created').length;
    const updatedCount = results.filter(r => r.success && r.action === 'updated').length;
    const successRate = totalProcessed > 0 ? (((createdCount + updatedCount) / totalProcessed) * 100).toFixed(1) : 0;
    
    console.log('=== 匯入完成統計 ===');
    console.log(`總處理項目：${totalProcessed}`);
    console.log(`成功創建：${createdCount}`);
    console.log(`成功更新：${updatedCount}`);
    console.log(`成功刪除：${deletedCount}`);
    console.log(`處理失敗：${failedItems.length}`);
    console.log(`成功率：${successRate}%`);
    console.log(`自動創建分類：${createdCategories.length}`);
    console.log('==================');
    
    res.status(200).json({
      status: 'success',
      data: {
        total: processedInventory.length,
        created: createdCount,
        updated: updatedCount,
        deleted: deletedCount,
        failed: failedItems.length,
        successRate: parseFloat(successRate),
        results: results,
        categoriesCreated: createdCategories.length,
        newCategories: createdCategories.map(cat => ({
          name: cat.name,
          description: cat.description
        }))
      },
      message: `成功處理 ${createdCount + updatedCount} 個庫存項目（創建 ${createdCount} 個，更新 ${updatedCount} 個${deletedCount > 0 ? `，刪除 ${deletedCount} 個` : ''}）${failedItems.length > 0 ? `，${failedItems.length} 個失敗` : ''}${createdCategories.length > 0 ? `，自動創建 ${createdCategories.length} 個新分類` : ''}`
    });
    
  } catch (error) {
    console.error('匯入過程中發生未預期錯誤：', error);
    
    // 清理暫存檔案
    try {
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
        console.log('✓ 錯誤處理時清理暫存檔案成功');
      }
    } catch (cleanupError) {
      console.warn('⚠ 錯誤處理時清理暫存檔案失敗:', cleanupError);
    }
    
    return next(new AppError(`匯入失敗：${error.message}`, 400));
  }
});
