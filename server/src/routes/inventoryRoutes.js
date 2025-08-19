const express = require('express');
const inventoryController = require('../controllers/inventoryController');
const { protectMerchantOrAdmin, restrictTo } = require('../middleware/auth');

const router = express.Router();

// 商家或超級管理員登入後才能訪問的路由
router.use(protectMerchantOrAdmin);
router.use(restrictTo('merchant', 'admin'));

// 庫存項目路由
router.route('/')
  .get(inventoryController.getAllInventory)
  .post(inventoryController.createInventory);

// 批量操作
router.patch('/batch/update', inventoryController.batchUpdateInventory);

// 統計信息
router.get('/stats/overview', inventoryController.getInventoryStats);
router.get('/categories', inventoryController.getInventoryCategories);

// 搜索
router.get('/search', inventoryController.searchInventory);

// 特定庫存項目路由 (必須放在最後，避免攔截其他路由)
router.route('/:id')
  .get(inventoryController.getInventory)
  .patch(inventoryController.updateInventory)
  .put(inventoryController.updateInventory)  // 向後兼容 PUT 方法
  .delete(inventoryController.deleteInventory);

module.exports = router;
