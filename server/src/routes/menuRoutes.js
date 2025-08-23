const express = require('express');
const menuCategoryController = require('../controllers/menuCategoryController');
const dishController = require('../controllers/dishController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { protectAny, requirePermissions } = require('../middleware/auth');

const router = express.Router();

// 上傳配置（先保存到暫存區，實際目錄與檔名在 controller 中決定）
// Upload config: store temporarily; controller will move/rename per category/dish
const tempDir = path.join(__dirname, '..', 'tmp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// 圖片上傳配置
const imageUpload = multer({
  dest: tempDir,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  preserveExtension: true,
  fileFilter: (req, file, cb) => {
    if (/^image\/(png|jpe?g|gif|webp)$/.test(file.mimetype)) return cb(null, true);
    cb(new Error('只允許上傳圖片檔案'));
  }
});

// Excel 檔案上傳配置
const excelUpload = multer({
  dest: tempDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (/\.(xlsx|xls|csv)$/i.test(file.originalname)) return cb(null, true);
    cb(new Error('只允許上傳 Excel 或 CSV 檔案'));
  }
});

// 公開路由 - 客戶端獲取菜單
router.get('/public/:merchantId', dishController.getPublicMenu);

// 商家或超級管理員登入後才能訪問的路由
router.use(protectAny);

// 菜單分類路由
router.route('/categories')
  .get(requirePermissions('菜單:查看'), menuCategoryController.getAllCategories)
  .post(requirePermissions('菜單:編輯'), menuCategoryController.createCategory);

router.route('/categories/:id')
  .get(requirePermissions('菜單:查看'), menuCategoryController.getCategory)
  .patch(requirePermissions('菜單:編輯'), menuCategoryController.updateCategory)
  .delete(requirePermissions('菜單:編輯'), menuCategoryController.deleteCategory);

// 分類排序
router.patch('/categories/order', requirePermissions('菜單:編輯'), menuCategoryController.updateCategoriesOrder);

// 分類統計
router.get('/categories/stats', requirePermissions('報表:查看'), menuCategoryController.getCategoryStats);

// 菜品路由
router.route('/dishes')
  .get(requirePermissions('菜單:查看'), dishController.getAllDishes)
  .post(requirePermissions('菜單:編輯'), imageUpload.single('image'), dishController.createDish);

router.route('/dishes/:id')
  .get(requirePermissions('菜單:查看'), dishController.getDish)
  .patch(requirePermissions('菜單:編輯'), imageUpload.single('image'), dishController.updateDish)
  .put(requirePermissions('菜單:編輯'), imageUpload.single('image'), dishController.updateDish)  // 向後兼容 PUT 方法
  .delete(requirePermissions('菜單:編輯'), dishController.deleteDish);

// 批量操作
router.patch('/dishes/batch', requirePermissions('菜單:編輯'), dishController.batchUpdateDishes);

// 菜品統計
router.get('/dishes/stats', requirePermissions('報表:查看'), dishController.getDishStats);

// 菜單匯入
router.post('/import', requirePermissions('菜單:編輯'), excelUpload.single('file'), dishController.importMenu);

// 圖片匯入
router.post('/import-images', requirePermissions('菜單:編輯'), imageUpload.array('images', 20), dishController.importImages);

module.exports = router;
