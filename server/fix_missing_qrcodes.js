const mongoose = require('mongoose');
const QRCode = require('qrcode');

// 連接到 MongoDB
mongoose.connect('mongodb://admin:admin123@127.0.0.1:27018/order?authSource=admin', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// 引入桌次模型
const Table = require('./src/models/table');

async function fixMissingQRCodes() {
  try {
    console.log('開始修復缺少 QR Code 的桌次...');
    
    // 查找所有沒有 QR Code 的桌次
    const tablesWithoutQR = await Table.find({
      $or: [
        { qrCodeDataUrl: { $exists: false } },
        { qrCodeDataUrl: '' },
        { qrCodeDataUrl: null }
      ]
    });
    
    console.log(`找到 ${tablesWithoutQR.length} 個缺少 QR Code 的桌次`);
    
    for (const table of tablesWithoutQR) {
      try {
        // 確保有 uniqueCode 和 customerUrl
        if (!table.uniqueCode) {
          table.uniqueCode = table.generateUniqueCode();
        }
        if (!table.customerUrl) {
          table.customerUrl = table.generateCustomerUrl();
        }
        
        // 生成 QR Code
        const qrCodeDataUrl = await QRCode.toDataURL(table.customerUrl, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        
        table.qrCodeDataUrl = qrCodeDataUrl;
        await table.save();
        
        console.log(`✅ 桌次 ${table.tableNumber} QR Code 生成成功`);
      } catch (error) {
        console.error(`❌ 桌次 ${table.tableNumber} QR Code 生成失敗:`, error.message);
      }
    }
    
    console.log('修復完成！');
  } catch (error) {
    console.error('修復過程中發生錯誤:', error);
  } finally {
    mongoose.connection.close();
  }
}

fixMissingQRCodes();
