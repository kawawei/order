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

  // 構建日期查詢條件
  let dateQuery = {};
  let groupBy = {};
  
  if (period === 'day' && date) {
    // 單日查詢 - 正確處理台灣時區
    // 直接使用本地時間，避免時區轉換問題
    const startOfDay = new Date(date + 'T00:00:00');
    const endOfDay = new Date(date + 'T23:59:59.999');
    dateQuery.createdAt = { $gte: startOfDay, $lte: endOfDay };
    // 使用台灣時區格式化時間
    groupBy = { 
      $dateToString: { 
        format: "%H:00", 
        date: { $add: ["$createdAt", 8 * 60 * 60 * 1000] } // 轉換為台灣時區 (UTC+8)
      } 
    };
  } else if (period === 'month' && startDate && endDate) {
    // 月份查詢 - 正確處理台灣時區
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59.999');
    dateQuery.createdAt = { $gte: start, $lt: end };
    groupBy = { 
      $dateToString: { 
        format: "%Y-%m-%d", 
        date: { $add: ["$createdAt", 8 * 60 * 60 * 1000] } // 轉換為台灣時區 (UTC+8)
      } 
    };
  } else if (period === 'year' && startDate && endDate) {
    // 年份查詢 - 正確處理台灣時區
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59.999');
    dateQuery.createdAt = { $gte: start, $lt: end };
    groupBy = { 
      $dateToString: { 
        format: "%Y-%m", 
        date: { $add: ["$createdAt", 8 * 60 * 60 * 1000] } // 轉換為台灣時區 (UTC+8)
      } 
    };
  } else {
    // 預設查詢今天 - 正確處理台灣時區
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const startOfDay = new Date(todayStr + 'T00:00:00');
    const endOfDay = new Date(todayStr + 'T23:59:59.999');
    dateQuery.createdAt = { $gte: startOfDay, $lte: endOfDay };
    groupBy = { 
      $dateToString: { 
        format: "%H:00", 
        date: { $add: ["$createdAt", 8 * 60 * 60 * 1000] } // 轉換為台灣時區 (UTC+8)
      } 
    };
  }

  try {
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

    // 2. 獲取人流量統計（基於桌次使用，只計算已結帳的訂單）
    // 使用與儀表板相同的邏輯：按桌次和客人組別分組
    
    // 調試：先獲取原始訂單數據
    const debugOrders = await Order.find({
      merchantId: new mongoose.Types.ObjectId(merchantId),
      status: 'completed',
      ...dateQuery
    }).select('orderNumber tableId createdAt totalAmount status');
    
    console.log('=== 調試：原始訂單數據 ===');
    console.log(`總訂單數: ${debugOrders.length}`);
    debugOrders.forEach((order, index) => {
      console.log(`訂單 ${index + 1}: ${order.orderNumber} | 桌次: ${order.tableId} | 金額: ${order.totalAmount} | 時間: ${order.createdAt}`);
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
    const totalCost = await Order.aggregate([
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
          totalCost: { $sum: '$totalCost' }
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
      // 與前一天比較
      const currentDate = new Date(date);
      const previousDate = new Date(currentDate);
      previousDate.setDate(previousDate.getDate() - 1);
      
      previousPeriodQuery.createdAt = {
        $gte: new Date(previousDate.getFullYear(), previousDate.getMonth(), previousDate.getDate()),
        $lt: new Date(previousDate.getFullYear(), previousDate.getMonth(), previousDate.getDate() + 1)
      };
    } else if (period === 'month' && startDate) {
      // 與上個月比較
      const currentStart = new Date(startDate);
      const previousStart = new Date(currentStart);
      previousStart.setMonth(previousStart.getMonth() - 1);
      const previousEnd = new Date(currentStart);
      previousEnd.setMonth(previousEnd.getMonth() - 1);
      previousEnd.setDate(0);
      
      previousPeriodQuery.createdAt = {
        $gte: previousStart,
        $lt: previousEnd
      };
    } else if (period === 'year' && startDate) {
      // 與上一年比較
      const currentStart = new Date(startDate);
      const previousStart = new Date(currentStart);
      previousStart.setFullYear(previousStart.getFullYear() - 1);
      const previousEnd = new Date(currentStart);
      previousEnd.setFullYear(previousEnd.getFullYear() - 1);
      
      previousPeriodQuery.createdAt = {
        $gte: previousStart,
        $lt: previousEnd
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
      }).select('orderNumber tableId createdAt totalAmount status');
      
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
    
    const peakHours = await Order.aggregate([
      { 
        $match: { 
          merchantId: new mongoose.Types.ObjectId(merchantId),
          status: 'completed', // 只計算已結帳的訂單
          createdAt: { $gte: sevenDaysAgo }
        } 
      },
      {
        $addFields: {
          // 轉換為台灣時區 (UTC+8)
          localHour: {
            $add: [
              { $hour: '$createdAt' },
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
    dateQuery.createdAt = { $gte: startOfDay, $lte: endOfDay };
  } else {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateQuery.createdAt = { $gte: today, $lt: tomorrow };
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
    // 單日查詢 - 正確處理台灣時區
    const startOfDay = new Date(date + 'T00:00:00');
    const endOfDay = new Date(date + 'T23:59:59.999');
    dateQuery.createdAt = { $gte: startOfDay, $lte: endOfDay };
    periodDisplay = `日報_${date}`;
  } else if (period === 'month' && startDate && endDate) {
    // 月份查詢 - 正確處理台灣時區
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59.999');
    dateQuery.createdAt = { $gte: start, $lt: end };
    periodDisplay = `月報_${startDate}_${endDate}`;
  } else if (period === 'year' && startDate && endDate) {
    // 年份查詢 - 正確處理台灣時區
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59.999');
    dateQuery.createdAt = { $gte: start, $lt: end };
    periodDisplay = `年報_${startDate}_${endDate}`;
  } else {
    // 預設查詢今天 - 正確處理台灣時區
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const startOfDay = new Date(todayStr + 'T00:00:00');
    const endOfDay = new Date(todayStr + 'T23:59:59.999');
    dateQuery.createdAt = { $gte: startOfDay, $lte: endOfDay };
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

    // 2. 獲取成本統計（基於訂單中已計算的庫存成本）
    const costStats = await Order.aggregate([
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
          totalCost: { $sum: '$totalCost' }
        }
      }
    ]);

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

    // 5. 獲取時間序列數據
    const timeSeriesData = await Order.aggregate([
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
            timeSlot: {
              $dateToString: { 
                format: "%H:00", 
                date: { $add: ["$createdAt", 8 * 60 * 60 * 1000] } // 轉換為台灣時區 (UTC+8)
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
          customerGroupCount: { $sum: 1 } // 計算客人組數
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

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

    // 生成檔案名稱：使用報表期間的日期，而不是當前時間
    let fileNameDateStr;
    if (period === 'day' && date) {
      // 使用報表日期
      fileNameDateStr = date.replace(/-/g, '');
    } else if (period === 'month' && startDate) {
      // 使用月份開始日期
      fileNameDateStr = startDate.replace(/-/g, '');
    } else if (period === 'year' && startDate) {
      // 使用年份開始日期
      fileNameDateStr = startDate.replace(/-/g, '');
    } else {
      // 預設使用當前日期
      const now = new Date();
      fileNameDateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
    }
    const fileName = `${fileNameDateStr}-${merchant.businessName}-統計報表`;
    
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
