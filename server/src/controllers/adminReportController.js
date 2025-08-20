const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Order = require('../models/order');
const Merchant = require('../models/merchant');
const MenuItem = require('../models/menuItem');
const mongoose = require('mongoose');
const XLSX = require('xlsx');

// 獲取餐廳列表
exports.getRestaurants = catchAsync(async (req, res, next) => {
  try {
    const restaurants = await Merchant.find(
      { status: 'active' },
      { _id: 1, businessName: 1, merchantCode: 1 }
    ).sort({ businessName: 1 });

    res.status(200).json({
      status: 'success',
      data: restaurants
    });
  } catch (error) {
    console.error('獲取餐廳列表時發生錯誤:', error);
    return next(new AppError('獲取餐廳列表失敗', 500));
  }
});

// 獲取平台報表統計數據
exports.getPlatformStats = catchAsync(async (req, res, next) => {
  const { period, date, startDate, endDate, restaurantId } = req.query;

  // 構建日期查詢條件
  let dateQuery = {};
  let groupBy = {};
  
  if (period === 'day' && date) {
    // 單日查詢
    const startOfDay = new Date(date + 'T00:00:00');
    const endOfDay = new Date(date + 'T23:59:59.999');
    dateQuery.createdAt = { $gte: startOfDay, $lte: endOfDay };
    groupBy = { 
      $dateToString: { 
        format: "%H:00", 
        date: { $add: ["$createdAt", 8 * 60 * 60 * 1000] } // 轉換為台灣時區 (UTC+8)
      } 
    };
  } else if (period === 'month' && startDate && endDate) {
    // 月份查詢
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
    // 年份查詢
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59.999');
    dateQuery.createdAt = { $gte: start, $lt: end };
    groupBy = { 
      $dateToString: { 
        format: "%Y-%m", 
        date: { $add: ["$createdAt", 8 * 60 * 60 * 1000] }
      } 
    };
  } else {
    // 預設查詢今天
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
    // 構建查詢條件
    const matchCondition = {
      status: 'completed', // 只計算已結帳的訂單
      ...dateQuery
    };

    // 如果指定了餐廳ID，則只查詢該餐廳的訂單
    if (restaurantId && restaurantId !== 'all') {
      matchCondition.merchantId = new mongoose.Types.ObjectId(restaurantId);
    }

    // 1. 獲取平台總營收統計（只計算已結帳的訂單）
    const revenueStats = await Order.aggregate([
      { 
        $match: matchCondition
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

    // 2. 獲取活躍商家統計（僅在查看所有餐廳時計算）
    let activeMerchantsStats = [];
    if (!restaurantId || restaurantId === 'all') {
      activeMerchantsStats = await Order.aggregate([
        { 
          $match: { 
            status: 'completed',
            ...dateQuery 
          } 
        },
      {
        $group: {
          _id: '$merchantId'
        }
      },
      {
        $group: {
          _id: null,
          activeMerchants: { $sum: 1 }
        }
      }
    ]);

    // 3. 獲取總訂單數
    const totalOrdersStats = await Order.aggregate([
      { 
        $match: matchCondition
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 }
        }
      }
    ]);

    // 4. 計算營收、成本和利潤
    const totalRevenue = revenueStats.reduce((sum, item) => sum + item.revenue, 0);
    
    // 計算成本（假設成本率為 70%）
    const costRate = 0.7;
    const totalCost = totalRevenue * costRate;
    
    // 計算淨利
    const totalProfit = totalRevenue - totalCost;
    
    // 計算毛利率
    const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue * 100).toFixed(1) : 0;
    
    // 計算平台佣金（假設佣金率為 5%）
    const commissionRate = 0.05;
    const totalCommission = totalRevenue * commissionRate;

    // 5. 獲取熱門商家排行（僅在查看所有餐廳時顯示）
    let topMerchants = [];
    if (!restaurantId || restaurantId === 'all') {
      topMerchants = await Order.aggregate([
        { 
          $match: { 
            status: 'completed',
            ...dateQuery 
          } 
        },
      {
        $group: {
          _id: '$merchantId',
          orderCount: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      {
        $lookup: {
          from: 'merchants',
          localField: '_id',
          foreignField: '_id',
          as: 'merchant'
        }
      },
      {
        $unwind: '$merchant'
      },
      {
        $project: {
          _id: 1,
          businessName: '$merchant.businessName',
          merchantCode: '$merchant.merchantCode',
          orderCount: 1,
          revenue: 1
        }
      },
      {
        $sort: { revenue: -1 }
      },
      {
        $limit: 10
      }
    ]);

    // 6. 如果是單餐廳查詢，獲取詳細資訊
    let restaurantDetails = {};
    if (restaurantId && restaurantId !== 'all') {
      // 獲取受歡迎餐點
      const popularItems = await Order.aggregate([
        { $match: matchCondition },
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.menuItemId',
            orderCount: { $sum: '$items.quantity' },
            revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
          }
        },
        {
          $lookup: {
            from: 'menuitems',
            localField: '_id',
            foreignField: '_id',
            as: 'menuItem'
          }
        },
        { $unwind: '$menuItem' },
        {
          $project: {
            _id: 1,
            name: '$menuItem.name',
            category: '$menuItem.category',
            orderCount: 1,
            revenue: 1
          }
        },
        { $sort: { orderCount: -1 } },
        { $limit: 10 }
      ]);

      // 獲取熱門時段
      const peakHours = await Order.aggregate([
        { $match: matchCondition },
        {
          $group: {
            _id: {
              hour: { $hour: { $add: ['$createdAt', 8 * 60 * 60 * 1000] } }
            },
            orderCount: { $sum: 1 }
          }
        },
        {
          $project: {
            hour: { $concat: ['$_id.hour', ':00'] },
            orderCount: 1
          }
        },
        { $sort: { '_id.hour': 1 } }
      ]);

      // 計算時段百分比
      const totalOrdersForHours = peakHours.reduce((sum, hour) => sum + hour.orderCount, 0);
      const peakHoursWithPercentage = peakHours.map(hour => ({
        ...hour,
        percentage: totalOrdersForHours > 0 ? (hour.orderCount / totalOrdersForHours * 100).toFixed(1) : 0
      }));

      // 獲取訂單統計
      const orderStats = await Order.aggregate([
        { $match: matchCondition },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            avgOrderValue: { $avg: '$totalAmount' },
            completedOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            cancelledOrders: {
              $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
            }
          }
        }
      ]);

      restaurantDetails = {
        popularItems,
        peakHours: peakHoursWithPercentage,
        totalOrders: orderStats[0]?.totalOrders || 0,
        avgOrderValue: orderStats[0]?.avgOrderValue || 0,
        completedOrders: orderStats[0]?.completedOrders || 0,
        cancelledOrders: orderStats[0]?.cancelledOrders || 0
      };
    }

    // 7. 計算增長率（與前一天/月/年比較）
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
      // 獲取前一期的統計數據
      const [prevRevenueStats, prevMerchantStats, prevOrderStats] = await Promise.all([
        Order.aggregate([
          { $match: { status: 'completed', ...previousPeriodQuery } },
          { $group: { _id: null, revenue: { $sum: '$totalAmount' } } }
        ]),
        Order.aggregate([
          { $match: { status: 'completed', ...previousPeriodQuery } },
          { $group: { _id: '$merchantId' } },
          { $group: { _id: null, activeMerchants: { $sum: 1 } } }
        ]),
        Order.aggregate([
          { $match: { status: 'completed', ...previousPeriodQuery } },
          { $group: { _id: null, totalOrders: { $sum: 1 } } }
        ])
      ]);

      const prevRevenue = prevRevenueStats[0]?.revenue || 0;
      const prevMerchants = prevMerchantStats[0]?.activeMerchants || 0;
      const prevOrders = prevOrderStats[0]?.totalOrders || 0;
      const prevCommission = prevRevenue * commissionRate;

      // 計算增長率
      const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
      const merchantChange = prevMerchants > 0 ? ((activeMerchantsStats[0]?.activeMerchants || 0) - prevMerchants) / prevMerchants * 100 : 0;
      const orderChange = prevOrders > 0 ? ((totalOrdersStats[0]?.totalOrders || 0) - prevOrders) / prevOrders * 100 : 0;
      const commissionChange = prevCommission > 0 ? ((totalCommission - prevCommission) / prevCommission) * 100 : 0;

      previousPeriodStats = {
        revenueChange: Math.round(revenueChange * 100) / 100,
        merchantChange: Math.round(merchantChange * 100) / 100,
        orderChange: Math.round(orderChange * 100) / 100,
        commissionChange: Math.round(commissionChange * 100) / 100
      };
    }

    // 7. 準備圖表數據
    const revenueChart = revenueStats.map(item => ({
      label: item._id,
      value: item.revenue
    }));

    const merchantChart = revenueStats.map(item => ({
      label: item._id,
      value: item.orderCount
    }));

    // 回傳結果
    res.status(200).json({
      status: 'success',
      data: {
        totalRevenue,
        activeMerchants: activeMerchantsStats[0]?.activeMerchants || 0,
        totalOrders: totalOrdersStats[0]?.totalOrders || 0,
        totalCommission,
        revenueChange: previousPeriodStats?.revenueChange || 0,
        merchantChange: previousPeriodStats?.merchantChange || 0,
        orderChange: previousPeriodStats?.orderChange || 0,
        commissionChange: previousPeriodStats?.commissionChange || 0,
        topMerchants,
        revenueChart,
        merchantChart
      }
    });

  } catch (error) {
    console.error('獲取平台報表統計時發生錯誤:', error);
    return next(new AppError('獲取平台報表統計失敗', 500));
  }
});

