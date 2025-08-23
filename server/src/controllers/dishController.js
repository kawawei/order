const mongoose = require('mongoose');
const Dish = require('../models/dish');
const MenuCategory = require('../models/menuCategory');
const Inventory = require('../models/inventory');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

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

// 將選項欄位映射到庫存項目名稱
const mapOptionToInventory = (fieldName) => {
  // 移除「選-」前綴
  const cleanFieldName = fieldName.replace(/^選-/, '');
  
  const mapping = {
    '吸管': '吸管',
    '杯子': '杯子',
    '果糖': '果糖',
    '珍珠': '珍珠'
  };
  
  const mappedName = mapping[cleanFieldName] || cleanFieldName;
  console.log(`映射選項：${fieldName} -> ${cleanFieldName} -> 庫存：${mappedName}`);
  
  return mappedName;
};

// 清理選項名稱，移除「選-」前綴
const cleanOptionName = (optionName) => {
  return optionName.replace(/^選-/, '');
};

// 根據名稱查找庫存項目
const findInventoryByName = async (inventoryName, merchantId) => {
  try {
    console.log(`查找庫存項目：名稱="${inventoryName}"，商家ID="${merchantId}"`);
    
    const inventory = await Inventory.findOne({
      name: inventoryName,
      merchant: merchantId
    });
    
    if (inventory) {
      console.log(`找到庫存項目：${inventory.name} (ID: ${inventory._id})`);
    } else {
      console.log(`未找到庫存項目：${inventoryName}`);
      
      // 列出該商家的所有庫存項目，幫助調試
      const allInventories = await Inventory.find({ merchant: merchantId }).select('name type');
      console.log(`該商家的所有庫存項目：${allInventories.map(inv => `${inv.name}(${inv.type})`).join(', ')}`);
    }
    
    return inventory;
  } catch (error) {
    console.warn(`查找庫存項目「${inventoryName}」失敗:`, error.message);
    return null;
  }
};

