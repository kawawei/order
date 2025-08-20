import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env?.VITE_API_URL || 'http://localhost:3002/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: true
});

// 取得目前情境下的商家 ID（優先 URL，其次 localStorage）
const resolveActiveMerchantId = () => {
  try {
    // 1) URL query: ?merchantId=xxx
    const url = new URL(window.location?.href || '')
    const fromQuery = url.searchParams.get('merchantId') || url.searchParams.get('restaurantId')
    if (fromQuery) return fromQuery

    // 2) localStorage.merchant_user
    const raw = localStorage.getItem('merchant_user')
    if (raw) {
      const mu = JSON.parse(raw)
      const merchantId = (
        mu?.merchantId ||
        (typeof mu?.merchant === 'string' ? mu.merchant : null) ||
        mu?._id ||
        mu?.id
      )
      if (merchantId) return merchantId
    }
  } catch (e) {}
  return null
}

// 請求攔截器：根據情境添加對應 token（分離 admin 與 merchant），並關閉後台請求的 cookie 傳遞
api.interceptors.request.use(
  (config) => {
    try {
      const currentPath = window.location?.pathname || ''
      const requestUrl = config?.url || ''
      const isAdminContext = currentPath.startsWith('/admin') || requestUrl.startsWith('/admin')
      const isMerchantBackoffice = currentPath.startsWith('/merchant')
      const isBackofficeContext = isAdminContext || isMerchantBackoffice

      const adminToken = localStorage.getItem('admin_token')
      const merchantToken = localStorage.getItem('merchant_token')

      // 規則：
      // - admin 情境：使用 admin_token
      // - 其他情境：優先 merchant_token，如沒有再回退 admin_token（允許 admin 探索商家頁）
      let token = null
      let actor = null
      if (isAdminContext) {
        token = adminToken
        actor = 'admin'
      } else if (merchantToken) {
        token = merchantToken
        actor = 'merchant'
      } else if (adminToken) {
        token = adminToken
        actor = 'admin'
      }

      if (token) {
        config.headers.Authorization = `Bearer ${token}`
        // 標記使用了哪個身分的 token（僅存在於客戶端，不作為請求標頭，避免 CORS 預檢）
        config._sessionActor = actor
      }

      // 關閉後台情境的 cookie，以免跨分頁覆蓋（admin/merchant 後台改用 Authorization）
      if (isBackofficeContext) {
        config.withCredentials = false
      }
    } catch (e) {
      // 忽略 token 設置錯誤，走未登入狀態
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 響應攔截器：處理錯誤
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response) {
      // 401：未授權 -> 僅清除對應情境的 token，不影響另一個身分的登入
      if (error.response.status === 401) {
        const reqUrl = error.config?.url || ''
        const currentPath = window.location?.pathname || ''
        const isAdminPath = currentPath.startsWith('/admin') || reqUrl.startsWith('/admin')
        const actor = error.config?._sessionActor || error.config?.headers?.['X-Auth-Actor']

        // 精準清除實際使用的 token 所對應的 session
        if (actor === 'admin') {
          localStorage.removeItem('admin_token')
          localStorage.removeItem('admin_user')
        } else if (actor === 'merchant') {
          localStorage.removeItem('merchant_token')
          localStorage.removeItem('merchant_user')
        } else {
          // 回退：按路徑判斷
          if (isAdminPath) {
            localStorage.removeItem('admin_token')
            localStorage.removeItem('admin_user')
          } else {
            localStorage.removeItem('merchant_token')
            localStorage.removeItem('merchant_user')
          }
        }

        if (!reqUrl.includes('/admin/login') && !reqUrl.includes('/auth/login')) {
          const redirectTo = actor === 'admin' ? '/admin/login' : (isAdminPath ? '/admin/login' : '/merchant/login')
          window.location.href = redirectTo
        }
      }
      // 403：無權限 -> 不要登出，不跳轉，交由頁面自行處理錯誤
      return Promise.reject(error.response.data)
    }
    return Promise.reject(error)
  }
)

