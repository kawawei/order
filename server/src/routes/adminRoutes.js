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

// 商家管理路由
router.route('/merchants')
  .get(adminController.getAllMerchants)
  .post(adminController.createMerchant);

router.route('/merchants/:id')
  .get(adminController.getMerchant)
  .patch(adminController.updateMerchantStatus)
  .delete(adminController.deleteMerchant);

// 超級管理員查看特定商家統計信息
router.get('/merchants/:id/tables/stats', adminController.getMerchantTableStats);
router.get('/merchants/:id/orders/stats', adminController.getMerchantOrderStats);

module.exports = router;
