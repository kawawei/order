const express = require('express');
const roleController = require('../controllers/roleController');
const { protectAny, requirePermissions, requireOwnerOrAdmin } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// 需要登入
router.use(protectAny);

// 查詢系統支援的權限清單（放在動態路由前，避免被 `/:id` 吃掉）
router.get('/_catalog/permissions', (req, res) => {
  res.status(200).json({ status: 'success', data: { permissions: PERMISSIONS } });
});

// 角色管理（需「角色：管理」權限；商家/超管預設允許）
router.route('/')
  .get(requireOwnerOrAdmin, roleController.getAllRoles)
  .post(requireOwnerOrAdmin, roleController.createRole);

router.route('/:id')
  .get(requireOwnerOrAdmin, roleController.getRole)
  .patch(requireOwnerOrAdmin, roleController.updateRole)
  .delete(requireOwnerOrAdmin, roleController.deleteRole);

module.exports = router;


