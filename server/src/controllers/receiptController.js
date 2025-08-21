const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Receipt = require('../models/receipt');
const Order = require('../models/order');
const Merchant = require('../models/merchant');
const mongoose = require('mongoose');

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

// 創建收據
exports.createReceipt = catchAsync(async (req, res, next) => {
  const { orderId, employeeId, employeeName } = req.body;
  const merchantId = getMerchantId(req);

  // 驗證訂單是否存在
  const order = await Order.findById(orderId)
    .populate([
      { path: 'tableId', select: 'tableNumber' },
      { path: 'merchantId', select: 'businessName' }
    ]);

  if (!order) {
    return next(new AppError('訂單不存在', 404));
  }

  // 驗證訂單是否屬於當前商家
  if (order.merchantId.toString() !== merchantId) {
    return next(new AppError('無權限訪問此訂單', 403));
  }

  // 檢查是否已經有收據
  const existingReceipt = await Receipt.findOne({ orderId });
  if (existingReceipt) {
    return next(new AppError('此訂單已有收據', 400));
  }

  // 創建收據
  const receipt = await Receipt.createFromOrder(
    order, 
    employeeId, 
    employeeName
  );

  // 填充相關資料
  await receipt.populate([
    { path: 'orderId', select: 'orderNumber' },
    { path: 'tableId', select: 'tableNumber' },
    { path: 'merchantId', select: 'businessName' },
    { path: 'items.dishId', select: 'name' }
  ]);

  res.status(201).json({
    status: 'success',
    data: {
      receipt
    }
  });
});

// 獲取收據列表
exports.getReceipts = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  const { 
    page = 1, 
    limit = 10, 
    startDate, 
    endDate, 
    tableNumber,
    employeeId,
    status = 'active'
  } = req.query;

  // 構建查詢條件
  const matchQuery = {
    merchantId: new mongoose.Types.ObjectId(merchantId),
    status
  };

  if (startDate && endDate) {
    matchQuery.checkoutTime = {
      $gte: new Date(startDate),
      $lt: new Date(new Date(endDate).setDate(new Date(endDate).getDate() + 1))
    };
  }

  if (tableNumber) {
    matchQuery.tableNumber = { $regex: tableNumber, $options: 'i' };
  }

  if (employeeId) {
    matchQuery.employeeId = employeeId;
  }

  // 計算分頁
  const skip = (page - 1) * limit;

  // 獲取收據列表
  const receipts = await Receipt.find(matchQuery)
    .populate([
      { path: 'orderId', select: 'orderNumber' },
      { path: 'tableId', select: 'tableNumber' },
      { path: 'merchantId', select: 'businessName' }
    ])
    .sort({ checkoutTime: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  // 獲取總數
  const total = await Receipt.countDocuments(matchQuery);

  res.status(200).json({
    status: 'success',
    data: {
      receipts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    }
  });
});

// 獲取單個收據
exports.getReceipt = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const merchantId = getMerchantId(req);

  const receipt = await Receipt.findById(id)
    .populate([
      { path: 'orderId', select: 'orderNumber' },
      { path: 'tableId', select: 'tableNumber' },
      { path: 'merchantId', select: 'businessName' },
      { path: 'items.dishId', select: 'name' }
    ]);

  if (!receipt) {
    return next(new AppError('收據不存在', 404));
  }

  // 驗證收據是否屬於當前商家
  if (receipt.merchantId.toString() !== merchantId) {
    return next(new AppError('無權限訪問此收據', 403));
  }

  res.status(200).json({
    status: 'success',
    data: {
      receipt
    }
  });
});

