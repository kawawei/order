const express = require('express');
const menuCategoryController = require('../controllers/menuCategoryController');
const dishController = require('../controllers/dishController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// 公開路由 - 客戶端獲取菜單
router.get('/public/:merchantId', dishController.getPublicMenu);

// 商家登入後才能訪問的路由
router.use(protect);
router.use(restrictTo('merchant'));

// 菜單分類路由
router.route('/categories')
  .get(menuCategoryController.getAllCategories)
  .post(menuCategoryController.createCategory);

router.route('/categories/:id')
  .get(menuCategoryController.getCategory)
  .patch(menuCategoryController.updateCategory)
  .delete(menuCategoryController.deleteCategory);

// 分類排序
router.patch('/categories/order', menuCategoryController.updateCategoriesOrder);

// 分類統計
router.get('/categories/stats', menuCategoryController.getCategoryStats);

// 菜品路由
router.route('/dishes')
  .get(dishController.getAllDishes)
  .post(dishController.createDish);

router.route('/dishes/:id')
  .get(dishController.getDish)
  .patch(dishController.updateDish)
  .put(dishController.updateDish)  // 向後兼容 PUT 方法
  .delete(dishController.deleteDish);

// 批量操作
router.patch('/dishes/batch', dishController.batchUpdateDishes);

// 菜品統計
router.get('/dishes/stats', dishController.getDishStats);

module.exports = router;
