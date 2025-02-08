const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

// 註冊和登入路由
router.post('/signup', authController.signup);
router.post('/login', authController.login);

// 需要認證的路由
router.use(authController.protect);
router.patch('/update-password', authController.updatePassword);

module.exports = router;
