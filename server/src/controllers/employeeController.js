const jwt = require('jsonwebtoken');
const Employee = require('../models/employee');
const Role = require('../models/role');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

const signToken = (employee) => {
  return jwt.sign(
    { id: employee._id, role: 'employee', merchantId: employee.merchant },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

const getMerchantId = (req) => {
  if (req.admin && req.query.merchantId) return req.query.merchantId;
  if (req.merchant) return req.merchant.id;
  if (req.employee) return req.employee.merchant.toString();
  throw new AppError('無法確定商家身份', 401);
};

// 僅允許管理人員編輯「工作人員」，不可操作老闆與其他管理人員
const assertManagerCanEditTarget = async (req, targetEmployeeDocOrId) => {
  console.log('=== 權限檢查開始 ===');
  console.log('當前用戶信息:');
  console.log('- req.admin:', req.admin);
  console.log('- req.merchant:', req.merchant ? { id: req.merchant.id, businessName: req.merchant.businessName } : null);
  console.log('- req.employee:', req.employee ? { 
    id: req.employee._id, 
    name: req.employee.name, 
    isOwner: req.employee.isOwner,
    role: req.employee.role ? { name: req.employee.role.name } : null
  } : null);

  // 取得目標員工實體
  let target = targetEmployeeDocOrId;
  if (!target || !target.role) {
    target = await Employee.findById(typeof targetEmployeeDocOrId === 'string' ? targetEmployeeDocOrId : targetEmployeeDocOrId?._id).populate('role');
  }
  if (!target) {
    console.log('目標員工不存在');
    throw new AppError('員工不存在', 404);
  }

  // 如果 populate 失敗，手動查詢角色
  if (target.role && !target.role.name && target.role._id) {
    console.log('Populate 失敗，手動查詢角色信息...');
    const Role = require('../models/role');
    const roleDoc = await Role.findById(target.role._id);
    if (roleDoc) {
      target.role = roleDoc;
      console.log('手動查詢角色成功:', { name: roleDoc.name, id: roleDoc._id });
    } else {
      console.log('手動查詢角色失敗，角色不存在');
    }
  }

  console.log('目標員工信息:');
  console.log('- 目標ID:', target._id);
  console.log('- 目標姓名:', target.name);
  console.log('- 目標是否為老闆:', target.isOwner);
  console.log('- 目標角色:', target.role ? { name: target.role.name } : null);

  // 超級管理員不受限制
  if (req.admin) {
    console.log('權限檢查結果: 超級管理員，允許操作');
    return;
  }

  // 商家（老闆）的限制：不能刪除自己，但可以刪除所有其他員工
  if (req.merchant) {
    console.log('當前用戶是商家（老闆）');
    // 檢查是否為員工身分的老闆（通過員工編號或帳號匹配）
    const merchantEmployee = await Employee.findOne({ 
      merchant: req.merchant.id,
      isOwner: true 
    });
    
    console.log('查詢到的老闆員工:', merchantEmployee ? { id: merchantEmployee._id, name: merchantEmployee.name } : null);
    
    if (merchantEmployee && merchantEmployee._id.toString() === target._id.toString()) {
      console.log('權限檢查結果: 老闆嘗試刪除自己，拒絕操作');
      throw new AppError('老闆不能刪除自己', 403);
    }
    console.log('權限檢查結果: 老闆可以刪除所有其他員工（包括管理人員）');
    return; // 老闆可以刪除所有其他員工（包括管理人員）
  }

  // 非員工（理論上不會到這步）
  if (!req.employee) {
    console.log('權限檢查結果: 非員工，拒絕操作');
    throw new AppError('您沒有權限執行此操作', 403);
  }

  // 若自己是「店老闆」員工，也視為老闆
  if (req.employee.isOwner) {
    console.log('當前用戶是員工身分的老闆');
    // 員工身分的老闆不能刪除自己
    if (req.employee._id.toString() === target._id.toString()) {
      console.log('權限檢查結果: 員工身分的老闆嘗試刪除自己，拒絕操作');
      throw new AppError('老闆不能刪除自己', 403);
    }
    console.log('權限檢查結果: 員工身分的老闆可以刪除所有其他員工（包括管理人員）');
    return; // 員工身分的老闆可以刪除所有其他員工（包括管理人員）
  }

  // 判斷是否為管理人員：其角色名稱必須為「管理人員」或英文別名 manager
  const roleName = (req.employee.role && (req.employee.role.name || '')) || '';
  const isManager = String(roleName).trim().toLowerCase() === '管理人員' || String(roleName).trim().toLowerCase() === 'manager';
  console.log('當前用戶角色檢查:');
  console.log('- 角色名稱:', roleName);
  console.log('- 是否為管理人員:', isManager);
  
  if (!isManager) {
    console.log('權限檢查結果: 非管理人員，拒絕操作');
    throw new AppError('您沒有權限執行此操作', 403);
  }

  // 禁止操作店老闆
  if (target.isOwner) {
    console.log('權限檢查結果: 管理人員嘗試操作老闆，拒絕操作');
    throw new AppError('不可編輯或刪除老闆', 403);
  }

  // 只允許操作「工作人員」
  const targetRoleName = (target.role && (target.role.name || '')) || '';
  const normalizedTargetRoleName = String(targetRoleName).trim().toLowerCase();
  const isTargetStaff = normalizedTargetRoleName === '工作人員' || 
                       normalizedTargetRoleName === 'staff' || 
                       normalizedTargetRoleName === 'employee' ||
                       normalizedTargetRoleName === '員工';
  console.log('目標員工角色檢查:');
  console.log('- 目標角色名稱:', targetRoleName);
  console.log('- 標準化後的角色名稱:', normalizedTargetRoleName);
  console.log('- 是否為工作人員:', isTargetStaff);
  console.log('- 角色對象:', target.role);
  
  if (!isTargetStaff) {
    console.log('權限檢查結果: 管理人員嘗試操作非工作人員，拒絕操作');
    console.log('- 目標角色名稱不匹配工作人員條件');
    throw new AppError('管理人員僅能操作工作人員', 403);
  }

  console.log('權限檢查結果: 管理人員可以操作工作人員');
  console.log('=== 權限檢查結束 ===');
};

const generateEmployeeNumber = async (merchantId) => {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  let code = '';
  let exists = true;
  while (exists) {
    code = '';
    for (let i = 0; i < 3; i++) {
      code += letters[Math.floor(Math.random() * letters.length)];
      code += digits[Math.floor(Math.random() * digits.length)];
    }
    const found = await Employee.findOne({ merchant: merchantId, employeeNumber: code }).lean();
    exists = !!found;
  }
  return code;
};

// 員工登入
exports.login = catchAsync(async (req, res, next) => {
  console.log('=== 員工登入開始 ===');
  const { merchantId, account, password } = req.body;
  console.log('登入參數:', { merchantId, account, password: '***' });
  
  if (!merchantId || !account || !password) {
    return next(new AppError('請提供商家ID、帳號與密碼', 400));
  }
  
  const employee = await Employee.findOne({ merchant: merchantId, account }).select('+password').populate('role');
  if (!employee) {
    console.log('帳號不存在');
    return next(new AppError('帳號不存在', 401));
  }
  
  console.log('找到員工:', {
    id: employee._id,
    name: employee.name,
    account: employee.account,
    isOwner: employee.isOwner,
    role: employee.role ? { name: employee.role.name } : null
  });
  
  const isCorrect = await employee.correctPassword(password, employee.password);
  if (!isCorrect) {
    console.log('密碼錯誤');
    return next(new AppError('密碼錯誤', 401));
  }
  
  // 獲取餐廳信息
  const Merchant = require('../models/merchant');
  console.log('=== 員工登入調試信息 ===');
  console.log('商家ID:', merchantId);
  const merchant = await Merchant.findById(merchantId).select('businessName merchantCode');
  console.log('查詢到的餐廳信息:', merchant);
  console.log('businessName:', merchant?.businessName);
  console.log('merchantCode:', merchant?.merchantCode);
  
  const token = signToken(employee);
  employee.lastLogin = new Date();
  await employee.save({ validateBeforeSave: false });
  
  const responseData = {
    status: 'success',
    token,
    data: {
      employee: {
        id: employee._id,
        name: employee.name,
        account: employee.account,
        merchant: employee.merchant,
        businessName: merchant?.businessName || null,
        merchantCode: merchant?.merchantCode || null,
        role: employee.role ? { id: employee.role._id, name: employee.role.name, permissions: employee.role.permissions } : null
      }
    }
  };
  
  console.log('=== 員工登入響應數據 ===');
  console.log('完整響應:', JSON.stringify(responseData, null, 2));
  console.log('=== 員工登入結束 ===');
  
  res.status(200).json(responseData);
});

// 取得員工清單（商家維度）
exports.getAllEmployees = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  const employees = await Employee.find({ merchant: merchantId }).populate('role').sort({ createdAt: -1 });
  res.status(200).json({ status: 'success', results: employees.length, data: { employees } });
});

