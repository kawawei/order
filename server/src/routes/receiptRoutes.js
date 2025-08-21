const express = require('express');
const receiptController = require('../controllers/receiptController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// 所有路由都需要身份驗證
router.use(protect);

// 收據管理路由 - 需要商家或管理員權限
router.use(restrictTo('merchant', 'admin'));

// 創建收據
router.post('/', receiptController.createReceipt);

// 獲取收據列表
router.get('/', receiptController.getReceipts);

// 獲取收據統計
router.get('/stats', receiptController.getReceiptStats);

// 獲取單個收據
router.get('/:id', receiptController.getReceipt);

// 根據帳單號碼獲取收據
router.get('/bill/:billNumber', receiptController.getReceiptByBillNumber);

// 根據訂單ID獲取收據
router.get('/order/:orderId', receiptController.getReceiptByOrderId);

// 更新收據列印次數
router.patch('/:id/print', receiptController.updatePrintCount);

// 重新列印收據
router.post('/:id/reprint', receiptController.reprintReceipt);

// 作廢收據
router.patch('/:id/void', receiptController.voidReceipt);

module.exports = router;
