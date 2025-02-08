const express = require('express');
const adminController = require('../controllers/adminController');
const authController = require('../controllers/authController');
const AppError = require('../utils/appError');

const router = express.Router();

// 初始化超級管理員（只能在系統初始化時使用一次）
router.post('/init-super-admin', adminController.createSuperAdmin);

// 管理員登入
router.post('/login', adminController.login);

// 需要管理員身份驗證的路由
router.use(authController.protect);

// 只有超級管理員可以訪問的路由
router.use((req, res, next) => {
  if (req.user.role !== 'superadmin') {
    return next(new AppError('只有超級管理員可以訪問此功能', 403));
  }
  next();
});

router.route('/')
  .get(adminController.getAllAdmins)
  .post(adminController.createAdmin);

module.exports = router;
