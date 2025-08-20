const express = require('express');
const orderController = require('../controllers/orderController');
const { protectAny, requirePermissions, enforceSameMerchantParam } = require('../middleware/auth');

const router = express.Router();

// 公共路由（客戶端使用）
router.post('/', orderController.createOrder);
router.post('/checkout', orderController.checkoutOrder);
router.get('/:id', orderController.getOrder);
router.get('/table/:tableId', orderController.getOrdersByTable);
router.get('/table/:tableId/batches', orderController.getTableBatches);
router.get('/table/:tableId/total', orderController.getTableTotal);
router.post('/table/:tableId/checkout', orderController.checkoutTable);

// 管理路由（後台使用）- 需要後台任一身分 + 權限（商家/管理員自帶全權限）
router.use('/merchant/:merchantId', protectAny, enforceSameMerchantParam('merchantId'));
router.get('/merchant/:merchantId', requirePermissions('訂單:查看'), orderController.getOrdersByMerchant);
router.get('/merchant/:merchantId/stats', requirePermissions('報表:查看'), orderController.getOrderStats);
router.get('/merchant/:merchantId/export', requirePermissions('報表:匯出'), orderController.exportHistoryOrders);

// 訂單狀態管理 - 需要權限
router.use('/:id', protectAny);
router.patch('/:id/status', requirePermissions('訂單:更新狀態'), orderController.updateOrderStatus);
router.patch('/:id/cancel', requirePermissions('訂單:更新狀態'), orderController.cancelOrder);

module.exports = router;
