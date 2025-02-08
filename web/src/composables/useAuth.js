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
      
      // 保存用戶信息
      if (credentials.role === 'admin') {
        user.value = response.data.admin
        localStorage.setItem('user', JSON.stringify({
          ...response.data.admin,
          role: 'admin'
        }))
      } else {
        user.value = response.data.merchant
        localStorage.setItem('user', JSON.stringify({
          ...response.data.merchant,
          role: 'merchant'
        }))
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
