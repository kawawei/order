const mongoose = require('mongoose');
const Dish = require('../models/dish');
const MenuCategory = require('../models/menuCategory');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const fs = require('fs');
const path = require('path');

// 輔助函數：獲取商家ID（支持超級管理員與員工訪問特定商家）
const getMerchantId = (req) => {
  console.log('=== getMerchantId 調試信息 ===');
  console.log('req.admin:', req.admin);
  console.log('req.merchant:', req.merchant);
  console.log('req.employee:', req.employee);
  console.log('req.query:', req.query);
  console.log('req.query.merchantId:', req.query.merchantId);
  console.log('req.params:', req.params);
  console.log('==============================');
  
  // 如果是超級管理員且指定了商家ID，使用指定的商家ID
  if (req.admin && req.query.merchantId) {
    console.log('超級管理員訪問，使用指定的商家ID:', req.query.merchantId);
    return req.query.merchantId;
  }
  // 如果是超級管理員但沒有指定商家ID，返回錯誤信息
  if (req.admin && !req.query.merchantId) {
    console.log('超級管理員訪問但沒有指定merchantId參數');
    throw new AppError('超級管理員訪問商家後台需要指定merchantId參數', 400);
  }
  // 員工：從所屬商家取得 ID
  if (req.employee) {
    const id = req.employee.merchant?.toString();
    console.log('員工訪問，使用所屬商家ID:', id);
    return id;
  }
  // 商家：使用當前登入商家 ID
  if (req.merchant) {
    console.log('使用當前登入的商家ID:', req.merchant.id);
    return req.merchant.id;
  }
  console.log('無法獲取商家信息');
  throw new AppError('無法獲取商家信息', 401);
};

// 將字串轉為安全檔名（slug）- Convert string to safe slug
const toSlug = (text) => (text || '')
  .toString()
  .trim()
  .toLowerCase()
  .replace(/\s+/g, '-')
  .replace(/[^a-z0-9\-_.]/g, '')
  .replace(/-+/g, '-')
  .replace(/^[-_.]+|[-_.]+$/g, '');

// 取得分類圖片目錄 - Get category image directory
const getCategoryDir = (merchantId, categoryName) => {
  const baseDir = path.join(__dirname, '..', 'uploads', 'menu');
  const safeMerchant = toSlug(String(merchantId));
  const safeCategory = toSlug(String(categoryName));
  return path.join(baseDir, safeMerchant, safeCategory);
};

// 根據菜名與副檔名生成檔名 - Build filename using dish name and ext
const buildDishFilename = (dishName, dishId, ext) => {
  const base = toSlug(dishName);
  const idSuffix = dishId ? `--${dishId}` : '';
  return `${base}${idSuffix}${ext}`;
};

// 解析可能為 JSON 字串的欄位 - Parse fields that may be JSON strings
const parseJsonFields = (body, fields) => {
  fields.forEach((key) => {
    if (typeof body[key] === 'string') {
      try {
        body[key] = JSON.parse(body[key]);
      } catch (e) {}
    }
  });
};

// 安全搬移檔案：優先 rename，同掛載點跨裝置(EXDEV)時改為 copy + unlink
const safeMoveFileSync = (sourcePath, destinationPath) => {
  try {
    fs.renameSync(sourcePath, destinationPath);
  } catch (error) {
    if (error && error.code === 'EXDEV') {
      fs.copyFileSync(sourcePath, destinationPath);
      fs.unlinkSync(sourcePath);
    } else {
      throw error;
    }
  }
};

