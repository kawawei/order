const mongoose = require('mongoose');
const InventoryCategory = require('../models/inventoryCategory');
const Inventory = require('../models/inventory');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// 輔助函數：獲取商家ID（支援員工與超管）
const getMerchantId = (req) => {
  // 超管/管理員可帶入 merchantId
  if (req.admin && req.query.merchantId) return req.query.merchantId;
  if (req.admin && !req.query.merchantId) {
    throw new AppError('超級管理員訪問商家後台需要指定merchantId參數', 400);
  }
  // 員工從所屬商家取得
  if (req.employee) return req.employee.merchant?.toString();
  // 商家本人
  if (req.merchant) return req.merchant.id;
  throw new AppError('無法獲取商家信息', 401);
};

// 獲取所有分類
exports.getAllCategories = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  
  const categories = await InventoryCategory.find({ merchant: merchantId })
    .sort({ sortOrder: 1, name: 1 })
    .populate('itemCount');
  
  res.status(200).json({
    status: 'success',
    results: categories.length,
    data: {
      categories
    }
  });
});

// 獲取單個分類
exports.getCategory = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  
  const category = await InventoryCategory.findOne({
    _id: req.params.id,
    merchant: merchantId
  }).populate('itemCount');
  
  if (!category) {
    return next(new AppError('找不到該分類', 404));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      category
    }
  });
});

// 創建新分類
exports.createCategory = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  
  // 檢查分類名稱是否已存在
  const existingCategory = await InventoryCategory.findOne({
    merchant: merchantId,
    name: req.body.name
  });
  
  if (existingCategory) {
    return next(new AppError('分類名稱已存在', 400));
  }
  
  // 添加商家ID
  req.body.merchant = merchantId;
  
  // 設置排序順序（如果沒有提供）
  if (!req.body.sortOrder) {
    const maxSortOrder = await InventoryCategory.findOne({ merchant: merchantId })
      .sort({ sortOrder: -1 })
      .select('sortOrder');
    req.body.sortOrder = maxSortOrder ? maxSortOrder.sortOrder + 1 : 1;
  }
  
  const category = await InventoryCategory.create(req.body);
  
  res.status(201).json({
    status: 'success',
    data: {
      category
    }
  });
});

// 更新分類
exports.updateCategory = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  
  // 檢查分類是否存在
  const category = await InventoryCategory.findOne({
    _id: req.params.id,
    merchant: merchantId
  });
  
  if (!category) {
    return next(new AppError('找不到該分類', 404));
  }
  
  // 系統預設分類也可以被完全編輯，讓商家有更大的靈活性
  if (category.isSystem) {
    console.log(`商家 ${merchantId} 正在編輯系統預設分類: ${category.name}`);
  }
  
  // 如果要修改名稱，檢查是否與其他分類重複
  if (req.body.name && req.body.name !== category.name) {
    const existingCategory = await InventoryCategory.findOne({
      merchant: merchantId,
      name: req.body.name,
      _id: { $ne: req.params.id }
    });
    
    if (existingCategory) {
      return next(new AppError('分類名稱已存在', 400));
    }
  }
  
  const updatedCategory = await InventoryCategory.findByIdAndUpdate(
    req.params.id,
    req.body,
    {
      new: true,
      runValidators: true
    }
  ).populate('itemCount');
  
  res.status(200).json({
    status: 'success',
    data: {
      category: updatedCategory
    }
  });
});

// 刪除分類
exports.deleteCategory = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  
  const category = await InventoryCategory.findOne({
    _id: req.params.id,
    merchant: merchantId
  });
  
  if (!category) {
    return next(new AppError('找不到該分類', 404));
  }
  
  // 檢查是否可以刪除（系統分類也可以刪除，但需要額外確認）
  if (category.isSystem) {
    // 系統分類可以刪除，但建議用戶謹慎操作
    console.log(`商家 ${merchantId} 正在刪除系統預設分類: ${category.name}`);
  }
  
  // 檢查是否有原料使用此分類
  const itemCount = await Inventory.countDocuments({
    category: category.name,
    merchant: merchantId
  });
  
  if (itemCount > 0) {
    return next(new AppError(`該分類下還有 ${itemCount} 個原料，無法刪除`, 400));
  }
  
  await InventoryCategory.findByIdAndDelete(req.params.id);
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// 更新分類排序
exports.updateCategoriesOrder = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  const { categories } = req.body;
  
  if (!Array.isArray(categories)) {
    return next(new AppError('請提供有效的排序數據', 400));
  }
  
  // 驗證所有分類都屬於該商家
  const categoryIds = categories.map(cat => cat.id || cat._id);
  const existingCategories = await InventoryCategory.find({
    _id: { $in: categoryIds },
    merchant: merchantId
  });
  
  if (existingCategories.length !== categoryIds.length) {
    return next(new AppError('部分分類不存在或無權限訪問', 400));
  }
  
  // 批量更新排序
  const updates = categories.map(async (item) => {
    return InventoryCategory.findByIdAndUpdate(
      item.id || item._id,
      { sortOrder: item.sortOrder },
      { new: true }
    );
  });
  
  const updatedCategories = await Promise.all(updates);
  
  res.status(200).json({
    status: 'success',
    data: {
      categories: updatedCategories
    }
  });
});

// 初始化系統預設分類
exports.initializeSystemCategories = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  
  // 檢查是否已經有分類
  const existingCount = await InventoryCategory.countDocuments({ merchant: merchantId });
  
  if (existingCount > 0) {
    return next(new AppError('商家已有分類，無需初始化', 400));
  }
  
  // 創建系統預設分類
  const categories = await InventoryCategory.createSystemCategories(merchantId);
  
  res.status(201).json({
    status: 'success',
    message: '系統預設分類創建成功',
    data: {
      categories
    }
  });
});

// 獲取分類統計信息
exports.getCategoryStats = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  
  // 聚合查詢：統計每個分類下的原料數量和總價值
  const stats = await Inventory.aggregate([
    { $match: { merchant: mongoose.Types.ObjectId(merchantId) } },
    {
      $group: {
        _id: '$category',
        itemCount: { $sum: 1 },
        totalValue: {
          $sum: {
            $cond: [
              { $eq: ['$type', 'single'] },
              { $multiply: ['$cost.unitPrice', '$singleStock.quantity'] },
              {
                $reduce: {
                  input: '$multiSpecStock',
                  initialValue: 0,
                  in: { $add: ['$$value', { $multiply: ['$cost.unitPrice', '$$this.quantity'] }] }
                }
              }
            ]
          }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  res.status(200).json({
    status: 'success',
    data: {
      stats
    }
  });
});


