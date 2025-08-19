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
  // 管理員（後台超管）與商家（老闆）不受此限制
  if (req.admin || req.merchant) return;
  // 非員工（理論上不會到這步）
  if (!req.employee) throw new AppError('您沒有權限執行此操作', 403);

  // 若自己是「店老闆」員工，也視為老闆
  if (req.employee.isOwner) return;

  // 判斷是否為管理人員：其角色名稱必須為「管理人員」或英文別名 manager
  const roleName = (req.employee.role && (req.employee.role.name || '')) || '';
  const isManager = String(roleName).trim().toLowerCase() === '管理人員' || String(roleName).trim().toLowerCase() === 'manager';
  if (!isManager) {
    throw new AppError('您沒有權限執行此操作', 403);
  }

  // 取得目標員工實體
  let target = targetEmployeeDocOrId;
  if (!target || !target.role) {
    target = await Employee.findById(typeof targetEmployeeDocOrId === 'string' ? targetEmployeeDocOrId : targetEmployeeDocOrId?._id).populate('role');
  }
  if (!target) throw new AppError('員工不存在', 404);

  // 禁止操作店老闆
  if (target.isOwner) throw new AppError('不可編輯或刪除老闆', 403);

  // 只允許操作「工作人員」
  const targetRoleName = (target.role && (target.role.name || '')) || '';
  const isTargetStaff = String(targetRoleName).trim().toLowerCase() === '工作人員' || String(targetRoleName).trim().toLowerCase() === 'staff' || String(targetRoleName).trim().toLowerCase() === 'employee';
  if (!isTargetStaff) throw new AppError('管理人員僅能操作工作人員', 403);
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
  const { merchantId, account, password } = req.body;
  if (!merchantId || !account || !password) {
    return next(new AppError('請提供商家ID、帳號與密碼', 400));
  }
  const employee = await Employee.findOne({ merchant: merchantId, account }).select('+password').populate('role');
  if (!employee) return next(new AppError('帳號不存在', 401));
  const isCorrect = await employee.correctPassword(password, employee.password);
  if (!isCorrect) return next(new AppError('密碼錯誤', 401));
  const token = signToken(employee);
  employee.lastLogin = new Date();
  await employee.save({ validateBeforeSave: false });
  res.status(200).json({
    status: 'success',
    token,
    data: {
      employee: {
        id: employee._id,
        name: employee.name,
        account: employee.account,
        merchant: employee.merchant,
        role: employee.role ? { id: employee.role._id, name: employee.role.name, permissions: employee.role.permissions } : null
      }
    }
  });
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
  const { name, roleId, email } = req.body;
  if (!name || !roleId) {
    return next(new AppError('請提供姓名與角色', 400));
  }
  const role = await Role.findOne({ _id: roleId, merchant: merchantId });
  if (!role) return next(new AppError('角色不存在', 400));
  // 管理人員只能新增「工作人員」
  if (!req.admin && !req.merchant) {
    const actorRoleName = (req.employee?.role?.name || '').trim().toLowerCase();
    const isManager = actorRoleName === '管理人員' || actorRoleName === 'manager';
    if (!isManager && !req.employee?.isOwner) {
      return next(new AppError('您沒有權限執行此操作', 403));
    }
    const newRoleName = (role.name || '').trim().toLowerCase();
    const isStaffRole = newRoleName === '工作人員' || newRoleName === 'staff' || newRoleName === 'employee';
    if (!isStaffRole) {
      return next(new AppError('管理人員僅能新增「工作人員」', 403));
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
    email
  });
  res.status(201).json({ status: 'success', data: { employee } });
});

// 更新員工
exports.updateEmployee = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  const { name, password, roleId, isActive } = req.body;
  const employee = await Employee.findOne({ _id: req.params.id, merchant: merchantId });
  if (!employee) return next(new AppError('員工不存在', 404));
  await assertManagerCanEditTarget(req, employee);
  if (typeof name === 'string') employee.name = name;
  if (typeof isActive === 'boolean') employee.isActive = isActive;
  if (roleId) {
    const role = await Role.findOne({ _id: roleId, merchant: merchantId });
    if (!role) return next(new AppError('角色不存在', 400));
    // 管理人員只能把對象設為「工作人員」
    if (!req.admin && !req.merchant) {
      const newRoleName = (role.name || '').trim().toLowerCase();
      const isStaffRole = newRoleName === '工作人員' || newRoleName === 'staff' || newRoleName === 'employee';
      if (!isStaffRole) return next(new AppError('管理人員僅能調整為「工作人員」', 403));
    }
    employee.role = roleId;
  }
  if (password) employee.password = password;
  await employee.save();
  res.status(200).json({ status: 'success', data: { employee } });
});

// 刪除員工
exports.deleteEmployee = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  const employee = await Employee.findOne({ _id: req.params.id, merchant: merchantId });
  if (!employee) return next(new AppError('員工不存在', 404));
  await assertManagerCanEditTarget(req, employee);
  await employee.deleteOne();
  res.status(204).json({ status: 'success', data: null });
});


