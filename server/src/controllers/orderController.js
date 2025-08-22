const mongoose = require('mongoose');
const XLSX = require('xlsx');
const Order = require('../models/order');
const Table = require('../models/table');
const Dish = require('../models/dish');
const inventoryService = require('../services/inventoryService');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

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
  // 否則使用當前登入的商家ID
  if (!req.merchant) {
    throw new AppError('無法獲取商家信息', 401);
  }
  return req.merchant.id;
};

// 創建新訂單或更新現有未結帳訂單
exports.createOrder = catchAsync(async (req, res, next) => {
  const { tableId, items, customerNotes } = req.body;

  // 驗證桌子是否存在且可用
  const table = await Table.findById(tableId).populate('merchant');
  if (!table) {
    return next(new AppError('桌子不存在', 404));
  }

  // 如果桌子狀態是 available，自動設為 occupied
  if (table.status === 'available') {
    await table.updateStatus('occupied', {
      customerName: null,
      customerCount: 1
    });
  } else if (table.status !== 'occupied') {
    return next(new AppError('桌子狀態不正確', 400));
  }

  // 獲取下一個批次號碼
  const nextBatchNumber = await Order.getNextBatchNumber(table._id);

  // 驗證商品並計算價格
  const validatedItems = [];
  let totalAmount = 0;

  for (const item of items) {
    console.log('處理訂單項目:', item);
    const dish = await Dish.findById(item.dishId);
    if (!dish) {
      return next(new AppError(`商品 ${item.dishId} 不存在`, 404));
    }
    
    console.log('找到菜品:', {
      _id: dish._id,
      name: dish.name,
      price: dish.price,
      customOptions: dish.customOptions
    });

    // 計算商品總價（包含選項價格）
    let unitPrice = dish.price;
    const selectedOptions = new Map();

    // 處理自定義選項
    if (item.selectedOptions && dish.customOptions) {
      for (const [optionName, optionValue] of Object.entries(item.selectedOptions)) {
        const customOption = dish.customOptions.find(opt => opt.name === optionName);
        if (customOption) {
          // 處理不同格式的 optionValue
          let valueToMatch = optionValue;
          let optionPrice = 0;
          
          // 如果 optionValue 是對象（從前端傳來的完整選項對象）
          if (typeof optionValue === 'object' && optionValue !== null) {
            valueToMatch = optionValue.value || optionValue.name || optionValue.label;
            optionPrice = optionValue.price || 0;
            
            // 直接使用前端傳來的價格，但仍需要驗證
            const optionChoice = customOption.options.find(choice => 
              choice.value === valueToMatch || choice.label === valueToMatch
            );
            if (optionChoice) {
              // 使用後端定義的價格作為最終價格（安全考量）
              unitPrice += optionChoice.price || 0;
              // 存儲完整的選項信息
              selectedOptions.set(optionName, optionValue);
            }
          } else {
            // 如果是字符串值，按原來的邏輯處理
            const optionChoice = customOption.options.find(choice => choice.value === valueToMatch);
            if (optionChoice && optionChoice.price) {
              unitPrice += optionChoice.price;
            }
            selectedOptions.set(optionName, optionValue);
          }
        }
      }
    }

    const itemTotal = unitPrice * item.quantity;
    totalAmount += itemTotal;

    validatedItems.push({
      dishId: dish._id,
      name: dish.name,
      quantity: item.quantity,
      unitPrice,
      totalPrice: itemTotal,
      selectedOptions,
      notes: item.notes || ''
    });
  }

  // 注意：庫存檢查、成本計算和庫存扣減將在後台確認訂單時進行
  // 這裡只創建訂單，不進行庫存相關操作

  // 創建新的批次訂單（帶重試機制）
  let order;
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      const orderNumber = await Order.generateOrderNumber(table._id, table.tableNumber);
      
      // 創建新的批次訂單
      order = new Order({
        orderNumber,
        tableId: table._id,
        tableNumber: table.tableNumber,
        merchantId: table.merchant._id,
        batchNumber: nextBatchNumber,
        isMainOrder: nextBatchNumber === 1,
        items: validatedItems,
        totalAmount,
        totalCost: 0, // 成本將在後台確認訂單時計算
        customerNotes: customerNotes || '',
        status: 'pending'
      });

      await order.save();
      break; // 成功保存，跳出循環
      
    } catch (error) {
      attempts++;
      
      // 如果是重複鍵錯誤，重試
      if (error.code === 11000 && error.keyValue && error.keyValue.orderNumber) {
        if (attempts >= maxAttempts) {
          return next(new AppError('訂單號碼生成失敗，請稍後重試', 500));
        }
        // 短暫延遲後重試
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        continue;
      }
      
      // 其他錯誤直接拋出
      throw error;
    }
  }

  // 注意：庫存扣減和成本計算將在後台確認訂單時進行
  // 這裡只創建訂單，不扣減庫存

  // 填充相關資料
  await order.populate([
    { path: 'tableId', select: 'tableNumber status' },
    { path: 'merchantId', select: 'name' },
    { path: 'items.dishId', select: 'name price category' }
  ]);

  res.status(201).json({
    status: 'success',
    data: {
      order,
      isUpdate: false
    }
  });
});

