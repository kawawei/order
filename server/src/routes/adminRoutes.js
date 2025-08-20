const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const adminController = require('../controllers/adminController');
const authController = require('../controllers/authController');
const AppError = require('../utils/appError');

const router = express.Router();

// 設定 multer 儲存配置
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../tmp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'import-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只允許上傳 Excel 檔案 (.xlsx, .xls)'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 限制 5MB
  }
});

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

// 匯入餐廳路由
router.post('/merchants/import', upload.single('file'), adminController.importMerchants);

router.route('/merchants/:id')
  .get(adminController.getMerchant)
  .patch(adminController.updateMerchant)
  .delete(adminController.deleteMerchant);

// 超級管理員查看特定商家統計信息
router.get('/merchants/:id/tables/stats', adminController.getMerchantTableStats);
router.get('/merchants/:id/orders/stats', adminController.getMerchantOrderStats);

module.exports = router;
