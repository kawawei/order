# 開發日誌

## 2025-02-09
### 商家註冊頁面優化
1. 重構註冊頁面代碼
   - 將 Register.vue 拆分為三個文件
     * Register.vue：保留模板結構
     * RegisterScript.js：包含所有業務邏輯
     * Register.css：統一管理樣式
   - 優化代碼組織，提高可維護性
   - 實現關注點分離

2. 改進註冊流程UI
   - 優化步驟指示器樣式
     * 調整數字圓圈大小（36px）
     * 添加邊框效果
     * 改進活動狀態和完成狀態的視覺效果
   - 確保更好的用戶體驗
   - 提升界面專業度


### 用戶管理頁面開發
1. 基本功能實現
   - 創建用戶管理頁面基本結構
   - 實現用戶列表顯示
   - 添加用戶搜索功能
   - 實現用戶狀態切換（啟用/停用）
   - 預留編輯和重置密碼功能

2. 組件和樣式優化
   - 使用基礎組件改進界面
     * BaseTable 用於數據表格
     * BaseTag 用於狀態和角色標籤
     * BaseButton 用於操作按鈕
     * BaseCard 用於內容容器
   - 實現響應式佈局
   - 添加表格懸停效果
   - 優化搜索框樣式

3. 代碼結構優化
   - 將代碼分離為三個文件
     * Users.vue：模板結構
     * Users.js：業務邏輯
     * Users.css：樣式定義
   - 使用 Composition API
   - 實現關注點分離


### 菜單管理功能增強
1. 完善菜品選項系統
   - 實現自定義選項名稱（如：甜度、冰塊等）
   - 支持為每個選項添加多個選項值（如：正常糖、少糖、無糖等）
   - 可選擇是否啟用加價功能
   - 改進選項值添加邏輯，避免一次添加多個輸入框

2. 添加菜品編輯和刪除功能
   - 實現菜品編輯功能
     * 點擊編輯按鈕打開編輯對話框
     * 自動填充當前菜品數據
     * 支持修改所有菜品信息
   - 實現菜品刪除功能
     * 點擊刪除按鈕直接移除菜品
   - 優化表單處理邏輯
     * 抽取表單重置邏輯到獨立函數
     * 根據不同場景（新增/編輯）決定是否重置表單
     * 優化數據清理邏輯，移除未啟用的價格字段

3. 改進用戶界面
   - 對話框標題根據操作類型動態顯示（添加/編輯）
   - 優化表單驗證，確保所有必要字段都已填寫
   - 改進選項值的添加體驗，避免出現空白輸入框



## 2025-02-08
### 項目初始化
1. 確定項目架構
   - 採用前後端分離架構
   - 前端使用 Vue 3
   - 後端使用 Node.js + Express
   - 資料庫選用 MongoDB（考慮多租戶架構）

2. 技術選型考量
   - 前端框架選擇 Vue 3 的原因：
     * 組合式 API 提供更好的代碼組織
     * TypeScript 支持完善
     * 較小的打包體積
     * 優秀的性能表現
   
   - 後端選擇 Node.js + Express 的原因：
     * 開發效率高
     * 豐富的生態系統
     * 適合處理高併發
     * 前後端可以共用代碼

   - 資料庫選擇 MongoDB 的原因：
     * 靈活的文檔結構
     * 原生支持多租戶
     * 易於擴展
     * 強大的查詢功能

3. 多租戶架構設計決策
   - 採用共享數據庫，獨立集合的方案
   - 每個集合都包含 merchantId 字段
   - 使用中間件確保數據隔離
   - 實現商家級別的緩存策略

4. 安全性考慮
   - 實現 JWT 身份驗證
   - API 請求加入限流
   - 所有敏感數據加密存儲
   - 實現 CORS 策略

5. 待辦事項
   - [ ] 建立前端專案架構
   - [ ] 設置後端開發環境
   - [ ] 建立資料庫連接
   - [ ] 實現基礎的身份驗證
   - [ ] 設計並實現多租戶中間件
   - [ ] 建立超級管理員後台
   - [ ] 實現商家審核流程
   - [ ] 建立訂閱方案管理
   - [ ] 實現財務系統
   - [ ] 建立系統監控

