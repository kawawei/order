const bwipjs = require('bwip-js'); // 使用 bwip-js 替代 jsbarcode，適合 Node.js 服務器端 / Use bwip-js instead of jsbarcode, suitable for Node.js server-side
const QRCode = require('qrcode'); // QR Code 生成庫 / QR Code generation library

class BarcodeService {
  /**
   * 生成條碼圖片 (SVG) / Generate barcode image (SVG)
   * @param {string} text - 要編碼的文字 / Text to encode
   * @param {Object} options - 條碼選項 / Barcode options
   * @returns {Promise<string>} SVG 格式的條碼 / SVG format barcode
   */
  async generateBarcode(text, options = {}) {
    try {
      // 預設選項 / Default options
      const defaultOptions = {
        bcid: 'code128', // bwip-js 使用 bcid 指定條碼類型 / bwip-js uses bcid to specify barcode type
        text: text, // 要編碼的文字 / Text to encode
        width: 150, // 條碼寬度（像素）/ Barcode width in pixels
        height: 30, // 條碼高度（像素）/ Barcode height in pixels
        includetext: false, // 不顯示文字，只顯示條碼 / Don't display text, only barcode
        scale: 1.5, // 增加條碼密度，讓條紋更緊密 / Increase barcode density
        ...options
      };

      // 使用 bwip-js 生成 SVG 條碼 / Use bwip-js to generate SVG barcode
      const svg = await bwipjs.toSVG(defaultOptions);
      
      return svg;
    } catch (error) {
      console.error('生成條碼失敗:', error); // 條碼生成失敗日誌 / Barcode generation failure log
      throw new Error('條碼生成失敗'); // 拋出條碼生成失敗錯誤 / Throw barcode generation failure error
    }
  }

  /**
   * 生成 QR Code 圖片 (base64) / Generate QR Code image (base64)
   * @param {string} text - 要編碼的文字 / Text to encode
   * @param {Object} options - QR Code 選項 / QR Code options
   * @returns {Promise<string>} base64 圖片 / base64 image
   */
  async generateQRCode(text, options = {}) {
    try {
      // 預設 QR Code 選項 / Default QR Code options
      const defaultOptions = {
        width: 200, // 圖片寬度 / Image width
        margin: 2, // 邊距 / Margin
        color: {
          dark: '#000000', // 深色（前景）/ Dark color (foreground)
          light: '#FFFFFF' // 淺色（背景）/ Light color (background)
        },
        ...options
      };

      // 生成 QR Code 並轉換為 Data URL / Generate QR Code and convert to Data URL
      const qrCodeDataURL = await QRCode.toDataURL(text, defaultOptions);
      return qrCodeDataURL;
    } catch (error) {
      console.error('生成 QR Code 失敗:', error); // QR Code 生成失敗日誌 / QR Code generation failure log
      throw new Error('QR Code 生成失敗'); // 拋出 QR Code 生成失敗錯誤 / Throw QR Code generation failure error
    }
  }

  /**
   * 生成條碼和 QR Code 組合圖片 / Generate combined barcode and QR Code images
   * @param {string} text - 要編碼的文字 / Text to encode
   * @param {Object} options - 選項 / Options
   * @returns {Promise<Object>} 包含條碼和 QR Code 的物件 / Object containing barcode and QR Code
   */
  async generateBarcodeAndQRCode(text, options = {}) {
    try {
      // 並行生成條碼和 QR Code / Generate barcode and QR Code in parallel
      const [barcode, qrCode] = await Promise.all([
        this.generateBarcode(text, options.barcode),
        this.generateQRCode(text, options.qrCode)
      ]);

      return {
        barcode, // 條碼圖片 / Barcode image
        qrCode, // QR Code 圖片 / QR Code image
        text // 原始文字 / Original text
      };
    } catch (error) {
      console.error('生成條碼和 QR Code 失敗:', error); // 組合生成失敗日誌 / Combined generation failure log
      throw new Error('條碼和 QR Code 生成失敗'); // 拋出組合生成失敗錯誤 / Throw combined generation failure error
    }
  }

  /**
   * 驗證條碼格式 / Validate barcode format
   * @param {string} text - 要驗證的文字 / Text to validate
   * @param {string} format - 條碼格式 / Barcode format
   * @returns {boolean} 是否有效 / Whether it's valid
   */
  validateBarcode(text, format = 'CODE128') {
    try {
      // 基本驗證：檢查文字是否存在 / Basic validation: check if text exists
      if (!text || text.length === 0) {
        return false;
      }

      // 根據格式進行特定驗證 / Perform specific validation based on format
      switch (format) {
        case 'CODE128':
          // CODE128 支援 ASCII 0-127 / CODE128 supports ASCII 0-127
          return /^[\x00-\x7F]+$/.test(text);
        
        case 'CODE39':
          // CODE39 支援數字、大寫字母、空格和一些符號 / CODE39 supports numbers, uppercase letters, spaces and some symbols
          return /^[0-9A-Z\s\-\.\/\+\$\%]+$/.test(text);
        
        case 'EAN13':
          // EAN13 必須是 13 位數字 / EAN13 must be 13 digits
          return /^\d{13}$/.test(text);
        
        case 'EAN8':
          // EAN8 必須是 8 位數字 / EAN8 must be 8 digits
          return /^\d{8}$/.test(text);
        
        case 'UPC':
          // UPC 必須是 12 位數字 / UPC must be 12 digits
          return /^\d{12}$/.test(text);
        
        default:
          return true; // 其他格式預設為有效 / Other formats default to valid
      }
    } catch (error) {
      console.error('條碼驗證失敗:', error); // 條碼驗證失敗日誌 / Barcode validation failure log
      return false;
    }
  }

  /**
   * 生成多個條碼 / Generate multiple barcodes
   * @param {Array} texts - 文字陣列 / Array of texts
   * @param {Object} options - 選項 / Options
   * @returns {Promise<Array>} 條碼陣列 / Array of barcodes
   */
  async generateMultipleBarcodes(texts, options = {}) {
    try {
      // 並行生成多個條碼 / Generate multiple barcodes in parallel
      const promises = texts.map(text => this.generateBarcode(text, options));
      return await Promise.all(promises);
    } catch (error) {
      console.error('生成多個條碼失敗:', error); // 多個條碼生成失敗日誌 / Multiple barcode generation failure log
      throw new Error('多個條碼生成失敗'); // 拋出多個條碼生成失敗錯誤 / Throw multiple barcode generation failure error
    }
  }

  /**
   * 生成多個 QR Code / Generate multiple QR Codes
   * @param {Array} texts - 文字陣列 / Array of texts
   * @param {Object} options - 選項 / Options
   * @returns {Promise<Array>} QR Code 陣列 / Array of QR Codes
   */
  async generateMultipleQRCodes(texts, options = {}) {
    try {
      // 並行生成多個 QR Code / Generate multiple QR Codes in parallel
      const promises = texts.map(text => this.generateQRCode(text, options));
      return await Promise.all(promises);
    } catch (error) {
      console.error('生成多個 QR Code 失敗:', error); // 多個 QR Code 生成失敗日誌 / Multiple QR Code generation failure log
      throw new Error('多個 QR Code 生成失敗'); // 拋出多個 QR Code 生成失敗錯誤 / Throw multiple QR Code generation failure error
    }
  }
}

module.exports = new BarcodeService();
