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

// 判斷當前用戶是否為管理員
const isAdminUser = () => {
  try {
    const adminRaw = localStorage.getItem('admin_user')
    if (adminRaw) {
      const admin = JSON.parse(adminRaw)
      return admin.role === 'admin' || admin.role === 'superadmin'
    }
    return false
  } catch (e) {
    return false
  }
}

// 判斷當前用戶是否為商家
const isMerchantUser = () => {
  try {
    const merchantRaw = localStorage.getItem('merchant_user')
    if (merchantRaw) {
      const merchant = JSON.parse(merchantRaw)
      // 商家用戶包括：merchant 角色和 employee 角色
      return merchant.role === 'merchant' || merchant.role === 'employee'
    }
    return false
  } catch (e) {
    return false
  }
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
  (response) => {
    // 如果是 blob 響應，保留完整的響應對象以獲取標頭信息
    if (response.config?.responseType === 'blob') {
      return response
    }
    return response.data
  },
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
  getTables: (params = {}) => {
    const merchantId = resolveActiveMerchantId()
    const finalParams = merchantId ? { ...params, merchantId } : params
    return api.get('/tables', { params: finalParams })
  },
  
  // 創建新桌次
  createTable: (data) => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.post('/tables', data, { params })
  },
  
  // 更新桌次
  updateTable: (tableId, data) => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.put(`/tables/${tableId}`, data, { params })
  },
  
  // 刪除桌次
  deleteTable: (tableId) => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.delete(`/tables/${tableId}`, { params })
  },
  
  // 更新桌次狀態
  updateTableStatus: (tableId, statusData) => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.patch(`/tables/${tableId}/status`, statusData, { params })
  },
  
  // 重新生成 QR Code
  regenerateQRCode: (tableId) => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.post(`/tables/${tableId}/regenerate-qr`, {}, { params })
  },
};

