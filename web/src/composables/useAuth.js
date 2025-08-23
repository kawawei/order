import { ref } from 'vue'
import { authAPI } from '@/services/api'

export function useAuth() {
  // 優先使用分離的 token，再回退舊鍵
  const initialToken =
    localStorage.getItem('admin_token') ||
    localStorage.getItem('merchant_token') ||
    localStorage.getItem('token') ||
    null
  const token = ref(initialToken)
  const user = ref(null)

  const login = async (credentials) => {
    try {
      const response = await authAPI.login(credentials)
      
      // 分離保存 token：依據身分儲存到對應鍵名
      const isAdminLogin = credentials?.role === 'admin' || !!response?.data?.admin
      token.value = response.token
      if (isAdminLogin) {
        localStorage.setItem('admin_token', response.token)
      } else {
        localStorage.setItem('merchant_token', response.token)
      }
      
      // 保存用戶信息（自動判斷回應身分），並標準化 merchantId
      if (response?.data?.admin) {
        const admin = response.data.admin
        user.value = admin
        localStorage.setItem('admin_user', JSON.stringify({
          ...admin,
          role: admin.role || 'admin'
        }))
        // 不再動到商家端的資料，避免互相影響
      } else if (response?.data?.employee) {
        const employee = response.data.employee
        const merchantId =
          (typeof employee?.merchant === 'string' ? employee.merchant : null) ||
          employee?.merchant?._id ||
          employee?.merchant?.id ||
          employee?.merchantId ||
          null
        const employeeRoleId = (employee?.role && (employee?.role?._id || employee?.role?.id)) || employee?.roleId || employee?.role || null
        const employeeRoleName = (employee?.role && (employee?.role?.name || employee?.role?.title)) || null
        user.value = employee
        localStorage.setItem('merchant_user', JSON.stringify({
          ...employee,
          role: 'employee',
          merchantId,
          employeeRoleId,
          employeeRoleName,
          // 確保餐廳名稱和代碼被保存
          businessName: employee.businessName || null,
          merchantCode: employee.merchantCode || null
        }))
      } else if (response?.data?.merchant) {
        const merchant = response.data.merchant
        const merchantId = merchant?._id || merchant?.id || null
        user.value = merchant
        localStorage.setItem('merchant_user', JSON.stringify({
          ...merchant,
          role: 'merchant',
          merchantId
        }))
      }
      
      return response
    } catch (error) {
      console.error('登入失敗：', error)
      throw error
    }
  }

  const logout = () => {
    // 僅清除當前情境的 session，避免互相登出
    token.value = null
    user.value = null
    const currentPath = window.location?.pathname || ''
    const isAdminContext = currentPath.startsWith('/admin')
    if (isAdminContext) {
      localStorage.removeItem('admin_token')
      localStorage.removeItem('admin_user')
    } else {
      localStorage.removeItem('merchant_token')
      localStorage.removeItem('merchant_user')
      // 兼容舊資料
      localStorage.removeItem('merchant')
    }
  }

  const isAuthenticated = () => {
    // 任何一種身分有 token 即視為已登入（具體授權在路由角色校驗）
    return !!(
      localStorage.getItem('admin_token') ||
      localStorage.getItem('merchant_token') ||
      token.value
    )
  }

  const getUserRole = () => {
    // 先判斷 admin，再判斷 merchant，最後回退舊資料
    try {
      const adminRaw = localStorage.getItem('admin_user')
      if (adminRaw) {
        const admin = JSON.parse(adminRaw)
        return admin.role || 'admin'
      }
      const merchantRaw = localStorage.getItem('merchant_user')
      if (merchantRaw) {
        const merchant = JSON.parse(merchantRaw)
        return merchant.role || 'merchant'
      }
      // 回退：舊版鍵名
      const legacyRaw = localStorage.getItem('user')
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw)
        return legacy.role || 'merchant'
      }
      return null
    } catch (error) {
      console.error('解析用戶信息錯誤:', error)
      return null
    }
  }

  const register = async (userData) => {
    try {
      const response = await authAPI.register(userData)
      return response
    } catch (error) {
      console.error('註冊失敗：', error)
      throw error
    }
  }

  return {
    user,
    token,
    login,
    logout,
    isAuthenticated,
    getUserRole,
    register
  }
}
