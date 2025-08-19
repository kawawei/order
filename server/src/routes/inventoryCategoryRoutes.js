const express = require('express');
const inventoryCategoryController = require('../controllers/inventoryCategoryController');
const { protectAny, requirePermissions } = require('../middleware/auth');

const router = express.Router();

// 商家或超級管理員登入後才能訪問的路由
router.use(protectAny);

// 分類管理路由
router.route('/')
  .get(requirePermissions('庫存:查看'), inventoryCategoryController.getAllCategories)
  .post(requirePermissions('庫存:編輯'), inventoryCategoryController.createCategory);

// 批量操作
router.patch('/order', requirePermissions('庫存:編輯'), inventoryCategoryController.updateCategoriesOrder);

// 統計信息
router.get('/stats', requirePermissions('報表:查看'), inventoryCategoryController.getCategoryStats);

// 初始化系統預設分類
router.post('/initialize', requirePermissions('庫存:編輯'), inventoryCategoryController.initializeSystemCategories);

// 特定分類路由
router.route('/:id')
  .get(requirePermissions('庫存:查看'), inventoryCategoryController.getCategory)
  .patch(requirePermissions('庫存:編輯'), inventoryCategoryController.updateCategory)
  .delete(requirePermissions('庫存:編輯'), inventoryCategoryController.deleteCategory);

module.exports = router;


