const express = require('express');
const inventoryController = require('../controllers/inventoryController');
const { protectAny, requirePermissions } = require('../middleware/auth');

const router = express.Router();

// 商家或超級管理員登入後才能訪問的路由
router.use(protectAny);

// 庫存項目路由
router.route('/')
  .get(requirePermissions('庫存:查看'), inventoryController.getAllInventory)
  .post(requirePermissions('庫存:編輯'), inventoryController.createInventory);

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
