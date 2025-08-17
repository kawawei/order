require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/database');
const AppError = require('./utils/appError');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const tableRoutes = require('./routes/tableRoutes');
const menuRoutes = require('./routes/menuRoutes');

// 配置 CORS 選項
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
};

// 初始化 Express 應用
const app = express();

// 連接數據庫
connectDB();

// 中間件
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan('dev'));

// 路由
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/tables', tableRoutes);
app.use('/api/v1/menu', menuRoutes);

// 處理未找到的路由
app.all('*', (req, res, next) => {
  next(new AppError(`找不到路徑: ${req.originalUrl}`, 404));
});

// 錯誤處理中間件
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // 處理 Mongoose 驗證錯誤
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(error => error.message);
    return res.status(400).json({
      success: false,
      message: '輸入驗證錯誤',
      errors: errors
    });
  }

  // 處理重複鍵錯誤
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `該${field}已被使用`
    });
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || '服務器內部錯誤';

  res.status(statusCode).json({
    success: false,
    message: message,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      error: err
    })
  });
});

// 啟動服務器
const PORT = process.env.PORT || 5173;
app.listen(PORT, () => {
  console.log(`服務器運行在端口 ${PORT}`);
});
