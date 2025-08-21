const Order = require('../models/order');
const Merchant = require('../models/merchant');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const XLSX = require('xlsx');
const mongoose = require('mongoose');

/**
 * 獲取平台統計數據
 * 支援日、月、年三種週期，以及單一餐廳查詢
 */
exports.getPlatformStats = catchAsync(async (req, res, next) => {
  const { period, date, startDate, endDate, restaurantId } = req.query;
  
  console.log('=== 後端報表統計調試 ===')
  console.log('請求參數:', { period, date, startDate, endDate, restaurantId })

  // 構建日期查詢條件
  let dateQuery = {};
  let previousDateQuery = {};
  
  if (period === 'day' && date) {
    // 確保日期是本地時間
    const currentDay = new Date(date + 'T00:00:00');
    const startOfDay = new Date(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate());
    const endOfDay = new Date(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate() + 1);
    dateQuery.createdAt = { $gte: startOfDay, $lt: endOfDay };
    
    // 前一天的查詢條件（用於計算變化率）
    const previousDay = new Date(currentDay);
    previousDay.setDate(previousDay.getDate() - 1);
    const prevStartOfDay = new Date(previousDay.getFullYear(), previousDay.getMonth(), previousDay.getDate());
    const prevEndOfDay = new Date(previousDay.getFullYear(), previousDay.getMonth(), previousDay.getDate() + 1);
    previousDateQuery.createdAt = { $gte: prevStartOfDay, $lt: prevEndOfDay };
  } else if (period === 'month' && startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1); // 包含結束日期
    dateQuery.createdAt = { $gte: start, $lt: end };
    
    // 前一個月的查詢條件
    const monthDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - monthDiff);
    const prevEnd = new Date(start);
    previousDateQuery.createdAt = { $gte: prevStart, $lt: prevEnd };
  } else if (period === 'year' && startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1); // 包含結束日期
    dateQuery.createdAt = { $gte: start, $lt: end };
    
    // 前一年的查詢條件
    const prevStart = new Date(start);
    prevStart.setFullYear(prevStart.getFullYear() - 1);
    const prevEnd = new Date(end);
    prevEnd.setFullYear(prevEnd.getFullYear() - 1);
    previousDateQuery.createdAt = { $gte: prevStart, $lt: prevEnd };
  } else {
    // 預設為今天
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    dateQuery.createdAt = { $gte: startOfDay, $lt: endOfDay };
    
    // 昨天的查詢條件
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const prevStartOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    const prevEndOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate() + 1);
    previousDateQuery.createdAt = { $gte: prevStartOfDay, $lt: prevEndOfDay };
  }

  // 如果指定了餐廳，添加餐廳篩選條件
    if (restaurantId && restaurantId !== 'all') {
    // 確保 restaurantId 是 ObjectId
    const merchantId = mongoose.Types.ObjectId.isValid(restaurantId) 
      ? new mongoose.Types.ObjectId(restaurantId) 
      : restaurantId;
    dateQuery.merchantId = merchantId;
    previousDateQuery.merchantId = merchantId;
    console.log('指定餐廳查詢，merchantId:', merchantId)
  } else {
    console.log('查詢所有餐廳')
  }

  // 並行執行所有查詢以提高性能
  const [
    currentStats,
    previousStats,
    merchantCount,
    previousMerchantCount,
    topMerchants,
    chartData,
    restaurantDetails
  ] = await Promise.all([
    // 當前期間統計
    Order.aggregate([
      { $match: { ...dateQuery } },
      {
        $lookup: {
          from: 'merchants',
          localField: 'merchantId',
          foreignField: '_id',
          as: 'merchant'
        }
      },
      {
        $match: {
          merchant: { $ne: [] }
        }
      },
      {
        $addFields: {
          // 從訂單號解析客人組別（與商家報表邏輯一致）
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
            totalRevenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] } },
            totalCost: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalCost', 0] } },
          orderCount: { $sum: 1 }
        }
      },
        {
          $group: {
            _id: null,
          totalRevenue: { $sum: '$totalRevenue' },
          totalCost: { $sum: '$totalCost' },
          totalOrders: { $sum: 1 } // 統計客人組數
        }
      }
    ]),
    
    // 前一期間統計（用於計算變化率）
    Order.aggregate([
      { $match: { ...previousDateQuery } },
      {
        $lookup: {
          from: 'merchants',
          localField: 'merchantId',
          foreignField: '_id',
          as: 'merchant'
        }
      },
        { 
          $match: { 
          merchant: { $ne: [] }
        }
      },
      {
        $addFields: {
          // 從訂單號解析客人組別（與商家報表邏輯一致）
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
          totalRevenue: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalAmount', 0] } },
          totalCost: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$totalCost', 0] } },
          orderCount: { $sum: 1 }
          }
        },
        {
          $group: {
            _id: null,
          totalRevenue: { $sum: '$totalRevenue' },
          totalCost: { $sum: '$totalCost' },
          totalOrders: { $sum: 1 } // 統計客人組數
        }
      }
    ]),
    
    // 當前期間活躍商家數
    Order.aggregate([
      { $match: { ...dateQuery } },
      {
        $lookup: {
          from: 'merchants',
          localField: 'merchantId',
          foreignField: '_id',
          as: 'merchant'
        }
      },
      {
        $match: {
          merchant: { $ne: [] }
        }
      },
      { $group: { _id: '$merchantId' } },
      { $count: 'activeMerchants' }
    ]),
    
    // 前一期間活躍商家數
    Order.aggregate([
      { $match: { ...previousDateQuery } },
      {
        $lookup: {
          from: 'merchants',
          localField: 'merchantId',
          foreignField: '_id',
          as: 'merchant'
        }
      },
      {
        $match: {
          merchant: { $ne: [] }
        }
      },
      { $group: { _id: '$merchantId' } },
      { $count: 'activeMerchants' }
    ]),
    
    // 熱門商家排行（僅在查看所有餐廳時）
    restaurantId === 'all' ? Order.aggregate([
      { $match: { ...dateQuery } },
      {
        $lookup: {
          from: 'merchants',
          localField: 'merchantId',
          foreignField: '_id',
          as: 'merchant'
        }
      },
        { 
          $match: { 
          merchant: { $ne: [] }
        }
      },
      {
        $addFields: {
          // 從訂單號解析客人組別（與商家報表邏輯一致）
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
          _id: { merchantId: '$merchantId', tableId: '$tableId', customerGroup: '$customerGroup' },
          revenue: { $sum: '$totalAmount' }
        }
      },
      {
        $group: {
          _id: '$_id.merchantId',
          orderCount: { $sum: 1 },
          revenue: { $sum: '$revenue' }
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
      { $unwind: '$merchant' },
      {
        $project: {
          businessName: '$merchant.businessName',
          merchantCode: '$merchant.merchantCode',
          orderCount: 1,
          revenue: 1
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 }
    ]) : [],
    
    // 圖表數據（營收趨勢）
    getChartData(period, dateQuery, restaurantId),
    
    // 餐廳詳細資訊（僅在選擇特定餐廳時）
    restaurantId && restaurantId !== 'all' ? getRestaurantDetails(restaurantId, dateQuery) : null
  ]);

  // 調試訊息：查看詳細的統計數據
  console.log('=== 平台報表統計調試訊息 ===');
  console.log('查詢條件:', dateQuery);
  console.log('當前期間統計結果:', currentStats);
  console.log('前一期間統計結果:', previousStats);
  console.log('當前期間活躍商家數:', merchantCount);
  console.log('前一期間活躍商家數:', previousMerchantCount);
  
  // 調試：顯示每個餐廳的詳細數據
  const allRestaurantsData = await Order.aggregate([
    { $match: { status: 'completed', ...dateQuery } },
    {
      $lookup: {
        from: 'merchants',
        localField: 'merchantId',
        foreignField: '_id',
        as: 'merchant'
      }
    },
    { $unwind: '$merchant' },
    {
      $group: {
        _id: '$merchantId',
        businessName: { $first: '$merchant.businessName' },
        merchantCode: { $first: '$merchant.merchantCode' },
        totalRevenue: { $sum: '$totalAmount' },
        totalCost: { $sum: '$totalCost' },
        orderCount: { $sum: 1 },
        orderNumbers: { $push: '$orderNumber' }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);
  
  // 調試：檢查 merchantId 和商家關聯
  const debugMerchantIds = await Order.aggregate([
    { $match: { status: 'completed', ...dateQuery } },
        {
          $group: {
        _id: '$merchantId',
        orderCount: { $sum: 1 },
        orderNumbers: { $push: '$orderNumber' }
      }
    }
  ]);
  
  console.log('=== 調試：merchantId 檢查 ===');
  console.log('找到的 merchantId:', debugMerchantIds);
  
  // 檢查商家是否存在
  const merchantIds = debugMerchantIds.map(item => item._id);
  const merchants = await mongoose.model('Merchant').find({ _id: { $in: merchantIds } });
  console.log('對應的商家資料:', merchants.map(m => ({ id: m._id, businessName: m.businessName, merchantCode: m.merchantCode })));
  
  console.log('=== 各餐廳詳細數據 ===');
  console.log('餐廳數量:', allRestaurantsData.length);
  allRestaurantsData.forEach((restaurant, index) => {
    console.log(`${index + 1}. ${restaurant.businessName} (${restaurant.merchantCode})`);
    console.log(`   營收: ${restaurant.totalRevenue}, 成本: ${restaurant.totalCost}, 訂單數: ${restaurant.orderCount}`);
    console.log(`   訂單號: ${restaurant.orderNumbers.slice(0, 5).join(', ')}${restaurant.orderNumbers.length > 5 ? '...' : ''}`);
  });
  
  // 調試：顯示所有訂單的詳細信息
  const allOrders = await Order.find({ status: 'completed', ...dateQuery })
    .populate('merchantId', 'businessName merchantCode')
    .select('orderNumber totalAmount totalCost createdAt merchantId')
    .sort({ createdAt: -1 });
  
  console.log('=== 所有訂單詳細信息 ===');
  console.log('訂單總數:', allOrders.length);
  allOrders.forEach((order, index) => {
    console.log(`${index + 1}. ${order.orderNumber} - ${order.merchantId?.businessName || 'Unknown'} (${order.merchantId?.merchantCode || 'Unknown'})`);
    console.log(`   金額: ${order.totalAmount}, 成本: ${order.totalCost}, 時間: ${order.createdAt}`);
  });
  
  // 調試：查看客人組數的詳細計算過程
  const debugCustomerGroups = await Order.aggregate([
    { $match: { status: 'completed', ...dateQuery } },
        {
          $lookup: {
        from: 'merchants',
        localField: 'merchantId',
            foreignField: '_id',
        as: 'merchant'
      }
    },
    {
      $match: {
        merchant: { $ne: [] }
      }
    },
    {
      $addFields: {
        // 從訂單號解析客人組別（與商家報表邏輯一致）
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
        totalRevenue: { $sum: '$totalAmount' },
        totalCost: { $sum: '$totalCost' },
        orderCount: { $sum: 1 },
        orderIds: { $push: '$_id' }
      }
    },
    { $sort: { '_id.tableId': 1, '_id.customerGroup': 1 } }
  ]);
  
  console.log('=== 客人組數詳細計算 ===');
  console.log('查詢條件:', dateQuery);
  console.log('客人組數詳細數據:', debugCustomerGroups);
  console.log('客人組數總計:', debugCustomerGroups.length);
  
  // 處理統計數據
  const current = currentStats[0] || { totalRevenue: 0, totalCost: 0, totalOrders: 0 };
  const previous = previousStats[0] || { totalRevenue: 0, totalCost: 0, totalOrders: 0 };
  const currentMerchants = merchantCount[0]?.activeMerchants || 0;
  const previousMerchants = previousMerchantCount[0]?.activeMerchants || 0;

  // 計算淨利和毛利率
  const totalProfit = current.totalRevenue - current.totalCost;
  const previousProfit = previous.totalRevenue - previous.totalCost;
  const grossMargin = current.totalRevenue > 0 ? ((totalProfit / current.totalRevenue) * 100).toFixed(2) : 0;

  // 計算變化率
  const calculateChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous * 100).toFixed(2);
  };

  const revenueChange = calculateChange(current.totalRevenue, previous.totalRevenue);
  const costChange = calculateChange(current.totalCost, previous.totalCost);
  const profitChange = calculateChange(totalProfit, previousProfit);
  const marginChange = calculateChange(grossMargin, previous.totalRevenue > 0 ? ((previousProfit / previous.totalRevenue) * 100) : 0);
  const merchantChange = calculateChange(currentMerchants, previousMerchants);
  const orderChange = calculateChange(current.totalOrders, previous.totalOrders);

  // 構建回應數據
  const responseData = {
    totalRevenue: current.totalRevenue,
    totalCost: current.totalCost,
    totalProfit,
    grossMargin: parseFloat(grossMargin),
    activeMerchants: currentMerchants,
    totalOrders: current.totalOrders,
    revenueChange: parseFloat(revenueChange),
    costChange: parseFloat(costChange),
    profitChange: parseFloat(profitChange),
    marginChange: parseFloat(marginChange),
    merchantChange: parseFloat(merchantChange),
    orderChange: parseFloat(orderChange),
    topMerchants: topMerchants || [],
    revenueChart: chartData.revenue || [],
    activityChart: chartData.activity || []
  };

  // 如果是特定餐廳，添加餐廳詳細資訊
  if (restaurantDetails) {
    console.log('餐廳詳細資訊:', restaurantDetails)
    responseData.popularItems = restaurantDetails.popularItems || [];
    responseData.peakHours = restaurantDetails.peakHours || [];
    // 直接使用顯示的總訂單數和總金額計算平均訂單金額
    const totalOrders = responseData.totalOrders || 0;
    const totalRevenue = responseData.totalRevenue || 0;
    responseData.avgOrderValue = totalOrders > 0 ? parseFloat((totalRevenue / totalOrders).toFixed(2)) : 0;
    responseData.completedOrders = restaurantDetails.completedOrders || 0;
    responseData.cancelledOrders = restaurantDetails.cancelledOrders || 0;
  } else {
    console.log('沒有餐廳詳細資訊')
  }

  res.status(200).json({
    status: 'success',
    data: responseData
  });
});