// 新增員工
exports.createEmployee = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  const { name, roleId, email, serialNumber } = req.body;
  if (!name || !roleId) {
    return next(new AppError('請提供姓名與角色', 400));
  }
  const role = await Role.findOne({ _id: roleId, merchant: merchantId });
  if (!role) return next(new AppError('角色不存在', 400));
  // 管理人員只能新增「工作人員」
  if (!req.admin && !req.merchant) {
    const actorIsEmployeeOwner = req.employee?.isOwner === true;
    const newRoleName = (role.name || '').trim().toLowerCase();
    const isOwnerRole = newRoleName === '老闆' || newRoleName === 'owner';
    if (actorIsEmployeeOwner) {
      // 員工身分的老闆：可新增管理人員/工作人員，但不可新增老闆
      if (isOwnerRole) {
        return next(new AppError('不可新增老闆角色', 403));
      }
    } else {
      // 非老闆員工（例如管理人員）：僅能新增工作人員
      const actorRoleName = (req.employee?.role?.name || '').trim().toLowerCase();
      const isManager = actorRoleName === '管理人員' || actorRoleName === 'manager';
      if (!isManager) {
        return next(new AppError('您沒有權限執行此操作', 403));
      }
      const isStaffRole = newRoleName === '工作人員' || newRoleName === 'staff' || newRoleName === 'employee';
      if (!isStaffRole) {
        return next(new AppError('管理人員僅能新增「工作人員」', 403));
      }
    }
  }
  const employeeNumber = await generateEmployeeNumber(merchantId);
  const employee = await Employee.create({
    merchant: merchantId,
    name,
    employeeNumber,
    account: employeeNumber,
    password: employeeNumber,
    role: roleId,
    email,
    ...(serialNumber && { serialNumber })
  });
  res.status(201).json({ status: 'success', data: { employee } });
});

