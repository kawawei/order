const mongoose = require('mongoose');
const Dish = require('../models/dish');
const MenuCategory = require('../models/menuCategory');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

// 獲取商家的所有菜品
exports.getAllDishes = catchAsync(async (req, res, next) => {
  const merchantId = req.merchant.id;
  
  const queryObj = { merchant: merchantId };
  
  // 分類篩選
  if (req.query.category) {
    queryObj.category = req.query.category;
  }
  
  // 是否啟用篩選
  if (req.query.isActive !== undefined) {
    queryObj.isActive = req.query.isActive === 'true';
  }
  
  // 是否為招牌菜篩選
  if (req.query.isSignature !== undefined) {
    queryObj.isSignature = req.query.isSignature === 'true';
  }
  
  // 是否為推薦菜品篩選
  if (req.query.isRecommended !== undefined) {
    queryObj.isRecommended = req.query.isRecommended === 'true';
  }
  
  // 價格範圍篩選
  if (req.query.minPrice || req.query.maxPrice) {
    queryObj.price = {};
    if (req.query.minPrice) {
      queryObj.price.$gte = parseFloat(req.query.minPrice);
    }
    if (req.query.maxPrice) {
      queryObj.price.$lte = parseFloat(req.query.maxPrice);
    }
  }
  
  // 辣度篩選
  if (req.query.spiceLevel !== undefined) {
    queryObj.spiceLevel = parseInt(req.query.spiceLevel);
  }
  
  // 標籤篩選
  if (req.query.tags) {
    const tags = req.query.tags.split(',');
    queryObj.tags = { $in: tags };
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
    sortBy = { sortOrder: 1, createdAt: -1 };
  }
  
  // 分頁
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  const skip = (page - 1) * limit;
  
  const dishes = await Dish.find(queryObj)
    .sort(sortBy)
    .skip(skip)
    .limit(limit)
    .populate('category', 'name label')
    .populate('merchant', 'businessName');
  
  const total = await Dish.countDocuments(queryObj);
  
  res.status(200).json({
    status: 'success',
    results: dishes.length,
    total,
    page,
    pages: Math.ceil(total / limit),
    data: {
      dishes
    }
  });
});

// 獲取客戶端菜單（公開接口）
exports.getPublicMenu = catchAsync(async (req, res, next) => {
  const merchantId = req.params.merchantId;
  
  // 獲取啟用的分類
  const categories = await MenuCategory.find({
    merchant: merchantId,
    isActive: true
  }).sort({ sortOrder: 1 });
  
  if (categories.length === 0) {
    return next(new AppError('該商家暫無可用菜單', 404));
  }
  
  // 獲取每個分類下的啟用菜品
  const menuData = await Promise.all(
    categories.map(async (category) => {
      const dishes = await Dish.find({
        merchant: merchantId,
        category: category._id,
        isActive: true
      }).sort({ sortOrder: 1, createdAt: -1 });
      
      return {
        ...category.toObject(),
        dishes
      };
    })
  );
  
  // 過濾掉沒有菜品的分類
  const filteredMenu = menuData.filter(category => category.dishes.length > 0);
  
  res.status(200).json({
    status: 'success',
    data: {
      menu: filteredMenu
    }
  });
});

// 獲取單個菜品
exports.getDish = catchAsync(async (req, res, next) => {
  const dish = await Dish.findById(req.params.id)
    .populate('category', 'name label')
    .populate('merchant', 'businessName businessType');
  
  if (!dish) {
    return next(new AppError('找不到指定的菜品', 404));
  }
  
  // 檢查菜品是否屬於當前商家
  if (dish.merchant._id.toString() !== req.merchant.id) {
    return next(new AppError('您沒有權限訪問此菜品', 403));
  }
  
  res.status(200).json({
    status: 'success',
    data: {
      dish
    }
  });
});

// 創建新菜品
exports.createDish = catchAsync(async (req, res, next) => {
  // 確保菜品關聯到當前商家
  req.body.merchant = req.merchant.id;
  
  // 驗證分類是否屬於當前商家
  const category = await MenuCategory.findById(req.body.category);
  if (!category || category.merchant.toString() !== req.merchant.id) {
    return next(new AppError('無效的分類或分類不屬於您的商家', 400));
  }
  
  // 如果沒有提供排序順序，設置為分類中最大值+1
  if (!req.body.sortOrder) {
    const lastDish = await Dish.findOne({ 
      merchant: req.merchant.id,
      category: req.body.category
    }).sort({ sortOrder: -1 });
    req.body.sortOrder = lastDish ? lastDish.sortOrder + 1 : 1;
  }
  
  const dish = await Dish.create(req.body);
  
  // 返回包含分類信息的菜品
  const populatedDish = await Dish.findById(dish._id)
    .populate('category', 'name label')
    .populate('merchant', 'businessName');
  
  res.status(201).json({
    status: 'success',
    data: {
      dish: populatedDish
    }
  });
});

