const mongoose = require('mongoose');
require('dotenv').config();

// 連接數據庫
mongoose.connect(process.env.MONGODB_URI || 'mongodb://admin:admin123@localhost:27018/order?authSource=admin', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const Role = require('./src/models/role');
const Merchant = require('./src/models/merchant');

async function checkRoles() {
  try {
    console.log('🔍 檢查數據庫中的角色...');
    
    // 查找所有角色
    const roles = await Role.find().populate('merchant', 'businessName merchantCode');
    console.log(`📋 找到 ${roles.length} 個角色`);
    
    for (const role of roles) {
      console.log(`\n🔍 角色: ${role.name}`);
      console.log(`   商家: ${role.merchant?.businessName} (${role.merchant?.merchantCode})`);
      console.log(`   權限: ${role.permissions.join(', ')}`);
      console.log(`   系統角色: ${role.isSystem ? '是' : '否'}`);
    }
    
    // 查找所有商家
    const merchants = await Merchant.find().select('businessName merchantCode');
    console.log(`\n📋 找到 ${merchants.length} 個商家`);
    
    for (const merchant of merchants) {
      console.log(`   商家: ${merchant.businessName} (${merchant.merchantCode})`);
    }
    
  } catch (error) {
    console.error('❌ 檢查過程中發生錯誤:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkRoles();
