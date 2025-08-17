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
  getTables: () => api.get('/tables'),
  
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

export default api;