// 根據帳單號碼獲取收據
exports.getReceiptByBillNumber = catchAsync(async (req, res, next) => {
  const { billNumber } = req.params;
  const merchantId = getMerchantId(req);

  console.log('=== 根據帳單號碼獲取收據調試信息 ===');
  console.log('請求時間:', new Date().toISOString());
  console.log('帳單號碼:', billNumber);
  console.log('商家ID:', merchantId);

  const receipt = await Receipt.findOne({ 
    billNumber,
    merchantId: new mongoose.Types.ObjectId(merchantId)
  }).populate([
    { path: 'orderId', select: 'orderNumber' },
    { path: 'tableId', select: 'tableNumber' },
    { path: 'merchantId', select: 'businessName' },
    { path: 'items.dishId', select: 'name' }
  ]);

  if (!receipt) {
    console.log('收據不存在');
    return next(new AppError('收據不存在', 404));
  }

  console.log('找到收據:', {
    receiptId: receipt._id,
    billNumber: receipt.billNumber,
    orderId: receipt.orderId,
    tableNumber: receipt.tableNumber,
    merchantId: receipt.merchantId,
    subtotal: receipt.subtotal,
    total: receipt.total,
    checkoutTime: receipt.checkoutTime,
    employeeId: receipt.employeeId,
    employeeName: receipt.employeeName,
    itemsCount: receipt.items.length
  });

  console.log('收據項目詳情:');
  receipt.items.forEach((item, index) => {
    console.log(`項目 ${index + 1}:`, {
      dishId: item.dishId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      selectedOptions: item.selectedOptions ? Object.fromEntries(item.selectedOptions) : {}
    });
  });

  console.log('=== 根據帳單號碼獲取收據調試完成 ===');

  res.status(200).json({
    status: 'success',
    data: {
      receipt
    }
  });
});

// 更新收據列印次數
exports.updatePrintCount = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const merchantId = getMerchantId(req);

  const receipt = await Receipt.findById(id);

  if (!receipt) {
    return next(new AppError('收據不存在', 404));
  }

  // 驗證收據是否屬於當前商家
  if (receipt.merchantId.toString() !== merchantId) {
    return next(new AppError('無權限訪問此收據', 403));
  }

  // 更新列印信息
  receipt.printCount += 1;
  receipt.lastPrintedAt = new Date();
  await receipt.save();

  res.status(200).json({
    status: 'success',
    data: {
      receipt
    }
  });
});

// 作廢收據
exports.voidReceipt = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { reason } = req.body;
  const merchantId = getMerchantId(req);

  const receipt = await Receipt.findById(id);

  if (!receipt) {
    return next(new AppError('收據不存在', 404));
  }

  // 驗證收據是否屬於當前商家
  if (receipt.merchantId.toString() !== merchantId) {
    return next(new AppError('無權限訪問此收據', 403));
  }

  // 檢查收據狀態
  if (receipt.status !== 'active') {
    return next(new AppError('收據狀態不允許作廢', 400));
  }

  // 作廢收據
  receipt.status = 'void';
  receipt.notes = reason || '收據已作廢';
  await receipt.save();

  res.status(200).json({
    status: 'success',
    message: '收據已作廢',
    data: {
      receipt
    }
  });
});

// 獲取收據統計
exports.getReceiptStats = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  const { startDate, endDate } = req.query;

  const stats = await Receipt.getStats(merchantId, startDate, endDate);

  res.status(200).json({
    status: 'success',
    data: {
      stats
    }
  });
});

// 重新列印收據
exports.reprintReceipt = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const merchantId = getMerchantId(req);

  const receipt = await Receipt.findById(id)
    .populate([
      { path: 'orderId', select: 'orderNumber' },
      { path: 'tableId', select: 'tableNumber' },
      { path: 'merchantId', select: 'businessName' },
      { path: 'items.dishId', select: 'name' }
    ]);

  if (!receipt) {
    return next(new AppError('收據不存在', 404));
  }

  // 驗證收據是否屬於當前商家
  if (receipt.merchantId.toString() !== merchantId) {
    return next(new AppError('無權限訪問此收據', 403));
  }

  // 更新列印信息
  receipt.printCount += 1;
  receipt.lastPrintedAt = new Date();
  await receipt.save();

  res.status(200).json({
    status: 'success',
    message: '收據已重新列印',
    data: {
      receipt
    }
  });
});

