const Role = require('../models/role');
const Employee = require('../models/employee');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const { normalizePermissionKeys } = require('../config/permissions');

const getMerchantId = (req) => {
  if (req.admin && req.query.merchantId) return req.query.merchantId;
  if (req.employee) return req.employee.merchant?.toString();
  if (req.merchant) return req.merchant.id;
  throw new AppError('無法確定商家身份', 401);
};

// 確保系統固定角色存在（管理人員、工作人員）
const ensureSystemRolesForMerchant = async (merchantId) => {
  const existingRoles = await Role.find({ merchant: merchantId }).select('name');
  const names = new Set(existingRoles.map(r => (r.name || '').trim()));

  const rolesToCreate = [];

  if (!names.has('管理人員')) {
    rolesToCreate.push({
      merchant: merchantId,
      name: '管理人員',
      permissions: normalizePermissionKeys([
        '菜單:查看',
        '菜單:編輯',
        '庫存:查看',
        '庫存:編輯',
        '訂單:查看',
        '訂單:更新狀態',
        '訂單:結帳',
        '桌位:查看',
        '桌位:管理',
        '報表:查看',
        '員工:查看',
        '員工:編輯'
      ]),
      isSystem: true
    });
  }

  if (!names.has('工作人員')) {
    rolesToCreate.push({
      merchant: merchantId,
      name: '工作人員',
      permissions: normalizePermissionKeys([
        '訂單:查看',
        '訂單:更新狀態',
        '訂單:結帳',
        '桌位:查看'
      ]),
      isSystem: true
    });
  }

  if (rolesToCreate.length > 0) {
    await Role.insertMany(rolesToCreate);
  }
};

exports.getAllRoles = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  await ensureSystemRolesForMerchant(merchantId);
  
  let roles = await Role.find({ merchant: merchantId }).sort({ createdAt: -1 });
  
  // 如果是管理人員（非老闆），只返回工作人員角色
  if (req.employee && !req.employee.isOwner && !req.admin) {
    roles = roles.filter(role => role.name === '工作人員');
  }
  
  res.status(200).json({ status: 'success', results: roles.length, data: { roles } });
});

exports.createRole = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  const role = await Role.create({
    merchant: merchantId,
    name: req.body.name,
    permissions: normalizePermissionKeys(req.body.permissions)
  });
  res.status(201).json({ status: 'success', data: { role } });
});

exports.getRole = catchAsync(async (req, res, next) => {
  const role = await Role.findById(req.params.id);
  if (!role) return next(new AppError('角色不存在', 404));
  const merchantId = getMerchantId(req);
  if (role.merchant.toString() !== merchantId.toString()) {
    return next(new AppError('您沒有權限訪問此資源', 403));
  }
  res.status(200).json({ status: 'success', data: { role } });
});

exports.updateRole = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  const role = await Role.findById(req.params.id);
  if (!role) return next(new AppError('角色不存在', 404));
  if (role.merchant.toString() !== merchantId.toString()) {
    return next(new AppError('您沒有權限執行此操作', 403));
  }
  const isAdminActor = !!req.admin;
  const isMerchantOwner = !!req.merchant || !!req.employee?.isOwner;

  // 系統預設角色（如：老闆）的保護規則
  if (role.isSystem) {
    // 非管理員不可修改系統預設角色
    if (!isAdminActor && !isMerchantOwner) {
      return next(new AppError('系統預設角色不可修改，請聯繫管理員', 403));
    }
    // 管理員可調整權限，但不可更名
    if (Array.isArray(req.body.permissions)) {
      role.permissions = normalizePermissionKeys(req.body.permissions);
    }
    // 忽略對名稱的任何修改請求，保持「老闆」名稱固定
  } else {
    if (typeof req.body.name === 'string') role.name = req.body.name;
    if (Array.isArray(req.body.permissions)) role.permissions = normalizePermissionKeys(req.body.permissions);
  }
  await role.save();
  res.status(200).json({ status: 'success', data: { role } });
});

exports.deleteRole = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  const role = await Role.findById(req.params.id);
  if (!role) return next(new AppError('角色不存在', 404));
  if (role.merchant.toString() !== merchantId.toString()) {
    return next(new AppError('您沒有權限執行此操作', 403));
  }
  if (role.isSystem) return next(new AppError('系統預設角色不可刪除', 400));
  // 檢查是否仍有員工使用此角色
  const usedByEmployees = await Employee.exists({ merchant: merchantId, role: role._id });
  if (usedByEmployees) {
    return next(new AppError('仍有員工使用此角色，請先調整員工角色後再刪除', 400));
  }
  await role.deleteOne();
  res.status(204).json({ status: 'success', data: null });
});


