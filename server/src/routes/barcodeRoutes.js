const express = require('express');
const router = express.Router();
const barcodeController = require('../controllers/barcodeController');

/**
 * @route POST /api/barcode/generate
 * @desc 生成條碼圖片
 * @access Public
 */
router.post('/generate', barcodeController.generateBarcode);

/**
 * @route POST /api/barcode/qrcode
 * @desc 生成 QR Code 圖片
 * @access Public
 */
router.post('/qrcode', barcodeController.generateQRCode);

/**
 * @route POST /api/barcode/combined
 * @desc 生成條碼和 QR Code 組合
 * @access Public
 */
router.post('/combined', barcodeController.generateBarcodeAndQRCode);

/**
 * @route POST /api/barcode/multiple
 * @desc 生成多個條碼
 * @access Public
 */
router.post('/multiple', barcodeController.generateMultipleBarcodes);

/**
 * @route POST /api/barcode/multiple-qrcode
 * @desc 生成多個 QR Code
 * @access Public
 */
router.post('/multiple-qrcode', barcodeController.generateMultipleQRCodes);

/**
 * @route POST /api/barcode/validate
 * @desc 驗證條碼格式
 * @access Public
 */
router.post('/validate', barcodeController.validateBarcode);

module.exports = router;
