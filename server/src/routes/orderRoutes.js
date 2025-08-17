const express = require('express');
const orderController = require('../controllers/orderController');

const router = express.Router();

// 公共路由（客戶端使用）
router.post('/', orderController.createOrder);
router.get('/:id', orderController.getOrder);
router.get('/table/:tableId', orderController.getOrdersByTable);

// 管理路由（後台使用）
router.get('/merchant/:merchantId', orderController.getOrdersByMerchant);
router.patch('/:id/status', orderController.updateOrderStatus);
router.patch('/:id/cancel', orderController.cancelOrder);
router.get('/merchant/:merchantId/stats', orderController.getOrderStats);

module.exports = router;
