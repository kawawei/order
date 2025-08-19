const express = require('express');
const roleController = require('../controllers/roleController');
const { protectAny, requirePermissions } = require('../middleware/auth');
const { PERMISSIONS } = require('../config/permissions');

const router = express.Router();

// 需要登入
router.use(protectAny);

// 角色管理（需「角色：管理」權限；商家/超管預設允許）
router.route('/')
  .get(requirePermissions('角色:管理'), roleController.getAllRoles)
  .post(requirePermissions('角色:管理'), roleController.createRole);

router.route('/:id')
  .get(requirePermissions('角色:管理'), roleController.getRole)
  .patch(requirePermissions('角色:管理'), roleController.updateRole)
  .delete(requirePermissions('角色:管理'), roleController.deleteRole);

// 查詢系統支援的權限清單（方便前端渲染）
router.get('/_catalog/permissions', (req, res) => {
  res.status(200).json({ status: 'success', data: { permissions: PERMISSIONS } });
});

module.exports = router;


