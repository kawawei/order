const jwt = require('jsonwebtoken');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Merchant = require('../models/merchant');
const Admin = require('../models/admin');
const Employee = require('../models/employee');

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
  } else if (decoded.role === 'admin' || decoded.role === 'superadmin') {
    currentUser = await Admin.findById(decoded.id).select('+isActive');
  } else if (decoded.role === 'employee') {
    currentUser = await Employee.findById(decoded.id).select('+isActive').populate('role');
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
  } else if (decoded.role === 'admin' || decoded.role === 'superadmin') {
    req.admin = currentUser;
  } else if (decoded.role === 'employee') {
    req.employee = currentUser;
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
    let userRole = null;
    
    if (req.merchant) {
      userRole = 'merchant';
    } else if (req.admin) {
      // 檢查是否為超級管理員
      if (req.admin.role === 'superadmin') {
        userRole = 'superadmin';
      } else {
        userRole = 'admin';
      }
    }
    
    // 超級管理員擁有所有權限
    if (userRole === 'superadmin') {
      return next();
    }
    
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
    } else if (decoded.role === 'admin' || decoded.role === 'superadmin') {
      currentUser = await Admin.findById(decoded.id).select('+isActive');
      req.admin = currentUser;
    } else if (decoded.role === 'employee') {
      currentUser = await Employee.findById(decoded.id).select('+isActive').populate('role');
      req.employee = currentUser;
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

// 商家或超級管理員權限中間件
exports.protectMerchantOrAdmin = catchAsync(async (req, res, next) => {
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

  // 3) 檢查用戶是否仍然存在
  let currentUser;
  
  if (decoded.role === 'merchant') {
    currentUser = await Merchant.findById(decoded.id).select('+isActive');
  } else if (decoded.role === 'admin' || decoded.role === 'superadmin') {
    currentUser = await Admin.findById(decoded.id).select('+isActive');
  } else {
    return next(new AppError('無效的用戶角色', 401));
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

  // 6) 將用戶信息添加到請求對象
  if (decoded.role === 'merchant') {
    req.merchant = currentUser;
    req.user = currentUser;
  } else if (decoded.role === 'admin' || decoded.role === 'superadmin') {
    req.admin = currentUser;
    req.user = currentUser;
  }
  
  next();
});

// 檢查商家權限或超級管理員權限
exports.checkMerchantOrAdminAccess = (model) => {
  return catchAsync(async (req, res, next) => {
    const resource = await model.findById(req.params.id);
    
    if (!resource) {
      return next(new AppError('找不到指定的資源', 404));
    }
    
    // 如果是超級管理員，允許訪問所有資源
    if (req.admin) {
      req.resource = resource;
      return next();
    }
    
    // 如果是商家，檢查資源是否屬於自己
    if (req.merchant && resource.merchant && resource.merchant.toString() !== req.merchant.id) {
      return next(new AppError('您沒有權限訪問此資源', 403));
    }
    
    req.resource = resource;
    next();
  });
};

// 允許商家、管理員或員工的保護中介層
exports.protectAny = catchAsync(async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    return next(new AppError('您需要先登入才能訪問此資源', 401));
  }
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return next(new AppError('token 驗證失敗', 401));
  }
  let currentUser;
  if (decoded.role === 'merchant') {
    currentUser = await Merchant.findById(decoded.id).select('+isActive');
    if (!currentUser || !currentUser.isActive) return next(new AppError('帳戶無效', 401));
    req.merchant = currentUser;
    req.user = currentUser;
  } else if (decoded.role === 'admin' || decoded.role === 'superadmin') {
    currentUser = await Admin.findById(decoded.id).select('+isActive');
    if (!currentUser || !currentUser.isActive) return next(new AppError('帳戶無效', 401));
    req.admin = currentUser;
    req.user = currentUser;
  } else if (decoded.role === 'employee') {
    currentUser = await Employee.findById(decoded.id).select('+isActive').populate('role');
    if (!currentUser || !currentUser.isActive) return next(new AppError('帳戶無效', 401));
    req.employee = currentUser;
    req.user = currentUser;
  } else {
    return next(new AppError('無效的用戶角色', 401));
  }
  next();
});

// 權限檢查：管理員、商家擁有所有權限；員工依其角色權限
exports.requirePermissions = (...requiredPermissions) => {
  return (req, res, next) => {
    console.log('=== 權限檢查調試 ===');
    console.log('需要權限:', requiredPermissions);
    console.log('用戶類型:', req.admin ? 'admin' : req.merchant ? 'merchant' : req.employee ? 'employee' : 'unknown');
    
    // 超級管理員與管理員：允許
    if (req.admin) {
      console.log('管理員權限檢查通過');
      return next();
    }
    // 商家：允許
    if (req.merchant) {
      console.log('商家權限檢查通過');
      return next();
    }
    // 員工：檢查權限
    if (req.employee && req.employee.role && Array.isArray(req.employee.role.permissions)) {
      const employeePerms = req.employee.role.permissions;
      console.log('員工權限:', employeePerms);
      console.log('員工角色:', req.employee.role.name);
      console.log('員工是否為老闆:', req.employee.isOwner);
      
      const ok = requiredPermissions.every(p => employeePerms.includes(p));
      console.log('權限檢查結果:', ok);
      
      if (ok) {
        console.log('員工權限檢查通過');
        return next();
      }
    }
    // 特殊情況：員工如果是老闆（isOwner=true），也允許所有操作
    if (req.employee && req.employee.isOwner) {
      console.log('員工老闆權限檢查通過');
      return next();
    }
    console.log('權限檢查失敗');
    return next(new AppError('您沒有權限執行此操作', 403));
  };
};

// 僅允許老闆或管理員：用於角色管理等敏感操作
exports.requireOwnerOrAdmin = (req, res, next) => {
  // 超管/管理員
  if (req.admin) return next();
  // 商家（老闆身分，使用商家登入）
  if (req.merchant) return next();
  // 員工：僅當其為店老闆（isOwner=true）時允許
  if (req.employee && req.employee.isOwner) return next();
  return next(new AppError('只有老闆可以執行此操作', 403));
};

// 強制檢查路由參數中的商家ID與登入者所屬商家相同（管理員略過）
exports.enforceSameMerchantParam = (paramName = 'merchantId') => {
  return (req, res, next) => {
    if (req.admin) return next();
    const requestedMerchantId = req.params[paramName];
    const currentMerchantId = req.merchant ? req.merchant.id : (req.employee ? req.employee.merchant?.toString() : null);
    if (!requestedMerchantId || !currentMerchantId) {
      return next(new AppError('無法確認商家身分', 401));
    }
    if (requestedMerchantId.toString() !== currentMerchantId.toString()) {
      return next(new AppError('您沒有權限訪問此商家的資料', 403));
    }
    next();
  };
};
