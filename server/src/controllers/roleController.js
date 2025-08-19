const Role = require('../models/role');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');

const getMerchantId = (req) => {
  if (req.admin && req.query.merchantId) return req.query.merchantId;
  if (req.merchant) return req.merchant.id;
  if (req.employee) return req.employee.merchant.toString();
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
    permissions: Array.isArray(req.body.permissions) ? req.body.permissions : []
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
  if (typeof req.body.name === 'string') role.name = req.body.name;
  if (Array.isArray(req.body.permissions)) role.permissions = req.body.permissions;
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
  await role.deleteOne();
  res.status(204).json({ status: 'success', data: null });
});


