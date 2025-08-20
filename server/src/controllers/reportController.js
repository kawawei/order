const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Order = require('../models/order');
const Table = require('../models/table');
const Dish = require('../models/dish');
const mongoose = require('mongoose');


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
    // 單日查詢
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    dateQuery.createdAt = { $gte: startOfDay, $lte: endOfDay };
    // 使用台灣時區格式化時間
    groupBy = { 
      $dateToString: { 
        format: "%H:00", 
        date: { $add: ["$createdAt", 8 * 60 * 60 * 1000] } // 轉換為台灣時區 (UTC+8)
      } 
    };
  } else if (period === 'month' && startDate && endDate) {
    // 月份查詢
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    dateQuery.createdAt = { $gte: start, $lt: end };
    groupBy = { 
      $dateToString: { 
        format: "%Y-%m-%d", 
        date: { $add: ["$createdAt", 8 * 60 * 60 * 1000] } // 轉換為台灣時區 (UTC+8)
      } 
    };
  } else if (period === 'year' && startDate && endDate) {
    // 年份查詢
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    dateQuery.createdAt = { $gte: start, $lt: end };
    groupBy = { 
      $dateToString: { 
        format: "%Y-%m", 
        date: { $add: ["$createdAt", 8 * 60 * 60 * 1000] } // 轉換為台灣時區 (UTC+8)
      } 
    };
  } else {
    // 預設查詢今天
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateQuery.createdAt = { $gte: today, $lt: tomorrow };
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
          orderCount: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.timeSlot',
          totalCustomers: { $sum: '$tableCapacity' }, // 直接加總桌次容量，不乘以訂單數
          tableUsageCount: { $sum: '$orderCount' },
          uniqueTables: { $addToSet: '$_id.tableId' }
        }
      },
      {
        $project: {
          _id: 1,
          totalCustomers: 1,
          tableUsageCount: 1,
          uniqueTableCount: { $size: '$uniqueTables' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

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
    const totalOrders = revenueStats.reduce((sum, stat) => sum + stat.orderCount, 0);
    const totalCustomers = trafficStats.reduce((sum, stat) => sum + stat.totalCustomers, 0);
    
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
          totalOrders,
          averageOrderValue: totalCustomers > 0 ? Math.round(totalRevenue / totalCustomers) : 0,
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
          tableUsageCount: trafficStats.reduce((sum, stat) => sum + stat.tableUsageCount, 0),
          uniqueTableCount: trafficStats.reduce((sum, stat) => sum + stat.uniqueTableCount, 0),
          customerChange: 0, // 可以根據需要計算
          peakHours: peakHoursFormatted,
          averageStayTime: 45, // 預設值，可以根據實際數據計算
          trafficTrend: trafficStats
        },
        
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
