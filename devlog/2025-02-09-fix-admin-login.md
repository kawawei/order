# 修復管理員登入功能

## 問題描述
管理員登入請求被錯誤地發送到商家登入端點 `/api/v1/auth/login`，導致登入失敗。

## 解決方案
1. 修改了 axios 實例配置：
   - 添加了 `withCredentials: true`
   - 添加了 `Accept: application/json` header

2. 改進了 `authAPI` 中的登入邏輯：
   - 根據用戶角色選擇正確的登入端點
   - 添加了詳細的錯誤處理
   - 改進了日誌輸出，隱藏敏感信息

3. 優化了管理員登入頁面：
   - 使用 `useAuth` composable 處理登入邏輯
   - 改進了錯誤處理和提示信息

## 修改的文件
1. `/web/src/services/api.js`
   - 更新了 axios 實例配置
   - 改進了登入邏輯和錯誤處理

2. `/web/src/views/auth/admin/Login.vue`
   - 使用 `useAuth` composable
   - 優化了錯誤處理和日誌輸出

## 測試
- 使用管理員帳號 `superadmin` 成功登入
- 確認請求被正確發送到 `/api/v1/admin/login` 端點
- 驗證了錯誤處理和提示信息

## 注意事項
- 確保環境變量中設置了正確的管理員帳號和密碼
- 驗證碼目前固定為 `654321`
