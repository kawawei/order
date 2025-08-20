const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const employeeController = require('../controllers/employeeController');
const { protectAny, requirePermissions } = require('../middleware/auth');

const router = express.Router();

// 設定 multer 儲存配置
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../tmp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'import-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只允許上傳 Excel 檔案 (.xlsx, .xls)'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 限制 5MB
  }
});

// 員工登入（無需 token）
router.post('/login', employeeController.login);

// 後台員工管理（需登入 + 權限）
router.use(protectAny);

router.route('/')
  .get(requirePermissions('員工:查看'), employeeController.getAllEmployees)
  .post(requirePermissions('員工:編輯'), employeeController.createEmployee);

router.route('/:id')
  .patch(requirePermissions('員工:編輯'), employeeController.updateEmployee)
  .delete(requirePermissions('員工:編輯'), employeeController.deleteEmployee);

// 匯入員工（Excel）
router.post('/import', upload.single('file'), requirePermissions('員工:編輯'), employeeController.importEmployees);

module.exports = router;