// 更新員工
exports.updateEmployee = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  const { name, password, roleId, isActive, serialNumber } = req.body;
  const employee = await Employee.findOne({ _id: req.params.id, merchant: merchantId });
  if (!employee) return next(new AppError('員工不存在', 404));
  await assertManagerCanEditTarget(req, employee);
  if (typeof name === 'string') employee.name = name;
  if (typeof isActive === 'boolean') employee.isActive = isActive;
  if (typeof serialNumber === 'string') employee.serialNumber = serialNumber;
  if (roleId) {
    const role = await Role.findOne({ _id: roleId, merchant: merchantId });
    if (!role) return next(new AppError('角色不存在', 400));
    // 管理人員只能把對象設為「工作人員」
    if (!req.admin && !req.merchant) {
      const actorIsEmployeeOwner = req.employee?.isOwner === true;
      const newRoleName = (role.name || '').trim().toLowerCase();
      const isOwnerRole = newRoleName === '老闆' || newRoleName === 'owner';
      if (actorIsEmployeeOwner) {
        // 員工身分的老闆：可調整為管理人員/工作人員，但不可調整為老闆
        if (isOwnerRole) return next(new AppError('不可將角色調整為「老闆」', 403));
      } else {
        const isStaffRole = newRoleName === '工作人員' || newRoleName === 'staff' || newRoleName === 'employee';
        if (!isStaffRole) return next(new AppError('管理人員僅能調整為「工作人員」', 403));
      }
    }
    employee.role = roleId;
  }
  if (password) employee.password = password;
  await employee.save();
  res.status(200).json({ status: 'success', data: { employee } });
});

// 刪除員工
exports.deleteEmployee = catchAsync(async (req, res, next) => {
  console.log('=== 刪除員工操作開始 ===');
  console.log('請求參數:', req.params);
  console.log('當前用戶信息:');
  console.log('- req.admin:', req.admin);
  console.log('- req.merchant:', req.merchant ? { id: req.merchant.id, businessName: req.merchant.businessName } : null);
  console.log('- req.employee:', req.employee ? { 
    id: req.employee._id, 
    name: req.employee.name, 
    isOwner: req.employee.isOwner,
    role: req.employee.role ? { name: req.employee.role.name } : null
  } : null);

  const merchantId = getMerchantId(req);
  console.log('商家ID:', merchantId);
  
  const employee = await Employee.findOne({ _id: req.params.id, merchant: merchantId });
  if (!employee) {
    console.log('目標員工不存在');
    return next(new AppError('員工不存在', 404));
  }
  
  console.log('找到目標員工:', {
    id: employee._id,
    name: employee.name,
    isOwner: employee.isOwner,
    role: employee.role ? { name: employee.role.name } : null
  });

  console.log('開始權限檢查...');
  await assertManagerCanEditTarget(req, employee);
  console.log('權限檢查通過，開始刪除...');
  
  await employee.deleteOne();
  console.log('員工刪除成功');
  console.log('=== 刪除員工操作結束 ===');
  
  res.status(204).json({ status: 'success', data: null });
});


