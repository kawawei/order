import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3002/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: true
});

// 請求攔截器：添加 token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 響應攔截器：處理錯誤
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      // 如果是 401 錯誤，清除 token
      if (error.response.status === 401) {
        localStorage.removeItem('token');
        // 檢查當前路徑來決定重定向
        const isAdminPath = window.location.pathname.startsWith('/admin');
        if (!error.config.url.includes('/admin/login')) {
          window.location.href = isAdminPath ? '/admin/login' : '/merchant/login';
        }
      }
      return Promise.reject(error.response.data);
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  // 商家註冊
  register: (data) => api.post('/auth/signup', data),
  
  // 登入
  login: async (data) => {
    try {
      console.log('執行登入請求:', {
        role: data.role,
        endpoint: data.role === 'admin' ? '/admin/login' : '/auth/login',
        data: { ...data, password: '[HIDDEN]' }
      });
      
      const loginData = { ...data };
      delete loginData.role;
      
      const endpoint = data.role === 'admin' ? '/admin/login' : '/auth/login';
      const response = await api.post(endpoint, loginData);
      
      console.log('登入回應:', {
        status: response.status,
        endpoint,
        data: response.data
      });
      
      return response;
    } catch (error) {
      console.error('登入失敗:', {
        endpoint: data.role === 'admin' ? '/admin/login' : '/auth/login',
        error: error.response?.data || error.message
      });
      throw error;
    }
  },
  
  // 更新密碼
  updatePassword: (data) => api.patch('/auth/update-password', data),
};

export const tableAPI = {
  // 獲取桌次列表
  getTables: (params = {}) => api.get('/tables', { params }),
  
  // 創建新桌次
  createTable: (data) => api.post('/tables', data),
  
  // 更新桌次
  updateTable: (tableId, data) => api.put(`/tables/${tableId}`, data),
  
  // 刪除桌次
  deleteTable: (tableId) => api.delete(`/tables/${tableId}`),
  
  // 更新桌次狀態
  updateTableStatus: (tableId, statusData) => api.patch(`/tables/${tableId}/status`, statusData),
  
  // 重新生成 QR Code
  regenerateQRCode: (tableId) => api.post(`/tables/${tableId}/regenerate-qr`),
};

export const menuAPI = {
  // 分類相關
  getCategories: (params = {}) => api.get('/menu/categories', { params }),
  createCategory: (data) => api.post('/menu/categories', data),
  updateCategory: (categoryId, data) => api.patch(`/menu/categories/${categoryId}`, data),
  deleteCategory: (categoryId) => api.delete(`/menu/categories/${categoryId}`),
  
  // 菜品相關
  getDishes: (params = {}) => api.get('/menu/dishes', { params }),
  createDish: (data) => api.post('/menu/dishes', data),
  updateDish: (dishId, data) => api.put(`/menu/dishes/${dishId}`, data),
  deleteDish: (dishId) => api.delete(`/menu/dishes/${dishId}`),
  
  // 菜單相關
  getMenu: (params = {}) => api.get('/menu', { params }),
  updateMenuStructure: (data) => api.put('/menu/structure', data),
  
  // 客戶端公開菜單
  getPublicMenu: (merchantId) => api.get(`/menu/public/${merchantId}`),
};

// 為了向後兼容，創建 menuService 對象
export const orderAPI = {
  // 創建訂單
  createOrder: (data) => api.post('/orders', data),
  
  // 結帳功能 (舊版本，保持向後兼容)
  checkout: (data) => api.post('/orders/checkout', data),
  
  // 新的桌子結帳功能 - 合併所有批次
  checkoutTable: (tableId) => api.post(`/orders/table/${tableId}/checkout`),
  
  // 獲取桌子的所有批次訂單
  getTableBatches: (tableId) => api.get(`/orders/table/${tableId}/batches`),
  
  // 獲取桌子當前總金額
  getTableTotal: (tableId) => api.get(`/orders/table/${tableId}/total`),
  
  // 獲取訂單詳情
  getOrder: (orderId) => api.get(`/orders/${orderId}`),
  
  // 根據桌子獲取訂單列表
  getOrdersByTable: (tableId, params = {}) => api.get(`/orders/table/${tableId}`, { params }),
  
  // 根據商家獲取訂單列表（後台用）
  getOrdersByMerchant: (merchantId, params = {}) => api.get(`/orders/merchant/${merchantId}`, { params }),
  
  // 更新訂單狀態
  updateOrderStatus: (orderId, data) => api.patch(`/orders/${orderId}/status`, data),
  
  // 取消訂單
  cancelOrder: (orderId) => api.patch(`/orders/${orderId}/cancel`),
  
  // 獲取訂單統計
  getOrderStats: (merchantId, params = {}) => api.get(`/orders/merchant/${merchantId}/stats`, { params }),
};

