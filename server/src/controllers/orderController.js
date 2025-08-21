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
    status: { $in: ['pending', 'confirmed', 'preparing', 'ready'] }
  }).populate([
    { path: 'tableId', select: 'tableNumber status' },
    { path: 'merchantId', select: 'name' },
    { path: 'items.dishId', select: 'name price category' }
  ]);

  if (!order) {
    return next(new AppError('找不到待結帳的訂單', 404));
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

  const { status, date, limit = 20, page = 1 } = req.query;

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

  if (date) {
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);
    query.createdAt = {
      $gte: startDate,
      $lt: endDate
    };
  }

  const skip = (page - 1) * limit;

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
  }

  const stats = await Order.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' }
      }
    }
  ]);

  // 計算訂單數量 - 使用 completedAt 過濾已完成的訂單
  let totalOrders;
  if (date) {
    // 如果指定了日期，使用該日期
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);
    totalOrders = await Order.countDocuments({
      merchantId: new mongoose.Types.ObjectId(merchantId),
      status: { $in: ['completed', 'cancelled'] },
      completedAt: {
        $gte: startDate,
        $lt: endDate
      }
    });
  } else if (startDate && endDate) {
    // 如果指定了日期範圍，使用該範圍
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);
    totalOrders = await Order.countDocuments({
      merchantId: new mongoose.Types.ObjectId(merchantId),
      status: { $in: ['completed', 'cancelled'] },
      completedAt: {
        $gte: start,
        $lt: end
      }
    });
  } else {
    // 默認計算今日結帳的訂單
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    totalOrders = await Order.countDocuments({
      merchantId: new mongoose.Types.ObjectId(merchantId),
      status: { $in: ['completed', 'cancelled'] },
      completedAt: {
        $gte: todayStart,
        $lte: todayEnd
      }
    });
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

  res.status(200).json({
    status: 'success',
    data: {
      tableId,
      totalAmount,
      batchCount: batches.length
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

  // 時間範圍過濾 - 使用 createdAt 作為備選
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999); // 設定為當天結束時間
    query.$or = [
      { completedAt: { $gte: start, $lte: end } },
      { createdAt: { $gte: start, $lte: end } }
    ];
  } else if (startDate) {
    const start = new Date(startDate);
    const end = new Date(startDate);
    end.setHours(23, 59, 59, 999);
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

  console.log('找到訂單數量:', orders.length);

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

  // 準備匯出數據
  const exportData = [];
  
  orders.forEach(order => {
    const orderTime = order.completedAt ? 
      new Date(order.completedAt).toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }) : '';

    // 處理訂單項目
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

        exportData.push({
          '訂單號': order.tableOrderNumber || order.orderNumber,
          '桌號': order.tableNumber || (order.tableId ? order.tableId.tableNumber : '未知'),
          '結帳時間': orderTime,
          '總金額': order.totalAmount,
          '桌位容量': order.tableId ? order.tableId.tableCapacity : '',
          '商品名稱': item.name,
          '數量': item.quantity,
          '單價': item.unitPrice,
          '小計': item.totalPrice || (item.unitPrice * item.quantity),
          '選項': optionsText,
          '備註': item.notes || ''
        });
      });
    } else {
      // 如果沒有項目，至少匯出訂單基本資訊
      exportData.push({
        '訂單號': order.tableOrderNumber || order.orderNumber,
        '桌號': order.tableNumber || (order.tableId ? order.tableId.tableNumber : '未知'),
        '結帳時間': orderTime,
        '總金額': order.totalAmount,
        '桌位容量': order.tableId ? order.tableId.tableCapacity : '',
        '商品名稱': '',
        '數量': '',
        '單價': '',
        '小計': '',
        '選項': '',
        '備註': ''
      });
    }
  });

  // 生成檔案名稱：年月日-餐廳名稱-歷史訂單
  const now = new Date();
  const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
  const timeStr = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
  const fileName = `${dateStr}-${merchant.businessName}-歷史訂單`;
  
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
      { wch: 15 }, // 訂單號
      { wch: 10 }, // 桌號
      { wch: 20 }, // 結帳時間
      { wch: 12 }, // 總金額
      { wch: 12 }, // 桌位容量
      { wch: 20 }, // 商品名稱
      { wch: 8 },  // 數量
      { wch: 10 }, // 單價
      { wch: 12 }, // 小計
      { wch: 30 }, // 選項
      { wch: 20 }  // 備註
    ];
    worksheet['!cols'] = columnWidths;

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
