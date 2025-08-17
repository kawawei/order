const express = require('express');
const orderController = require('../controllers/orderController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// 公共路由（客戶端使用）
router.post('/', orderController.createOrder);
router.post('/checkout', orderController.checkoutOrder);
router.get('/:id', orderController.getOrder);
router.get('/table/:tableId', orderController.getOrdersByTable);
router.get('/table/:tableId/batches', orderController.getTableBatches);
router.get('/table/:tableId/total', orderController.getTableTotal);
router.post('/table/:tableId/checkout', orderController.checkoutTable);

// 管理路由（後台使用）- 需要商家權限
router.use('/merchant/:merchantId', protect, restrictTo('merchant'));
router.get('/merchant/:merchantId', orderController.getOrdersByMerchant);
router.get('/merchant/:merchantId/stats', orderController.getOrderStats);

// 訂單狀態管理 - 需要商家權限
router.use('/:id', protect, restrictTo('merchant'));
router.patch('/:id/status', orderController.updateOrderStatus);
router.patch('/:id/cancel', orderController.cancelOrder);

module.exports = router;