// 結帳功能 - 完成訂單並清空相關資料
exports.checkoutOrder = catchAsync(async (req, res, next) => {
  const { tableId } = req.body;

  // 驗證桌子是否存在
  const table = await Table.findById(tableId);
  if (!table) {
    return next(new AppError('桌子不存在', 404));
  }

  // 查找該桌子的未結帳訂單
  const order = await Order.findOne({
    tableId: table._id,
    status: { $in: ['pending', 'confirmed', 'preparing', 'ready', 'delivered'] }
  }).populate([
    { path: 'tableId', select: 'tableNumber status' },
    { path: 'merchantId', select: 'name' },
    { path: 'items.dishId', select: 'name price category' }
  ]);

  if (!order) {
    return next(new AppError('找不到待結帳的訂單', 404));
  }

  // 檢查訂單狀態，只有當訂單狀態為 'delivered'（已送出）時才能結帳
  if (order.status !== 'delivered') {
    return next(new AppError('訂單尚未送出，無法結帳。請等待所有餐點送出後再進行結帳。', 400));
  }

  // 更新訂單狀態為已完成
  await order.updateStatus('completed');

  // 購物車資料存儲在前端 sessionStorage 中，不需要後端清空
  // 前端會在結帳成功後自動清空購物車

  // 結帳完成後，自動將桌次狀態重置為可用
  await table.updateStatus('available');
  
  console.log(`桌次 ${table.tableNumber} 結帳完成，狀態已重置為可用`);
  
  res.status(200).json({
    status: 'success',
    message: '結帳成功',
    data: {
      order,
      totalAmount: order.totalAmount,
      completedAt: order.completedAt
    }
  });
});

// 獲取訂單詳情
exports.getOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate([
      { path: 'tableId', select: 'tableNumber status' },
      { path: 'merchantId', select: 'name' },
      { path: 'items.dishId', select: 'name price category image' }
    ]);

  if (!order) {
    return next(new AppError('訂單不存在', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      order
    }
  });
});

