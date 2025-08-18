const express = require('express');
const reportController = require('../controllers/reportController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// 所有報表路由都需要商家身份驗證
router.use(protect);
router.use(restrictTo('merchant'));

// 獲取詳細報表統計
router.get('/stats', reportController.getReportStats);

// 獲取簡化版報表統計（用於儀表板）
router.get('/simple', reportController.getSimpleReportStats);

module.exports = router;
