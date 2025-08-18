const express = require('express');
const tableController = require('../controllers/tableController');
const { protectMerchantOrAdmin, restrictTo } = require('../middleware/auth');

const router = express.Router();

// 公開路由 - 客戶端訪問桌次信息
router.get('/public/:code', tableController.getTableByCode);

// 公開路由 - 客戶端開始點餐
router.post('/:id/start-ordering', tableController.startOrdering);

// 商家或超級管理員登入後才能訪問的路由
router.use(protectMerchantOrAdmin);
router.use(restrictTo('merchant', 'admin'));

// 統計信息 - 必須在 /:id 路由之前
router.get('/stats', tableController.getTableStats);

// 桌次 CRUD 路由
router
  .route('/')
  .get(tableController.getAllTables)
  .post(tableController.createTable);

router
  .route('/:id')
  .get(tableController.getTable)
  .patch(tableController.updateTable)
  .delete(tableController.deleteTable);

// 桌次狀態管理
router.patch('/:id/status', tableController.updateTableStatus);
router.patch('/batch/status', tableController.batchUpdateStatus);

// 二維碼管理
router.post('/:id/regenerate-qr', tableController.regenerateQRCode);

module.exports = router;