// 根據桌子獲取訂單列表
exports.getOrdersByTable = catchAsync(async (req, res, next) => {
  const { tableId } = req.params;
  const { status, limit = 10, page = 1 } = req.query;

  const query = { tableId };
  if (status) {
    // 處理多個狀態值，支援逗號分隔的字符串
    if (status.includes(',')) {
      query.status = { $in: status.split(',').map(s => s.trim()) };
    } else {
      query.status = status;
    }
  }

  const skip = (page - 1) * limit;

  const orders = await Order.find(query)
    .populate([
      { path: 'tableId', select: 'tableNumber status' },
      { path: 'merchantId', select: 'name' },
      { path: 'items.dishId', select: 'name price category image' }
    ])
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await Order.countDocuments(query);

  res.status(200).json({
    status: 'success',
    results: orders.length,
    data: {
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// 根據商家獲取訂單列表（後台用）
exports.getOrdersByMerchant = catchAsync(async (req, res, next) => {
  const { merchantId } = req.params;
  
  // 權限驗證：確保用戶只能查詢自己商家的訂單
  if (req.merchant && req.merchant._id.toString() !== merchantId) {
    return next(new AppError('您沒有權限訪問此商家的訂單', 403));
  }

  const { status, date, startDate, endDate, limit = 20, page = 1 } = req.query;

  // === 調試訊息：顯示查詢參數 ===
  console.log('\n=== 歷史訂單查詢調試 ===');
  console.log(`商家ID: ${merchantId}`);
  console.log(`查詢參數:`, { status, date, startDate, endDate, limit, page });

  const query = { merchantId };
  
  if (status) {
    // 處理逗號分隔的狀態參數
    if (status.includes(',')) {
      const statusArray = status.split(',').map(s => s.trim());
      query.status = { $in: statusArray };
    } else {
      query.status = status;
    }
  }

  // 優先使用時間範圍查詢，如果沒有則使用單一日期查詢
  // 對於已完成的訂單，使用 completedAt 字段
  if (startDate && endDate) {
    // 正確處理日期字符串，支援多種格式
    let start, end;
    
    // 檢查是否已經是完整的日期時間字符串
    if (startDate.includes('T') || startDate.includes('Z')) {
      start = new Date(startDate);
    } else {
      // 處理純日期字符串
      start = new Date(startDate + 'T00:00:00');
    }
    
    if (endDate.includes('T') || endDate.includes('Z')) {
      end = new Date(endDate);
    } else {
      // 處理純日期字符串
      end = new Date(endDate + 'T23:59:59.999');
    }
    
    // 驗證日期是否有效
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return next(new AppError('日期格式無效', 400));
    }
    
    query.completedAt = {
      $gte: start,
      $lte: end
    };

    // === 調試訊息：顯示時間範圍 ===
    console.log(`時間範圍查詢: ${startDate} 到 ${endDate}`);
    console.log(`轉換後時間: ${start.toISOString()} 到 ${end.toISOString()}`);
  } else if (date) {
    let startDate, endDate;
    
    // 檢查是否已經是完整的日期時間字符串
    if (date.includes('T') || date.includes('Z')) {
      startDate = new Date(date);
      endDate = new Date(date);
    } else {
      // 處理純日期字符串
      startDate = new Date(date + 'T00:00:00');
      endDate = new Date(date + 'T23:59:59.999');
    }
    
    // 驗證日期是否有效
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return next(new AppError('日期格式無效', 400));
    }
    
    query.completedAt = {
      $gte: startDate,
      $lte: endDate
    };

    // === 調試訊息：顯示單日查詢 ===
    console.log(`單日查詢: ${date}`);
    console.log(`轉換後時間: ${startDate.toISOString()} 到 ${endDate.toISOString()}`);
  }

  // === 調試訊息：顯示最終查詢條件 ===
  console.log(`最終查詢條件:`, JSON.stringify(query, null, 2));

  const skip = (page - 1) * limit;

  // === 調試：先獲取所有符合條件的訂單（不分頁） ===
  const allMatchingOrders = await Order.find(query)
    .populate([
      { path: 'tableId', select: 'tableNumber status' },
      { path: 'items.dishId', select: 'name price category image' }
    ])
    .select('+items.selectedOptions') // 確保選項信息被包含
    .sort({ createdAt: -1 });

  console.log(`\n=== 符合條件的所有訂單 (共 ${allMatchingOrders.length} 筆) ===`);
  allMatchingOrders.forEach((order, index) => {
    console.log(`\n訂單 ${index + 1}:`);
    console.log(`  收據號: ${order.receiptOrderNumber || '無'}`);
    console.log(`  訂單號: ${order.orderNumber}`);
    console.log(`  桌次: ${order.tableId?.tableNumber || '未知'}`);
    console.log(`  狀態: ${order.status}`);
    console.log(`  完成時間: ${order.completedAt}`);
    console.log(`  總金額: ${order.totalAmount}`);
    console.log(`  商品項目:`);
    order.items.forEach((item, itemIndex) => {
      console.log(`    項目 ${itemIndex + 1}: ${item.dishId?.name || '未知商品'} x${item.quantity} = $${item.price * item.quantity}`);
      if (item.selectedOptions && Object.keys(item.selectedOptions).length > 0) {
        console.log(`      選項:`, item.selectedOptions);
      }
      if (item.additionalPrice && item.additionalPrice > 0) {
        console.log(`      加價: $${item.additionalPrice}`);
      }
    });
  });

  const orders = await Order.find(query)
    .populate([
      { path: 'tableId', select: 'tableNumber status' },
      { path: 'items.dishId', select: 'name price category image' }
    ])
    .select('+items.selectedOptions') // 確保選項信息被包含
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(skip);

  const total = await Order.countDocuments(query);

  console.log(`\n=== 分頁結果 ===`);
  console.log(`當前頁: ${page}, 每頁: ${limit}, 總數: ${total}, 當前頁結果數: ${orders.length}`);

  res.status(200).json({
    status: 'success',
    results: orders.length,
    data: {
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// 更新訂單狀態
exports.updateOrderStatus = catchAsync(async (req, res, next) => {
  const { status, estimatedTime } = req.body;

  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(new AppError('訂單不存在', 404));
  }

  // 驗證狀態轉換的合法性
  const validTransitions = {
    'pending': ['confirmed', 'cancelled'],
    'confirmed': ['preparing', 'cancelled'],
    'preparing': ['ready', 'cancelled'],
    'ready': ['delivered', 'cancelled'],
    'delivered': ['completed'],
    'served': ['completed'],
    'completed': [],
    'cancelled': []
  };

  if (!validTransitions[order.status].includes(status)) {
    return next(new AppError(`無法從 ${order.status} 狀態轉換到 ${status} 狀態`, 400));
  }

  // 如果訂單被確認，執行庫存扣減和成本計算
  if (status === 'confirmed' && order.status === 'pending') {
    try {
      // 計算庫存消耗和成本
      let totalCost = 0;
      const allConsumptionDetails = [];
      
      for (const item of order.items) {
        try {
          // 轉換選項格式為庫存服務需要的格式
          const customOptions = [];
          if (item.selectedOptions) {
            for (const [optionName, optionValue] of item.selectedOptions.entries()) {
              if (typeof optionValue === 'object' && optionValue !== null) {
                customOptions.push({
                  type: optionName,
                  value: optionValue.value || optionValue.name || optionValue.label
                });
              } else {
                customOptions.push({
                  type: optionName,
                  value: optionValue
                });
              }
            }
          }

          const consumption = await inventoryService.calculateDishConsumption(
            item.dishId,
            customOptions
          );
          
          // 乘以數量
          const itemTotalCost = consumption.totalCost * item.quantity;
          totalCost += itemTotalCost;
          
          // 累積消耗詳情
          allConsumptionDetails.push({
            dishId: item.dishId,
            dishName: item.name,
            quantity: item.quantity,
            consumptionDetails: consumption.consumptionDetails,
            totalCost: itemTotalCost
          });
        } catch (error) {
          console.error(`計算菜品 ${item.name} 庫存消耗失敗:`, error);
          // 如果計算失敗，繼續處理其他菜品
        }
      }

      // 扣減庫存
      const deductionResults = await inventoryService.deductInventory(
        allConsumptionDetails.flatMap(item => 
          item.consumptionDetails.map(consumption => ({
            inventoryId: consumption.inventoryId,
            inventoryValueId: consumption.inventoryValueId,
            quantity: consumption.quantity * item.quantity
          }))
        )
      );

      // 檢查扣減結果
      const failedDeductions = deductionResults.filter(result => !result.success);
      if (failedDeductions.length > 0) {
        console.error('部分庫存扣減失敗:', failedDeductions);
        return next(new AppError('庫存不足，無法確認訂單', 400));
      }

      // 重新計算總成本（基於實際扣減的庫存）
      totalCost = allConsumptionDetails.reduce((total, item) => {
        return total + item.totalCost;
      }, 0);

      // 更新訂單的總成本
      order.totalCost = totalCost;
      await order.save();

      console.log(`訂單 ${order.orderNumber} 已確認，庫存扣減成功，總成本：${totalCost}`);
    } catch (error) {
      console.error('確認訂單時庫存扣減失敗:', error);
      return next(new AppError('確認訂單失敗：庫存處理錯誤', 500));
    }
  }

  // 如果訂單被取消，需要恢復庫存（如果之前已經扣減過）
  if (status === 'cancelled' && order.status === 'confirmed') {
    try {
      // 這裡可以實現庫存恢復邏輯
      // 暫時只記錄日誌
      console.log(`訂單 ${order.orderNumber} 已取消，需要恢復庫存`);
    } catch (error) {
      console.error('取消訂單時庫存恢復失敗:', error);
      // 不阻止訂單取消，只記錄錯誤
    }
  }

  await order.updateStatus(status);

  if (estimatedTime !== undefined) {
    order.estimatedTime = estimatedTime;
    await order.save();
  }

  // 重新獲取更新後的訂單
  const updatedOrder = await Order.findById(order._id)
    .populate([
      { path: 'tableId', select: 'tableNumber status' },
      { path: 'merchantId', select: 'name' },
      { path: 'items.dishId', select: 'name price category image' }
    ]);

  res.status(200).json({
    status: 'success',
    data: {
      order: updatedOrder
    }
  });
});

// 取消訂單
exports.cancelOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    return next(new AppError('訂單不存在', 404));
  }

  if (order.status === 'served' || order.status === 'completed') {
    return next(new AppError('已完成的訂單無法取消', 400));
  }

  await order.updateStatus('cancelled');

  res.status(200).json({
    status: 'success',
    message: '訂單已取消'
  });
});

// 獲取訂單統計
exports.getOrderStats = catchAsync(async (req, res, next) => {
  const { merchantId } = req.params;
  const { date, startDate, endDate } = req.query;

  let matchQuery = { merchantId: new mongoose.Types.ObjectId(merchantId) };

  // 支援單一日期查詢 - 使用 completedAt 而不是 createdAt
  if (date) {
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);
    matchQuery.completedAt = {
      $gte: startDate,
      $lt: endDate
    };
  }
  
  // 支援日期範圍查詢 - 使用 completedAt 而不是 createdAt
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1); // 包含結束日期
    matchQuery.completedAt = {
      $gte: start,
      $lt: end
    };
  } else {
    // 默認計算今日結帳的訂單
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    matchQuery.completedAt = {
      $gte: todayStart,
      $lte: todayEnd
    };
  }
  
  // 添加調試日誌
  console.log('getOrderStats - 查詢條件:', JSON.stringify(matchQuery, null, 2))
  console.log('getOrderStats - 總訂單數:', totalOrders)
  
  // 計算營業額 - 使用 completedAt 過濾已完成的訂單
  const totalRevenue = await Order.aggregate([
    { 
      $match: { 
        merchantId: new mongoose.Types.ObjectId(merchantId),
        status: { $in: ['completed'] }, // 只計算已完成的訂單
        ...(date ? {
          completedAt: {
            $gte: new Date(date),
            $lt: new Date(new Date(date).setDate(new Date(date).getDate() + 1))
          }
        } : {}),
        ...(startDate && endDate ? {
          completedAt: {
            $gte: new Date(startDate),
            $lt: new Date(new Date(endDate).setDate(new Date(endDate).getDate() + 1))
          }
        } : {})
      } 
    },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);

  // 獲取客人數量 - 使用 completedAt 過濾已完成的訂單
  let customerMatchQuery = {
    merchantId: new mongoose.Types.ObjectId(merchantId),
    status: { $in: ['completed', 'cancelled'] }
  };
  
  if (date) {
    // 如果指定了日期，使用該日期
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);
    customerMatchQuery.completedAt = {
      $gte: startDate,
      $lt: endDate
    };
  } else if (startDate && endDate) {
    // 如果指定了日期範圍，使用該範圍
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);
    customerMatchQuery.completedAt = {
      $gte: start,
      $lt: end
    };
  } else {
    // 默認計算今日結帳的訂單
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    customerMatchQuery.completedAt = {
      $gte: todayStart,
      $lte: todayEnd
    };
  }
  
  const customerStats = await Order.aggregate([
    { 
      $match: customerMatchQuery
    },
    {
      $lookup: {
        from: 'tables',
        localField: 'tableId',
        foreignField: '_id',
        as: 'tableInfo'
      }
    },
    {
      $unwind: '$tableInfo'
    },
    {
      $group: {
        _id: '$tableId',
        tableCapacity: { $first: '$tableInfo.capacity' },
        orderCount: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: null,
        totalCustomers: { $sum: { $multiply: ['$tableCapacity', '$orderCount'] } }
      }
    }
  ]);
  
  // 添加調試日誌
  console.log('getOrderStats - 客人統計結果:', customerStats)
  console.log('getOrderStats - 總客人數:', customerStats[0]?.totalCustomers || 0)

  res.status(200).json({
    status: 'success',
    data: {
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      totalCustomers: customerStats[0]?.totalCustomers || 0,
      statusBreakdown: stats
    }
  });
});