export const menuAPI = {
  // 分類相關
  getCategories: (params = {}) => {
    const merchantId = resolveActiveMerchantId()
    const finalParams = merchantId ? { ...params, merchantId } : params
    return api.get('/menu/categories', { params: finalParams })
  },
  createCategory: (data) => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.post('/menu/categories', data, { params })
  },
  updateCategory: (categoryId, data) => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.patch(`/menu/categories/${categoryId}`, data, { params })
  },
  deleteCategory: (categoryId) => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.delete(`/menu/categories/${categoryId}`, { params })
  },
  
  // 菜品相關
  getDishes: (params = {}) => {
    const merchantId = resolveActiveMerchantId()
    const finalParams = merchantId ? { ...params, merchantId } : params
    return api.get('/menu/dishes', { params: finalParams })
  },
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
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.post('/menu/dishes', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params
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
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.put(`/menu/dishes/${dishId}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      params
    })
  },
  deleteDish: (dishId) => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.delete(`/menu/dishes/${dishId}`, { params })
  },
  
  // 菜單相關
  getMenu: (params = {}) => {
    const merchantId = resolveActiveMerchantId()
    const finalParams = merchantId ? { ...params, merchantId } : params
    return api.get('/menu', { params: finalParams })
  },
  updateMenuStructure: (data) => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.put('/menu/structure', data, { params })
  },
  
  // 客戶端公開菜單
  getPublicMenu: (merchantId) => api.get(`/menu/public/${merchantId}`),
  
  // 匯入菜單項目
  importMenu: (formData) => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.post('/menu/import', formData, {
      params,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  }
};

// 為了向後兼容，創建 menuService 對象
export const orderAPI = {
  // 創建訂單（顧客使用，不需要商家ID）
  createOrder: (data) => {
    return api.post('/orders', data)
  },
  
  // 結帳功能 (舊版本，保持向後兼容)（顧客使用，不需要商家ID）
  checkout: (data) => {
    return api.post('/orders/checkout', data)
  },
  
  // 新的桌子結帳功能 - 合併所有批次（顧客使用，不需要商家ID）
  checkoutTable: (tableId) => {
    return api.post(`/orders/table/${tableId}/checkout`)
  },
  
  // 獲取桌子的所有批次訂單（顧客使用，不需要商家ID）
  getTableBatches: (tableId) => {
    return api.get(`/orders/table/${tableId}/batches`)
  },
  
  // 獲取桌子當前總金額（顧客使用，不需要商家ID）
  getTableTotal: (tableId) => {
    return api.get(`/orders/table/${tableId}/total`)
  },
  
  // 獲取訂單詳情（顧客使用，不需要商家ID）
  getOrder: (orderId) => {
    return api.get(`/orders/${orderId}`)
  },
  
  // 根據桌子獲取訂單列表（顧客使用，不需要商家ID）
  getOrdersByTable: (tableId, params = {}) => {
    return api.get(`/orders/table/${tableId}`, { params })
  },
  
  // 根據商家獲取訂單列表（後台用）
  getOrdersByMerchant: (merchantId, params = {}) => api.get(`/orders/merchant/${merchantId}`, { params }),
  
  // 更新訂單狀態
  updateOrderStatus: (orderId, data) => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.patch(`/orders/${orderId}/status`, data, { params })
  },
  
  // 取消訂單
  cancelOrder: (orderId) => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.patch(`/orders/${orderId}/cancel`, {}, { params })
  },
  
  // 獲取訂單統計
  getOrderStats: (merchantId, params = {}) => api.get(`/orders/merchant/${merchantId}/stats`, { params }),
  
  // 匯出歷史訂單
  exportHistoryOrders: (merchantId, params = {}) => {
    return api.get(`/orders/merchant/${merchantId}/export`, { 
      params,
      responseType: 'blob' // 設定回應類型為 blob 以處理檔案下載
    })
  },
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
  
  // 匯入菜單
  importMenu: menuAPI.importMenu,
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
  exportHistoryOrders: orderAPI.exportHistoryOrders,
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
  },

  // 匯出報表
  exportReport: (params = {}) => {
    const merged = { ...(params || {}) }
    if (!merged.merchantId) {
      const merchantId = resolveActiveMerchantId()
      if (merchantId) merged.merchantId = merchantId
    }
    return api.get('/reports/export', { 
      params: merged,
      responseType: 'blob' // 重要：設定為blob以接收檔案
    })
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
  },
  
  // 匯入員工權限（Excel）
  importPermissions: async (formData) => {
    console.log('🔍 [API] 開始匯入權限/員工...')
    
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    
    console.log('🏪 [API] 當前商家ID:', merchantId)
    console.log('📋 [API] 請求參數:', params)
    
    // 判斷用戶身份
    const isAdmin = isAdminUser()
    const isMerchant = isMerchantUser()
    
    console.log('👤 [API] 用戶身份檢查:', { isAdmin, isMerchant })
    
    // 根據用戶身份選擇正確的端點
    let endpoint = '/admin/permissions/import' // 預設管理員端點
    
    if (isMerchant) {
      // 商家用戶使用員工端點
      endpoint = '/employees/import'
      console.log('🏪 [API] 商家用戶，使用員工端點:', endpoint)
    } else if (isAdmin) {
      console.log('🔧 [API] 管理員用戶，使用管理員端點:', endpoint)
    } else {
      console.warn('⚠️ [API] 未知用戶身份，使用預設管理員端點:', endpoint)
    }
    
    console.log('📤 [API] 準備發送請求到端點:', endpoint)
    console.log('📋 [API] FormData 內容檢查:', {
      hasFile: formData.has('file'),
      fileName: formData.get('file')?.name || '未知',
      fileSize: formData.get('file')?.size || '未知',
      fileType: formData.get('file')?.type || '未知'
    })
    
    try {
      console.log('🚀 [API] 發送請求...')
      const response = await api.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        params
      })
      
      console.log('✅ [API] 請求成功:', {
        status: response.status,
        statusText: response.statusText,
        data: response.data
      })
      
      return response
    } catch (error) {
      console.error('❌ [API] 請求失敗:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        endpoint,
        isAdmin,
        isMerchant
      })
      throw error
    }
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
  getAllInventory: (params = {}) => {
    const merged = { ...(params || {}) }
    if (!merged.merchantId) {
      const merchantId = resolveActiveMerchantId()
      if (merchantId) merged.merchantId = merchantId
    }
    return api.get('/inventory', { params: merged })
  },
  
  // 獲取單個庫存項目
  getInventory: (inventoryId, params = {}) => {
    const merged = { ...(params || {}) }
    if (!merged.merchantId) {
      const merchantId = resolveActiveMerchantId()
      if (merchantId) merged.merchantId = merchantId
    }
    return api.get(`/inventory/${inventoryId}`, { params: merged })
  },
  
  // 創建庫存項目
  createInventory: (data, params = {}) => {
    const merged = { ...(params || {}) }
    if (!merged.merchantId) {
      const merchantId = resolveActiveMerchantId()
      if (merchantId) merged.merchantId = merchantId
    }
    return api.post('/inventory', data, { params: merged })
  },
  
  // 更新庫存項目
  updateInventory: (inventoryId, data, params = {}) => {
    const merged = { ...(params || {}) }
    if (!merged.merchantId) {
      const merchantId = resolveActiveMerchantId()
      if (merchantId) merged.merchantId = merchantId
    }
    return api.patch(`/inventory/${inventoryId}`, data, { params: merged })
  },
  
  // 刪除庫存項目
  deleteInventory: (inventoryId, params = {}) => {
    const merged = { ...(params || {}) }
    if (!merged.merchantId) {
      const merchantId = resolveActiveMerchantId()
      if (merchantId) merged.merchantId = merchantId
    }
    return api.delete(`/inventory/${inventoryId}`, { params: merged })
  },
  
  // 批量更新庫存
  batchUpdateInventory: (updates, params = {}) => {
    const merged = { ...(params || {}) }
    if (!merged.merchantId) {
      const merchantId = resolveActiveMerchantId()
      if (merchantId) merged.merchantId = merchantId
    }
    return api.patch('/inventory/batch/update', { updates }, { params: merged })
  },
  
  // 獲取庫存統計概覽
  getInventoryStats: (params = {}) => {
    const merged = { ...(params || {}) }
    if (!merged.merchantId) {
      const merchantId = resolveActiveMerchantId()
      if (merchantId) merged.merchantId = merchantId
    }
    return api.get('/inventory/stats/overview', { params: merged })
  },
  
  // 獲取庫存分類統計
  getInventoryCategories: (params = {}) => {
    const merged = { ...(params || {}) }
    if (!merged.merchantId) {
      const merchantId = resolveActiveMerchantId()
      if (merchantId) merged.merchantId = merchantId
    }
    return api.get('/inventory/categories', { params: merged })
  },
  
  // 搜索庫存項目
  searchInventory: (params = {}) => {
    const merged = { ...(params || {}) }
    if (!merged.merchantId) {
      const merchantId = resolveActiveMerchantId()
      if (merchantId) merged.merchantId = merchantId
    }
    return api.get('/inventory/search', { params: merged })
  },
  
  // 匯入庫存項目
  importInventory: (formData, params = {}) => {
    const merged = { ...(params || {}) }
    if (!merged.merchantId) {
      const merchantId = resolveActiveMerchantId()
      if (merchantId) merged.merchantId = merchantId
    }
    return api.post('/inventory/import', formData, {
      params: merged,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  },
  
  // 匯入菜單項目
  importMenu: (formData, params = {}) => {
    const merged = { ...(params || {}) }
    if (!merged.merchantId) {
      const merchantId = resolveActiveMerchantId()
      if (merchantId) merged.merchantId = merchantId
    }
    return api.post('/menu/import', formData, {
      params: merged,
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  }
};

// 庫存分類管理 API
// 超級管理員報表統計 API
export const adminReportAPI = {
  // 獲取平台統計數據
  getPlatformStats: (params = {}) => {
    return api.get('/admin/reports/platform-stats', { params })
  },
  
  // 獲取餐廳列表
  getRestaurants: () => {
    return api.get('/admin/reports/restaurants')
  },
  
  // 匯出平台報表
  exportPlatformReport: (params = {}) => {
    return api.get('/admin/reports/export', { 
      params,
      responseType: 'blob'
    })
  }
};

export const inventoryCategoryAPI = {
  // 獲取所有分類
  getAllCategories: () => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.get('/inventory-categories', { params })
  },
  
  // 獲取單個分類
  getCategory: (id) => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.get(`/inventory-categories/${id}`, { params })
  },
  
  // 創建新分類
  createCategory: (data) => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.post('/inventory-categories', data, { params })
  },
  
  // 更新分類
  updateCategory: (id, data) => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.patch(`/inventory-categories/${id}`, data, { params })
  },
  
  // 刪除分類
  deleteCategory: (id) => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.delete(`/inventory-categories/${id}`, { params })
  },
  
  // 更新分類排序
  updateCategoriesOrder: (data) => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.patch('/inventory-categories/order', data, { params })
  },
  
  // 獲取分類統計
  getCategoryStats: () => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.get('/inventory-categories/stats', { params })
  },
  
  // 初始化系統預設分類
  initializeSystemCategories: () => {
    const merchantId = resolveActiveMerchantId()
    const params = merchantId ? { merchantId } : {}
    return api.post('/inventory-categories/initialize', {}, { params })
  }
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
  importInventory: inventoryAPI.importInventory,
  
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