// 獲取商家的所有菜品
exports.getAllDishes = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  
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
  
  // 檢查菜品是否屬於當前商家（超級管理員可以訪問所有菜品）
  if (req.merchant && dish.merchant._id.toString() !== req.merchant.id) {
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
  req.body.merchant = getMerchantId(req);
  // 解析 JSON 欄位
  parseJsonFields(req.body, ['customOptions', 'inventoryConfig']);
  
  // 驗證分類是否屬於當前商家
  const category = await MenuCategory.findById(req.body.category);
  if (!category || category.merchant.toString() !== getMerchantId(req)) {
    return next(new AppError('無效的分類或分類不屬於您的商家', 400));
  }
  
  // 如果沒有提供排序順序，設置為分類中最大值+1
  if (!req.body.sortOrder) {
    const lastDish = await Dish.findOne({ 
      merchant: getMerchantId(req),
      category: req.body.category
    }).sort({ sortOrder: -1 });
    req.body.sortOrder = lastDish ? lastDish.sortOrder + 1 : 1;
  }
  
  const dish = await Dish.create(req.body);

  // 若有圖片上傳，將暫存檔移動到分類目錄，並以菜名命名 - Move uploaded image into category folder
  if (req.file) {
    try {
      const category = await MenuCategory.findById(dish.category);
      const categoryDir = getCategoryDir(dish.merchant, category.name);
      fs.mkdirSync(categoryDir, { recursive: true });

      const ext = path.extname(req.file.originalname) ||
        (req.file.mimetype === 'image/png' ? '.png' : req.file.mimetype === 'image/webp' ? '.webp' : '.jpg');
      const finalName = buildDishFilename(dish.name, dish._id.toString(), ext);
      const finalPath = path.join(categoryDir, finalName);

      safeMoveFileSync(req.file.path, finalPath);

      // 儲存相對於 /uploads 的路徑 - Save relative path
      const relativePath = path
        .relative(path.join(__dirname, '..'), finalPath)
        .split(path.sep)
        .join('/');
      dish.image = `/${relativePath}`;
      await dish.save();
    } catch (e) {
      console.warn('處理菜品圖片失敗:', e?.message);
    }
  }
  
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
  // 解析 JSON 欄位
  parseJsonFields(req.body, ['customOptions', 'inventoryConfig']);
  
  const dish = await Dish.findById(req.params.id);
  
  if (!dish) {
    return next(new AppError('找不到指定的菜品', 404));
  }
  
  // 檢查菜品是否屬於當前商家（超級管理員可以修改所有菜品）
  if (req.merchant && dish.merchant.toString() !== req.merchant.id) {
    return next(new AppError('您沒有權限修改此菜品', 403));
  }
  
  // 如果要修改分類，驗證新分類是否屬於當前商家
  if (req.body.category && req.body.category !== dish.category.toString()) {
    const category = await MenuCategory.findById(req.body.category);
    if (!category || category.merchant.toString() !== getMerchantId(req)) {
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

  // 若有新圖片上傳，或名稱/分類變更，需要重命名/搬移圖片 - Handle image move/rename
  try {
    const hasNewFile = !!req.file;
    const category = await MenuCategory.findById(updatedDish.category);
    const targetDir = getCategoryDir(updatedDish.merchant, category.name);
    fs.mkdirSync(targetDir, { recursive: true });

    if (hasNewFile) {
      const ext = path.extname(req.file.originalname) ||
        (req.file.mimetype === 'image/png' ? '.png' : req.file.mimetype === 'image/webp' ? '.webp' : '.jpg');
      const finalName = buildDishFilename(updatedDish.name, updatedDish._id.toString(), ext);
      const finalPath = path.join(targetDir, finalName);
      safeMoveFileSync(req.file.path, finalPath);
      const relativePath = path
        .relative(path.join(__dirname, '..'), finalPath)
        .split(path.sep)
        .join('/');
      updatedDish.image = `/${relativePath}`;
      await updatedDish.save();
    } else if (updatedDish.image) {
      // 若沒有新檔，但名稱或分類可能改了，嘗試搬移/重命名現有檔案
      const currentPath = path.join(__dirname, '..', updatedDish.image.replace(/^\/+/, ''));
      const currentExt = path.extname(currentPath) || '.jpg';
      const finalName = buildDishFilename(updatedDish.name, updatedDish._id.toString(), currentExt);
      const finalPath = path.join(targetDir, finalName);
      if (fs.existsSync(currentPath) && currentPath !== finalPath) {
        fs.mkdirSync(path.dirname(finalPath), { recursive: true });
        safeMoveFileSync(currentPath, finalPath);
        const relativePath = path
          .relative(path.join(__dirname, '..'), finalPath)
          .split(path.sep)
          .join('/');
        updatedDish.image = `/${relativePath}`;
        await updatedDish.save();
      }
    }
  } catch (e) {
    console.warn('更新菜品圖片處理失敗:', e?.message);
  }
  
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
  
  // 檢查菜品是否屬於當前商家（超級管理員可以刪除所有菜品）
  if (req.merchant && dish.merchant.toString() !== req.merchant.id) {
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
    merchant: getMerchantId(req)
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
  const merchantId = getMerchantId(req);
  
  const stats = await Dish.aggregate([
    { $match: { merchant: new mongoose.Types.ObjectId(merchantId) } },
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
    { $match: { merchant: new mongoose.Types.ObjectId(merchantId) } },
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