// 獲取桌子的所有批次訂單
exports.getTableBatches = catchAsync(async (req, res, next) => {
  const { tableId } = req.params;

  const batches = await Order.getAllBatchesByTable(tableId);
  
  // 填充相關資料
  await Order.populate(batches, [
    { path: 'tableId', select: 'tableNumber status' },
    { path: 'items.dishId', select: 'name price category image' }
  ]);

  const totalAmount = await Order.calculateTableTotal(tableId);

  res.status(200).json({
    status: 'success',
    data: {
      batches,
      totalAmount,
      batchCount: batches.length
    }
  });
});

// 生成10位隨機數字收據號碼
function generateReceiptNumber() {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString();
}

// 桌次結帳功能 - 合併所有批次進行結帳
exports.checkoutTable = catchAsync(async (req, res, next) => {
  const { tableId } = req.params;
  
  console.log('=== checkoutTable 調用調試信息 ===');
  console.log('桌次ID:', tableId);
  console.log('調用時間:', new Date().toISOString());
  
  // 使用 Order 模型的靜態方法合併桌次數據
  const mergedData = await Order.mergeBatchesForCheckout(tableId);
  
  if (!mergedData) {
    return next(new AppError('此桌次目前沒有任何訂單可以結帳', 404));
  }
  
  console.log('合併的桌次數據:', {
    tableId: mergedData.tableId,
    tableNumber: mergedData.tableNumber,
    batchCount: mergedData.batchCount,
    totalAmount: mergedData.totalAmount,
    itemsCount: mergedData.allItems.length
  });
  
  // 檢查是否有未送出的訂單（狀態不是 'delivered'）
  const hasUndeliveredOrders = mergedData.batches.some(batch => batch.status !== 'delivered');
  
  if (hasUndeliveredOrders) {
    // 找出未送出的訂單批次
    const undeliveredBatches = mergedData.batches
      .filter(batch => batch.status !== 'delivered')
      .map(batch => `批次 ${batch.batchNumber} (${batch.status})`)
      .join('\n');
    
    console.log('發現未送出的訂單，無法結帳:', undeliveredBatches);
    return next(new AppError(`無法結帳：以下訂單尚未送出\n${undeliveredBatches}\n\n請等待所有餐點送出後再進行結帳。`, 400));
  }
  
  console.log('所有訂單都已送出，可以進行結帳');
  
  // 生成收據號碼
  const receiptNumber = generateReceiptNumber();
  console.log('生成的收據號碼:', receiptNumber);
  
  // 更新所有相關訂單的收據號碼和狀態
  const orderIds = mergedData.batches.map(batch => batch._id || batch.id);
  console.log('需要更新的訂單ID:', orderIds);
  
  // 批量更新所有訂單
  const updateResult = await Order.updateMany(
    { _id: { $in: orderIds } },
    { 
      $set: { 
        receiptOrderNumber: receiptNumber,
        status: 'completed',
        completedAt: new Date()
      }
    }
  );
  
  console.log('訂單更新結果:', {
    matchedCount: updateResult.matchedCount,
    modifiedCount: updateResult.modifiedCount
  });
  
  // 構建訂單數據，包含必要的ID信息
  const orderData = {
    tableId: mergedData.tableId,
    tableNumber: mergedData.tableNumber,
    merchantId: mergedData.merchantId,
    batches: mergedData.batches,
    allItems: mergedData.allItems,
    totalAmount: mergedData.totalAmount,
    batchCount: mergedData.batchCount,
    // 添加主要訂單的ID信息（使用第一個批次）
    orderId: mergedData.batches[0]._id || mergedData.batches[0].id,
    orderNumber: mergedData.batches[0].orderNumber,
    // 添加收據號碼
    receiptOrderNumber: receiptNumber
  };
  
  // 添加調試日誌來檢查批次數據結構
  console.log('第一個批次數據:', {
    _id: mergedData.batches[0]._id,
    id: mergedData.batches[0].id,
    orderNumber: mergedData.batches[0].orderNumber,
    tableNumber: mergedData.batches[0].tableNumber
  });
  
  console.log('返回的訂單數據包含ID信息:', {
    orderId: orderData.orderId,
    orderNumber: orderData.orderNumber,
    receiptOrderNumber: orderData.receiptOrderNumber,
    tableNumber: orderData.tableNumber,
    totalAmount: orderData.totalAmount
  });
  
  // 結帳完成後，自動將桌次狀態重置為可用
  const table = await Table.findById(tableId);
  if (table) {
    await table.updateStatus('available');
    console.log(`桌次 ${table.tableNumber} 結帳完成，狀態已重置為可用`);
  } else {
    console.log(`找不到桌次 ${tableId}，無法更新狀態`);
  }
  
  res.status(200).json({
    status: 'success',
    data: orderData
  });
});

