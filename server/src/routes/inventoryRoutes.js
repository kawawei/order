const express = require('express');
const inventoryController = require('../controllers/inventoryController');
const { protectAny, requirePermissions } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// 上傳配置
const tempDir = path.join(__dirname, '..', 'tmp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}
const upload = multer({
  dest: tempDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
      'application/csv'
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/)) {
      return cb(null, true);
    }
    cb(new Error('只允許上傳 Excel 或 CSV 檔案'));
  }
});

// 商家或超級管理員登入後才能訪問的路由
router.use(protectAny);

// 庫存項目路由
router.route('/')
  .get(requirePermissions('庫存:查看'), inventoryController.getAllInventory)
  .post(requirePermissions('庫存:編輯'), inventoryController.createInventory);

// 匯入功能
router.post('/import', 
  requirePermissions('庫存:編輯'), 
  upload.single('file'), 
  inventoryController.importInventory
);

// 批量操作
router.patch('/batch/update', requirePermissions('庫存:編輯'), inventoryController.batchUpdateInventory);

// 統計信息
router.get('/stats/overview', requirePermissions('報表:查看'), inventoryController.getInventoryStats);
router.get('/categories', requirePermissions('庫存:查看'), inventoryController.getInventoryCategories);

// 搜索
router.get('/search', requirePermissions('庫存:查看'), inventoryController.searchInventory);

// 特定庫存項目路由 (必須放在最後，避免攔截其他路由)
router.route('/:id')
  .get(requirePermissions('庫存:查看'), inventoryController.getInventory)
  .patch(requirePermissions('庫存:編輯'), inventoryController.updateInventory)
  .put(requirePermissions('庫存:編輯'), inventoryController.updateInventory)  // 向後兼容 PUT 方法
  .delete(requirePermissions('庫存:編輯'), inventoryController.deleteInventory);

module.exports = router;
