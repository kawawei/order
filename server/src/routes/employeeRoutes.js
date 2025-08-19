const express = require('express');
const employeeController = require('../controllers/employeeController');
const { protectAny, requirePermissions } = require('../middleware/auth');

const router = express.Router();

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

module.exports = router;


