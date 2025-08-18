const mongoose = require('mongoose');
const MenuCategory = require('../models/menuCategory');
const Dish = require('../models/dish');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// 獲取商家的所有菜單分類
exports.getAllCategories = catchAsync(async (req, res, next) => {
  const merchantId = req.merchant.id;
  
  const queryObj = { merchant: merchantId };
  
  // 是否啟用篩選
  if (req.query.isActive !== undefined) {
    queryObj.isActive = req.query.isActive === 'true';
  }
  
  // 排序
  const sortBy = req.query.sort || 'sortOrder';
  
  const categories = await MenuCategory.find(queryObj)
    .sort(sortBy)
    .populate('dishCount');
  
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
  const category = await MenuCategory.findById(req.params.id)
    .populate('merchant', 'businessName')
    .populate('dishCount');
  
  if (!category) {
    return next(new AppError('找不到指定的分類', 404));
  }
  
  // 檢查分類是否屬於當前商家
  if (category.merchant._id.toString() !== req.merchant.id) {
    return next(new AppError('您沒有權限訪問此分類', 403));
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
  // 確保分類關聯到當前商家
  req.body.merchant = req.merchant.id;
  
  // 如果沒有提供排序順序，設置為最大值+1
  if (!req.body.sortOrder) {
    const lastCategory = await MenuCategory.findOne({ merchant: req.merchant.id })
      .sort({ sortOrder: -1 });
    req.body.sortOrder = lastCategory ? lastCategory.sortOrder + 1 : 1;
  }
  
  const category = await MenuCategory.create(req.body);
  
  res.status(201).json({
    status: 'success',
    data: {
      category
    }
  });
});

// 更新分類
exports.updateCategory = catchAsync(async (req, res, next) => {
  const category = await MenuCategory.findById(req.params.id);
  
  if (!category) {
    return next(new AppError('找不到指定的分類', 404));
  }
  
  // 檢查分類是否屬於當前商家
  if (category.merchant.toString() !== req.merchant.id) {
    return next(new AppError('您沒有權限修改此分類', 403));
  }
  
  // 不允許修改商家ID
  delete req.body.merchant;
  
  const updatedCategory = await MenuCategory.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );
  
  res.status(200).json({
    status: 'success',
    data: {
      category: updatedCategory
    }
  });
});

// 刪除分類
exports.deleteCategory = catchAsync(async (req, res, next) => {
  const category = await MenuCategory.findById(req.params.id);
  
  if (!category) {
    return next(new AppError('找不到指定的分類', 404));
  }
  
  // 檢查分類是否屬於當前商家
  if (category.merchant.toString() !== req.merchant.id) {
    return next(new AppError('您沒有權限刪除此分類', 403));
  }
  
  // 檢查分類下是否還有菜品
  const dishCount = await Dish.countDocuments({ category: req.params.id });
  if (dishCount > 0) {
    return next(new AppError(`無法刪除分類，還有 ${dishCount} 個菜品屬於此分類`, 400));
  }
  
  await MenuCategory.findByIdAndDelete(req.params.id);
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// 批量更新分類排序
exports.updateCategoriesOrder = catchAsync(async (req, res, next) => {
  const { categories } = req.body; // [{ id, sortOrder }]
  
  if (!Array.isArray(categories)) {
    return next(new AppError('請提供分類排序數組', 400));
  }
  
  // 批量更新排序
  const updates = categories.map(async (item) => {
    const category = await MenuCategory.findById(item.id);
    if (!category || category.merchant.toString() !== req.merchant.id) {
      throw new AppError('無效的分類ID或權限不足', 400);
    }
    
    return MenuCategory.findByIdAndUpdate(
      item.id,
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

// 獲取分類統計信息
exports.getCategoryStats = catchAsync(async (req, res, next) => {
  const merchantId = req.merchant.id;
  
  const stats = await MenuCategory.aggregate([
    { $match: { merchant: new mongoose.Types.ObjectId(merchantId) } },
    {
      $lookup: {
        from: 'dishes',
        localField: '_id',
        foreignField: 'category',
        as: 'dishes'
      }
    },
    {
      $project: {
        name: 1,
        label: 1,
        isActive: 1,
        dishCount: { $size: '$dishes' },
        activeDishCount: {
          $size: {
            $filter: {
              input: '$dishes',
              cond: { $eq: ['$$this.isActive', true] }
            }
          }
        },
        totalValue: {
          $sum: '$dishes.price'
        },
        avgPrice: {
          $avg: '$dishes.price'
        }
      }
    },
    { $sort: { sortOrder: 1 } }
  ]);
  
  res.status(200).json({
    status: 'success',
    data: {
      stats
    }
  });
});
