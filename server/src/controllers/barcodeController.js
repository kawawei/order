const barcodeService = require('../services/barcodeService');

class BarcodeController {
  /**
   * 生成條碼圖片
   * @param {Object} req - Express 請求物件
   * @param {Object} res - Express 回應物件
   */
  async generateBarcode(req, res) {
    try {
      const { text, options } = req.body;

      if (!text) {
        return res.status(400).json({
          success: false,
          message: '請提供要編碼的文字'
        });
      }

      // 驗證條碼格式
      const format = options?.format || 'CODE128';
      if (!barcodeService.validateBarcode(text, format)) {
        return res.status(400).json({
          success: false,
          message: `無效的條碼格式: ${format}`
        });
      }

      const barcodeImage = await barcodeService.generateBarcode(text, options);

      res.json({
        success: true,
        data: {
          barcode: barcodeImage,
          text,
          format
        }
      });
    } catch (error) {
      console.error('生成條碼失敗:', error);
      res.status(500).json({
        success: false,
        message: '生成條碼失敗',
        error: error.message
      });
    }
  }

  /**
   * 生成 QR Code 圖片
   * @param {Object} req - Express 請求物件
   * @param {Object} res - Express 回應物件
   */
  async generateQRCode(req, res) {
    try {
      const { text, options } = req.body;

      if (!text) {
        return res.status(400).json({
          success: false,
          message: '請提供要編碼的文字'
        });
      }

      const qrCodeImage = await barcodeService.generateQRCode(text, options);

      res.json({
        success: true,
        data: {
          qrCode: qrCodeImage,
          text
        }
      });
    } catch (error) {
      console.error('生成 QR Code 失敗:', error);
      res.status(500).json({
        success: false,
        message: '生成 QR Code 失敗',
        error: error.message
      });
    }
  }

  /**
   * 生成條碼和 QR Code 組合
   * @param {Object} req - Express 請求物件
   * @param {Object} res - Express 回應物件
   */
  async generateBarcodeAndQRCode(req, res) {
    try {
      const { text, options } = req.body;

      if (!text) {
        return res.status(400).json({
          success: false,
          message: '請提供要編碼的文字'
        });
      }

      // 驗證條碼格式
      const format = options?.barcode?.format || 'CODE128';
      if (!barcodeService.validateBarcode(text, format)) {
        return res.status(400).json({
          success: false,
          message: `無效的條碼格式: ${format}`
        });
      }

      const result = await barcodeService.generateBarcodeAndQRCode(text, options);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('生成條碼和 QR Code 失敗:', error);
      res.status(500).json({
        success: false,
        message: '生成條碼和 QR Code 失敗',
        error: error.message
      });
    }
  }

  /**
   * 生成多個條碼
   * @param {Object} req - Express 請求物件
   * @param {Object} res - Express 回應物件
   */
  async generateMultipleBarcodes(req, res) {
    try {
      const { texts, options } = req.body;

      if (!texts || !Array.isArray(texts) || texts.length === 0) {
        return res.status(400).json({
          success: false,
          message: '請提供要編碼的文字陣列'
        });
      }

      // 驗證所有條碼格式
      const format = options?.format || 'CODE128';
      for (const text of texts) {
        if (!barcodeService.validateBarcode(text, format)) {
          return res.status(400).json({
            success: false,
            message: `無效的條碼格式: ${format}, 文字: ${text}`
          });
        }
      }

      const barcodes = await barcodeService.generateMultipleBarcodes(texts, options);

      res.json({
        success: true,
        data: {
          barcodes,
          texts,
          format
        }
      });
    } catch (error) {
      console.error('生成多個條碼失敗:', error);
      res.status(500).json({
        success: false,
        message: '生成多個條碼失敗',
        error: error.message
      });
    }
  }

  /**
   * 生成多個 QR Code
   * @param {Object} req - Express 請求物件
   * @param {Object} res - Express 回應物件
   */
  async generateMultipleQRCodes(req, res) {
    try {
      const { texts, options } = req.body;

      if (!texts || !Array.isArray(texts) || texts.length === 0) {
        return res.status(400).json({
          success: false,
          message: '請提供要編碼的文字陣列'
        });
      }

      const qrCodes = await barcodeService.generateMultipleQRCodes(texts, options);

      res.json({
        success: true,
        data: {
          qrCodes,
          texts
        }
      });
    } catch (error) {
      console.error('生成多個 QR Code 失敗:', error);
      res.status(500).json({
        success: false,
        message: '生成多個 QR Code 失敗',
        error: error.message
      });
    }
  }

  /**
   * 驗證條碼格式
   * @param {Object} req - Express 請求物件
   * @param {Object} res - Express 回應物件
   */
  async validateBarcode(req, res) {
    try {
      const { text, format } = req.body;

      if (!text) {
        return res.status(400).json({
          success: false,
          message: '請提供要驗證的文字'
        });
      }

      const isValid = barcodeService.validateBarcode(text, format);

      res.json({
        success: true,
        data: {
          isValid,
          text,
          format: format || 'CODE128'
        }
      });
    } catch (error) {
      console.error('驗證條碼失敗:', error);
      res.status(500).json({
        success: false,
        message: '驗證條碼失敗',
        error: error.message
      });
    }
  }
}

module.exports = new BarcodeController();