// 獲取桌子當前總金額
exports.getTableTotal = catchAsync(async (req, res, next) => {
  const { tableId } = req.params;

  const totalAmount = await Order.calculateTableTotal(tableId);
  const batches = await Order.getAllBatchesByTable(tableId);

  // 檢查是否有未送出的訂單（狀態不是 'delivered'）
  const hasUndeliveredOrders = batches.some(batch => batch.status !== 'delivered');
  const canCheckout = !hasUndeliveredOrders && batches.length > 0;

  res.status(200).json({
    status: 'success',
    data: {
      tableId,
      totalAmount,
      batchCount: batches.length,
      hasUndeliveredOrders,
      canCheckout,
      orderStatuses: batches.map(batch => ({
        batchNumber: batch.batchNumber,
        status: batch.status,
        orderNumber: batch.orderNumber
      }))
    }
  });
});

// 匯出歷史訂單
exports.exportHistoryOrders = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  const { startDate, endDate, searchTerm, format = 'xlsx' } = req.query;

  console.log('=== 匯出調試信息 ===');
  console.log('商家ID:', merchantId);
  console.log('開始日期:', startDate);
  console.log('結束日期:', endDate);
  console.log('搜尋詞:', searchTerm);

  // 建立查詢條件 - 匯出所有歷史訂單（包括已完成和已取消）
  const query = { 
    merchantId, 
    status: { $in: ['completed', 'cancelled'] } // 匯出已完成和已取消的訂單
  };

  // 時間範圍過濾 - 將本地時間轉換為 UTC 時間進行查詢
  if (startDate && endDate) {
    let start, end;
    
    if (startDate.includes('T') || startDate.includes('Z')) {
      // 如果已經是完整的日期時間字符串，直接使用
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      // 處理純日期字符串：使用與前端一致的時區轉換邏輯
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      // 台灣時區是 UTC+8，所以需要減去 8 小時來轉換為 UTC
      const taiwanTimezoneOffset = 8 * 60; // 8小時 = 480分鐘
      
      // 構建台灣本地時間的開始和結束
      const taiwanStart = new Date(startDateObj.getFullYear(), startDateObj.getMonth(), startDateObj.getDate());
      const taiwanEnd = new Date(endDateObj.getFullYear(), endDateObj.getMonth(), endDateObj.getDate(), 23, 59, 59, 999);
      
      // 轉換為 UTC 時間：台灣時間 - 8小時 = UTC 時間
      start = new Date(taiwanStart.getTime() - (taiwanTimezoneOffset * 60 * 1000));
      end = new Date(taiwanEnd.getTime() - (taiwanTimezoneOffset * 60 * 1000));
    }
    
    // 驗證日期是否有效
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return next(new AppError('日期格式無效', 400));
    }
    
    console.log('匯出查詢時間範圍:', {
      localDate: startDate,
      utcStart: start.toISOString(),
      utcEnd: end.toISOString(),
      timezoneOffset: new Date().getTimezoneOffset()
    });
    
    query.$or = [
      { completedAt: { $gte: start, $lte: end } },
      { createdAt: { $gte: start, $lte: end } }
    ];
  } else if (startDate) {
    // 只有開始日期時，查詢當天的所有訂單
    let start, end;
    
    if (startDate.includes('T') || startDate.includes('Z')) {
      // 如果已經是完整的日期時間字符串，轉換為當天 UTC 範圍
      const dateObj = new Date(startDate);
      const timezoneOffset = dateObj.getTimezoneOffset();
      
      const localStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
      const localEnd = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59, 999);
      
      start = new Date(localStart.getTime() + (timezoneOffset * 60 * 1000));
      end = new Date(localEnd.getTime() + (timezoneOffset * 60 * 1000));
    } else {
      // 處理純日期字符串，使用與前端一致的時區轉換邏輯
      const dateObj = new Date(startDate);
      
      // 台灣時區是 UTC+8，所以需要減去 8 小時來轉換為 UTC
      const taiwanTimezoneOffset = 8 * 60; // 8小時 = 480分鐘
      
      const taiwanStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
      const taiwanEnd = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59, 999);
      
      start = new Date(taiwanStart.getTime() - (taiwanTimezoneOffset * 60 * 1000));
      end = new Date(taiwanEnd.getTime() - (taiwanTimezoneOffset * 60 * 1000));
    }
    
    // 驗證日期是否有效
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return next(new AppError('日期格式無效', 400));
    }
    
    console.log('匯出查詢時間範圍:', {
      localDate: startDate,
      utcStart: start.toISOString(),
      utcEnd: end.toISOString(),
      timezoneOffset: new Date().getTimezoneOffset()
    });
    
    query.$or = [
      { completedAt: { $gte: start, $lte: end } },
      { createdAt: { $gte: start, $lte: end } }
    ];
  }

  // 搜尋過濾
  if (searchTerm) {
    const searchQuery = {
      $or: [
        { tableOrderNumber: { $regex: searchTerm, $options: 'i' } },
        { tableNumber: { $regex: searchTerm, $options: 'i' } }
      ]
    };
    // 合併搜尋條件
    Object.assign(query, searchQuery);
  }

  console.log('查詢條件:', JSON.stringify(query, null, 2));

  // 獲取商家信息
  const Merchant = require('../models/merchant');
  const merchant = await Merchant.findById(merchantId).select('businessName');
  
  if (!merchant) {
    return next(new AppError('找不到商家信息', 404));
  }

  // 獲取訂單數據
  const orders = await Order.find(query)
    .populate([
      { path: 'tableId', select: 'tableNumber status tableCapacity' },
      { path: 'items.dishId', select: 'name price category' }
    ])
    .select('+items.selectedOptions')
    .sort({ createdAt: -1 });

  console.log('=== 匯出訂單詳細信息 ===');
  console.log('找到訂單數量:', orders.length);
  
  // 顯示前5筆訂單的詳細信息用於比對
  if (orders.length > 0) {
    console.log('前5筆訂單詳細信息:');
    orders.slice(0, 5).forEach((order, index) => {
      console.log(`訂單 ${index + 1}:`, {
        id: order._id,
        orderNumber: order.orderNumber,
        tableOrderNumber: order.tableOrderNumber,
        receiptOrderNumber: order.receiptOrderNumber,
        status: order.status,
        createdAt: order.createdAt,
        completedAt: order.completedAt,
        tableNumber: order.tableId?.tableNumber || order.tableNumber,
        itemsCount: order.items?.length || 0,
        totalAmount: order.totalAmount
      });
    });
    
    // 顯示時間範圍統計
    const completedOrders = orders.filter(o => o.completedAt);
    const createdOrders = orders.filter(o => o.createdAt);
    
    console.log('時間範圍統計:', {
      totalOrders: orders.length,
      completedOrders: completedOrders.length,
      createdOrders: createdOrders.length,
      timeRange: startDate && endDate ? `${startDate} 到 ${endDate}` : startDate ? `單日 ${startDate}` : '無時間限制'
    });
    
    // 顯示每個訂單的本地時間轉換
    console.log('訂單時間轉換示例:');
    orders.slice(0, 3).forEach((order, index) => {
      const utcCreated = order.createdAt;
      const utcCompleted = order.completedAt;
      const localCreated = utcCreated ? new Date(utcCreated).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : 'N/A';
      const localCompleted = utcCompleted ? new Date(utcCompleted).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : 'N/A';
      
      console.log(`訂單 ${index + 1} 時間轉換:`, {
        orderNumber: order.orderNumber,
        utcCreated: utcCreated?.toISOString(),
        localCreated,
        utcCompleted: utcCompleted?.toISOString(),
        localCompleted
      });
    });
  }

  if (orders.length === 0) {
    // 如果沒有找到訂單，嘗試查找所有訂單來調試
    const allOrders = await Order.find({ merchantId }).limit(5);
    console.log('該商家的所有訂單樣本:', allOrders.map(o => ({
      id: o._id,
      status: o.status,
      createdAt: o.createdAt,
      completedAt: o.completedAt,
      tableOrderNumber: o.tableOrderNumber
    })));
    
    // 提供更詳細的錯誤信息
    const errorMessage = startDate 
      ? `沒有找到 ${startDate} 的已完成或已取消訂單。請檢查日期是否正確，或嘗試選擇其他日期範圍。`
      : '沒有找到符合條件的訂單。請檢查查詢條件。';
    
    return next(new AppError(errorMessage, 404));
  }

  // 準備匯出數據 - 按收據號和結帳時間分組，並合併相同菜品
  const exportData = [];
  const groupedOrders = new Map(); // 用於分組的 Map
  
  orders.forEach(order => {
    // 轉換為台灣本地時間 (UTC+8)
    const orderTime = order.completedAt ? 
      new Date(order.completedAt).toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Taipei'
      }) : '';

    // 創建分組鍵：收據號 + 結帳時間
    const receiptNumber = order.receiptOrderNumber || '';
    const groupKey = `${receiptNumber}_${orderTime}`;
    
    if (!groupedOrders.has(groupKey)) {
      groupedOrders.set(groupKey, {
        receiptNumber: receiptNumber,
        orderTime: orderTime,
        tableNumber: order.tableNumber || (order.tableId ? order.tableId.tableNumber : '未知'),
        items: new Map() // 使用 Map 來合併相同菜品
      });
    }
    
    const group = groupedOrders.get(groupKey);
    
    // 處理訂單項目 - 合併相同菜品
    if (order.items && order.items.length > 0) {
      order.items.forEach(item => {
        // 處理選項顯示
        let optionsText = '';
        if (item.selectedOptions) {
          const options = [];
          if (item.selectedOptions instanceof Map) {
            for (const [key, value] of item.selectedOptions.entries()) {
              if (typeof value === 'object' && value !== null && value.name) {
                options.push(`${key}:${value.name}`);
              } else {
                options.push(`${key}:${value}`);
              }
            }
          } else if (typeof item.selectedOptions === 'object') {
            for (const [key, value] of Object.entries(item.selectedOptions)) {
              if (key.startsWith('$')) continue; // 跳過 MongoDB 元數據
              if (typeof value === 'object' && value !== null && value.name) {
                options.push(`${key}:${value.name}`);
              } else {
                options.push(`${key}:${value}`);
              }
            }
          }
          optionsText = options.join(', ');
        }

        // 創建菜品唯一鍵：菜品名稱 + 選項 + 備註
        const itemKey = `${item.name}_${optionsText}_${item.notes || ''}`;
        
        if (group.items.has(itemKey)) {
          // 合併相同菜品
          const existingItem = group.items.get(itemKey);
          existingItem['數量'] += item.quantity;
          existingItem['小計'] += (item.totalPrice || (item.unitPrice * item.quantity));
        } else {
          // 新增菜品
          group.items.set(itemKey, {
            '商品名稱': item.name,
            '數量': item.quantity,
            '單價': item.unitPrice,
            '小計': item.totalPrice || (item.unitPrice * item.quantity),
            '選項': optionsText,
            '備註': item.notes || ''
          });
        }
      });
    }
  });
  
  // 將分組後的數據轉換為匯出格式
  const mergedRanges = []; // 記錄需要合併的儲存格範圍
  let currentRow = 2; // Excel 從第2行開始（第1行是標題）
  
  groupedOrders.forEach(group => {
    if (group.items.size > 0) {
      const startRow = currentRow;
      
      // 將 Map 轉換為陣列並按菜品名稱排序
      const sortedItems = Array.from(group.items.values()).sort((a, b) => 
        a['商品名稱'].localeCompare(b['商品名稱'])
      );
      
      sortedItems.forEach((item, index) => {
        exportData.push({
          '收據號': group.receiptNumber, // 每行都填入，但會合併
          '桌號': group.tableNumber, // 每行都填入，但會合併
          '結帳時間': group.orderTime, // 每行都填入，但會合併
          '商品名稱': item['商品名稱'],
          '數量': item['數量'],
          '單價': item['單價'],
          '小計': item['小計'],
          '選項': item['選項'],
          '備註': item['備註']
        });
        currentRow++;
      });
      
      const endRow = currentRow - 1;
      
      // 如果有多行，記錄合併範圍
      if (endRow > startRow) {
        mergedRanges.push(
          { s: { r: startRow - 1, c: 0 }, e: { r: endRow - 1, c: 0 } }, // 收據號 (A列)
          { s: { r: startRow - 1, c: 1 }, e: { r: endRow - 1, c: 1 } }, // 桌號 (B列)
          { s: { r: startRow - 1, c: 2 }, e: { r: endRow - 1, c: 2 } }  // 結帳時間 (C列)
        );
      }
    } else {
      // 如果沒有項目，至少匯出訂單基本資訊
      exportData.push({
        '收據號': group.receiptNumber,
        '桌號': group.tableNumber,
        '結帳時間': group.orderTime,
        '商品名稱': '',
        '數量': '',
        '單價': '',
        '小計': '',
        '選項': '',
        '備註': ''
      });
      currentRow++;
    }
  });

  // 根據匯出範圍生成檔案名稱
  let fileName;
  
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // 判斷匯出範圍類型
    if (startDate === endDate || (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth() && start.getDate() === end.getDate())) {
      // 單日匯出：年月日-餐廳名稱-歷史訂單
      const dateStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
      fileName = `${dateStr}-${merchant.businessName}-歷史訂單`;
    } else if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      // 整月匯出：年月-餐廳名稱-歷史訂單
      const monthStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      fileName = `${monthStr}-${merchant.businessName}-歷史訂單`;
    } else if (start.getFullYear() === end.getFullYear()) {
      // 整年匯出：年-餐廳名稱-歷史訂單
      const yearStr = `${start.getFullYear()}`;
      fileName = `${yearStr}-${merchant.businessName}-歷史訂單`;
    } else {
      // 其他情況：使用日期範圍
      const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
      const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
      fileName = `${startStr}_${endStr}-${merchant.businessName}-歷史訂單`;
    }
  } else {
    // 預設檔案名稱
    const now = new Date();
    const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
    fileName = `${dateStr}-${merchant.businessName}-歷史訂單`;
  }
  
  // 添加檔案名稱到響應標頭中，供前端使用
  res.setHeader('X-File-Name', encodeURIComponent(fileName));

  if (format === 'csv') {
    // 匯出 CSV
    const csvContent = convertToCSV(exportData);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    // 對檔案名稱進行 URL 編碼以支援中文
    const encodedFileName = encodeURIComponent(`${fileName}.csv`);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
    res.send('\ufeff' + csvContent); // 添加 BOM 以支援中文
  } else {
    // 匯出 Excel
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    
    // 設定欄寬
    const columnWidths = [
      { wch: 12 }, // 收據號 (10位數字)
      { wch: 10 }, // 桌號
      { wch: 20 }, // 結帳時間
      { wch: 20 }, // 商品名稱
      { wch: 8 },  // 數量
      { wch: 10 }, // 單價
      { wch: 12 }, // 小計
      { wch: 30 }, // 選項
      { wch: 20 }  // 備註
    ];
    worksheet['!cols'] = columnWidths;
    
    // 設定合併儲存格
    if (mergedRanges && mergedRanges.length > 0) {
      worksheet['!merges'] = mergedRanges;
    }

    // 設定樣式：框線和文字居中
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    
    // 為所有有數據的儲存格設定樣式
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = worksheet[cellAddress];
        
        if (cell) {
          // 設定儲存格樣式
          cell.s = {
            // 框線樣式
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } }
            },
            // 對齊方式：水平居中，垂直居中
            alignment: {
              horizontal: 'center',
              vertical: 'center',
              wrapText: true
            },
            // 字體樣式
            font: {
              name: '微軟正黑體',
              sz: 11
            }
          };
        }
      }
    }

    // 設定工作表樣式
    worksheet['!rows'] = [];
    for (let R = range.s.r; R <= range.e.r; R++) {
      worksheet['!rows'][R] = { hpt: 25 }; // 設定行高
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, '歷史訂單');
    
    // 設定回應標頭
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    // 對檔案名稱進行 URL 編碼以支援中文
    const encodedFileName = encodeURIComponent(`${fileName}.xlsx`);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
    
    // 寫入回應
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.send(buffer);
  }
});

// 輔助函數：轉換為 CSV 格式
function convertToCSV(data) {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  // 添加標題行
  csvRows.push(headers.join(','));
  
  // 添加數據行
  for (const row of data) {
    const values = headers.map(header => {
      const value = row[header];
      // 如果值包含逗號、引號或換行符，需要用引號包圍
      if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvRows.push(values.join(','));
  }
  
  return csvRows.join('\n');
}
