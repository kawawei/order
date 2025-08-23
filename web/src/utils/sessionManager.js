/**
 * 會話管理工具
 * 用於檢查和清除已刪除商家的會話資訊
 */

/**
 * 檢查當前用戶是否為已刪除的商家
 * @param {string} deletedMerchantId - 被刪除的商家ID
 * @returns {boolean} - 是否為當前用戶
 */
export const isCurrentUserDeleted = (deletedMerchantId) => {
  try {
    // 檢查商家用戶會話
    const merchantUser = localStorage.getItem('merchant_user')
    if (merchantUser) {
      const user = JSON.parse(merchantUser)
      const currentMerchantId = user.merchantId || user._id || user.id
      return currentMerchantId === deletedMerchantId
    }
    
    // 檢查舊版會話
    const legacyUser = localStorage.getItem('user')
    if (legacyUser) {
      const user = JSON.parse(legacyUser)
      const currentMerchantId = user.merchantId || user._id || user.id
      return currentMerchantId === deletedMerchantId
    }
    
    return false
  } catch (e) {
    console.error('檢查當前用戶時出錯:', e)
    return false
  }
}

/**
 * 清除商家相關的會話資訊
 */
export const clearMerchantSession = () => {
  try {
    console.log('清除商家會話資訊')
    
    // 清除所有可能的商家會話鍵
    const sessionKeys = [
      'merchant_user',
      'merchant_token',
      'user',
      'token',
      'merchant'
    ]
    
    sessionKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key)
        console.log(`已清除 ${key}`)
      }
    })
    
    // 清除相關的會話儲存
    if (sessionStorage.getItem('cart')) {
      sessionStorage.removeItem('cart')
      console.log('已清除購物車資料')
    }
    
    console.log('商家會話資訊清除完成')
  } catch (e) {
    console.error('清除會話資訊時出錯:', e)
  }
}

/**
 * 處理商家被刪除的情況
 * @param {string} deletedMerchantId - 被刪除的商家ID
 * @param {string} deletedBusinessName - 被刪除的商家名稱
 */
export const handleMerchantDeletion = (deletedMerchantId, deletedBusinessName) => {
  if (isCurrentUserDeleted(deletedMerchantId)) {
    console.log(`檢測到當前用戶 ${deletedBusinessName} 被刪除`)
    
    // 清除會話資訊
    clearMerchantSession()
    
    // 顯示提示訊息
    const message = `您的商家帳戶「${deletedBusinessName}」已被刪除，請重新登入`
    
    // 如果有 toast 可用，使用 toast
    if (window.toast) {
      window.toast.warning(message)
    } else {
      alert(message)
    }
    
    // 延遲重新導向到登入頁面
    setTimeout(() => {
      window.location.href = '/merchant/login'
    }, 2000)
    
    return true
  }
  
  return false
}

/**
 * 檢查會話有效性
 * @returns {boolean} - 會話是否有效
 */
export const isSessionValid = () => {
  try {
    const merchantUser = localStorage.getItem('merchant_user')
    const merchantToken = localStorage.getItem('merchant_token')
    
    if (!merchantUser || !merchantToken) {
      return false
    }
    
    const user = JSON.parse(merchantUser)
    return !!(user && user.merchantId)
  } catch (e) {
    console.error('檢查會話有效性時出錯:', e)
    return false
  }
}