// 在多規格庫存中查找對應的規格值
const findInventorySpec = (inventory, optionLabel) => {
  if (!inventory.multiSpecStock || inventory.multiSpecStock.length === 0) {
    console.log(`庫存 ${inventory.name} 沒有多規格庫存數據`);
    return null;
  }
  
  console.log(`在庫存 ${inventory.name} 中查找規格：${optionLabel}`);
  console.log(`可用規格：${inventory.multiSpecStock.map(spec => spec.specName).join(', ')}`);
  
  // 清理選項標籤，移除可能的後綴（如"杯"、"份"等）
  const cleanOptionLabel = optionLabel.replace(/[杯份個支]/g, '').trim();
  console.log(`清理後的選項標籤：${cleanOptionLabel}`);
  
  // 嘗試多種匹配策略
  let matchedSpec = null;
  
  // 1. 完全匹配
  matchedSpec = inventory.multiSpecStock.find(spec => 
    spec.specName.toLowerCase() === optionLabel.toLowerCase()
  );
  
  // 2. 清理後完全匹配
  if (!matchedSpec) {
    matchedSpec = inventory.multiSpecStock.find(spec => 
      spec.specName.toLowerCase() === cleanOptionLabel.toLowerCase()
    );
  }
  
  // 3. 包含匹配
  if (!matchedSpec) {
    matchedSpec = inventory.multiSpecStock.find(spec => 
      spec.specName.toLowerCase().includes(optionLabel.toLowerCase()) ||
      optionLabel.toLowerCase().includes(spec.specName.toLowerCase())
    );
  }
  
  // 4. 清理後包含匹配
  if (!matchedSpec) {
    matchedSpec = inventory.multiSpecStock.find(spec => 
      spec.specName.toLowerCase().includes(cleanOptionLabel.toLowerCase()) ||
      cleanOptionLabel.toLowerCase().includes(spec.specName.toLowerCase())
    );
  }
  
  // 5. 特殊映射匹配（針對常見的選項值）
  if (!matchedSpec) {
    const sizeMapping = {
      '大杯': '大',
      '中杯': '中', 
      '小杯': '小',
      '大份': '大',
      '中份': '中',
      '小份': '小',
      '大': '大',
      '中': '中',
      '小': '小'
    };
    
    const mappedValue = sizeMapping[optionLabel] || sizeMapping[cleanOptionLabel];
    if (mappedValue) {
      matchedSpec = inventory.multiSpecStock.find(spec => 
        spec.specName.toLowerCase() === mappedValue.toLowerCase()
      );
    }
  }
  
  if (matchedSpec) {
    console.log(`找到匹配規格：${matchedSpec.specName} (原始選項：${optionLabel})`);
  } else {
    console.log(`未找到匹配規格：${optionLabel} (清理後：${cleanOptionLabel})`);
  }
  
  return matchedSpec;
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

// 匯入菜單
exports.importMenu = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  
  if (!req.file) {
    return next(new AppError('請上傳檔案', 400));
  }



  try {
    console.log(`開始處理菜單匯入檔案：${req.file.originalname}`);
    
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
    
    const requiredHeaders = ['品名', '分類', '基礎價格'];
    const optionalHeaders = ['描述', '容量', '容量數量', '容量加價', '甜度', '甜度數量', '甜度加價', '加料', '加料數量', '加料加價'];
    
    // 檢查必要欄位
    const missingHeaders = requiredHeaders.filter(header => !headers.includes(header));
    if (missingHeaders.length > 0) {
      console.error(`缺少必要欄位：${missingHeaders.join(', ')}`);
      return next(new AppError(`缺少必要欄位：${missingHeaders.join(', ')}`, 400));
    }
    
    console.log('所有必要欄位檢查通過');
    
    // 解析數據
    const menuData = [];
    const errors = [];
    let processedRows = 0;
    let skippedRows = 0;
    
    // 全局選項收集器，用於收集所有行的選項數據
    const dishOptionsCollector = {};
    
    console.log('開始解析數據行...');
    
    // 新的解析邏輯：支持混合格式（全局標題行 + 個別菜品標題行）
    let currentDishHeaders = headers; // 預設使用全局標題行
    let currentDishName = null;
    
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
        // 檢查是否為標題行（第一欄包含「分類」）
        const firstCell = String(row[0] || '').trim();
        if (firstCell === '分類') {
          console.log(`第${i + 1}行：檢測到菜品標題行，更新當前標題`);
          currentDishHeaders = row;
          currentDishName = null; // 重置當前菜品名稱
          skippedRows++;
          continue;
        }
        
        // 檢查是否為菜品行（第一欄包含分類名稱，第二欄包含菜品名稱）
        const categoryCell = String(row[0] || '').trim();
        const dishNameCell = String(row[1] || '').trim();
        
        if (categoryCell && dishNameCell) {
          // 這是菜品行
          currentDishName = dishNameCell;
          console.log(`處理菜品：${currentDishName}，使用標題：${currentDishHeaders ? currentDishHeaders.slice(0, 3).join(', ') : '無'}`);
          
          // 使用當前菜品的標題行來解析數據
          const rowData = {};
          currentDishHeaders.forEach((header, index) => {
            rowData[header] = row[index] || '';
          });
          
          // 驗證必要欄位
          const missingFields = [];
          if (!rowData['品名']) missingFields.push('品名');
          if (!rowData['分類']) missingFields.push('分類');
          if (!rowData['基礎價格']) missingFields.push('基礎價格');
          
          if (missingFields.length > 0) {
            const errorMsg = `第${i + 1}行：缺少必要欄位 [${missingFields.join(', ')}]`;
            console.error(errorMsg);
            errors.push(errorMsg);
            continue;
          }
          
          // 驗證價格
          const basePrice = parseFloat(rowData['基礎價格']);
          if (isNaN(basePrice) || basePrice < 0) {
            const errorMsg = `第${i + 1}行：基礎價格「${rowData['基礎價格']}」無效，必須是正數`;
            console.error(errorMsg);
            errors.push(errorMsg);
            continue;
          }
          
          // 檢查分類是否存在，如果不存在則自動創建
          let category = await MenuCategory.findOne({
            label: rowData['分類'].trim(),
            merchant: merchantId
          });
          
          if (!category) {
            console.log(`分類「${rowData['分類']}」不存在，正在自動創建...`);
            try {
              // 生成唯一的 name，使用時間戳確保唯一性
              const timestamp = Date.now();
              const categoryData = {
                name: `${rowData['分類'].trim().replace(/\s+/g, '-')}-${timestamp}`,
                label: rowData['分類'].trim(),
                description: `${rowData['分類']}類別菜品`,
                merchant: merchantId
              };
              
              category = await MenuCategory.create(categoryData);
              console.log(`成功創建分類：${category.label} (ID: ${category._id})`);
            } catch (createError) {
              const errorMsg = `第${i + 1}行：無法創建分類「${rowData['分類']}」 - ${createError.message}`;
              console.error(errorMsg);
              errors.push(errorMsg);
              continue;
            }
          }
          
          // 構建菜品數據
          const dishData = {
            name: rowData['品名'].trim(),
            category: category._id,
            merchant: merchantId,
            price: basePrice,
            description: rowData['描述'] || '',
            isActive: true
          };
          
          // 收集當前行的選項數據，使用當前菜品的標題行
          const rowOptions = [];
          
          console.log(`解析菜品「${currentDishName}」的選項數據，標題欄位：${currentDishHeaders.slice(3).join(', ')}`);
          
          // 從第4個欄位開始（跳過分類、品名、基礎價格）
          let currentIndex = 3;
        
                  while (currentIndex < currentDishHeaders.length) {
            const currentHeader = currentDishHeaders[currentIndex];
            const currentValue = row[currentIndex] || '';
            
            // 如果當前欄位是選項名稱（不是數量、加價）
            if (currentHeader !== '數量' && currentHeader !== '加價' && currentValue && String(currentValue).trim() !== '') {
              const optionName = currentHeader;
              const optionValue = String(currentValue).trim();
              
              // 檢查是否為基礎庫存選項
              const isBaseInventory = optionValue === '基礎' || optionValue === 'base';
              
              let quantity = 0;
              let surcharge = 0;
              
              // 查找該選項後面的數量和加價
              if (currentIndex + 1 < currentDishHeaders.length && currentDishHeaders[currentIndex + 1] === '數量') {
                quantity = parseFloat(row[currentIndex + 1]) || 0;
                
                if (currentIndex + 2 < currentDishHeaders.length && currentDishHeaders[currentIndex + 2] === '加價') {
                  surcharge = parseFloat(row[currentIndex + 2]) || 0;
                }
              } else if (currentIndex + 1 < currentDishHeaders.length && currentDishHeaders[currentIndex + 1] === '加價') {
                // 如果沒有數量欄位，直接有加價欄位
                surcharge = parseFloat(row[currentIndex + 1]) || 0;
              }
              
              console.log(`解析選項：${optionName} = ${optionValue}，數量：${quantity}，加價：${surcharge}${isBaseInventory ? ' (基礎庫存)' : ''}`);
              
              // 收集選項數據
              rowOptions.push({
                name: optionName,
                value: optionValue,
                quantity: quantity,
                surcharge: surcharge,
                isBaseInventory: isBaseInventory
              });
              
              // 移動到下一個選項組
              if (currentIndex + 1 < currentDishHeaders.length && currentDishHeaders[currentIndex + 1] === '數量') {
                if (currentIndex + 2 < currentDishHeaders.length && currentDishHeaders[currentIndex + 2] === '加價') {
                  currentIndex += 3; // 跳過選項名稱、數量、加價
                } else {
                  currentIndex += 2; // 跳過選項名稱、數量
                }
              } else if (currentIndex + 1 < currentDishHeaders.length && currentDishHeaders[currentIndex + 1] === '加價') {
                currentIndex += 2; // 跳過選項名稱、加價
              } else {
                currentIndex += 1; // 只有選項名稱
              }
            } else {
              // 如果當前欄位不是選項名稱，跳到下一個
              currentIndex += 1;
            }
                    }
          
          // 將當前行的選項數據添加到全局收集器
          if (!dishOptionsCollector[dishData.name]) {
            dishOptionsCollector[dishData.name] = [];
          }
          dishOptionsCollector[dishData.name].push(...rowOptions);
          
          // 暫時不處理選項，先收集數據
          menuData.push(dishData);
          
          // 暫時不處理庫存，先收集數據
        } else {
          // 這不是菜品行，可能是選項數據行
          console.log(`第${i + 1}行：跳過非菜品行`);
          skippedRows++;
          continue;
        }
        
      } catch (error) {
        const errorMsg = `第${i + 1}行：處理失敗 - ${error.message}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }
    
    console.log(`數據解析完成：成功 ${menuData.length} 項，跳過 ${skippedRows} 行，錯誤 ${errors.length} 項`);
    
    // 處理選項配置 - 將收集的選項數據按菜品名稱分組
    console.log('開始處理選項配置...');
    console.log('收集到的選項數據：', dishOptionsCollector);
    
    // 為每個菜品處理選項配置
    for (const dishData of menuData) {
      const dishName = dishData.name;
      const collectedOptions = dishOptionsCollector[dishName] || [];
      
      if (collectedOptions.length > 0) {
        // 按選項名稱分組
        const optionGroups = {};
        
        // 分離基礎庫存選項和用戶選項
        const baseInventoryOptions = [];
        const userOptions = [];
        
        for (const option of collectedOptions) {
          if (option.isBaseInventory) {
            // 基礎庫存選項，不作為用戶可選擇的選項
            baseInventoryOptions.push(option);
          } else {
            // 用戶可選擇的選項
            userOptions.push(option);
          }
        }
        
        // 處理用戶可選擇的選項
        for (const option of userOptions) {
          const optionName = cleanOptionName(option.name); // 清理選項名稱，移除「選-」前綴
          
          if (!optionGroups[optionName]) {
            optionGroups[optionName] = {
              name: optionName,
              type: optionName === '珍珠' ? 'checkbox' : 'radio',
              required: optionName === '杯子',
              options: []
            };
          }
          
          // 創建選項
          let optionLabel = option.value;
          let optionValueKey = option.value.toLowerCase().replace(/\s+/g, '-');
          
          // 特殊處理珍珠選項
          if (optionName === '珍珠') {
            optionLabel = option.value === '有' ? '珍珠' : '無珍珠';
            optionValueKey = option.value === '有' ? 'pearl' : 'no-pearl';
          }
          
          const optionConfig = {
            label: optionLabel,
            value: optionValueKey,
            price: option.surcharge || 0,
            quantity: option.quantity || 0
          };
          
          // 檢查是否已存在相同值的選項
          const existingOption = optionGroups[optionName].options.find(opt => opt.value === optionValueKey);
          if (!existingOption) {
            optionGroups[optionName].options.push(optionConfig);
          }
        }
        
        // 將選項組轉換為選項配置
        const finalOptions = Object.values(optionGroups);
        console.log(`菜品「${dishName}」的選項配置：`, finalOptions);
        
        dishData.customOptions = finalOptions;
        
        // 處理庫存關聯配置
        const inventoryConfig = {
          baseInventory: [],
          conditionalInventory: []
        };
        
        console.log(`處理菜品「${dishName}」的庫存關聯，選項數量：${finalOptions.length}`);
        
        // 先處理基礎庫存選項
        console.log(`處理基礎庫存選項：${baseInventoryOptions.length} 項`);
        for (const baseOption of baseInventoryOptions) {
          const inventoryName = mapOptionToInventory(baseOption.name);
          console.log(`處理基礎庫存：${baseOption.name} -> 庫存：${inventoryName}`);
          
          const inventory = await findInventoryByName(inventoryName, merchantId);
          
          if (inventory) {
            console.log(`找到基礎庫存項目：${inventory.name} (ID: ${inventory._id})，類型：${inventory.type}`);
            
            if (inventory.type === 'single') {
              // 單一規格庫存
              inventoryConfig.baseInventory.push({
                inventoryId: inventory._id,
                inventoryValueId: inventory._id, // 單一庫存使用自身ID
                quantity: baseOption.quantity || 1
              });
              console.log(`添加基礎庫存（單一規格）：${inventory.name}，數量：${baseOption.quantity || 1}`);
            } else if (inventory.type === 'multiSpec') {
              // 多規格庫存，使用第一個規格作為預設
              if (inventory.multiSpecStock && inventory.multiSpecStock.length > 0) {
                const defaultSpec = inventory.multiSpecStock[0];
                inventoryConfig.baseInventory.push({
                  inventoryId: inventory._id,
                  inventoryValueId: defaultSpec._id,
                  quantity: baseOption.quantity || 1
                });
                console.log(`添加基礎庫存（多規格）：${inventory.name} - ${defaultSpec.specName}，數量：${baseOption.quantity || 1}`);
              } else {
                console.warn(`庫存 ${inventory.name} 沒有可用的規格`);
              }
            }
          } else {
            console.warn(`未找到基礎庫存項目：${inventoryName}`);
          }
        }
        
        // 根據選項值查找對應的庫存項目
        for (const optionConfig of finalOptions) {
          // 先查找對應的庫存項目
          const inventoryName = mapOptionToInventory(optionConfig.name);
          console.log(`映射選項：${optionConfig.name} -> 庫存：${inventoryName}`);
          
          const inventory = await findInventoryByName(inventoryName, merchantId);
          
          if (inventory) {
            console.log(`找到庫存項目：${inventory.name} (ID: ${inventory._id})，類型：${inventory.type}`);
            
            // 過濾掉數量為0或空的選項值
            const validOptions = optionConfig.options.filter(opt => 
              opt.quantity > 0 && opt.label && opt.label.trim() !== ''
            );
            
            console.log(`選項「${optionConfig.name}」的有效值：`, validOptions.map(opt => `${opt.label}(${opt.quantity})`));
            
            // 根據有效選項值的數量決定是基礎庫存還是條件庫存
            if (validOptions.length === 1) {
              // 只有一個有效值：基礎庫存
              const optionValue = validOptions[0];
              
              if (inventory.type === 'single') {
                // 單一規格庫存
                inventoryConfig.baseInventory.push({
                  inventoryId: inventory._id,
                  inventoryValueId: inventory._id, // 單一庫存使用自身ID
                  quantity: optionValue.quantity
                });
                console.log(`添加基礎庫存（單一規格）：${inventory.name}，數量：${optionValue.quantity}`);
              } else if (inventory.type === 'multiSpec') {
                // 多規格庫存，需要找到對應的規格
                const specValue = findInventorySpec(inventory, optionValue.label);
                if (specValue) {
                  inventoryConfig.baseInventory.push({
                    inventoryId: inventory._id,
                    inventoryValueId: specValue._id,
                    quantity: optionValue.quantity
                  });
                  console.log(`添加基礎庫存（多規格）：${inventory.name} - ${specValue.specName}，數量：${optionValue.quantity}`);
                } else {
                  console.warn(`未找到匹配的規格：${optionValue.label} 在庫存 ${inventory.name} 中`);
                }
              }
            } else if (validOptions.length > 1) {
              // 多個有效值：條件庫存（支援單一規格和多規格）
              console.log(`處理條件庫存：${inventory.name}（類型：${inventory.type}），選項：${optionConfig.name}，有效值：${validOptions.map(opt => `${opt.label}(${opt.quantity})`).join(', ')}`);
              
              const conditions = [];
              
              for (const optionValue of validOptions) {
                if (inventory.type === 'single') {
                  // 單一規格庫存：所有條件都指向同一個庫存項目，但數量不同
                  conditions.push({
                    optionType: optionConfig.name,
                    optionValue: optionValue.label,
                    inventoryValueId: inventory._id, // 單一庫存使用自身ID
                    quantity: optionValue.quantity
                  });
                  console.log(`添加條件（單一規格）：${optionConfig.name} = ${optionValue.label} -> ${inventory.name}，數量：${optionValue.quantity}`);
                } else if (inventory.type === 'multiSpec') {
                  // 多規格庫存：需要找到對應的規格
                  const specValue = findInventorySpec(inventory, optionValue.label);
                  if (specValue) {
                    conditions.push({
                      optionType: optionConfig.name,
                      optionValue: optionValue.label,
                      inventoryValueId: specValue._id,
                      quantity: optionValue.quantity
                    });
                    console.log(`添加條件（多規格）：${optionConfig.name} = ${optionValue.label} -> ${specValue.specName}，數量：${optionValue.quantity}`);
                  } else {
                    console.warn(`未找到匹配的規格：${optionValue.label} 在庫存 ${inventory.name} 中`);
                  }
                }
              }
              
              if (conditions.length > 0) {
                inventoryConfig.conditionalInventory.push({
                  inventoryId: inventory._id,
                  conditions: conditions
                });
                console.log(`添加條件庫存：${inventory.name}，條件數量：${conditions.length}，條件詳情：`, conditions.map(c => `${c.optionType}=${c.optionValue}(${c.quantity})`));
              }
            } else {
              console.log(`選項「${optionConfig.name}」沒有有效的值，跳過庫存配置`);
            }
          } else {
            console.warn(`未找到庫存項目：${inventoryName}`);
          }
        }
        
        if (inventoryConfig.baseInventory.length > 0 || inventoryConfig.conditionalInventory.length > 0) {
          dishData.inventoryConfig = inventoryConfig;
          
          // 調試：顯示最終的庫存配置
          console.log(`=== 菜品「${dishName}」的最終庫存配置 ===`);
          if (inventoryConfig.baseInventory.length > 0) {
            console.log('基礎庫存：', inventoryConfig.baseInventory.map(item => 
              `庫存ID: ${item.inventoryId}, 值ID: ${item.inventoryValueId}, 數量: ${item.quantity}`
            ));
          }
          if (inventoryConfig.conditionalInventory.length > 0) {
            console.log('條件庫存：', inventoryConfig.conditionalInventory.map(item => 
              `庫存ID: ${item.inventoryId}, 條件: ${item.conditions.map(c => 
                `${c.optionType}=${c.optionValue}(${c.quantity})`
              ).join(', ')}`
            ));
          }
          console.log('=====================================');
        }
      }
    }
    
    // 如果有錯誤，返回錯誤信息
    if (errors.length > 0) {
      return res.status(400).json({
        status: 'error',
        message: '匯入過程中發現錯誤',
        errors: errors,
        data: {
          processed: processedRows,
          skipped: skippedRows,
          errors: errors.length,
          valid: menuData.length
        }
      });
    }
    
    // 執行匯入
    console.log('開始執行菜單匯入...');
    const results = [];
    let created = 0;
    let updated = 0;
    let failed = 0;
    let deleted = 0;
    
    // 收集匯入表格中的所有菜品識別資訊
    const importedDishKeys = new Set();
    for (const dishData of menuData) {
      const key = `${dishData.name}-${dishData.category}`;
      importedDishKeys.add(key);
    }
    
    // 刪除不在匯入表格中的菜品
    console.log('檢查需要刪除的菜品...');
    
    // 獲取該商家所有現有菜品
    const existingDishes = await Dish.find({ merchant: merchantId });
    
    for (const existingDish of existingDishes) {
      const key = `${existingDish.name}-${existingDish.category}`;
      
      if (!importedDishKeys.has(key)) {
        try {
          await Dish.findByIdAndDelete(existingDish._id);
          results.push({
            name: existingDish.name,
            category: existingDish.category,
            success: true,
            action: 'deleted',
            id: existingDish._id
          });
          deleted++;
          console.log(`刪除菜品：${existingDish.name} (${existingDish.category})`);
        } catch (error) {
          console.error(`刪除菜品「${existingDish.name}」失敗:`, error);
          results.push({
            name: existingDish.name,
            category: existingDish.category,
            success: false,
            action: 'delete_failed',
            error: error.message
          });
          failed++;
        }
      }
    }
    
    for (const dishData of menuData) {
      try {
        // 檢查是否已存在同名菜品
        const existingDish = await Dish.findOne({
          name: dishData.name,
          category: dishData.category,
          merchant: merchantId
        });
        
        if (existingDish) {
          // 更新現有菜品
          const updatedDish = await Dish.findByIdAndUpdate(
            existingDish._id,
            dishData,
            { new: true, runValidators: true }
          );
          
          results.push({
            name: dishData.name,
            category: dishData.category,
            success: true,
            action: 'updated',
            id: updatedDish._id
          });
          updated++;
        } else {
          // 創建新菜品
          const newDish = await Dish.create(dishData);
          
          results.push({
            name: dishData.name,
            category: dishData.category,
            success: true,
            action: 'created',
            id: newDish._id
          });
          created++;
        }
             } catch (error) {
         console.error(`匯入菜品「${dishData.name}」失敗:`, error);
         results.push({
           name: dishData.name,
           category: dishData.category,
           success: false,
           error: error.message
         });
         failed++;
       }
    }
    
    // 清理暫存檔案
    try {
      fs.unlinkSync(req.file.path);
    } catch (error) {
      console.warn('清理暫存檔案失敗:', error);
    }
    
    console.log(`菜單匯入完成：新增 ${created} 項，更新 ${updated} 項，刪除 ${deleted} 項，失敗 ${failed} 項`);
    
    // 調試：顯示匯入結果摘要
    console.log('=== 匯入結果摘要 ===');
    for (const result of results) {
      if (result.success) {
        console.log(`✓ ${result.action}: ${result.name} (${result.category})`);
      } else {
        console.log(`✗ 失敗: ${result.name} (${result.category}) - ${result.error}`);
      }
    }
    console.log('===================');
    
    res.status(200).json({
      status: 'success',
      message: `菜單匯入完成：新增 ${created} 項，更新 ${updated} 項，刪除 ${deleted} 項，失敗 ${failed} 項`,
      data: {
        created,
        updated,
        deleted,
        failed,
        results
      }
    });
    
  } catch (error) {
    console.error('菜單匯入失敗:', error);
    
    // 清理暫存檔案
    try {
      if (req.file && req.file.path) {
        fs.unlinkSync(req.file.path);
      }
    } catch (cleanupError) {
      console.warn('清理暫存檔案失敗:', cleanupError);
    }
    
    return next(new AppError(`菜單匯入失敗：${error.message}`, 500));
  }
});

// 匯入菜品圖片
exports.importImages = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  
  if (!req.files || req.files.length === 0) {
    return next(new AppError('請選擇要匯入的圖片檔案', 400));
  }

  const results = [];
  let success = 0;
  let notFound = 0;
  let failed = 0;

  try {
    for (const file of req.files) {
      try {
        // 從檔案名提取菜品名稱（去除副檔名）
        // 處理中文文件名編碼問題
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const fileName = path.basename(originalName, path.extname(originalName));
        
        // 查找對應的菜品
        const dish = await Dish.findOne({
          name: fileName,
          merchant: merchantId
        });

        if (!dish) {
                  results.push({
          fileName: originalName,
          dishName: fileName,
          success: false,
          notFound: true,
          error: '未找到對應的菜品'
        });
          notFound++;
          continue;
        }

        // 獲取菜品的分類信息
        const category = await MenuCategory.findById(dish.category);
        if (!category) {
          results.push({
            fileName: originalName,
            dishName: dish.name,
            success: false,
            failed: true,
            error: '菜品分類不存在'
          });
          failed++;
          continue;
        }

        // 建立圖片目錄
        const categoryDir = getCategoryDir(merchantId, category.name);
        fs.mkdirSync(categoryDir, { recursive: true });

        // 生成新的檔案名
        const ext = path.extname(originalName);
        const newFileName = buildDishFilename(dish.name, dish._id, ext);
        const destinationPath = path.join(categoryDir, newFileName);

        // 移動檔案到目標目錄
        safeMoveFileSync(file.path, destinationPath);

        // 更新菜品的圖片路徑
        const imageUrl = `/uploads/menu/${toSlug(String(merchantId))}/${toSlug(category.name)}/${newFileName}`;
        await Dish.findByIdAndUpdate(dish._id, { image: imageUrl });

        results.push({
          fileName: originalName,
          dishName: dish.name,
          success: true,
          imageUrl: imageUrl
        });
        success++;

      } catch (error) {
        // 在 catch 塊中重新處理文件名，以防 originalName 未定義
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        const fileName = path.basename(originalName, path.extname(originalName));
        
        console.error(`處理圖片 ${originalName} 失敗:`, error);
        results.push({
          fileName: originalName,
          dishName: fileName,
          success: false,
          failed: true,
          error: error.message
        });
        failed++;
      }
    }

    // 清理未處理的暫存檔案
    req.files.forEach(file => {
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (error) {
        console.warn('清理暫存檔案失敗:', error);
      }
    });

    console.log(`圖片匯入完成：成功 ${success} 張，未找到菜品 ${notFound} 張，失敗 ${failed} 張`);

    res.status(200).json({
      status: 'success',
      message: `圖片匯入完成：成功 ${success} 張，未找到菜品 ${notFound} 張，失敗 ${failed} 張`,
      data: {
        success,
        notFound,
        failed,
        details: results
      }
    });

  } catch (error) {
    console.error('圖片匯入失敗:', error);
    
    // 清理暫存檔案
    req.files.forEach(file => {
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (cleanupError) {
        console.warn('清理暫存檔案失敗:', cleanupError);
      }
    });

    return next(new AppError(`圖片匯入失敗：${error.message}`, 500));
  }
});
