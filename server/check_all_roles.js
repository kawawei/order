const mongoose = require('mongoose');
const Role = require('./src/models/role');
const Employee = require('./src/models/employee');
const Merchant = require('./src/models/merchant');

// 連接到 MongoDB (Docker)
const connectDB = async () => {
  try {
    await mongoose.connect('mongodb://admin:admin123@localhost:27018/order-system?authSource=admin', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB 連接成功');
  } catch (error) {
    console.error('MongoDB 連接失敗:', error);
    process.exit(1);
  }
};

// 檢查所有資料
const checkAllData = async () => {
  try {
    console.log('=== 檢查所有商家 ===');
    const merchants = await Merchant.find({});
    console.log(`找到 ${merchants.length} 個商家`);
    
    for (const merchant of merchants) {
      console.log(`\n商家: ${merchant.businessName} (ID: ${merchant._id})`);
      console.log(`商家代碼: ${merchant.merchantCode}`);
      
      // 檢查該商家的角色
      const roles = await Role.find({ merchant: merchant._id });
      console.log(`該商家有 ${roles.length} 個角色:`);
      
      for (const role of roles) {
        console.log(`  - ${role.name} (ID: ${role._id})`);
        console.log(`    權限: ${role.permissions.join(', ')}`);
        console.log(`    是否系統角色: ${role.isSystem}`);
      }
      
      // 檢查該商家的員工
      const employees = await Employee.find({ merchant: merchant._id }).populate('role');
      console.log(`該商家有 ${employees.length} 個員工:`);
      
      for (const employee of employees) {
        console.log(`  - ${employee.name} (${employee.employeeNumber})`);
        console.log(`    帳號: ${employee.account}`);
        console.log(`    角色: ${employee.role ? employee.role.name : '無角色'}`);
        console.log(`    是否老闆: ${employee.isOwner}`);
      }
    }
    
  } catch (error) {
    console.error('檢查資料時發生錯誤:', error);
  }
};

// 主函數
const main = async () => {
  await connectDB();
  await checkAllData();
  console.log('\n=== 檢查完成 ===');
  process.exit(0);
};

main();