6. 技術難點記錄
   - 多租戶數據隔離的實現
   - 即時訂單通知系統的設計
   - QR Code 動態生成和管理
   - 高併發訂單處理

7. 性能優化計劃
   - 實現合理的緩存策略
   - 數據庫索引優化
   - 前端資源懶加載
   - 圖片資源優化

8. 擴展性考慮
   - 微服務架構預留
   - 國際化支持
   - 支付系統集成
   - 第三方服務集成

## 下一步計劃
1. 前端（/web）
   - 建立 Vue 3 專案
   - 配置 TypeScript
   - 設置 Vuetify
   - 實現基礎布局

2. 後端（/server）
   - 建立 Express 專案
   - 設置 MongoDB 連接
   - 實現用戶認證
   - 建立基礎 API

3. 資料庫
   - 建立集合結構
   - 設置索引
   - 實現數據驗證
   - 準備測試數據

## 2025-02-09
### 前端重構與功能擴展
1. Dashboard 組件重構
   - 將樣式分離到 `dashboard.css`
   - 將業務邏輯分離到 `useDashboard.js` composable
   - 提高代碼可維護性和重用性

2. 全局頂部欄實現
   - 新增 `TopBar.vue` 組件
   - 實現用戶信息顯示
   - 添加登出功能
   - 調整全局布局以適應頂部欄

3. 代碼優化
   - 使用 Vue 3 組合式 API
   - 遵循關注點分離原則
   - 保持一致的代碼風格
   - 添加必要的註釋

4. 待辦事項
   - [ ] 實現登出功能的具體邏輯
   - [ ] 從 API 獲取用戶信息
   - [ ] 添加用戶設置功能
   - [ ] 實現記住登入狀態

## 重要決策記錄

### 架構決策
1. 前端路由結構
   ```
   /
   /auth
   /admin              # 超級管理員後台
     /dashboard        # 平台數據總覽
     /merchants        # 商家管理
       /list          # 商家列表
       /pending       # 待審核商家
       /details/:id   # 商家詳情
     /plans           # 訂閱方案
       /list          # 方案列表
       /editor        # 方案編輯
     /finance         # 財務管理
       /overview      # 財務總覽
       /transactions  # 交易記錄
       /reports       # 財務報表
     /settings        # 系統設置
       /system        # 系統參數
       /api           # API設置
       /notifications # 通知設置
   /merchant          # 商家後台
     /dashboard
     /menu
     /orders
     /tables
   /customer          # 顧客點餐
     /menu
     /cart
     /order
   ```

2. 後端 API 結構
   ```
   /api/v1
     /auth
       /login          # 登入
       /logout         # 登出
       /refresh-token  # 更新令牌
     /admin
       /merchants      # 商家管理
       /plans          # 訂閱方案
       /finance        # 財務管理
       /settings       # 系統設置
     /merchants       # 商家API
       /profile        # 商家資料
       /menu           # 菜單管理
       /orders         # 訂單管理
       /tables         # 桌台管理
       /analytics      # 數據分析
     /customer        # 顧客API
       /menu           # 菜單瀏覽
       /cart           # 購物車
       /orders         # 訂單相關
   ```

3. 數據庫索引策略
   ```
   # 平台管理相關
   admins: { email: 1, role: 1 }
   subscription_plans: { planId: 1, status: 1 }
   transactions: { merchantId: 1, createdAt: -1, status: 1 }
   system_logs: { type: 1, createdAt: -1 }
   
   # 商家相關
   merchants: { merchantId: 1, status: 1, planId: 1 }
   dishes: { merchantId: 1, category: 1, status: 1 }
   orders: { merchantId: 1, status: 1, createdAt: -1 }
   tables: { merchantId: 1, tableNumber: 1, status: 1 }
   ```

### 開發工具配置
- ESLint 規則
- Prettier 配置
- Git 提交規範
- 測試框架選擇

### 部署策略
1. 開發環境
   - 本地開發
   - Docker 容器化

2. 測試環境
   - CI/CD 配置
   - 自動化測試

3. 生產環境
   - 負載均衡
   - 監控系統
   - 備份策略