export const authAPI = {
  // 商家註冊
  register: (data) => api.post('/auth/signup', data),
  
  // 登入
  login: async (data) => {
    try {
      const endpoint = data.role === 'admin' ? '/admin/login' : '/auth/login';

      // 生成送出的負載：
      // - 管理員：維持 email/password
      // - 商家：改以 merchantCode/employeeCode，兼容舊欄位 email/password
      let loginData;
      if (data.role === 'admin') {
        const { email, password, verificationCode, ...rest } = data || {};
        loginData = {
          email,
          password,
          ...(verificationCode ? { verificationCode } : {}),
          ...rest
        };
      } else {
        const merchantCode = data?.merchantCode ?? data?.email ?? '';
        const employeeCode = data?.employeeCode ?? data?.password ?? '';
        const { role, email, password, ...rest } = data || {};
        loginData = {
          merchantCode,
          employeeCode,
          ...rest
        };
      }

      console.log('執行登入請求:', {
        role: data.role || 'merchant',
        endpoint,
        payloadKeys: Object.keys(loginData || {})
      });

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
  // 使用 multipart/form-data 上傳圖片與 JSON 欄位
  createDish: (data) => {
    const form = new FormData()
    Object.entries(data || {}).forEach(([key, value]) => {
      if (key === 'image' && value && value instanceof File) {
        form.append('image', value)
      } else if (typeof value === 'object') {
        form.append(key, JSON.stringify(value))
      } else if (value !== undefined && value !== null) {
        form.append(key, value)
      }
    })
    return api.post('/menu/dishes', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  updateDish: (dishId, data) => {
    const form = new FormData()
    Object.entries(data || {}).forEach(([key, value]) => {
      if (key === 'image' && value && value instanceof File) {
        form.append('image', value)
      } else if (typeof value === 'object') {
        form.append(key, JSON.stringify(value))
      } else if (value !== undefined && value !== null) {
        form.append(key, value)
      }
    })
    return api.put(`/menu/dishes/${dishId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
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
  // 更新商家（詳細）
  updateMerchant: (merchantId, data) => api.patch(`/admin/merchants/${merchantId}`, data),
  
  // 新增商家（並建立老闆帳號）
  createMerchant: (data) => api.post('/admin/merchants', data),
  
  // 刪除商家
  deleteMerchant: (merchantId) => api.delete(`/admin/merchants/${merchantId}`),
  
  // 匯入商家（Excel）
  importMerchants: (formData) => {
    return api.post('/admin/merchants/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  }
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
  getReportStats: (params = {}) => {
    const merged = { ...(params || {}) }
    if (!merged.merchantId) {
      const merchantId = resolveActiveMerchantId()
      if (merchantId) merged.merchantId = merchantId
    }
    return api.get('/reports/stats', { params: merged })
  },
  
  // 獲取簡化版報表統計（用於儀表板）
  getSimpleReportStats: (params = {}) => {
    const merged = { ...(params || {}) }
    if (!merged.merchantId) {
      const merchantId = resolveActiveMerchantId()
      if (merchantId) merged.merchantId = merchantId
    }
    return api.get('/reports/simple', { params: merged })
  }
};

// 角色與權限 API
export const roleAPI = {
  // 權限目錄（由後端提供標準鍵與顯示文字）
  getPermissionCatalog: () => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.get('/roles/_catalog/permissions', { params })
  },

  // 角色 CRUD
  getRoles: () => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.get('/roles', { params })
  },
  createRole: (data) => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.post('/roles', data, { params })
  },
  updateRole: (roleId, data) => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.patch(`/roles/${roleId}`, data, { params })
  },
  deleteRole: (roleId) => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.delete(`/roles/${roleId}`, { params })
  }
};

// 員工管理 API（商家後台）
export const employeeAPI = {
  getEmployees: () => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.get('/employees', { params })
  },
  createEmployee: (data) => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.post('/employees', data, { params })
  },
  updateEmployee: (employeeId, data) => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.patch(`/employees/${employeeId}`, data, { params })
  },
  deleteEmployee: (employeeId) => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.delete(`/employees/${employeeId}`, { params })
  }
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

// 為了向後兼容，創建 inventoryService 對象
export const inventoryService = {
  // 庫存項目相關方法
  getInventory: inventoryAPI.getAllInventory,
  getInventoryItem: inventoryAPI.getInventory,
  createInventory: inventoryAPI.createInventory,
  updateInventory: inventoryAPI.updateInventory,
  deleteInventory: inventoryAPI.deleteInventory,
  batchUpdateInventory: inventoryAPI.batchUpdateInventory,
  getInventoryStats: inventoryAPI.getInventoryStats,
  getInventoryCategories: inventoryAPI.getInventoryCategories,
  searchInventory: inventoryAPI.searchInventory,
  
  // 庫存分類相關方法
  getCategories: inventoryCategoryAPI.getAllCategories,
  getCategory: inventoryCategoryAPI.getCategory,
  createCategory: inventoryCategoryAPI.createCategory,
  updateCategory: inventoryCategoryAPI.updateCategory,
  deleteCategory: inventoryCategoryAPI.deleteCategory,
  updateCategoriesOrder: inventoryCategoryAPI.updateCategoriesOrder,
  getCategoryStats: inventoryCategoryAPI.getCategoryStats,
  initializeSystemCategories: inventoryCategoryAPI.initializeSystemCategories
};

export default api;
