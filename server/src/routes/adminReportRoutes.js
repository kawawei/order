const express = require('express');
const adminReportController = require('../controllers/adminReportController');
const { protectAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// 所有路由都需要管理員身份驗證
router.use(protectAdmin);

// 獲取平台報表統計
router.get('/platform-stats', adminReportController.getPlatformStats);

// 匯出平台報表
router.get('/export', adminReportController.exportPlatformReport);

module.exports = router;
