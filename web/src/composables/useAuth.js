import { ref } from 'vue'
import { authAPI } from '@/services/api'

export function useAuth() {
  const token = ref(localStorage.getItem('token'))
  const user = ref(null)

  const login = async (credentials) => {
    try {
      const response = await authAPI.login(credentials)
      
      // 保存 token
      token.value = response.token
      localStorage.setItem('token', response.token)
      
      // 保存用戶信息（自動判斷回應身分），並標準化 merchantId
      if (response?.data?.admin) {
        const admin = response.data.admin
        user.value = admin
        localStorage.setItem('user', JSON.stringify({
          ...admin,
          role: admin.role || 'admin'
        }))
        // 清理舊版鍵名，避免顯示混淆
        localStorage.removeItem('merchant')
      } else if (response?.data?.employee) {
        const employee = response.data.employee
        const merchantId =
          (typeof employee?.merchant === 'string' ? employee.merchant : null) ||
          employee?.merchant?._id ||
          employee?.merchant?.id ||
          employee?.merchantId ||
          null
        user.value = employee
        localStorage.setItem('user', JSON.stringify({
          ...employee,
          role: 'employee',
          merchantId
        }))
        // 清理舊版鍵名
        localStorage.removeItem('merchant')
      } else if (response?.data?.merchant) {
        const merchant = response.data.merchant
        const merchantId = merchant?._id || merchant?.id || null
        user.value = merchant
        localStorage.setItem('user', JSON.stringify({
          ...merchant,
          role: 'merchant',
          merchantId
        }))
        // 同步清理舊版重複鍵
        localStorage.removeItem('merchant')
      }
      
      return response
    } catch (error) {
      console.error('登入失敗：', error)
      throw error
    }
  }

  const logout = () => {
    // 清除 token
    token.value = null
    localStorage.removeItem('token')
    
    // 清除用戶信息
    user.value = null
    localStorage.removeItem('user')
    // 清理可能殘留的舊版鍵名
    localStorage.removeItem('merchant')
  }

  const isAuthenticated = () => {
    return !!token.value
  }

  const getUserRole = () => {
    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser)
        console.log('用戶信息:', userData)
        return userData.role || 'merchant'
      } catch (error) {
        console.error('解析用戶信息錯誤:', error)
        return null
      }
    }
    return null
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
