const express = require('express');
const inventoryCategoryController = require('../controllers/inventoryCategoryController');
const { protectMerchantOrAdmin, restrictTo } = require('../middleware/auth');

const router = express.Router();

// 商家或超級管理員登入後才能訪問的路由
router.use(protectMerchantOrAdmin);
router.use(restrictTo('merchant', 'admin'));

// 分類管理路由
router.route('/')
  .get(inventoryCategoryController.getAllCategories)
  .post(inventoryCategoryController.createCategory);

// 批量操作
router.patch('/order', inventoryCategoryController.updateCategoriesOrder);

// 統計信息
router.get('/stats', inventoryCategoryController.getCategoryStats);

// 初始化系統預設分類
router.post('/initialize', inventoryCategoryController.initializeSystemCategories);

// 特定分類路由
router.route('/:id')
  .get(inventoryCategoryController.getCategory)
  .patch(inventoryCategoryController.updateCategory)
  .delete(inventoryCategoryController.deleteCategory);

module.exports = router;

