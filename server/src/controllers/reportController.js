const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Order = require('../models/order');
const Table = require('../models/table');
const Dish = require('../models/dish');
const mongoose = require('mongoose');
const XLSX = require('xlsx');


// 獲取商家ID（支援商家、員工與超管指定 merchantId）
const getMerchantId = (req) => {
  // 超級管理員或管理員可透過查詢參數指定商家
  if (req.admin && req.query.merchantId) {
    return req.query.merchantId;
  }
  // 員工從所屬商家取得 ID
  if (req.employee) {
    return req.employee.merchant?.toString();
  }
  // 商家本身
  if (req.merchant) {
    return req.merchant.id;
  }
  throw new AppError('無法獲取商家信息', 401);
};

// 獲取報表統計數據
exports.getReportStats = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  const { period, date, startDate, endDate } = req.query;

  // === 調試訊息：顯示查詢參數 ===
  console.log('\n=== 統計報表查詢調試 ===');
  console.log(`商家ID: ${merchantId}`);
  console.log(`查詢參數:`, { period, date, startDate, endDate });

  // 構建日期查詢條件
  let dateQuery = {};
  let groupBy = {};
  
  if (period === 'day' && date) {
    // 單日查詢 - 採用與歷史訂單一致的時區轉換方式
    let startOfDay, endOfDay;
    
    if (date.includes('T') || date.includes('Z')) {
      const dateObj = new Date(date);
      const timezoneOffset = dateObj.getTimezoneOffset();
      
      const localStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
      const localEnd = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59, 999);
      
      startOfDay = new Date(localStart.getTime() + (timezoneOffset * 60 * 1000));
      endOfDay = new Date(localEnd.getTime() + (timezoneOffset * 60 * 1000));
    } else {
      // 處理純日期字符串，使用與前端一致的時區轉換邏輯
      const dateObj = new Date(date);
      
      // 台灣時區是 UTC+8，所以需要減去 8 小時來轉換為 UTC
      const taiwanTimezoneOffset = 8 * 60; // 8小時 = 480分鐘
      
      const taiwanStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
      const taiwanEnd = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59, 999);
      
      startOfDay = new Date(taiwanStart.getTime() - (taiwanTimezoneOffset * 60 * 1000));
      endOfDay = new Date(taiwanEnd.getTime() - (taiwanTimezoneOffset * 60 * 1000));
    }
    
    // 驗證日期是否有效
    if (isNaN(startOfDay.getTime()) || isNaN(endOfDay.getTime())) {
      return next(new AppError('日期格式無效', 400));
    }
    
    dateQuery.completedAt = { $gte: startOfDay, $lte: endOfDay };
    // 使用本地時間格式化，轉換為台灣時區 (UTC+8)
    groupBy = { 
      $dateToString: { 
        format: "%H:00", 
        date: "$completedAt",
        timezone: "+08:00" // 台灣時區 UTC+8
      } 
    };

    // === 調試訊息：顯示單日查詢 ===
    console.log(`單日查詢: ${date}`);
    console.log(`轉換後時間: ${startOfDay.toISOString()} 到 ${endOfDay.toISOString()}`);
  } else if (period === 'month' && startDate && endDate) {
    // 月份查詢 - 採用與歷史訂單一致的時區轉換方式
    let start, end;
    
    // 檢查是否已經是完整的日期時間字符串
    if (startDate.includes('T') || startDate.includes('Z')) {
      const dateObj = new Date(startDate);
      const timezoneOffset = dateObj.getTimezoneOffset();
      
      const localStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
      start = new Date(localStart.getTime() + (timezoneOffset * 60 * 1000));
    } else {
      // 處理純日期字符串，使用與前端一致的時區轉換邏輯
      const dateObj = new Date(startDate);
      
      // 台灣時區是 UTC+8，所以需要減去 8 小時來轉換為 UTC
      const taiwanTimezoneOffset = 8 * 60; // 8小時 = 480分鐘
      
      const taiwanStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
      start = new Date(taiwanStart.getTime() - (taiwanTimezoneOffset * 60 * 1000));
    }
    
    if (endDate.includes('T') || endDate.includes('Z')) {
      const dateObj = new Date(endDate);
      const timezoneOffset = dateObj.getTimezoneOffset();
      
      const localEnd = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59, 999);
      end = new Date(localEnd.getTime() + (timezoneOffset * 60 * 1000));
    } else {
      // 處理純日期字符串，使用與前端一致的時區轉換邏輯
      const dateObj = new Date(endDate);
      
      // 台灣時區是 UTC+8，所以需要減去 8 小時來轉換為 UTC
      const taiwanTimezoneOffset = 8 * 60; // 8小時 = 480分鐘
      
      const taiwanEnd = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59, 999);
      end = new Date(taiwanEnd.getTime() - (taiwanTimezoneOffset * 60 * 1000));
    }
    
    // 驗證日期是否有效
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return next(new AppError('日期格式無效', 400));
    }
    
    dateQuery.completedAt = { $gte: start, $lt: end };
    // 使用本地時間格式化，轉換為台灣時區 (UTC+8)
    groupBy = { 
      $dateToString: { 
        format: "%Y-%m-%d", 
        date: "$completedAt",
        timezone: "+08:00" // 台灣時區 UTC+8
      } 
    };

    // === 調試訊息：顯示月份查詢 ===
    console.log(`月份查詢: ${startDate} 到 ${endDate}`);
    console.log(`轉換後時間: ${start.toISOString()} 到 ${end.toISOString()}`);
  } else if (period === 'year' && startDate && endDate) {
    // 年份查詢 - 採用與歷史訂單一致的時區轉換方式
    let start, end;
    
    // 檢查是否已經是完整的日期時間字符串
    if (startDate.includes('T') || startDate.includes('Z')) {
      const dateObj = new Date(startDate);
      const timezoneOffset = dateObj.getTimezoneOffset();
      
      const localStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
      start = new Date(localStart.getTime() + (timezoneOffset * 60 * 1000));
    } else {
      // 處理純日期字符串，使用與前端一致的時區轉換邏輯
      const dateObj = new Date(startDate);
      
      // 台灣時區是 UTC+8，所以需要減去 8 小時來轉換為 UTC
      const taiwanTimezoneOffset = 8 * 60; // 8小時 = 480分鐘
      
      const taiwanStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
      start = new Date(taiwanStart.getTime() - (taiwanTimezoneOffset * 60 * 1000));
    }
    
    if (endDate.includes('T') || endDate.includes('Z')) {
      const dateObj = new Date(endDate);
      const timezoneOffset = dateObj.getTimezoneOffset();
      
      const localEnd = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59, 999);
      end = new Date(localEnd.getTime() + (timezoneOffset * 60 * 1000));
    } else {
      // 處理純日期字符串，使用與前端一致的時區轉換邏輯
      const dateObj = new Date(endDate);
      
      // 台灣時區是 UTC+8，所以需要減去 8 小時來轉換為 UTC
      const taiwanTimezoneOffset = 8 * 60; // 8小時 = 480分鐘
      
      const taiwanEnd = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59, 999);
      end = new Date(taiwanEnd.getTime() - (taiwanTimezoneOffset * 60 * 1000));
    }
    
    // 驗證日期是否有效
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return next(new AppError('日期格式無效', 400));
    }
    
    dateQuery.completedAt = { $gte: start, $lt: end };
    // 使用本地時間格式化，轉換為台灣時區 (UTC+8)
    groupBy = { 
      $dateToString: { 
        format: "%Y-%m", 
        date: "$completedAt",
        timezone: "+08:00" // 台灣時區 UTC+8
      } 
    };

    // === 調試訊息：顯示年份查詢 ===
    console.log(`年份查詢: ${startDate} 到 ${endDate}`);
    console.log(`轉換後時間: ${start.toISOString()} 到 ${end.toISOString()}`);
  } else {
    // 預設查詢今天 - 採用與歷史訂單一致的時區轉換方式
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // 台灣時區是 UTC+8，所以需要減去 8 小時來轉換為 UTC
    const taiwanTimezoneOffset = 8 * 60; // 8小時 = 480分鐘
    
    const taiwanStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const taiwanEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    
    const startOfDay = new Date(taiwanStart.getTime() - (taiwanTimezoneOffset * 60 * 1000));
    const endOfDay = new Date(taiwanEnd.getTime() - (taiwanTimezoneOffset * 60 * 1000));
    
    dateQuery.completedAt = { $gte: startOfDay, $lte: endOfDay };
    // 使用本地時間格式化，轉換為台灣時區 (UTC+8)
    groupBy = { 
      $dateToString: { 
        format: "%H:00", 
        date: "$completedAt",
        timezone: "+08:00" // 台灣時區 UTC+8
      } 
    };

    // === 調試訊息：顯示預設查詢 ===
    console.log(`預設查詢今天: ${todayStr}`);
    console.log(`轉換後時間: ${startOfDay.toISOString()} 到 ${endOfDay.toISOString()}`);
  }

  // === 調試訊息：顯示最終查詢條件 ===
  console.log(`最終日期查詢條件:`, JSON.stringify(dateQuery, null, 2));

  try {
    // === 調試：先獲取所有符合條件的訂單 ===
    const allMatchingOrders = await Order.find({
      merchantId: new mongoose.Types.ObjectId(merchantId),
      status: 'completed', // 只計算已結帳的訂單
      ...dateQuery
    }).populate([
      { path: 'tableId', select: 'tableNumber status' },
      { path: 'items.dishId', select: 'name price category image' }
    ]).select('+items.selectedOptions');

    console.log(`\n=== 符合條件的所有訂單 (共 ${allMatchingOrders.length} 筆) ===`);
    allMatchingOrders.forEach((order, index) => {
      console.log(`\n訂單 ${index + 1}:`);
      console.log(`  收據號: ${order.receiptOrderNumber || '無'}`);
      console.log(`  訂單號: ${order.orderNumber}`);
      console.log(`  桌次: ${order.tableId?.tableNumber || '未知'}`);
      console.log(`  狀態: ${order.status}`);
      console.log(`  創建時間: ${order.createdAt}`);
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

    // 1. 獲取營收統計（只計算已結帳的訂單）
    const revenueStats = await Order.aggregate([
      { 
        $match: { 
          merchantId: new mongoose.Types.ObjectId(merchantId),
          status: 'completed', // 只計算已結帳的訂單
          ...dateQuery 
        } 
      },
      {
        $group: {
          _id: groupBy,
          revenue: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    console.log(`\n=== 營收統計結果 ===`);
    console.log(`統計項目數: ${revenueStats.length}`);
    revenueStats.forEach((stat, index) => {
      console.log(`項目 ${index + 1}: 時間=${stat._id}, 營收=${stat.revenue}, 訂單數=${stat.orderCount}`);
    });

    // 2. 獲取人流量統計（基於桌次使用，只計算已結帳的訂單）
    // 使用與儀表板相同的邏輯：按桌次和客人組別分組
    
    // 調試：先獲取原始訂單數據
    const debugOrders = await Order.find({
      merchantId: new mongoose.Types.ObjectId(merchantId),
      status: 'completed',
      ...dateQuery
    }).select('orderNumber tableId completedAt totalAmount status');
    
    console.log('\n=== 調試：原始訂單數據 ===');
    console.log(`總訂單數: ${debugOrders.length}`);
    debugOrders.forEach((order, index) => {
      console.log(`訂單 ${index + 1}: ${order.orderNumber} | 桌次: ${order.tableId} | 金額: ${order.totalAmount} | 時間: ${order.completedAt}`);
    });
    
    const trafficStats = await Order.aggregate([
      { 
        $match: { 
          merchantId: new mongoose.Types.ObjectId(merchantId),
          status: 'completed', // 只計算已結帳的訂單
          ...dateQuery 
        } 
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
        $addFields: {
          // 從訂單號解析客人組別
          customerGroup: {
            $let: {
              vars: {
                orderParts: { $split: ['$orderNumber', '-'] }
              },
              in: {
                $cond: {
                  if: { $gte: [{ $size: '$$orderParts' }, 2] },
                  then: {
                    $let: {
                      vars: {
                        dateGroupBatch: { $arrayElemAt: ['$$orderParts', 1] }
                      },
                      in: {
                        $cond: {
                          if: { $gte: [{ $strLenBytes: '$$dateGroupBatch' }, 12] },
                          then: {
                            $toString: {
                              $toInt: { $substr: ['$$dateGroupBatch', 8, 4] }
                            }
                          },
                          else: '1'
                        }
                      }
                    }
                  },
                  else: '1'
                }
              }
            }
          }
        }
      },
      {
        $group: {
          _id: { 
            timeSlot: groupBy, 
            tableId: '$tableId',
            customerGroup: '$customerGroup'
          },
          tableCapacity: { $first: '$tableInfo.capacity' },
          orderCount: { $sum: 1 },
          orderNumbers: { $push: '$orderNumber' } // 調試：記錄訂單號
        }
      },
      {
        $group: {
          _id: '$_id.timeSlot',
          totalCustomers: { $sum: '$tableCapacity' }, // 直接加總桌次容量，不乘以訂單數
          uniqueTables: { $addToSet: '$_id.tableId' },
          // 調試：記錄詳細分組信息
          groupDetails: {
            $push: {
              tableId: '$_id.tableId',
              customerGroup: '$_id.customerGroup',
              tableCapacity: '$tableCapacity',
              orderCount: '$orderCount',
              orderNumbers: '$orderNumbers'
            }
          }
        }
      },
      {
        $project: {
          _id: 1,
          totalCustomers: 1,
          tableCount: { $size: '$uniqueTables' },
          customerGroupCount: { $size: '$groupDetails' }, // 使用 groupDetails 的長度來計算組數
          groupDetails: 1 // 調試：保留詳細信息
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // 調試：輸出分組結果
    console.log('=== 調試：分組結果 ===');
    trafficStats.forEach((stat, index) => {
      console.log(`時段 ${index + 1}: ${stat._id}`);
      console.log(`  桌次數: ${stat.tableCount}`);
      console.log(`  客人組數: ${stat.customerGroupCount}`);
      console.log(`  總客人數: ${stat.totalCustomers}`);
      console.log(`  詳細分組:`);
      stat.groupDetails.forEach((group, gIndex) => {
        console.log(`    組 ${gIndex + 1}: 桌次=${group.tableId}, 客人組=${group.customerGroup}, 容量=${group.tableCapacity}, 訂單數=${group.orderCount}`);
        console.log(`      訂單號: ${group.orderNumbers.join(', ')}`);
      });
    });

    // 3. 獲取熱門餐點統計（包含成本計算，只計算已結帳的訂單）
    const popularDishes = await Order.aggregate([
      { 
        $match: { 
          merchantId: new mongoose.Types.ObjectId(merchantId),
          status: 'completed', // 只計算已結帳的訂單
          ...dateQuery 
        } 
      },
      {
        $unwind: '$items'
      },
      {
        $addFields: {
          // 按比例分配訂單總成本到每個菜品
          'items.proportionalCost': {
            $multiply: [
              { $divide: ['$totalCost', { $cond: { if: { $isArray: '$items' }, then: { $size: '$items' }, else: 1 } }] },
              '$items.quantity'
            ]
          }
        }
      },
      {
        $group: {
          _id: {
            dishId: '$items.dishId',
            dishName: '$items.name',
            category: '$items.category'
          },
          orderCount: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } },
          cost: { $sum: '$items.proportionalCost' }
        }
      },
      {
        $sort: { orderCount: -1, revenue: -1 }
      },
      {
        $limit: 10
      }
    ]);

    // 3.1 計算總成本（基於訂單中已計算的庫存成本，只計算已結帳的訂單）
    // 3. 獲取成本統計 - 使用與歷史訂單報表相同的邏輯
    const totalCost = await Order.aggregate([
      { 
        $match: { 
          merchantId: new mongoose.Types.ObjectId(merchantId),
          status: 'completed', // 只計算已結帳的訂單
          ...dateQuery 
        } 
      },
      {
        $unwind: '$items'
      },
      {
        $group: {
          _id: null,
          totalCost: { $sum: '$items.historicalCost.totalCost' }
        }
      }
    ]);

    // 4. 計算總計數據
    const totalRevenue = revenueStats.reduce((sum, stat) => sum + stat.revenue, 0);
    
    const actualTotalCost = totalCost[0]?.totalCost || 0;
    const actualProfit = totalRevenue - actualTotalCost;
    const profitMargin = totalRevenue > 0 ? ((actualProfit / totalRevenue) * 100).toFixed(1) : 0;
    const costRatio = totalRevenue > 0 ? ((actualTotalCost / totalRevenue) * 100).toFixed(1) : 0;
    // 總桌次數和客人組數
    const totalTables = trafficStats.reduce((sum, stat) => sum + stat.tableCount, 0);
    const totalCustomers = trafficStats.reduce((sum, stat) => sum + stat.totalCustomers, 0);
    
    // 重新計算總客人組數，避免重複計算
    const totalCustomerGroups = await Order.aggregate([
      { 
        $match: { 
          merchantId: new mongoose.Types.ObjectId(merchantId),
          status: 'completed',
          ...dateQuery 
        } 
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
        $addFields: {
          customerGroup: {
            $let: {
              vars: {
                orderParts: { $split: ['$orderNumber', '-'] }
              },
              in: {
                $cond: {
                  if: { $gte: [{ $size: '$$orderParts' }, 2] },
                  then: {
                    $let: {
                      vars: {
                        dateGroupBatch: { $arrayElemAt: ['$$orderParts', 1] }
                      },
                      in: {
                        $cond: {
                          if: { $gte: [{ $strLenBytes: '$$dateGroupBatch' }, 12] },
                          then: {
                            $toString: {
                              $toInt: { $substr: ['$$dateGroupBatch', 8, 4] }
                            }
                          },
                          else: '1'
                        }
                      }
                    }
                  },
                  else: '1'
                }
              }
            }
          }
        }
      },
      {
        $group: {
          _id: { 
            tableId: '$tableId',
            customerGroup: '$customerGroup'
          }
        }
      },
      {
        $group: {
          _id: null,
          totalCustomerGroups: { $sum: 1 }
        }
      }
    ]);
    
    const actualTotalCustomerGroups = totalCustomerGroups[0]?.totalCustomerGroups || 0;
    
    // 5. 計算增長率（與前一天/月/年比較）
    let previousPeriodQuery = {};
    let previousPeriodStats = null;
    
    if (period === 'day' && date) {
      // 與前一天比較 - 使用時區轉換
      const currentDate = new Date(date);
      const previousDate = new Date(currentDate);
      previousDate.setDate(previousDate.getDate() - 1);
      
      // 台灣時區是 UTC+8，所以需要減去 8 小時來轉換為 UTC
      const taiwanTimezoneOffset = 8 * 60; // 8小時 = 480分鐘
      
      const taiwanStart = new Date(previousDate.getFullYear(), previousDate.getMonth(), previousDate.getDate());
      const taiwanEnd = new Date(previousDate.getFullYear(), previousDate.getMonth(), previousDate.getDate() + 1);
      
      const startOfDay = new Date(taiwanStart.getTime() - (taiwanTimezoneOffset * 60 * 1000));
      const endOfDay = new Date(taiwanEnd.getTime() - (taiwanTimezoneOffset * 60 * 1000));
      
      previousPeriodQuery.completedAt = {
        $gte: startOfDay,
        $lt: endOfDay
      };
    } else if (period === 'month' && startDate) {
      // 與上個月比較 - 使用時區轉換
      const currentStart = new Date(startDate);
      const previousStart = new Date(currentStart);
      previousStart.setMonth(previousStart.getMonth() - 1);
      const previousEnd = new Date(currentStart);
      previousEnd.setMonth(previousEnd.getMonth() - 1);
      previousEnd.setDate(0);
      
      // 台灣時區是 UTC+8，所以需要減去 8 小時來轉換為 UTC
      const taiwanTimezoneOffset = 8 * 60; // 8小時 = 480分鐘
      
      const startOfMonth = new Date(previousStart.getTime() - (taiwanTimezoneOffset * 60 * 1000));
      const endOfMonth = new Date(previousEnd.getTime() - (taiwanTimezoneOffset * 60 * 1000));
      
      previousPeriodQuery.completedAt = {
        $gte: startOfMonth,
        $lt: endOfMonth
      };
    } else if (period === 'year' && startDate) {
      // 與上一年比較 - 使用時區轉換
      const currentStart = new Date(startDate);
      const previousStart = new Date(currentStart);
      previousStart.setFullYear(previousStart.getFullYear() - 1);
      const previousEnd = new Date(currentStart);
      previousEnd.setFullYear(previousEnd.getFullYear() - 1);
      
      // 台灣時區是 UTC+8，所以需要減去 8 小時來轉換為 UTC
      const taiwanTimezoneOffset = 8 * 60; // 8小時 = 480分鐘
      
      const startOfYear = new Date(previousStart.getTime() - (taiwanTimezoneOffset * 60 * 1000));
      const endOfYear = new Date(previousEnd.getTime() - (taiwanTimezoneOffset * 60 * 1000));
      
      previousPeriodQuery.completedAt = {
        $gte: startOfYear,
        $lt: endOfYear
      };
    }

    if (Object.keys(previousPeriodQuery).length > 0) {
      const previousRevenue = await Order.aggregate([
        { 
          $match: { 
            merchantId: new mongoose.Types.ObjectId(merchantId),
            status: 'completed', // 只計算已結帳的訂單
            ...previousPeriodQuery 
          } 
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$totalAmount' }
          }
        }
      ]);
      
      previousPeriodStats = previousRevenue[0]?.revenue || 0;
    }

    // 計算增長率
    const revenueChange = previousPeriodStats > 0 
      ? ((totalRevenue - previousPeriodStats) / previousPeriodStats * 100).toFixed(1)
      : 0;

    // 計算客人組數增長率（需要獲取前一期的客人組數）
    let previousCustomerGroups = 0;
    let previousDebugOrders = []; // 初始化為空數組
    if (Object.keys(previousPeriodQuery).length > 0) {
      // 調試：獲取前一期原始訂單數據
      previousDebugOrders = await Order.find({
        merchantId: new mongoose.Types.ObjectId(merchantId),
        status: 'completed',
        ...previousPeriodQuery
      }).select('orderNumber tableId completedAt totalAmount status');
      
      console.log('=== 調試：前一期原始訂單數據 ===');
      console.log(`前一期總訂單數: ${previousDebugOrders.length}`);
      previousDebugOrders.forEach((order, index) => {
        console.log(`前一期訂單 ${index + 1}: ${order.orderNumber} | 桌次: ${order.tableId} | 金額: ${order.totalAmount} | 時間: ${order.createdAt}`);
      });
      
      const previousTrafficStats = await Order.aggregate([
        { 
          $match: { 
            merchantId: new mongoose.Types.ObjectId(merchantId),
            status: 'completed',
            ...previousPeriodQuery 
          } 
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
          $addFields: {
            customerGroup: {
              $let: {
                vars: {
                  orderParts: { $split: ['$orderNumber', '-'] }
                },
                in: {
                  $cond: {
                    if: { $gte: [{ $size: '$$orderParts' }, 2] },
                    then: {
                      $let: {
                        vars: {
                          dateGroupBatch: { $arrayElemAt: ['$$orderParts', 1] }
                        },
                        in: {
                          $cond: {
                            if: { $gte: [{ $strLenBytes: '$$dateGroupBatch' }, 12] },
                            then: {
                              $toString: {
                                $toInt: { $substr: ['$$dateGroupBatch', 8, 4] }
                              }
                            },
                            else: '1'
                          }
                        }
                      }
                    },
                    else: '1'
                  }
                }
              }
            }
          }
        },
        {
          $group: {
            _id: { 
              tableId: '$tableId',
              customerGroup: '$customerGroup'
            },
            tableCapacity: { $first: '$tableInfo.capacity' },
            orderCount: { $sum: 1 },
            orderNumbers: { $push: '$orderNumber' } // 調試：記錄訂單號
          }
        },
        {
          $group: {
            _id: null,
            uniqueTables: { $addToSet: '$_id.tableId' },
            uniqueCustomerGroups: { $addToSet: '$_id.customerGroup' },
            // 調試：記錄詳細分組信息
            groupDetails: {
              $push: {
                tableId: '$_id.tableId',
                customerGroup: '$_id.customerGroup',
                tableCapacity: '$tableCapacity',
                orderCount: '$orderCount',
                orderNumbers: '$orderNumbers'
              }
            }
          }
        },
        {
          $project: {
            totalTables: { $size: '$uniqueTables' },
            totalCustomerGroups: { $size: '$uniqueCustomerGroups' },
            groupDetails: 1 // 調試：保留詳細信息
          }
        }
      ]);
      
      // 調試：輸出前一期分組結果
      console.log('=== 調試：前一期分組結果 ===');
      if (previousTrafficStats[0]) {
        const stat = previousTrafficStats[0];
        console.log(`前一期桌次數: ${stat.totalTables}`);
        console.log(`前一期客人組數: ${stat.totalCustomerGroups}`);
        console.log(`前一期詳細分組:`);
        stat.groupDetails.forEach((group, gIndex) => {
          console.log(`  組 ${gIndex + 1}: 桌次=${group.tableId}, 客人組=${group.customerGroup}, 容量=${group.tableCapacity}, 訂單數=${group.orderCount}`);
          console.log(`    訂單號: ${group.orderNumbers.join(', ')}`);
        });
      }
      
      previousCustomerGroups = previousTrafficStats[0]?.totalCustomerGroups || 0;
    }

    const customerGroupsChange = previousCustomerGroups > 0 
      ? ((actualTotalCustomerGroups - previousCustomerGroups) / previousCustomerGroups * 100).toFixed(1)
      : 0;

    // 6. 獲取高峰時段（使用最近7天數據，與儀表板保持一致）
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    // 台灣時區是 UTC+8，所以需要減去 8 小時來轉換為 UTC
    const taiwanTimezoneOffset = 8 * 60; // 8小時 = 480分鐘
    const sevenDaysAgoUTC = new Date(sevenDaysAgo.getTime() - (taiwanTimezoneOffset * 60 * 1000));
    
    const peakHours = await Order.aggregate([
      { 
        $match: { 
          merchantId: new mongoose.Types.ObjectId(merchantId),
          status: 'completed', // 只計算已結帳的訂單
          completedAt: { $gte: sevenDaysAgoUTC }
        } 
      },
      {
        $addFields: {
          // 轉換為台灣時區 (UTC+8)
          localHour: {
            $add: [
              { $hour: '$completedAt' },
              8 // 台灣時區偏移
            ]
          }
        }
      },
      {
        $group: {
          _id: { $mod: ['$localHour', 24] }, // 確保小時在 0-23 範圍內
          orderCount: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      {
        $sort: { orderCount: -1 }
      },
      {
        $limit: 3
      }
    ]);

    const peakHoursFormatted = peakHours.map(hour => {
      const startHour = hour._id.toString().padStart(2, '0');
      const endHour = ((hour._id + 1) % 24).toString().padStart(2, '0');
      return `${startHour}:00-${endHour}:00`;
    });

    res.status(200).json({
      status: 'success',
      data: {
        period,
        dateRange: { startDate, endDate, date },
        
        // 財務統計
        financial: {
          totalRevenue,
          totalOrders: totalTables,
          averageOrderValue: totalTables > 0 ? Math.round(totalRevenue / totalTables) : 0,
          revenueChange: parseFloat(revenueChange),
          revenueTrend: revenueStats,
          // 新增基於實際庫存成本的財務數據
          totalCost: actualTotalCost,
          totalProfit: actualProfit,
          profitMargin: parseFloat(profitMargin),
          costRatio: parseFloat(costRatio)
        },
        
        // 人流量統計
        traffic: {
          totalCustomers,
          totalTables,
          totalCustomerGroups: actualTotalCustomerGroups,
          customerChange: 0, // 可以根據需要計算
          peakHours: peakHoursFormatted,
          averageStayTime: 45, // 預設值，可以根據實際數據計算
          trafficTrend: trafficStats
        },
        
        // 調試信息（僅在開發環境顯示）
        debug: process.env.NODE_ENV === 'development' ? {
          rawOrders: debugOrders.map(order => ({
            orderNumber: order.orderNumber,
            tableId: order.tableId,
            totalAmount: order.totalAmount,
            createdAt: order.createdAt
          })),
          trafficStatsDetails: trafficStats.map(stat => ({
            timeSlot: stat._id,
            tableCount: stat.tableCount,
            customerGroupCount: stat.customerGroupCount,
            totalCustomers: stat.totalCustomers,
            groupDetails: stat.groupDetails
          })),
          previousPeriodDetails: Object.keys(previousPeriodQuery).length > 0 ? {
            rawOrders: (previousDebugOrders || []).map(order => ({
              orderNumber: order.orderNumber,
              tableId: order.tableId,
              totalAmount: order.totalAmount,
              createdAt: order.createdAt
            })),
            previousCustomerGroups
          } : null
        } : null,
        
        // 熱門餐點
        popularDishes: popularDishes.map(dish => ({
          id: dish._id.dishId,
          name: dish._id.dishName,
          category: dish._id.category,
          orderCount: dish.orderCount,
          revenue: dish.revenue
        })),
        
        // 時間序列數據
        timeSeries: {
          revenue: revenueStats,
          traffic: trafficStats
        }
      }
    });

  } catch (error) {
    console.error('獲取報表統計失敗:', error);
    return next(new AppError('獲取報表統計失敗', 500));
  }
});

// 獲取簡化版報表統計（用於儀表板）
exports.getSimpleReportStats = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  const { date } = req.query;

  // 預設查詢今天
  let dateQuery = {};
  if (date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    dateQuery.completedAt = { $gte: startOfDay, $lte: endOfDay };
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateQuery.completedAt = { $gte: today, $lt: tomorrow };
  }

  try {
    // 獲取今日營收
    const todayRevenue = await Order.aggregate([
      { 
        $match: { 
          merchantId: new mongoose.Types.ObjectId(merchantId),
          status: 'completed', // 只計算已結帳的訂單
          ...dateQuery 
        } 
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 }
        }
      }
    ]);

    // 獲取今日人流量
    const todayTraffic = await Order.aggregate([
      { 
        $match: { 
          merchantId: new mongoose.Types.ObjectId(merchantId),
          status: 'completed', // 只計算已結帳的訂單
          ...dateQuery 
        } 
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
        $addFields: {
          // 從訂單號解析客人組別
          customerGroup: {
            $let: {
              vars: {
                orderParts: { $split: ['$orderNumber', '-'] }
              },
              in: {
                $cond: {
                  if: { $gte: [{ $size: '$$orderParts' }, 2] },
                  then: {
                    $let: {
                      vars: {
                        dateGroupBatch: { $arrayElemAt: ['$$orderParts', 1] }
                      },
                      in: {
                        $cond: {
                          if: { $gte: [{ $strLenBytes: '$$dateGroupBatch' }, 12] },
                          then: {
                            $toString: {
                              $toInt: { $substr: ['$$dateGroupBatch', 8, 4] }
                            }
                          },
                          else: '1'
                        }
                      }
                    }
                  },
                  else: '1'
                }
              }
            }
          }
        }
      },
      {
        $group: {
          _id: { tableId: '$tableId', customerGroup: '$customerGroup' },
          tableCapacity: { $first: '$tableInfo.capacity' },
          orderCount: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: null,
          totalCustomers: { $sum: '$tableCapacity' } // 直接加總桌次容量，不乘以訂單數
        }
      }
    ]);

    // 獲取今日熱門餐點（前5名）
    const todayPopularDishes = await Order.aggregate([
      { 
        $match: { 
          merchantId: new mongoose.Types.ObjectId(merchantId),
          status: 'completed', // 只計算已結帳的訂單
          ...dateQuery 
        } 
      },
      {
        $unwind: '$items'
      },
      {
        $group: {
          _id: {
            dishId: '$items.dishId',
            dishName: '$items.name',
            category: '$items.category'
          },
          orderCount: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } }
        }
      },
      {
        $sort: { orderCount: -1 }
      },
      {
        $limit: 5
      }
    ]);

    const result = {
      revenue: todayRevenue[0]?.revenue || 0,
      orderCount: todayRevenue[0]?.orderCount || 0,
      totalCustomers: todayTraffic[0]?.totalCustomers || 0,
      popularDishes: todayPopularDishes.map(dish => ({
        id: dish._id.dishId,
        name: dish._id.dishName,
        category: dish._id.category,
        orderCount: dish.orderCount,
        revenue: dish.revenue
      }))
    };

    res.status(200).json({
      status: 'success',
      data: result
    });

  } catch (error) {
    console.error('獲取簡化報表統計失敗:', error);
    return next(new AppError('獲取簡化報表統計失敗', 500));
  }
});

// 匯出報表
exports.exportReport = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  const { period, date, startDate, endDate, format = 'xlsx' } = req.query;

  console.log('=== 報表匯出調試信息 ===');
  console.log('商家ID:', merchantId);
  console.log('期間:', period);
  console.log('日期:', date);
  console.log('開始日期:', startDate);
  console.log('結束日期:', endDate);

  // 構建日期查詢條件
  let dateQuery = {};
  let periodDisplay = '';
  
  if (period === 'day' && date) {
    // 單日查詢 - 採用與統計報表一致的時區轉換方式
    let startOfDay, endOfDay;
    
    if (date.includes('T') || date.includes('Z')) {
      const dateObj = new Date(date);
      const timezoneOffset = dateObj.getTimezoneOffset();
      
      const localStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
      const localEnd = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59, 999);
      
      startOfDay = new Date(localStart.getTime() + (timezoneOffset * 60 * 1000));
      endOfDay = new Date(localEnd.getTime() + (timezoneOffset * 60 * 1000));
    } else {
      // 處理純日期字符串，使用與前端一致的時區轉換邏輯
      const dateObj = new Date(date);
      
      // 台灣時區是 UTC+8，所以需要減去 8 小時來轉換為 UTC
      const taiwanTimezoneOffset = 8 * 60; // 8小時 = 480分鐘
      
      const taiwanStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
      const taiwanEnd = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59, 999);
      
      startOfDay = new Date(taiwanStart.getTime() - (taiwanTimezoneOffset * 60 * 1000));
      endOfDay = new Date(taiwanEnd.getTime() - (taiwanTimezoneOffset * 60 * 1000));
    }
    
    dateQuery.completedAt = { $gte: startOfDay, $lte: endOfDay };
    periodDisplay = `日報_${date}`;
  } else if (period === 'month' && startDate && endDate) {
    // 月份查詢 - 採用與統計報表一致的時區轉換方式
    let start, end;
    
    if (startDate.includes('T') || startDate.includes('Z')) {
      const startObj = new Date(startDate);
      const timezoneOffset = startObj.getTimezoneOffset();
      
      const localStart = new Date(startObj.getFullYear(), startObj.getMonth(), startObj.getDate());
      start = new Date(localStart.getTime() + (timezoneOffset * 60 * 1000));
    } else {
      const startObj = new Date(startDate);
      const taiwanTimezoneOffset = 8 * 60;
      const taiwanStart = new Date(startObj.getFullYear(), startObj.getMonth(), startObj.getDate());
      start = new Date(taiwanStart.getTime() - (taiwanTimezoneOffset * 60 * 1000));
    }
    
    if (endDate.includes('T') || endDate.includes('Z')) {
      const endObj = new Date(endDate);
      const timezoneOffset = endObj.getTimezoneOffset();
      
      const localEnd = new Date(endObj.getFullYear(), endObj.getMonth(), endObj.getDate(), 23, 59, 59, 999);
      end = new Date(localEnd.getTime() + (timezoneOffset * 60 * 1000));
    } else {
      const endObj = new Date(endDate);
      const taiwanTimezoneOffset = 8 * 60;
      const taiwanEnd = new Date(endObj.getFullYear(), endObj.getMonth(), endObj.getDate(), 23, 59, 59, 999);
      end = new Date(taiwanEnd.getTime() - (taiwanTimezoneOffset * 60 * 1000));
    }
    
    dateQuery.completedAt = { $gte: start, $lt: end };
    periodDisplay = `月報_${startDate}_${endDate}`;
  } else if (period === 'year' && startDate && endDate) {
    // 年份查詢 - 採用與統計報表一致的時區轉換方式
    let start, end;
    
    if (startDate.includes('T') || startDate.includes('Z')) {
      const startObj = new Date(startDate);
      const timezoneOffset = startObj.getTimezoneOffset();
      
      const localStart = new Date(startObj.getFullYear(), startObj.getMonth(), startObj.getDate());
      start = new Date(localStart.getTime() + (timezoneOffset * 60 * 1000));
    } else {
      const startObj = new Date(startDate);
      const taiwanTimezoneOffset = 8 * 60;
      const taiwanStart = new Date(startObj.getFullYear(), startObj.getMonth(), startObj.getDate());
      start = new Date(taiwanStart.getTime() - (taiwanTimezoneOffset * 60 * 1000));
    }
    
    if (endDate.includes('T') || endDate.includes('Z')) {
      const endObj = new Date(endDate);
      const timezoneOffset = endObj.getTimezoneOffset();
      
      const localEnd = new Date(endObj.getFullYear(), endObj.getMonth(), endObj.getDate(), 23, 59, 59, 999);
      end = new Date(localEnd.getTime() + (timezoneOffset * 60 * 1000));
    } else {
      const endObj = new Date(endDate);
      const taiwanTimezoneOffset = 8 * 60;
      const taiwanEnd = new Date(endObj.getFullYear(), endObj.getMonth(), endObj.getDate(), 23, 59, 59, 999);
      end = new Date(taiwanEnd.getTime() - (taiwanTimezoneOffset * 60 * 1000));
    }
    
    dateQuery.completedAt = { $gte: start, $lt: end };
    periodDisplay = `年報_${startDate}_${endDate}`;
  } else {
    // 預設查詢今天 - 採用與統計報表一致的時區轉換方式
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // 台灣時區是 UTC+8，所以需要減去 8 小時來轉換為 UTC
    const taiwanTimezoneOffset = 8 * 60; // 8小時 = 480分鐘
    
    const taiwanStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const taiwanEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    
    const startOfDay = new Date(taiwanStart.getTime() - (taiwanTimezoneOffset * 60 * 1000));
    const endOfDay = new Date(taiwanEnd.getTime() - (taiwanTimezoneOffset * 60 * 1000));
    
    dateQuery.completedAt = { $gte: startOfDay, $lte: endOfDay };
    periodDisplay = `日報_${todayStr}`;
  }

  try {
    // 獲取商家信息
    const Merchant = require('../models/merchant');
    const merchant = await Merchant.findById(merchantId).select('businessName');
    
    if (!merchant) {
      return next(new AppError('找不到商家信息', 404));
    }

    // 1. 獲取財務統計
    const financialStats = await Order.aggregate([
      { 
        $match: { 
          merchantId: new mongoose.Types.ObjectId(merchantId),
          status: 'completed',
          ...dateQuery 
        } 
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalOrders: { $sum: 1 },
          averageOrderValue: { $avg: '$totalAmount' }
        }
      }
    ]);

    // 2. 直接調用歷史訂單統計邏輯來獲取成本，確保與歷史訂單統計完全一致
    console.log('\n=== 歷史訂單成本計算調試 ===');
    console.log(`查詢條件:`, { merchantId, dateQuery });
    
    const historicalOrders = await Order.find({
      merchantId: new mongoose.Types.ObjectId(merchantId),
      status: 'completed',
      ...dateQuery
    }).populate('tableId').populate('items.historicalCost.consumptionDetails.inventoryId');

    console.log(`找到歷史訂單數量: ${historicalOrders.length}`);

    let totalHistoricalCost = 0;
    let orderCostDetails = [];
    
    if (historicalOrders && historicalOrders.length > 0) {
      historicalOrders.forEach((order, orderIndex) => {
        let orderCost = 0;
        let itemCostDetails = [];
        
        if (order.items && order.items.length > 0) {
          order.items.forEach((item, itemIndex) => {
            if (item.historicalCost && item.historicalCost.totalCost) {
              orderCost += item.historicalCost.totalCost;
              itemCostDetails.push({
                itemName: item.name || `項目${itemIndex + 1}`,
                cost: item.historicalCost.totalCost
              });
            }
          });
        }
        
        totalHistoricalCost += orderCost;
        orderCostDetails.push({
          orderNumber: order.orderNumber,
          orderCost: orderCost,
          items: itemCostDetails
        });
        
        console.log(`訂單 ${orderIndex + 1}: ${order.orderNumber} - 成本: ${orderCost}`);
        if (itemCostDetails.length > 0) {
          itemCostDetails.forEach(item => {
            console.log(`  - ${item.itemName}: ${item.cost}`);
          });
        }
      });
    }

    console.log(`總歷史成本: ${totalHistoricalCost}`);
    console.log('=== 歷史訂單成本計算完成 ===\n');

    const costStats = [{ totalCost: totalHistoricalCost }];

    // 3. 獲取人流量統計（使用與報表統計頁面相同的邏輯）
    const trafficStats = await Order.aggregate([
      { 
        $match: { 
          merchantId: new mongoose.Types.ObjectId(merchantId),
          status: 'completed',
          ...dateQuery 
        } 
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
        $addFields: {
          // 從訂單號解析客人組別
          customerGroup: {
            $let: {
              vars: {
                orderParts: { $split: ['$orderNumber', '-'] }
              },
              in: {
                $cond: {
                  if: { $gte: [{ $size: '$$orderParts' }, 2] },
                  then: {
                    $let: {
                      vars: {
                        dateGroupBatch: { $arrayElemAt: ['$$orderParts', 1] }
                      },
                      in: {
                        $cond: {
                          if: { $gte: [{ $strLenBytes: '$$dateGroupBatch' }, 12] },
                          then: {
                            $toString: {
                              $toInt: { $substr: ['$$dateGroupBatch', 8, 4] }
                            }
                          },
                          else: '1'
                        }
                      }
                    }
                  },
                  else: '1'
                }
              }
            }
          }
        }
      },
      {
        $group: {
          _id: { 
            tableId: '$tableId',
            customerGroup: '$customerGroup'
          },
          tableCapacity: { $first: '$tableInfo.capacity' },
          orderCount: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: null,
          totalCustomers: { $sum: '$tableCapacity' },
          uniqueCustomerGroups: { $addToSet: '$_id.customerGroup' },
          uniqueTables: { $addToSet: '$_id.tableId' }
        }
      },
      {
        $project: {
          totalCustomers: 1,
          totalCustomerGroups: { $size: '$uniqueCustomerGroups' },
          uniqueTableCount: { $size: '$uniqueTables' }
        }
      }
    ]);

    // 4. 獲取熱門餐點（前10名）
    const popularDishes = await Order.aggregate([
      { 
        $match: { 
          merchantId: new mongoose.Types.ObjectId(merchantId),
          status: 'completed',
          ...dateQuery 
        } 
      },
      {
        $unwind: '$items'
      },
      {
        $group: {
          _id: {
            dishId: '$items.dishId',
            dishName: '$items.name',
            category: '$items.category'
          },
          orderCount: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.unitPrice', '$items.quantity'] } }
        }
      },
      {
        $sort: { orderCount: -1 }
      },
      {
        $limit: 10
      }
    ]);

    // 5. 獲取時間序列數據 - 根據報表類型使用不同的分組方式
    let timeSeriesData;
    
    if (period === 'day') {
      // 日報：按小時分組
      timeSeriesData = await Order.aggregate([
        { 
          $match: { 
            merchantId: new mongoose.Types.ObjectId(merchantId),
            status: 'completed',
            ...dateQuery 
          } 
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
          $addFields: {
            customerGroup: {
              $let: {
                vars: {
                  orderParts: { $split: ['$orderNumber', '-'] }
                },
                in: {
                  $cond: {
                    if: { $gte: [{ $size: '$$orderParts' }, 2] },
                    then: {
                      $let: {
                        vars: {
                          dateGroupBatch: { $arrayElemAt: ['$$orderParts', 1] }
                        },
                        in: {
                          $cond: {
                            if: { $gte: [{ $strLenBytes: '$$dateGroupBatch' }, 12] },
                            then: {
                              $toString: {
                                $toInt: { $substr: ['$$dateGroupBatch', 8, 4] }
                              }
                            },
                            else: '1'
                          }
                        }
                      }
                    },
                    else: '1'
                  }
                }
              }
            }
          }
        },
        {
          $group: {
            _id: {
              timeSlot: {
                $dateToString: { 
                  format: "%H:00", 
                  date: "$completedAt",
                  timezone: "+08:00" // 台灣時區 UTC+8
                }
              },
              tableId: '$tableId',
              customerGroup: '$customerGroup'
            },
            tableCapacity: { $first: '$tableInfo.capacity' },
            orderCount: { $sum: 1 },
            revenue: { $sum: '$totalAmount' }
          }
        },
        {
          $group: {
            _id: '$_id.timeSlot',
            revenue: { $sum: '$revenue' },
            orderCount: { $sum: '$orderCount' },
            customerCount: { $sum: '$tableCapacity' },
            customerGroupCount: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);
    } else if (period === 'month') {
      // 月報：按天分組
      timeSeriesData = await Order.aggregate([
        { 
          $match: { 
            merchantId: new mongoose.Types.ObjectId(merchantId),
            status: 'completed',
            ...dateQuery 
          } 
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
          $addFields: {
            customerGroup: {
              $let: {
                vars: {
                  orderParts: { $split: ['$orderNumber', '-'] }
                },
                in: {
                  $cond: {
                    if: { $gte: [{ $size: '$$orderParts' }, 2] },
                    then: {
                      $let: {
                        vars: {
                          dateGroupBatch: { $arrayElemAt: ['$$orderParts', 1] }
                        },
                        in: {
                          $cond: {
                            if: { $gte: [{ $strLenBytes: '$$dateGroupBatch' }, 12] },
                            then: {
                              $toString: {
                                $toInt: { $substr: ['$$dateGroupBatch', 8, 4] }
                              }
                            },
                            else: '1'
                          }
                        }
                      }
                    },
                    else: '1'
                  }
                }
              }
            }
          }
        },
        {
          $group: {
            _id: {
              timeSlot: {
                $dateToString: { 
                  format: "%m/%d", 
                  date: "$completedAt",
                  timezone: "+08:00" // 台灣時區 UTC+8
                }
              },
              tableId: '$tableId',
              customerGroup: '$customerGroup'
            },
            tableCapacity: { $first: '$tableInfo.capacity' },
            orderCount: { $sum: 1 },
            revenue: { $sum: '$totalAmount' }
          }
        },
        {
          $group: {
            _id: '$_id.timeSlot',
            revenue: { $sum: '$revenue' },
            orderCount: { $sum: '$orderCount' },
            customerCount: { $sum: '$tableCapacity' },
            customerGroupCount: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);
    } else if (period === 'year') {
      // 年報：按月分組
      timeSeriesData = await Order.aggregate([
        { 
          $match: { 
            merchantId: new mongoose.Types.ObjectId(merchantId),
            status: 'completed',
            ...dateQuery 
          } 
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
          $addFields: {
            customerGroup: {
              $let: {
                vars: {
                  orderParts: { $split: ['$orderNumber', '-'] }
                },
                in: {
                  $cond: {
                    if: { $gte: [{ $size: '$$orderParts' }, 2] },
                    then: {
                      $let: {
                        vars: {
                          dateGroupBatch: { $arrayElemAt: ['$$orderParts', 1] }
                        },
                        in: {
                          $cond: {
                            if: { $gte: [{ $strLenBytes: '$$dateGroupBatch' }, 12] },
                            then: {
                              $toString: {
                                $toInt: { $substr: ['$$dateGroupBatch', 8, 4] }
                              }
                            },
                            else: '1'
                          }
                        }
                      }
                    },
                    else: '1'
                  }
                }
              }
            }
          }
        },
        {
          $group: {
            _id: {
              timeSlot: {
                $dateToString: { 
                  format: "%Y年%m月", 
                  date: "$completedAt",
                  timezone: "+08:00" // 台灣時區 UTC+8
                }
              },
              tableId: '$tableId',
              customerGroup: '$customerGroup'
            },
            tableCapacity: { $first: '$tableInfo.capacity' },
            orderCount: { $sum: 1 },
            revenue: { $sum: '$totalAmount' }
          }
        },
        {
          $group: {
            _id: '$_id.timeSlot',
            revenue: { $sum: '$revenue' },
            orderCount: { $sum: '$orderCount' },
            customerCount: { $sum: '$tableCapacity' },
            customerGroupCount: { $sum: 1 }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]);
    }

    // 重新計算總客人組數，避免重複計算
    const totalCustomerGroupsResult = await Order.aggregate([
      { 
        $match: { 
          merchantId: new mongoose.Types.ObjectId(merchantId),
          status: 'completed',
          ...dateQuery 
        } 
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
        $addFields: {
          customerGroup: {
            $let: {
              vars: {
                orderParts: { $split: ['$orderNumber', '-'] }
              },
              in: {
                $cond: {
                  if: { $gte: [{ $size: '$$orderParts' }, 2] },
                  then: {
                    $let: {
                      vars: {
                        dateGroupBatch: { $arrayElemAt: ['$$orderParts', 1] }
                      },
                      in: {
                        $cond: {
                          if: { $gte: [{ $strLenBytes: '$$dateGroupBatch' }, 12] },
                          then: {
                            $toString: {
                              $toInt: { $substr: ['$$dateGroupBatch', 8, 4] }
                            }
                          },
                          else: '1'
                        }
                      }
                    }
                  },
                  else: '1'
                }
              }
            }
          }
        }
      },
      {
        $group: {
          _id: { 
            tableId: '$tableId',
            customerGroup: '$customerGroup'
          }
        }
      },
      {
        $group: {
          _id: null,
          totalCustomerGroups: { $sum: 1 }
        }
      }
    ]);
    
    const totalCustomerGroups = totalCustomerGroupsResult[0]?.totalCustomerGroups || 0;

    // 計算增長率（簡化版，匯出報表不需要複雜的增長率計算）
    const revenueChange = '0.0'; // 預設值
    const customerGroupsChange = '0.0'; // 預設值

    // 準備Excel數據
    const workbook = XLSX.utils.book_new();

    // 工作表1: 財務摘要
    const financialData = [
      ['項目', '數值', '單位', '備註'],
      ['總營收', financialStats[0]?.totalRevenue || 0, '元', '本期總營收'],
      ['總成本', costStats[0]?.totalCost || 0, '元', '基於庫存成本計算'],
      ['總利潤', (financialStats[0]?.totalRevenue || 0) - (costStats[0]?.totalCost || 0), '元', '營收 - 成本'],
      ['利潤率', financialStats[0]?.totalRevenue ? (((financialStats[0].totalRevenue - (costStats[0]?.totalCost || 0)) / financialStats[0].totalRevenue) * 100).toFixed(1) + '%' : '0%', '%', '(利潤/營收) × 100'],
      ['成本率', financialStats[0]?.totalRevenue ? (((costStats[0]?.totalCost || 0) / financialStats[0].totalRevenue) * 100).toFixed(1) + '%' : '0%', '%', '(成本/營收) × 100'],
      ['總客人組數', totalCustomerGroups || 0, '組', '已結帳客人組'],
      ['平均訂單金額', totalCustomerGroups ? Math.round((financialStats[0]?.totalRevenue || 0) / totalCustomerGroups) : 0, '元', '總營收/總客人組數'],
      ['營收增長率', revenueChange + '%', '%', '與前一期比較'],
      ['客人組數增長率', customerGroupsChange + '%', '%', '與前一期比較']
    ];

    const financialSheet = XLSX.utils.aoa_to_sheet(financialData);
    financialSheet['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(workbook, financialSheet, '財務摘要');

    // 工作表2: 人流量統計
    const trafficData = [
      ['項目', '數值', '單位', '備註'],
      ['總顧客數', trafficStats[0]?.totalCustomers || 0, '人', '基於桌次容量計算'],
      ['使用桌次數', trafficStats[0]?.uniqueTableCount || 0, '桌', '實際使用桌數'],
      ['平均停留時間', 45, '分鐘', '預設值']
    ];

    const trafficSheet = XLSX.utils.aoa_to_sheet(trafficData);
    trafficSheet['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(workbook, trafficSheet, '人流量統計');

    // 工作表3: 熱門餐點
    const dishesData = [
      ['排名', '餐點名稱', '分類', '訂購次數', '營收', '佔總營收比例']
    ];

    const totalRevenue = financialStats[0]?.totalRevenue || 0;
    popularDishes.forEach((dish, index) => {
      const revenuePercentage = totalRevenue ? ((dish.revenue / totalRevenue) * 100).toFixed(1) + '%' : '0%';
      dishesData.push([
        index + 1,
        dish._id.dishName,
        dish._id.category,
        dish.orderCount,
        dish.revenue,
        revenuePercentage
      ]);
    });

    const dishesSheet = XLSX.utils.aoa_to_sheet(dishesData);
    dishesSheet['!cols'] = [{ wch: 8 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, dishesSheet, '熱門餐點');

    // 工作表4: 營收趨勢
    const revenueData = [
      ['時間', '營收', '客人組數', '平均訂單金額']
    ];

    timeSeriesData.forEach(item => {
      const avgOrderValue = item.customerGroupCount ? Math.round(item.revenue / item.customerGroupCount) : 0;
      revenueData.push([
        item._id,
        item.revenue,
        item.customerGroupCount,
        avgOrderValue
      ]);
    });

    const revenueSheet = XLSX.utils.aoa_to_sheet(revenueData);
    revenueSheet['!cols'] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, revenueSheet, '營收趨勢');

    // 工作表5: 報表資訊
    const infoData = [
      ['項目', '內容'],
      ['報表期間', periodDisplay],
      ['報表類型', period === 'day' ? '日報' : period === 'month' ? '月報' : '年報'],
      ['匯出時間', new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })],
      ['商家名稱', merchant.businessName],
      ['商家ID', merchantId]
    ];

    const infoSheet = XLSX.utils.aoa_to_sheet(infoData);
    infoSheet['!cols'] = [{ wch: 15 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(workbook, infoSheet, '報表資訊');

    // 生成檔案名稱：根據報表類型使用不同格式
    let fileName;
    if (period === 'day' && date) {
      // 日報：年月日-餐廳名稱-統計報表
      fileName = `${date.replace(/-/g, '')}-${merchant.businessName}-統計報表`;
    } else if (period === 'month' && startDate) {
      // 月報：年份-月份-餐廳名稱-統計報表
      const year = startDate.split('-')[0];
      const month = parseInt(startDate.split('-')[1]);
      fileName = `${year}-${month}-${merchant.businessName}-統計報表`;
    } else if (period === 'year' && startDate) {
      // 年報：年份-餐廳名稱-統計報表
      const year = startDate.split('-')[0];
      fileName = `${year}-${merchant.businessName}-統計報表`;
    } else {
      // 預設使用當前日期
      const now = new Date();
      const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
      fileName = `${dateStr}-${merchant.businessName}-統計報表`;
    }
    
    // 添加檔案名稱到響應標頭中，供前端使用
    res.setHeader('X-File-Name', encodeURIComponent(fileName));

    if (format === 'csv') {
      // 匯出 CSV（只匯出財務摘要）
      const csvContent = convertToCSV(financialData);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      const encodedFileName = encodeURIComponent(`${fileName}.csv`);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
      res.send('\ufeff' + csvContent); // 添加 BOM 以支援中文
    } else {
      // 匯出 Excel
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const encodedFileName = encodeURIComponent(`${fileName}.xlsx`);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      res.send(buffer);
    }

  } catch (error) {
    console.error('匯出報表失敗:', error);
    return next(new AppError('匯出報表失敗', 500));
  }
});

// 輔助函數：轉換為 CSV 格式
function convertToCSV(data) {
  if (data.length === 0) return '';
  
  const csvRows = [];
  
  // 添加數據行
  for (const row of data) {
    const values = row.map(value => {
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