// 商家管理 API（超級管理員專用）
export const merchantAPI = {
  // 獲取所有商家
  getAllMerchants: (params = {}) => api.get('/admin/merchants', { params }),
  
  // 獲取單個商家
  getMerchant: (merchantId) => api.get(`/admin/merchants/${merchantId}`),
  
  // 更新商家狀態
  updateMerchantStatus: (merchantId, status) => api.patch(`/admin/merchants/${merchantId}`, { status }),
  
  // 刪除商家
  deleteMerchant: (merchantId) => api.delete(`/admin/merchants/${merchantId}`)
};

export const menuService = {
  // 分類相關方法
  getCategories: menuAPI.getCategories,
  createCategory: menuAPI.createCategory,
  updateCategory: menuAPI.updateCategory,
  deleteCategory: menuAPI.deleteCategory,
  
  // 菜品相關方法  
  getDishes: menuAPI.getDishes,
  createDish: menuAPI.createDish,
  updateDish: menuAPI.updateDish,
  deleteDish: menuAPI.deleteDish,
  
  // 菜單相關方法
  getMenu: menuAPI.getMenu,
  updateMenuStructure: menuAPI.updateMenuStructure,
  
  // 客戶端公開菜單
  getPublicMenu: menuAPI.getPublicMenu,
};

// 為了向後兼容，創建 orderService 對象
export const orderService = {
  createOrder: orderAPI.createOrder,
  getOrder: orderAPI.getOrder,
  getOrdersByTable: orderAPI.getOrdersByTable,
  getOrdersByMerchant: orderAPI.getOrdersByMerchant,
  updateOrderStatus: orderAPI.updateOrderStatus,
  cancelOrder: orderAPI.cancelOrder,
  getOrderStats: orderAPI.getOrderStats,
};

// 報表 API
export const reportAPI = {
  // 獲取詳細報表統計
  getReportStats: (params = {}) => api.get('/reports/stats', { params }),
  
  // 獲取簡化版報表統計（用於儀表板）
  getSimpleReportStats: (params = {}) => api.get('/reports/simple', { params })
};

// 庫存管理 API
export const inventoryAPI = {
  // 獲取所有庫存項目
  getAllInventory: (params = {}) => api.get('/inventory', { params }),
  
  // 獲取單個庫存項目
  getInventory: (id) => api.get(`/inventory/${id}`),
  
  // 創建庫存項目
  createInventory: (data) => api.post('/inventory', data),
  
  // 更新庫存項目
  updateInventory: (id, data) => api.patch(`/inventory/${id}`, data),
  
  // 刪除庫存項目
  deleteInventory: (id) => api.delete(`/inventory/${id}`),
  
  // 批量更新庫存
  batchUpdateInventory: (data) => api.patch('/inventory/batch/update', data),
  
  // 獲取庫存統計概覽
  getInventoryStats: () => api.get('/inventory/stats/overview'),
  
  // 獲取庫存分類統計
  getInventoryCategories: () => api.get('/inventory/categories'),
  
  // 搜索庫存項目
  searchInventory: (query) => api.get('/inventory/search', { params: { q: query } })
};

// 庫存分類管理 API
export const inventoryCategoryAPI = {
  // 獲取所有分類
  getAllCategories: () => api.get('/inventory-categories'),
  
  // 獲取單個分類
  getCategory: (id) => api.get(`/inventory-categories/${id}`),
  
  // 創建新分類
  createCategory: (data) => api.post('/inventory-categories', data),
  
  // 更新分類
  updateCategory: (id, data) => api.patch(`/inventory-categories/${id}`, data),
  
  // 刪除分類
  deleteCategory: (id) => api.delete(`/inventory-categories/${id}`),
  
  // 更新分類排序
  updateCategoriesOrder: (data) => api.patch('/inventory-categories/order', data),
  
  // 獲取分類統計
  getCategoryStats: () => api.get('/inventory-categories/stats'),
  
  // 初始化系統預設分類
  initializeSystemCategories: () => api.post('/inventory-categories/initialize')
};

export default api;
