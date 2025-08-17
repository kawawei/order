const jwt = require('jsonwebtoken');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Merchant = require('../models/merchant');
const Admin = require('../models/admin');

// 驗證 JWT token
exports.protect = catchAsync(async (req, res, next) => {
  // 1) 檢查 token 是否存在
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('您需要先登入才能訪問此資源', 401));
  }

  // 2) 驗證 token
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('無效的 token', 401));
    } else if (error.name === 'TokenExpiredError') {
      return next(new AppError('token 已過期，請重新登入', 401));
    }
    return next(new AppError('token 驗證失敗', 401));
  }

  // 3) 檢查用戶是否仍然存在 - Check if user still exists
  let currentUser;
  
  if (decoded.role === 'merchant') {
    currentUser = await Merchant.findById(decoded.id).select('+isActive');
  } else if (decoded.role === 'admin') {
    currentUser = await Admin.findById(decoded.id).select('+isActive');
  } else {
    // 默認情況下，假設是商家用戶（向後兼容） - Default case, assume merchant user (backward compatibility)
    currentUser = await Merchant.findById(decoded.id).select('+isActive');
  }

  if (!currentUser) {
    return next(new AppError('該用戶已不存在', 401));
  }

  // 4) 檢查用戶是否被停用
  if (!currentUser.isActive) {
    return next(new AppError('您的帳戶已被停用，請聯繫管理員', 401));
  }

  // 5) 檢查密碼是否在 token 發放後被更改
  if (currentUser.passwordChangedAt) {
    const changedTimestamp = parseInt(currentUser.passwordChangedAt.getTime() / 1000, 10);
    if (decoded.iat < changedTimestamp) {
      return next(new AppError('密碼已被更改，請重新登入', 401));
    }
  }

  // 6) 將用戶信息添加到請求對象 - Add user info to request object
  if (decoded.role === 'merchant') {
    req.merchant = currentUser;
  } else if (decoded.role === 'admin') {
    req.admin = currentUser;
  } else {
    // 默認情況下，假設是商家用戶 - Default case, assume merchant user
    req.merchant = currentUser;
  }
  req.user = currentUser;
  
  next();
});

// 限制角色訪問
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // 檢查用戶角色
    const userRole = req.merchant ? 'merchant' : req.admin ? 'admin' : null;
    
    if (!userRole || !roles.includes(userRole)) {
      return next(new AppError('您沒有權限執行此操作', 403));
    }
    
    next();
  };
};

// 可選的認證中間件（不會拋出錯誤）
exports.optionalAuth = catchAsync(async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    let currentUser;
    if (decoded.role === 'merchant') {
      currentUser = await Merchant.findById(decoded.id).select('+isActive');
      req.merchant = currentUser;
    } else if (decoded.role === 'admin') {
      currentUser = await Admin.findById(decoded.id).select('+isActive');
      req.admin = currentUser;
    }
    
    if (currentUser && currentUser.isActive) {
      req.user = currentUser;
    }
  } catch (error) {
    // 忽略 token 錯誤，繼續處理
  }

  next();
});

// 檢查商家是否擁有特定資源
exports.checkMerchantOwnership = (model) => {
  return catchAsync(async (req, res, next) => {
    const resource = await model.findById(req.params.id);
    
    if (!resource) {
      return next(new AppError('找不到指定的資源', 404));
    }
    
    // 檢查資源是否屬於當前商家
    if (resource.merchant && resource.merchant.toString() !== req.merchant.id) {
      return next(new AppError('您沒有權限訪問此資源', 403));
    }
    
    req.resource = resource;
    next();
  });
};
