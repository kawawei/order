const express = require('express');
const tableController = require('../controllers/tableController');
const { protectAny, requirePermissions } = require('../middleware/auth');

const router = express.Router();

// 公開路由 - 客戶端訪問桌次信息
router.get('/public/:code', tableController.getTableByCode);

// 公開路由 - 客戶端開始點餐
router.post('/:id/start-ordering', tableController.startOrdering);

// 商家或超級管理員登入後才能訪問的路由
router.use(protectAny);

// 統計信息 - 必須在 /:id 路由之前
router.get('/stats', tableController.getTableStats);

// 桌次 CRUD 路由
router
  .route('/')
  .get(requirePermissions('桌位:查看'), tableController.getAllTables)
  .post(requirePermissions('桌位:管理'), tableController.createTable);

router
  .route('/:id')
  .get(requirePermissions('桌位:查看'), tableController.getTable)
  .patch(requirePermissions('桌位:管理'), tableController.updateTable)
  .delete(requirePermissions('桌位:管理'), tableController.deleteTable);

// 桌次狀態管理
router.patch('/:id/status', requirePermissions('桌位:管理'), tableController.updateTableStatus);
router.patch('/batch/status', requirePermissions('桌位:管理'), tableController.batchUpdateStatus);

// 二維碼管理
router.post('/:id/regenerate-qr', requirePermissions('桌位:管理'), tableController.regenerateQRCode);
router.post('/batch/generate-qr', requirePermissions('桌位:管理'), tableController.batchGenerateQRCode);

module.exports = router;