// 匯出平台報表
exports.exportPlatformReport = catchAsync(async (req, res, next) => {
  const { period, date, startDate, endDate } = req.query;

  // 構建日期查詢條件
  let dateQuery = {};
  
  if (period === 'day' && date) {
    const startOfDay = new Date(date + 'T00:00:00');
    const endOfDay = new Date(date + 'T23:59:59.999');
    dateQuery.createdAt = { $gte: startOfDay, $lte: endOfDay };
  } else if (period === 'month' && startDate && endDate) {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59.999');
    dateQuery.createdAt = { $gte: start, $lt: end };
  } else if (period === 'year' && startDate && endDate) {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T23:59:59.999');
    dateQuery.createdAt = { $gte: start, $lt: end };
  } else {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const startOfDay = new Date(todayStr + 'T00:00:00');
    const endOfDay = new Date(todayStr + 'T23:59:59.999');
    dateQuery.createdAt = { $gte: startOfDay, $lte: endOfDay };
  }

  try {
    // 獲取詳細的訂單數據
    const orders = await Order.aggregate([
      { 
        $match: { 
          status: 'completed',
          ...dateQuery 
        } 
      },
      {
        $lookup: {
          from: 'merchants',
          localField: 'merchantId',
          foreignField: '_id',
          as: 'merchant'
        }
      },
      {
        $unwind: '$merchant'
      },
      {
        $project: {
          orderNumber: 1,
          businessName: '$merchant.businessName',
          merchantCode: '$merchant.merchantCode',
          totalAmount: 1,
          status: 1,
          createdAt: 1,
          items: 1
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ]);

    // 創建 Excel 工作簿
    const workbook = XLSX.utils.book_new();

    // 訂單詳情工作表
    const orderData = orders.map(order => ({
      '訂單編號': order.orderNumber,
      '商家名稱': order.businessName,
      '商家代碼': order.merchantCode,
      '訂單金額': order.totalAmount,
      '訂單狀態': order.status,
      '建立時間': new Date(order.createdAt).toLocaleString('zh-TW')
    }));

    const orderWorksheet = XLSX.utils.json_to_sheet(orderData);
    XLSX.utils.book_append_sheet(workbook, orderWorksheet, '訂單詳情');

    // 商家統計工作表
    const merchantStats = await Order.aggregate([
      { 
        $match: { 
          status: 'completed',
          ...dateQuery 
        } 
      },
      {
        $group: {
          _id: '$merchantId',
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: '$totalAmount' }
        }
      },
      {
        $lookup: {
          from: 'merchants',
          localField: '_id',
          foreignField: '_id',
          as: 'merchant'
        }
      },
      {
        $unwind: '$merchant'
      },
      {
        $project: {
          businessName: '$merchant.businessName',
          merchantCode: '$merchant.merchantCode',
          orderCount: 1,
          totalRevenue: 1
        }
      },
      {
        $sort: { totalRevenue: -1 }
      }
    ]);

    const merchantData = merchantStats.map(merchant => ({
      '商家名稱': merchant.businessName,
      '商家代碼': merchant.merchantCode,
      '訂單數量': merchant.orderCount,
      '總營收': merchant.totalRevenue
    }));

    const merchantWorksheet = XLSX.utils.json_to_sheet(merchantData);
    XLSX.utils.book_append_sheet(workbook, merchantWorksheet, '商家統計');

    // 生成 Excel 檔案
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // 設定回應標頭
    const fileName = `平台報表_${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    res.send(excelBuffer);

  } catch (error) {
    console.error('匯出平台報表時發生錯誤:', error);
    return next(new AppError('匯出平台報表失敗', 500));
  }
});
