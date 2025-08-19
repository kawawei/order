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

exports.getAllRoles = catchAsync(async (req, res, next) => {
  const merchantId = getMerchantId(req);
  const roles = await Role.find({ merchant: merchantId }).sort({ createdAt: -1 });
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

  // 系統預設角色（如：老闆）的保護規則
  if (role.isSystem) {
    // 非管理員不可修改系統預設角色
    if (!isAdminActor) {
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


