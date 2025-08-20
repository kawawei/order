const express = require('express');
const reportController = require('../controllers/reportController');
const { protectAny, requirePermissions } = require('../middleware/auth');

const router = express.Router();

// 所有報表路由都需要後台登入
router.use(protectAny);

// 獲取詳細報表統計
router.get('/stats', requirePermissions('報表:查看'), reportController.getReportStats);

// 獲取簡化版報表統計（用於儀表板）
router.get('/simple', requirePermissions('報表:查看'), reportController.getSimpleReportStats);

// 匯出報表
router.get('/export', requirePermissions('報表:匯出'), reportController.exportReport);

module.exports = router;
