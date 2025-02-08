import { ref } from 'vue'

export function useAuth() {
  const token = ref(localStorage.getItem('token'))
  const user = ref(null)

  const login = async (credentials) => {
    try {
      // 模擬 API 請求
      await new Promise(resolve => setTimeout(resolve, 1000))

      // 驗證帳號密碼
      if (credentials.email === 'admin@example.com' && credentials.password === '123456') {
        const mockResponse = {
          token: 'mock-jwt-token',
          user: {
            id: 1,
            email: credentials.email,
            role: 'merchant',
            name: '管理員'
          }
        }

        // 保存 token
        token.value = mockResponse.token
        localStorage.setItem('token', mockResponse.token)
        
        // 保存用戶信息
        user.value = mockResponse.user
        localStorage.setItem('user', JSON.stringify(mockResponse.user))
        
        return mockResponse
      } else {
        throw new Error('帳號或密碼錯誤')
      }
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
      const userData = JSON.parse(storedUser)
      return userData.role
    }
    return null
  }

  return {
    user,
    token,
    login,
    logout,
    isAuthenticated,
    getUserRole
  }
}

// 模擬登入 API
function mockLoginApi(credentials) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // 餐廳管理員登入
      if (credentials.role === 'merchant' && 
          credentials.email === 'restaurant@example.com' && 
          credentials.password === 'password') {
        resolve({
          token: 'mock-merchant-token',
          user: {
            id: 1,
            email: 'restaurant@example.com',
            name: '餐廳管理員',
            role: 'merchant'
          }
        })
      }
      // 超級管理員登入
      else if (credentials.role === 'admin' && 
               credentials.username === 'admin' && 
               credentials.password === 'admin123' &&
               credentials.verificationCode === '1234') {
        resolve({
          token: 'mock-admin-token',
          user: {
            id: 999,
            username: 'admin',
            name: '系統管理員',
            role: 'admin'
          }
        })
      } else {
        reject(new Error('帳號或密碼錯誤'))
      }
    }, 1000) // 模擬網絡延遲
  })
}
