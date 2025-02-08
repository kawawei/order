import { ref } from 'vue'

export function useAuth() {
  const token = ref(localStorage.getItem('token'))
  const user = ref(null)

  const login = async (credentials) => {
    try {
      // 模擬 API 請求
      const response = await mockLoginApi(credentials)
      
      // 保存 token
      token.value = response.token
      localStorage.setItem('token', response.token)
      
      // 保存用戶信息
      user.value = response.user
      
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
  }

  const isAuthenticated = () => {
    return !!token.value
  }

  return {
    user,
    token,
    login,
    logout,
    isAuthenticated
  }
}

// 模擬登入 API
function mockLoginApi({ email, password }) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // 模擬驗證
      if (email === 'test@example.com' && password === 'password') {
        resolve({
          token: 'mock-jwt-token',
          user: {
            id: 1,
            email: 'test@example.com',
            name: '測試用戶'
          }
        })
      } else {
        reject(new Error('帳號或密碼錯誤'))
      }
    }, 1000) // 模擬網絡延遲
  })
}