// 根據訂單ID獲取收據
exports.getReceiptByOrderId = catchAsync(async (req, res, next) => {
  const { orderId } = req.params;
  const merchantId = getMerchantId(req);

  console.log('=== 🖨️ 歷史訂單列印收據調試信息 ===');
  console.log('📋 操作類型: 歷史訂單列印收據');
  console.log('請求時間:', new Date().toISOString());
  console.log('訂單ID:', orderId);
  console.log('商家ID:', merchantId);

  // 驗證訂單是否存在且屬於當前商家
  const order = await Order.findById(orderId);
  if (!order) {
    console.log('訂單不存在');
    return next(new AppError('訂單不存在', 404));
  }

  console.log('找到訂單:', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    tableNumber: order.tableNumber,
    merchantId: order.merchantId,
    totalAmount: order.totalAmount,
    status: order.status,
    receiptOrderNumber: order.receiptOrderNumber
  });

  if (order.merchantId.toString() !== merchantId) {
    console.log('無權限訪問此訂單');
    return next(new AppError('無權限訪問此訂單', 403));
  }

  // 查找收據
  const receipt = await Receipt.findOne({ orderId })
    .populate([
      { path: 'orderId', select: 'orderNumber' },
      { path: 'tableId', select: 'tableNumber' },
      { path: 'merchantId', select: 'businessName' },
      { path: 'items.dishId', select: 'name' }
    ]);

  if (!receipt) {
    console.log('找不到此訂單的收據，嘗試使用訂單中的收據號碼生成新收據');
    
    // 檢查訂單是否有收據號碼
    if (order.receiptOrderNumber) {
      console.log('訂單有收據號碼，使用該號碼生成收據:', order.receiptOrderNumber);
      
      // 獲取商家信息
      const merchant = await Merchant.findById(order.merchantId);
      if (!merchant) {
        console.log('找不到商家信息');
        return next(new AppError('找不到商家信息', 404));
      }
      
      // 使用訂單中的收據號碼生成新收據
      const newReceipt = await Receipt.createFromOrderWithBillNumber(
        order,
        'admin', // 預設員工ID
        '管理員', // 預設員工姓名
        order.receiptOrderNumber // 使用訂單中儲存的收據號碼
      );
      
      console.log('成功生成新收據:', {
        receiptId: newReceipt._id,
        billNumber: newReceipt.billNumber,
        orderId: newReceipt.orderId,
        checkoutTime: newReceipt.checkoutTime,
        total: newReceipt.total
      });
      
      // 重新查詢收據以獲取完整的關聯數據
      const populatedReceipt = await Receipt.findById(newReceipt._id)
        .populate([
          { path: 'orderId', select: 'orderNumber' },
          { path: 'tableId', select: 'tableNumber' },
          { path: 'merchantId', select: 'businessName' },
          { path: 'items.dishId', select: 'name' }
        ]);
      
      res.status(200).json({
        status: 'success',
        data: {
          receipt: populatedReceipt
        }
      });
      return;
    }
    
    console.log('訂單沒有收據號碼，嘗試查找該桌子的其他收據');
    
    // 備用方案：查找該桌子的所有收據
    const tableReceipts = await Receipt.find({ 
      tableId: order.tableId,
      merchantId: order.merchantId
    }).populate([
      { path: 'orderId', select: 'orderNumber' },
      { path: 'tableId', select: 'tableNumber' },
      { path: 'merchantId', select: 'businessName' },
      { path: 'items.dishId', select: 'name' }
    ]).sort({ checkoutTime: -1 });

    console.log('該桌子的所有收據:', tableReceipts.map(r => ({
      receiptId: r._id,
      billNumber: r.billNumber,
      orderId: r.orderId,
      checkoutTime: r.checkoutTime,
      total: r.total
    })));

    if (tableReceipts.length > 0) {
      // 使用最新的收據
      const latestReceipt = tableReceipts[0];
      console.log('使用最新的收據:', {
        receiptId: latestReceipt._id,
        billNumber: latestReceipt.billNumber,
        orderId: latestReceipt.orderId,
        checkoutTime: latestReceipt.checkoutTime,
        total: latestReceipt.total
      });

      res.status(200).json({
        status: 'success',
        data: {
          receipt: latestReceipt
        }
      });
      return;
    }

    console.log('該桌子也沒有找到任何收據');
    return next(new AppError('找不到此訂單的收據', 404));
  }

  console.log('找到收據:', {
    receiptId: receipt._id,
    billNumber: receipt.billNumber,
    orderId: receipt.orderId,
    tableNumber: receipt.tableNumber,
    merchantId: receipt.merchantId,
    subtotal: receipt.subtotal,
    total: receipt.total,
    checkoutTime: receipt.checkoutTime,
    employeeId: receipt.employeeId,
    employeeName: receipt.employeeName,
    itemsCount: receipt.items.length
  });

  console.log('收據項目詳情:');
  receipt.items.forEach((item, index) => {
    console.log(`項目 ${index + 1}:`, {
      dishId: item.dishId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      selectedOptions: item.selectedOptions ? Object.fromEntries(item.selectedOptions) : {}
    });
  });

  console.log('=== 歷史訂單列印收據調試完成 ===');

  res.status(200).json({
    status: 'success',
    data: {
      receipt
    }
  });
});
