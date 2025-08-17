const mongoose = require('mongoose');
const Order = require('../models/order');
const Table = require('../models/table');
const Dish = require('../models/dish');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');

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

  // 檢查是否已有未結帳的訂單
  let existingOrder = await Order.findOne({
    tableId: table._id,
    status: { $in: ['pending', 'confirmed', 'preparing', 'ready'] }
  }).sort({ createdAt: -1 });

  // 驗證商品並計算價格
  const validatedItems = [];
  let totalAmount = 0;

  for (const item of items) {
    const dish = await Dish.findById(item.dishId);
    if (!dish) {
      return next(new AppError(`商品 ${item.dishId} 不存在`, 404));
    }

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

  let order;

  if (existingOrder) {
    // 如果存在未結帳的訂單，累積商品
    const updatedItems = [...existingOrder.items];
    
    // 將新商品加入現有訂單
    for (const newItem of validatedItems) {
      // 檢查是否已存在相同商品和選項的項目
      const existingItemIndex = updatedItems.findIndex(existingItem => {
        // 比較 dishId
        if (!existingItem.dishId.equals(newItem.dishId)) {
          return false;
        }
        
        // 比較選項
        const existingOptions = existingItem.selectedOptions || new Map();
        const newOptions = newItem.selectedOptions || new Map();
        
        // 將 Map 轉換為可比較的格式
        const existingOptionsObj = existingOptions instanceof Map ? 
          Object.fromEntries(existingOptions) : existingOptions;
        const newOptionsObj = newOptions instanceof Map ? 
          Object.fromEntries(newOptions) : newOptions;
        
        // 比較選項內容
        const existingOptionsStr = JSON.stringify(existingOptionsObj);
        const newOptionsStr = JSON.stringify(newOptionsObj);
        
        // 比較備註
        const existingNotes = existingItem.notes || '';
        const newNotes = newItem.notes || '';
        
        return existingOptionsStr === newOptionsStr && existingNotes === newNotes;
      });
      
      if (existingItemIndex !== -1) {
        // 如果找到相同的項目，增加數量
        updatedItems[existingItemIndex].quantity += newItem.quantity;
        updatedItems[existingItemIndex].totalPrice += newItem.totalPrice;
      } else {
        // 如果沒找到相同項目，新增
        updatedItems.push(newItem);
      }
    }
    
    // 重新計算總金額
    const newTotalAmount = updatedItems.reduce((total, item) => total + item.totalPrice, 0);
    
    // 更新現有訂單
    existingOrder.items = updatedItems;
    existingOrder.totalAmount = newTotalAmount;
    existingOrder.customerNotes = customerNotes || existingOrder.customerNotes;
    existingOrder.updatedAt = new Date();
    
    await existingOrder.save();
    order = existingOrder;
    
  } else {
    // 如果沒有現有訂單，創建新訂單（帶重試機制）
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        const orderNumber = await Order.generateOrderNumber();
        
        // 創建訂單
        order = new Order({
          orderNumber,
          tableId: table._id,
          tableNumber: table.tableNumber,
          merchantId: table.merchant._id,
          items: validatedItems,
          totalAmount,
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
  }

  // 填充相關資料
  await order.populate([
    { path: 'tableId', select: 'number status' },
    { path: 'merchantId', select: 'name' },
    { path: 'items.dishId', select: 'name price category' }
  ]);

  res.status(existingOrder ? 200 : 201).json({
    status: 'success',
    data: {
      order,
      isUpdate: !!existingOrder
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
    { path: 'tableId', select: 'number status' },
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

  // 可以選擇是否重置桌子狀態為可用
  // 這裡暫時不重置，讓服務員手動重置桌子狀態
  
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
      { path: 'tableId', select: 'number status' },
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
      { path: 'tableId', select: 'number status' },
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
  const { status, date, limit = 20, page = 1 } = req.query;

  const query = { merchantId };
  
  if (status) {
    query.status = status;
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
      { path: 'tableId', select: 'number status' },
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
    'ready': ['served'],
    'served': ['completed'],
    'completed': [],
    'cancelled': []
  };

  if (!validTransitions[order.status].includes(status)) {
    return next(new AppError(`無法從 ${order.status} 狀態轉換到 ${status} 狀態`, 400));
  }

  await order.updateStatus(status);

  if (estimatedTime !== undefined) {
    order.estimatedTime = estimatedTime;
    await order.save();
  }

  // 重新獲取更新後的訂單
  const updatedOrder = await Order.findById(order._id)
    .populate([
      { path: 'tableId', select: 'number status' },
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
  const { date } = req.query;

  let matchQuery = { merchantId: mongoose.Types.ObjectId(merchantId) };

  if (date) {
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);
    matchQuery.createdAt = {
      $gte: startDate,
      $lt: endDate
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

  const totalOrders = await Order.countDocuments(matchQuery);
  const totalRevenue = await Order.aggregate([
    { $match: { ...matchQuery, status: { $ne: 'cancelled' } } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      statusBreakdown: stats
    }
  });
});
