const express = require('express');
const adminReportController = require('../controllers/adminReportController');
const { protectAdmin } = require('../middleware/auth');

const router = express.Router();

// 所有路由都需要管理員身份驗證
router.use(protectAdmin);

// 獲取餐廳列表
router.get('/restaurants', adminReportController.getRestaurants);

// 獲取平台報表統計
router.get('/platform-stats', adminReportController.getPlatformStats);

// 匯出平台報表
router.get('/export', adminReportController.exportPlatformReport);

// 匯出完整管理員統計報表（暫時移除，因為函數未定義）
// router.get('/export-complete', adminReportController.exportCompleteAdminReport);

module.exports = router;
