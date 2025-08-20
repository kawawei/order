const mongoose = require('mongoose');
require('dotenv').config();

// 連接數據庫
mongoose.connect(process.env.MONGODB_URI || 'mongodb://admin:admin123@localhost:27018/order?authSource=admin', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const Role = require('./src/models/role');

async function fixManagerPermissions() {
  try {
    console.log('🔧 開始修復管理人員權限...');
    
    // 查找所有管理人員角色
    const managerRoles = await Role.find({ name: '管理人員' });
    console.log(`📋 找到 ${managerRoles.length} 個管理人員角色`);
    
    // 正確的管理人員權限
    const correctPermissions = [
      '菜單:查看',
      '菜單:編輯', 
      '庫存:查看',
      '庫存:編輯',
      '訂單:查看',
      '訂單:更新狀態',
      '訂單:結帳',
      '桌位:查看',
      '桌位:管理',
      '報表:查看',
      '員工:查看',
      '員工:編輯'
    ];
    
    let updatedCount = 0;
    
    for (const role of managerRoles) {
      console.log(`\n🔍 檢查角色: ${role.name} (商家ID: ${role.merchant})`);
      console.log(`   當前權限: ${role.permissions.join(', ')}`);
      
      // 檢查是否缺少權限
      const missingPermissions = correctPermissions.filter(p => !role.permissions.includes(p));
      
      if (missingPermissions.length > 0) {
        console.log(`   ❌ 缺少權限: ${missingPermissions.join(', ')}`);
        
        // 更新權限
        role.permissions = correctPermissions;
        await role.save();
        
        console.log(`   ✅ 已更新權限`);
        updatedCount++;
      } else {
        console.log(`   ✅ 權限已正確`);
      }
    }
    
    console.log(`\n🎉 修復完成！共更新了 ${updatedCount} 個管理人員角色`);
    
  } catch (error) {
    console.error('❌ 修復過程中發生錯誤:', error);
  } finally {
    mongoose.connection.close();
  }
}

fixManagerPermissions();
