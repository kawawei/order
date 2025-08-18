const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Order = require('../models/order');
const Table = require('../models/table');
const Dish = require('../models/dish');
const mongoose = require('mongoose');

// 獲取商家ID
const getMerchantId = (req) => {
  return req.merchant.id;
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
    groupBy = { $dateToString: { format: "%H:00", date: "$createdAt" } };
  } else if (period === 'month' && startDate && endDate) {
    // 月份查詢
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    dateQuery.createdAt = { $gte: start, $lt: end };
    groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
  } else if (period === 'year' && startDate && endDate) {
    // 年份查詢
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    dateQuery.createdAt = { $gte: start, $lt: end };
    groupBy = { $dateToString: { format: "%Y-%m", date: "$createdAt" } };
  } else {
    // 預設查詢今天
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateQuery.createdAt = { $gte: today, $lt: tomorrow };
    groupBy = { $dateToString: { format: "%H:00", date: "$createdAt" } };
  }

  try {
    // 1. 獲取營收統計
    const revenueStats = await Order.aggregate([
      { 
        $match: { 
          merchantId: new mongoose.Types.ObjectId(merchantId),
          status: { $nin: ['cancelled'] }, // 排除取消的訂單
          ...dateQuery 
        } 
      },
      {
        $group: {
          _id: groupBy,
          revenue: { $sum: '$totalAmount' },
          orderCount: { $sum: 1 },
          customerCount: { $sum: 1 } // 每個訂單代表一組客人
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 2. 獲取人流量統計（基於桌次使用）
    const trafficStats = await Order.aggregate([
      { 
        $match: { 
          merchantId: new mongoose.Types.ObjectId(merchantId),
          status: { $nin: ['cancelled'] },
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
        $group: {
          _id: groupBy,
          totalCustomers: { $sum: '$tableInfo.capacity' }, // 使用桌次容量
          tableUsageCount: { $sum: 1 },
          uniqueTables: { $addToSet: '$tableId' }
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

    // 3. 獲取熱門餐點統計
    const popularDishes = await Order.aggregate([
      { 
        $match: { 
          merchantId: new mongoose.Types.ObjectId(merchantId),
          status: { $nin: ['cancelled'] },
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
        $sort: { orderCount: -1, revenue: -1 }
      },
      {
        $limit: 10
      }
    ]);

    // 4. 計算總計數據
    const totalRevenue = revenueStats.reduce((sum, stat) => sum + stat.revenue, 0);
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
            status: { $nin: ['cancelled'] },
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

    // 6. 獲取高峰時段
    const peakHours = await Order.aggregate([
      { 
        $match: { 
          merchantId: new mongoose.Types.ObjectId(merchantId),
          status: { $nin: ['cancelled'] },
          ...dateQuery 
        } 
      },
      {
        $group: {
          _id: { $hour: '$createdAt' },
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
          averageOrderValue: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
          revenueChange: parseFloat(revenueChange),
          revenueTrend: revenueStats
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
          status: { $nin: ['cancelled'] },
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
          status: { $nin: ['cancelled'] },
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
        $group: {
          _id: null,
          totalCustomers: { $sum: '$tableInfo.capacity' }
        }
      }
    ]);

    // 獲取今日熱門餐點（前5名）
    const todayPopularDishes = await Order.aggregate([
      { 
        $match: { 
          merchantId: new mongoose.Types.ObjectId(merchantId),
          status: { $nin: ['cancelled'] },
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
