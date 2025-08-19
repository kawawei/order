const mongoose = require('mongoose');
const Inventory = require('../models/inventory');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

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