/**
 * 獲取圖表數據
 */
async function getChartData(period, dateQuery, restaurantId) {
  let groupBy, dateFormat;
  
  if (period === 'day') {
    // 按小時分組 - 使用本地時間
    groupBy = { 
      $hour: { 
        date: '$createdAt', 
        timezone: 'Asia/Taipei' 
      } 
    };
    dateFormat = 'hour';
  } else if (period === 'month') {
    // 按天分組 - 使用本地時間
    groupBy = { 
      $dayOfMonth: { 
        date: '$createdAt', 
        timezone: 'Asia/Taipei' 
      } 
    };
    dateFormat = 'day';
  } else {
    // 按月分組 - 使用本地時間
    groupBy = { 
      $month: { 
        date: '$createdAt', 
        timezone: 'Asia/Taipei' 
      } 
    };
    dateFormat = 'month';
  }

  // 營收趨勢數據
  const revenueData = await Order.aggregate([
    { $match: { status: 'completed', ...dateQuery } },
    {
      $lookup: {
        from: 'merchants',
        localField: 'merchantId',
        foreignField: '_id',
        as: 'merchant'
      }
    },
    {
      $match: {
        merchant: { $ne: [] }
      }
    },
    {
      $group: {
        _id: groupBy,
        value: { $sum: '$totalAmount' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  // 活躍度趨勢數據
  let activityData;
  if (restaurantId === 'all') {
    // 平台模式：統計活躍商家數
    activityData = await Order.aggregate([
      { $match: { status: 'completed', ...dateQuery } },
      {
        $lookup: {
          from: 'merchants',
          localField: 'merchantId',
          foreignField: '_id',
          as: 'merchant'
        }
      },
      {
        $match: {
          merchant: { $ne: [] }
        }
      },
        {
          $group: {
          _id: { period: groupBy, merchantId: '$merchantId' }
        }
      },
      {
        $group: {
          _id: '$_id.period',
          value: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
  } else {
    // 餐廳模式：統計客人組數
    activityData = await Order.aggregate([
      { $match: { status: 'completed', ...dateQuery } },
      {
        $lookup: {
          from: 'merchants',
          localField: 'merchantId',
          foreignField: '_id',
          as: 'merchant'
        }
      },
      {
        $match: {
          merchant: { $ne: [] }
        }
      },
      {
        $group: {
          _id: { period: groupBy, tableId: '$tableId', customerGroup: '$customerGroup' }
        }
      },
      {
        $group: {
          _id: '$_id.period',
          value: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
  }

  // 格式化標籤
  const formatLabel = (id, format) => {
    if (format === 'hour') {
      // 將小時轉換為本地時間格式
      const hour = id.toString().padStart(2, '0');
      return `${hour}:00`;
    } else if (format === 'day') {
      return `${id}日`;
    } else if (format === 'month') {
      const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
      return months[id - 1] || `${id}月`;
    }
    return id.toString();
  };

  return {
    revenue: revenueData.map(item => ({
      label: formatLabel(item._id, dateFormat),
      value: item.value
    })),
    activity: activityData.map(item => ({
      label: formatLabel(item._id, dateFormat),
      value: item.value
    }))
  };
}

/**
 * 獲取餐廳詳細資訊
 */
async function getRestaurantDetails(restaurantId, dateQuery) {
  console.log('=== 調試：getRestaurantDetails 開始 ===');
  console.log('restaurantId:', restaurantId);
  console.log('dateQuery:', JSON.stringify(dateQuery, null, 2));
  
  // 確保 restaurantId 是 ObjectId
  const merchantId = mongoose.Types.ObjectId.isValid(restaurantId) 
    ? new mongoose.Types.ObjectId(restaurantId) 
    : restaurantId;
    
  console.log('merchantId:', merchantId);
    
  const [popularItems, peakHours, orderStats] = await Promise.all([
    // 熱門餐點 - 與商家後台保持一致
    Order.aggregate([
      { $match: { merchantId: merchantId, status: 'completed', ...dateQuery } },
      { $unwind: '$items' },
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
    ]),
    
    // 熱門時段 - 按桌次和客人組別計算（與商家後台一致）
        Order.aggregate([
      { $match: { merchantId: merchantId, status: 'completed', ...dateQuery } },
      {
        $addFields: {
          // 從訂單號解析客人組別（與商家後台邏輯一致）
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
          },
          // 轉換為台灣時區 (UTC+8)
          localHour: {
            $cond: {
              if: { $gte: [{ $add: [{ $hour: '$createdAt' }, 8] }, 24] },
              then: { $subtract: [{ $add: [{ $hour: '$createdAt' }, 8] }, 24] },
              else: { $add: [{ $hour: '$createdAt' }, 8] }
            }
          }
        }
      },
      {
        $group: {
          _id: {
            hour: '$localHour',
            tableId: '$tableId',
            customerGroup: '$customerGroup'
          },
          totalRevenue: { $sum: '$totalAmount' }
        }
      },
      {
        $group: {
          _id: '$_id.hour',
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: '$totalRevenue' }
        }
      },
      { $sort: { _id: 1 } }
    ]),
    
    // 訂單統計
        Order.aggregate([
      { $match: { merchantId: merchantId, ...dateQuery } },
        {
          $group: {
          _id: { status: '$status', tableId: '$tableId', customerGroup: '$customerGroup' },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      {
        $group: {
          _id: '$_id.status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
        ])
      ]);

  // 調試：熱門時段聚合結果
  console.log('=== 調試：熱門時段聚合結果 ===');
  console.log('peakHours 原始數據:', JSON.stringify(peakHours, null, 2));
  
  // 處理熱門時段數據 - 只顯示前五個最熱門的時段
  const maxOrders = Math.max(...peakHours.map(h => h.orderCount), 1);
  
  // 先按訂單數量排序，取前五個
  const topPeakHours = peakHours
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, 5);
  
  const formattedPeakHours = topPeakHours.map(hourData => {
    const orderCount = hourData.orderCount;
    const totalRevenue = hourData.totalRevenue;
    return {
      hour: `${hourData._id.toString().padStart(2, '0')}:00`,
      orderCount,
      totalRevenue,
      percentage: (orderCount / maxOrders * 100).toFixed(1)
    };
  });

  // 處理訂單統計
  const completedOrders = orderStats.find(s => s._id === 'completed')?.count || 0;
  const cancelledOrders = orderStats.find(s => s._id === 'cancelled')?.count || 0;
  const pendingOrders = orderStats.find(s => s._id === 'pending')?.count || 0;
  const totalOrders = completedOrders + cancelledOrders + pendingOrders; // 計算所有狀態的客人組數
  const totalRevenue = orderStats.find(s => s._id === 'completed')?.totalAmount || 0;
  const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : 0;

  // 處理熱門餐點數據格式
  const formattedPopularItems = popularItems.map(item => ({
    id: item._id.dishId,
    name: item._id.dishName,
    category: item._id.category,
    orderCount: item.orderCount,
    revenue: item.revenue,
    cost: item.cost
  }));

  return {
    popularItems: formattedPopularItems,
    peakHours: formattedPeakHours,
    totalOrders,
    avgOrderValue: parseFloat(avgOrderValue)
  };
}

/**
 * 獲取餐廳列表
 */
exports.getRestaurants = catchAsync(async (req, res, next) => {
  const restaurants = await Merchant.find({ 
    status: 'active' 
  }).select('businessName merchantCode _id').sort({ businessName: 1 });

    res.status(200).json({
      status: 'success',
    data: restaurants
  });
});

/**
 * 匯出平台報表
 */
exports.exportPlatformReport = catchAsync(async (req, res, next) => {
  const { period, date, startDate, endDate, restaurantId } = req.query;

  // 構建日期查詢條件（與 getPlatformStats 相同邏輯）
  let dateQuery = {};
  
  if (period === 'day' && date) {
    // 確保日期是本地時間
    const currentDay = new Date(date + 'T00:00:00');
    const startOfDay = new Date(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate());
    const endOfDay = new Date(currentDay.getFullYear(), currentDay.getMonth(), currentDay.getDate() + 1);
    dateQuery.createdAt = { $gte: startOfDay, $lt: endOfDay };
  } else if (period === 'month' && startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);
    dateQuery.createdAt = { $gte: start, $lt: end };
  } else if (period === 'year' && startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);
    dateQuery.createdAt = { $gte: start, $lt: end };
  } else {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    dateQuery.createdAt = { $gte: startOfDay, $lt: endOfDay };
  }

  // 如果指定了餐廳，添加餐廳篩選條件
  if (restaurantId && restaurantId !== 'all') {
    // 確保 restaurantId 是 ObjectId
    const merchantId = mongoose.Types.ObjectId.isValid(restaurantId) 
      ? new mongoose.Types.ObjectId(restaurantId) 
      : restaurantId;
    dateQuery.merchantId = merchantId;
  }

  // 獲取詳細的訂單數據
  const orders = await Order.aggregate([
    { $match: { status: 'completed', ...dateQuery } },
    {
      $lookup: {
        from: 'merchants',
        localField: 'merchantId',
        foreignField: '_id',
        as: 'merchant'
      }
    },
    { $unwind: '$merchant' },
    {
      $project: {
        orderNumber: 1,
        businessName: '$merchant.businessName',
        merchantCode: '$merchant.merchantCode',
        totalAmount: 1,
        totalCost: 1,
        status: 1,
        createdAt: 1,
        items: 1
      }
    },
    { $sort: { createdAt: -1 } }
  ]);

  // 獲取商家統計數據
  const merchantStats = await Order.aggregate([
    { $match: { status: 'completed', ...dateQuery } },
    {
      $lookup: {
        from: 'merchants',
        localField: 'merchantId',
        foreignField: '_id',
        as: 'merchant'
      }
    },
    { 
      $match: { 
        merchant: { $ne: [] }
      } 
    },
    {
      $group: {
        _id: '$merchantId',
        orderCount: { $sum: 1 },
        totalRevenue: { $sum: '$totalAmount' },
        totalCost: { $sum: '$totalCost' }
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
    { $unwind: '$merchant' },
    {
      $project: {
        businessName: '$merchant.businessName',
        merchantCode: '$merchant.merchantCode',
        orderCount: 1,
        totalRevenue: 1,
        totalCost: 1,
        profit: { $subtract: ['$totalRevenue', '$totalCost'] },
        margin: {
          $cond: {
            if: { $gt: ['$totalRevenue', 0] },
            then: { $multiply: [{ $divide: [{ $subtract: ['$totalRevenue', '$totalCost'] }, '$totalRevenue'] }, 100] },
            else: 0
          }
        }
      }
    },
    { $sort: { totalRevenue: -1 } }
  ]);

  // 創建 Excel 工作簿
  const workbook = XLSX.utils.book_new();

  // 訂單詳情工作表
  const orderData = orders.map(order => ({
    '訂單編號': order.orderNumber,
    '商家名稱': order.businessName,
    '商家代碼': order.merchantCode,
    '訂單金額': order.totalAmount,
    '成本金額': order.totalCost || 0,
    '淨利': (order.totalAmount - (order.totalCost || 0)),
    '訂單狀態': order.status,
    '建立時間': new Date(order.createdAt).toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }));

  const orderWorksheet = XLSX.utils.json_to_sheet(orderData);
  XLSX.utils.book_append_sheet(workbook, orderWorksheet, '訂單詳情');

  // 商家統計工作表
  const merchantData = merchantStats.map(merchant => ({
    '商家名稱': merchant.businessName,
    '商家代碼': merchant.merchantCode,
    '訂單數量': merchant.orderCount,
    '總營收': merchant.totalRevenue,
    '總成本': merchant.totalCost,
    '淨利': merchant.profit,
    '毛利率(%)': merchant.margin.toFixed(2)
  }));

  const merchantWorksheet = XLSX.utils.json_to_sheet(merchantData);
  XLSX.utils.book_append_sheet(workbook, merchantWorksheet, '商家統計');

  // 如果是特定餐廳，添加餐廳詳細資訊工作表
  if (restaurantId && restaurantId !== 'all') {
    const restaurantDetails = await getRestaurantDetails(restaurantId, dateQuery);
    
    // 熱門餐點工作表
    const popularItemsData = restaurantDetails.popularItems.map((item, index) => ({
      '排名': index + 1,
      '餐點名稱': item.name,
      '分類': item.category,
      '訂購次數': item.orderCount,
      '營收': item.revenue
    }));
    
    const popularItemsWorksheet = XLSX.utils.json_to_sheet(popularItemsData);
    XLSX.utils.book_append_sheet(workbook, popularItemsWorksheet, '熱門餐點');
    
    // 熱門時段工作表
    const peakHoursData = restaurantDetails.peakHours
      .filter(hour => hour.orderCount > 0)
      .map(hour => ({
        '時段': hour.hour,
        '訂單數': hour.orderCount,
        '佔比(%)': hour.percentage
      }));
    
    const peakHoursWorksheet = XLSX.utils.json_to_sheet(peakHoursData);
    XLSX.utils.book_append_sheet(workbook, peakHoursWorksheet, '熱門時段');
  }

  // 生成 Excel 檔案
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  // 設定檔案名稱 - 根據開發日誌的命名規則
  let fileName;
  
  // 獲取餐廳名稱的輔助函數
  const getRestaurantName = async (restaurantId) => {
    try {
      const merchant = await Merchant.findById(restaurantId).select('businessName');
      return merchant ? merchant.businessName : '未知餐廳';
    } catch (error) {
      console.error('獲取餐廳名稱失敗:', error);
      return '未知餐廳';
    }
  };
  
  if (period === 'day' && date) {
    // 日報：年月日-餐廳範圍-管理員統計報表
    const dateStr = date.replace(/-/g, '');
    if (restaurantId && restaurantId !== 'all') {
      // 特定餐廳
      const restaurantName = await getRestaurantName(restaurantId);
      fileName = `${dateStr}-${restaurantName}-管理員統計報表`;
    } else {
      // 所有餐廳
      fileName = `${dateStr}-所有餐廳-管理員統計報表`;
    }
  } else if (period === 'month' && startDate) {
    // 月報：年月-餐廳範圍-管理員統計報表
    const year = startDate.split('-')[0];
    const month = parseInt(startDate.split('-')[1]);
    if (restaurantId && restaurantId !== 'all') {
      // 特定餐廳
      const restaurantName = await getRestaurantName(restaurantId);
      fileName = `${year}-${month}-${restaurantName}-管理員統計報表`;
    } else {
      // 所有餐廳
      fileName = `${year}-${month}-所有餐廳-管理員統計報表`;
    }
  } else if (period === 'year' && startDate) {
    // 年報：年份-餐廳範圍-管理員統計報表
    const year = startDate.split('-')[0];
    if (restaurantId && restaurantId !== 'all') {
      // 特定餐廳
      const restaurantName = await getRestaurantName(restaurantId);
      fileName = `${year}-${restaurantName}-管理員統計報表`;
    } else {
      // 所有餐廳
      fileName = `${year}-所有餐廳-管理員統計報表`;
    }
  } else {
    // 預設使用當前日期
    const now = new Date();
    const dateStr = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
    fileName = `${dateStr}-所有餐廳-管理員統計報表`;
  }
  
  const filename = `${fileName}.xlsx`;

  // 設定回應標頭
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('X-File-Name', encodeURIComponent(fileName)); // 添加檔案名稱標頭供前端使用
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.setHeader('Content-Length', buffer.length);

  // 發送檔案
  res.send(buffer);
});

/**
 * 輔助函數：格式化日期範圍字串
 */
function formatDateRange(period, date, startDate, endDate) {
  if (period === 'day' && date) {
    return new Date(date).toLocaleDateString('zh-TW');
  } else if ((period === 'month' || period === 'year') && startDate && endDate) {
    const start = new Date(startDate).toLocaleDateString('zh-TW');
    const end = new Date(endDate).toLocaleDateString('zh-TW');
    return `${start} ~ ${end}`;
  }
  return '今日';
}

/**
 * 輔助函數：計算百分比變化
 */
function calculatePercentageChange(current, previous) {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous * 100).toFixed(2);
}

/**
 * 輔助函數：格式化貨幣
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('zh-TW', {
    style: 'currency',
    currency: 'TWD',
    minimumFractionDigits: 0
  }).format(amount);
}

/**
 * 輔助函數：安全的 ObjectId 轉換
 */
function toObjectId(id) {
  try {
    const { ObjectId } = require('mongodb');
    return new ObjectId(id);
  } catch (error) {
    return id;
  }
}