// 更新菜品
exports.updateDish = catchAsync(async (req, res, next) => {
  // 添加日誌來調試請求內容
  console.log('Update dish request body:', JSON.stringify(req.body, null, 2));
  
  const dish = await Dish.findById(req.params.id);
  
  if (!dish) {
    return next(new AppError('找不到指定的菜品', 404));
  }
  
  // 檢查菜品是否屬於當前商家
  if (dish.merchant.toString() !== req.merchant.id) {
    return next(new AppError('您沒有權限修改此菜品', 403));
  }
  
  // 如果要修改分類，驗證新分類是否屬於當前商家
  if (req.body.category && req.body.category !== dish.category.toString()) {
    const category = await MenuCategory.findById(req.body.category);
    if (!category || category.merchant.toString() !== req.merchant.id) {
      return next(new AppError('無效的分類或分類不屬於您的商家', 400));
    }
  }
  
  // 不允許修改商家ID
  delete req.body.merchant;
  
  const updatedDish = await Dish.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  ).populate('category', 'name label');
  
  console.log('Updated dish result:', JSON.stringify(updatedDish, null, 2));
  
  res.status(200).json({
    status: 'success',
    data: {
      dish: updatedDish
    }
  });
});

// 刪除菜品
exports.deleteDish = catchAsync(async (req, res, next) => {
  const dish = await Dish.findById(req.params.id);
  
  if (!dish) {
    return next(new AppError('找不到指定的菜品', 404));
  }
  
  // 檢查菜品是否屬於當前商家
  if (dish.merchant.toString() !== req.merchant.id) {
    return next(new AppError('您沒有權限刪除此菜品', 403));
  }
  
  await Dish.findByIdAndDelete(req.params.id);
  
  res.status(204).json({
    status: 'success',
    data: null
  });
});

// 批量更新菜品狀態
exports.batchUpdateDishes = catchAsync(async (req, res, next) => {
  const { dishIds, updateData } = req.body;
  
  if (!Array.isArray(dishIds) || dishIds.length === 0) {
    return next(new AppError('請提供要更新的菜品ID數組', 400));
  }
  
  // 驗證所有菜品都屬於當前商家
  const dishes = await Dish.find({
    _id: { $in: dishIds },
    merchant: req.merchant.id
  });
  
  if (dishes.length !== dishIds.length) {
    return next(new AppError('部分菜品不存在或不屬於您的商家', 400));
  }
  
  // 批量更新
  await Dish.updateMany(
    { _id: { $in: dishIds } },
    updateData,
    { runValidators: true }
  );
  
  const updatedDishes = await Dish.find({ _id: { $in: dishIds } })
    .populate('category', 'name label');
  
  res.status(200).json({
    status: 'success',
    data: {
      dishes: updatedDishes
    }
  });
});

// 獲取菜品統計信息
exports.getDishStats = catchAsync(async (req, res, next) => {
  const merchantId = req.merchant.id;
  
  const stats = await Dish.aggregate([
    { $match: { merchant: mongoose.Types.ObjectId(merchantId) } },
    {
      $group: {
        _id: null,
        totalDishes: { $sum: 1 },
        activeDishes: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        signatureDishes: {
          $sum: { $cond: [{ $eq: ['$isSignature', true] }, 1, 0] }
        },
        recommendedDishes: {
          $sum: { $cond: [{ $eq: ['$isRecommended', true] }, 1, 0] }
        },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
        totalValue: { $sum: '$price' }
      }
    }
  ]);
  
  // 按分類統計
  const categoryStats = await Dish.aggregate([
    { $match: { merchant: mongoose.Types.ObjectId(merchantId) } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        activeCount: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        avgPrice: { $avg: '$price' }
      }
    },
    {
      $lookup: {
        from: 'menucategories',
        localField: '_id',
        foreignField: '_id',
        as: 'category'
      }
    },
    {
      $unwind: '$category'
    },
    {
      $project: {
        categoryName: '$category.name',
        categoryLabel: '$category.label',
        count: 1,
        activeCount: 1,
        avgPrice: 1
      }
    }
  ]);
  
  res.status(200).json({
    status: 'success',
    data: {
      overall: stats[0] || {
        totalDishes: 0,
        activeDishes: 0,
        signatureDishes: 0,
        recommendedDishes: 0,
        avgPrice: 0,
        minPrice: 0,
        maxPrice: 0,
        totalValue: 0
      },
      categories: categoryStats
    }
  });
});
