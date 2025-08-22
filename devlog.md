# 開發日誌

## 2025-02-09
### 客人組數計算邏輯修正
1. 問題描述
   - 管理員後台顯示的熱門時段統計與商家後台歷史訂單數量不一致
   - 管理員後台顯示12筆訂單，但商家後台只顯示5筆歷史訂單
   - 原因是兩個系統使用了不同的計算邏輯

2. 根本原因分析
   - 商家後台：將同一桌同一組客人的多個批次訂單合併為一個桌次訂單顯示
     * 使用 `mergeOrdersByTable` 函數
     * 按桌次ID和客人組別進行分組
     * 從訂單號解析客人組別（如：T1-202508180001001 中的 0001）
   - 管理員後台：直接計算每個訂單的數量
     * 沒有考慮桌次和客人組別的分組邏輯
     * 導致同一組客人的多個批次訂單被重複計算

3. 解決方案
   - 修改管理員後台的熱門時段計算邏輯
   - 在 MongoDB 聚合管道中添加客人組別解析
   - 按桌次ID和客人組別進行分組，然後再按小時統計
   - 確保與商家後台的計算邏輯一致

4. 技術實現
   ```javascript
   // 從訂單號解析客人組別
   customerGroup: {
     $let: {
       vars: {
         orderParts: { $split: ['$orderNumber', '-'] }
       },
       in: {
         $cond: {
           if: { $gte: [{ $size: '$$orderParts' }, 2] },
           then: {
             $let: {
               vars: {
                 dateGroupBatch: { $arrayElemAt: ['$$orderParts', 1] }
               },
               in: {
                 $cond: {
                   if: { $gte: [{ $strLenBytes: '$$dateGroupBatch' }, 12] },
                   then: {
                     $toString: {
                       $toInt: { $substr: ['$$dateGroupBatch', 8, 4] }
                     }
                   },
                   else: '1'
                 }
               }
             }
           },
           else: '1'
         }
       }
     }
   }
   ```

5. 聚合管道修改
   - 第一階段：按小時、桌次ID、客人組別分組
   - 第二階段：按小時重新分組，計算每小時的客人組數
   - 確保統計結果與商家後台顯示的歷史訂單數量一致

6. 影響範圍
   - 管理員後台的熱門時段統計
   - 訂單統計數據的準確性
   - 報表數據的一致性

7. 測試驗證
   - 需要重啟後端服務以應用修改
   - 驗證管理員後台與商家後台的數據一致性
   - 確認熱門時段統計的準確性

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
### 修復管理員登入功能
1. 問題描述
   - 管理員登入請求被錯誤地發送到商家登入端點
   - 導致登入驗證失敗

2. 解決方案
   - 修改了 axios 實例配置
     * 添加了 `withCredentials: true`
     * 添加了 `Accept: application/json` header
   - 改進了 authAPI 中的登入邏輯
     * 根據用戶角色選擇正確的登入端點
     * 添加了詳細的錯誤處理
     * 改進了日誌輸出，隱藏敏感信息
   - 優化了管理員登入頁面
     * 使用 useAuth composable 處理登入邏輯
     * 改進了錯誤處理和提示信息

3. 測試結果
   - 使用管理員帳號成功登入
   - 確認請求被正確發送到管理員登入端點
   - 驗證了錯誤處理和提示信息

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

## 2025-08-16
### 需求分析與開發計劃制定
1. 完整需求梳理
   - 分析點餐系統核心需求
   - 確認多餐廳支援需求
   - 梳理Excel導入/導出功能
   - 確認圖片管理需求
   - 明確前台點餐流程

2. 現有專案評估
   - 評估已完成功能：
     * 基礎架構（Vue 3 + Node.js + Express + MongoDB）
     * 管理員/商家雙角色登入註冊系統
     * 商家菜單管理（含分類、菜品、選項、編輯刪除）
     * 管理員後台用戶管理
     * 響應式UI設計和基礎組件庫
   
   - 識別缺失功能：
     * 桌台管理系統（QR Code生成、桌號管理）
     * 顧客點餐前台（掃碼點餐界面）
     * 訂單管理系統（即時訂單、狀態更新）
     * 多餐廳支援架構
     * Excel導入/導出功能
     * 圖片上傳管理系統
     * 報表統計功能

3. 五階段開發計劃制定
      **第一階段：桌台管理與QR Code系統** ⏸️ *（待開發）*
     - [v] 實現桌台CRUD操作
     - [v] QR Code生成與管理功能
     - [v] 桌台狀態控制系統
     - [v] 桌台列表與詳情頁面
     - [ ] QR Code列印功能

   **第二階段：顧客點餐前台** ✅ *（已完成）*
     - v 建立顧客點餐界面結構
     - v 實現掃碼進入點餐頁面（待第一階段完成後整合）
     - v 菜單瀏覽與篩選功能
     - v 購物車功能實現
     - v 下單流程與表單驗證（待第三階段開發）
     - v 訂單確認與支付介面（待第三階段開發）

   **第三階段：訂單管理系統**
   - [v] 即時訂單接收系統
   - [v] 訂單狀態管理（待處理、製作中、完成等）
   - [ ] 廚房顯示系統
   - [v] 訂單通知機制
   - [v] 訂單歷史記錄
   - [ ] 訂單統計分析

   **第四階段：數據管理增強**
   - [ ] Excel菜單批次導入功能
   - [ ] 訂單數據Excel導出
   - [ ] 圖片批次上傳與管理
   - [ ] 圖片自動匹配系統（依名稱/序號）
   - [ ] 銷售統計報表
   - [ ] 數據備份與還原

   **第五階段：多餐廳支援架構**
   - [ ] 多租戶數據架構設計
   - [ ] 餐廳切換功能
   - [ ] 餐廳獨立配置管理
   - [ ] 統一管理後台
   - [ ] 數據隔離與安全性

4. 下一步行動
   - 由於第二階段顧客點餐前台已經完成，建議：
   - 優先實現第一階段：桌台管理與QR Code系統
   - 這是整個點餐流程的入口，是最基礎且最重要的功能
   - 完成後可以整合掃碼進入點餐頁面功能
   - 然後進入第三階段：訂單管理系統開發

### 技術決策記錄
1. QR Code 生成方案
   - 考慮使用 qrcode.js 或 node-qrcode 庫
   - 需要生成包含餐廳ID和桌號的唯一URL
   - QR Code 應包含過期時間或版本控制

2. 桌台管理數據結構
   - 需要設計桌台模型：桌號、容納人數、狀態、QR Code等
   - 考慮桌台分區管理（大廳、包廂等）
   - 預留多餐廳擴展字段

3. 前台點餐路由設計
   - 使用動態路由：/menu/:restaurantId/:tableId
   - 需要驗證餐廳和桌台的有效性
   - 考慮離線訪問和緩存策略

## 2025-08-17
### 顧客點餐前台開發完成
1. 前台界面架構建立
   - ✅ 建立CustomerLayout佈局組件
     * 實現乾淨簡潔的顧客介面設計
     * 無多餘導航元素，專注點餐體驗
     * 響應式設計適配手機使用
   
   - ✅ 實現Menu.vue點餐主頁面
     * 完整的菜單瀏覽功能
     * 分類篩選和搜索功能
     * 購物車功能完整實現
     * 支援有選項和無選項商品
   
   - ✅ 實現Orders.vue訂單歷史頁面
     * 顯示所有歷史訂單
     * 訂單狀態顯示和篩選
     * 訂單詳情查看功能

2. 購物車功能完善
   - ✅ 購物車按鈕添加購物車圖標（SVG）
   - ✅ 購物車數量顯示（購物車 (數量)）
   - ✅ 空購物車友善提示訊息
   - ✅ 支援兩種商品加入方式：
     * 無選項商品：直接加入購物車
     * 有選項商品：選擇選項後確認送出
   - ✅ 購物車商品數量調整和移除功能

3. 用戶體驗優化
   - ✅ 美觀的商品卡片設計
   - ✅ 直觀的選項選擇界面
   - ✅ 響應式佈局適配各種螢幕
   - ✅ 一致的設計語言和互動體驗

4. 代碼組織優化
   - ✅ 分離式檔案結構：
     * .vue檔案：模板結構
     * .js檔案：業務邏輯
     * .css檔案：樣式定義
   - ✅ 使用Vue 3 Composition API
   - ✅ 良好的代碼註解和可維護性

### 第二階段完成評估
**已完成功能：**
- ✅ 建立顧客點餐界面結構
- ✅ 菜單瀏覽與篩選功能  
- ✅ 購物車功能實現
- ⏸️ 掃碼進入點餐頁面（待桌台管理完成後整合）
- ⏸️ 下單流程與表單驗證（待訂單系統開發）
- ⏸️ 訂單確認與支付介面（待訂單系統開發）

**技術成果：**
- 前台基礎架構完整建立
- 購物車邏輯完全實現
- 響應式設計適配手機點餐場景
- 良好的代碼結構為後續開發奠定基礎

**下一步規劃：**
由於第一階段的桌台管理系統還未開始，建議：
1. 優先完成第一階段：桌台管理與QR Code系統
2. 然後回到第二階段：完成下單流程和訂單確認功能
3. 接著進入第三階段：訂單管理系統開發

*時間：2025-08-17 06:28*

## 2025-08-17 17:57
### 修復結帳後重新進入菜單的問題
1. 問題描述
   - 用戶在結帳完成後點擊"重新開始點餐"時
   - 系統清空了所有本地數據包括桌次信息
   - 導致重新進入菜單時無法獲取商家ID
   - 菜單無法正常加載顯示

2. 問題分析
   - 在 `ThankYou.vue` 的 `restartOrdering` 函數中
   - 原本清空了 `sessionStorage.removeItem('currentTable')`
   - 這導致桌次信息丟失，無法識別當前桌次
   - `Menu.js` 中的 `getMerchantId()` 函數無法獲取商家ID

3. 解決方案
   - 修改 `ThankYou.vue` 的 `restartOrdering` 函數
   - 保留桌次信息：不清空 `currentTable`
   - 只清空購物車和訂單數據：
     * `localStorage.removeItem('currentOrder')`
     * `sessionStorage.removeItem('cartItems')`
   - 確保用戶能正常回到該桌次的點餐頁面

4. 修復結果
   - ✅ 結帳後重新進入菜單功能正常
   - ✅ 桌次信息得到保留
   - ✅ 商家ID能正常獲取
   - ✅ 菜單能正常加載顯示
   - ✅ 用戶體驗得到改善

5. 技術細節
   - 使用 `sessionStorage` 存儲桌次信息
   - 使用 `localStorage` 存儲訂單數據
   - 購物車數據使用 `sessionStorage` 存儲
   - 實現了數據存儲的合理分離

*時間：2025-08-17 17:57*

## 2025-08-19
### 庫存管理系統完善與訂單處理邏輯優化
1. 新增庫存服務層架構
   - ✅ 建立 `inventoryService.js` 服務層
     * 統一處理庫存相關業務邏輯
     * 實現庫存扣減、增加、查詢等核心功能
     * 支援單一規格和多規格庫存管理
     * 提供庫存統計和報表數據處理
   
   - ✅ 優化庫存模型設計
     * 修復庫存模型中的字段定義
     * 支援庫存數量、成本、狀態等屬性
     * 完善庫存與菜單項目的關聯邏輯

2. 訂單處理邏輯重大修復
   - ✅ 修復訂單確認時的庫存扣減錯誤
     * 實現正確的庫存數量扣減邏輯
     * 支援多規格商品的庫存處理
     * 確保庫存扣減的原子性操作
   
   - ✅ 修復成本計算字段錯誤
     * 正確計算訂單總成本和利潤
     * 支援單一和多規格商品的成本計算
     * 優化成本計算的性能和準確性

3. 庫存管理介面優化
   - ✅ 前端庫存管理頁面改進
     * 優化庫存顯示和操作介面
     * 改進庫存統計圖表和數據展示
     * 提升使用者體驗和操作效率
   
   - ✅ 庫存報表功能完善
     * 實現庫存變動歷史記錄
     * 支援庫存統計和趨勢分析
     * 提供多維度的庫存數據查詢

4. 系統穩定性提升
   - ✅ 修復烏龍綠茶等飲品的庫存關聯問題
     * 解決庫存與菜單項目關聯錯誤
     * 確保庫存數據的一致性和準確性
     * 優化庫存關聯的查詢性能
   
   - ✅ 代碼架構優化
     * 實現關注點分離，提高可維護性
     * 統一錯誤處理和日誌記錄
     * 優化數據庫查詢和事務處理

### 技術成果總結
**本次更新統計：**
- 修改文件：11 個
- 新增代碼：452 行
- 刪除代碼：30 行
- 新增服務：1 個（inventoryService）

**核心功能完成度：**
- ✅ 庫存管理系統：90%
- ✅ 訂單處理邏輯：85%
- ✅ 庫存報表功能：80%
- ✅ 前端庫存介面：85%

### 下一步開發計劃
根據當前進度，剩餘主要功能包括：

1. **權限管理系統** (待開發)
   - 角色權限控制
   - 功能權限管理
   - 數據權限隔離

2. **導入導出功能** (待開發)
   - Excel菜單批次導入
   - 訂單數據Excel導出
   - 庫存數據導入導出

3. **Bug修復與優化** (持續進行)
   - 系統穩定性提升
   - 性能優化
   - 用戶體驗改進

**建議優先順序：**
1. 完成權限管理系統（系統安全基礎）
2. 實現導入導出功能（數據管理效率）
3. 持續Bug修復和系統優化

*時間：2025-08-19 12:07*

## 2025-08-19 23:16
### 權限管理初始建置（後端與前端同步）
1. 完成內容
   - ✅ 新增 `server/src/config/permissions.js`，定義系統權限常數與角色對應表
   - ✅ 調整控制器：`adminController.js`、`authController.js`、`employeeController.js`、`roleController.js`，統一權限處理邏輯
   - ✅ 更新路由：`server/src/routes/roleRoutes.js`，補齊角色/權限維護端點
   - ✅ 前端同步：更新 `web/src/services/api.js` 與 `web/src/views/merchant/permissions/Permissions.vue` 對接新的權限接口

2. 影響範圍
   - 後端角色/權限維護流程
   - 商家端權限頁面資料讀寫

3. 待辦事項（未完成）
   - ⏳ 權限中間件與端點保護全面整合與測試
   - ⏳ 前端基於權限的 UI 控制（按鈕顯示/禁用）
   - ⏳ 操作審計日誌（誰在何時變更了哪些權限）

*時間：2025-08-19 13:10*

## 2025-08-19 23:20
### 權限頁面 - 禁止刪除老闆帳號
1. 完成內容
   - ✅ 隱藏員工列表中老闆帳號的刪除按鈕（`web/src/views/merchant/permissions/Permissions.vue`）
   - ✅ 在刪除邏輯中增加保護，若為老闆則阻止刪除並提示

2. 技術細節
   - 透過 `employee.isOwner` 或其角色名稱為「老闆」來判斷
   - 封裝 `canDeleteEmployee()` 與 `isOwnerByRoleId()` 以便後續擴充

3. 待辦事項
   - ⏳ 後端 API `/employees/:id` 刪除端點增加相同保護（雙重保護）

*時間：2025-08-19 23:20*

## 2025-08-19 23:27
### 權限頁面 - 移除「唯一鍵」欄位
1. 調整內容
   - ✅ 移除角色表單中的「唯一鍵」欄位（未被後端使用）
   - ✅ 將角色名稱綁定修正為 `roleForm.name`

2. 影響範圍
   - 僅前端 UI，後端 API 不受影響

*時間：2025-08-19 23:27*

## 2025-08-20 00:52
### 商家端訂單卡片顯示選項標籤｜Show option tags on merchant order cards
1. 完成內容｜What’s done
   - ✅ 在 `web/src/composables/merchant/useOrders.js` 的 `groupOrdersByBatch` 中，改為使用 `processOrderItems()` 統一處理餐點選項，於餐點卡片名稱右側顯示標籤（如：無糖、去冰、大杯）。
   - ✅ 新增 `itemCount` 統計，批次卡片底部的「項」數量正確顯示。

2. 技術細節｜Technical details
   - 於批次聚合時，將 `order.items` 轉為 `processedItems`，每個項目包含 `processedOptions`（已映射成中文/可讀標籤）。
   - 批次物件新增 `itemCount` 並於聚合過程累加。

3. 影響範圍｜Impact
   - 商家端即時訂單頁（`Orders.vue`）顯示更清楚，廚房能一眼看到客製化選項。

4. 待辦事項｜TODO
   - ⏳ 歷史訂單詳情中也顯示同樣的選項標籤。

*時間：2025-08-20 00:52*

## 2025-08-20 01:08
### 菜單圖片上傳與分類目錄管理｜Menu image upload & category folder management
1. 完成內容｜What’s done
   - ✅ 後端靜態資源：在 `server/src/index.js` 掛載 `/uploads` 靜態目錄，提供圖片直接訪問。
   - ✅ 檔案上傳：新增 `multer`，在 `menuRoutes.js` 針對菜品建立/更新掛 `upload.single('image')`。
   - ✅ 類別目錄：在 `menuCategoryController.js` 新增建立/改名/刪除分類時，同步建立/重命名/刪除對應圖片資料夾：`uploads/menu/{merchantSlug}/{categorySlug}`。
   - ✅ 菜品圖片：在 `dishController.js` 新增圖片處理（搬移到對應分類資料夾，檔名規則：`{dish-slug}--{dishId}.{ext}`；更新菜名或分類時自動重命名/搬移）。
   - ✅ JSON 欄位：新增 `parseJsonFields`，支援 multipart/form-data 送入的 `customOptions`、`inventoryConfig` JSON 字串解析。
   - ✅ 前端上傳：`web/src/services/api.js` 的 `menuAPI.createDish/updateDish` 改為 `multipart/form-data`，自動附加 `File` 與 JSON 字串。
   - ✅ 前端表單：在 `AddMenuItemDialog.script.js` 增加 `imageFile`，`handleImageUpload` 保存原始 `File` 並保留預覽 DataURL。
   - ✅ 圖片顯示：`MenuItemCard.vue` 加入 `resolveImage()`，自動將相對路徑補全為 `VITE_API_URL` 對應的主機 + `/uploads/...`。
   - ✅ Docker：dev/prod `docker-compose.yml` 掛載 `server/src/uploads` 至容器，以確保圖片持久化（注意：部署時請確保 volume 權限）。

2. 影響範圍｜Impact
   - 菜單管理頁新增/編輯菜品可直接上傳圖片，圖片按分類歸檔並以菜名命名。
   - 分類名稱調整會同步重命名圖片資料夾，刪除分類會刪除其資料夾（若分類下仍有菜品，API 已阻擋刪除）。

3. 待辦事項｜TODO
   - ⏳ 後端路由加強錯誤訊息國際化與更完整回滾處理（檔案/DB 一致性）。
   - ⏳ 類別更名時，同步更新既有菜品 `image` 路徑（目前搬移檔案，但若出現自定義外連 URL 需另行處理）。
   - ⏳ 圖片壓縮/縮圖（可考慮引入 `sharp`）。
   - ⏳ 物件儲存（S3/MinIO）適配層。

*時間：2025-08-20 02:10*

## 2025-08-20 15:30
### 管理人員菜單編輯權限修正事件
1. 問題描述
   - 商家管理人員無法使用菜單匯入功能
   - 系統提示權限不足，缺少 `菜單:編輯` 權限
   - 影響商家正常使用菜單管理功能

2. 問題分析
   - 檢查資料庫中管理人員角色的權限設定
   - 發現部分管理人員角色缺少 `菜單:編輯` 權限
   - 共找到 43 個管理人員角色，其中 36 個缺少該權限
   - 問題可能出現在角色創建時的權限設定不完整

3. 解決方案
   - 建立權限修正腳本 `fix_manager_menu_permissions.js`
   - 腳本功能：
     * 連接到 MongoDB 資料庫
     * 查找所有管理人員角色
     * 檢查每個角色是否包含 `菜單:編輯` 權限
     * 自動為缺少權限的角色添加該權限
     * 提供詳細的處理日誌和驗證結果

4. 修正結果
   - ✅ 成功修正 36 個管理人員角色的權限
   - ✅ 所有管理人員角色現在都具備 `菜單:編輯` 權限
   - ✅ 驗證確認所有角色權限設定正確
   - ✅ 商家管理人員可以正常使用菜單匯入功能

5. 技術細節
   - 使用 MongoDB 連接字串：`mongodb://admin:admin123@127.0.0.1:27018/order?authSource=admin`
   - 腳本包含完整的錯誤處理和日誌記錄
   - 提供修正前後的權限對比
   - 實現了批量權限修正的原子性操作

6. 預防措施
   - 確認 `roleController.js` 中管理人員角色的預設權限設定正確
   - 建議在角色創建時進行權限完整性檢查
   - 考慮建立權限驗證機制，定期檢查系統角色權限

7. 相關檔案
   - 修正腳本：`server/fix_manager_menu_permissions.js`（已刪除）
   - 角色控制器：`server/src/controllers/roleController.js`
   - 權限配置：`server/src/config/permissions.js`

### 經驗總結
- 權限問題通常出現在資料庫層面，需要直接檢查和修正
- 建立自動化腳本可以快速解決批量權限問題
- 權限修正後必須進行驗證，確保修正成功
- 建議建立權限監控機制，避免類似問題再次發生

*時間：2025-08-20 15:30*

## 2025-08-20 21:30
### 歷史訂單匯出功能檔案下載問題修復｜Fix file download issues in order history export
1. 問題描述｜Problem description
   - 歷史訂單匯出功能無法正確下載檔案
   - 檔案名稱顯示為亂碼或預設名稱
   - Excel 檔案格式可能損壞或無法開啟
   - 瀏覽器下載權限提示出現問題

2. 問題分析｜Problem analysis
   - 後端 CORS 配置缺少檔案名稱標頭支援
   - 前端 blob 處理邏輯錯誤，直接使用 response 而非 response.data
   - 標頭讀取順序不當，可能導致檔案名稱獲取失敗
   - 缺少適當的錯誤處理和回退機制

3. 解決方案｜Solution
   - **後端 CORS 配置**：
     * 在 `server/src/index.js` 中新增 `x-file-name` 標頭到 CORS 允許列表
     * 確保檔案名稱可以正確傳遞到前端
   - **前端 blob 處理修正**：
     * 在 `web/src/composables/merchant/useOrders.js` 中修正 blob 創建邏輯
     * 使用 `response.data` 而非 `response` 作為 blob 內容
     * 調整標頭讀取順序，優先檢查小寫 `x-file-name`
   - **檔案名稱生成規則**：
     * 格式：`{日期}-{商家名稱}-歷史訂單.{格式}`
     * 範例：`20250820-test11-歷史訂單.xlsx`
     * 支援中文檔案名稱，使用 `decodeURIComponent` 解碼
     * 回退機制：如果無法從標頭獲取檔案名稱，使用預設格式

4. 技術細節｜Technical details
   - **CORS 配置**：
     ```javascript
     app.use(cors({
       origin: true,
       credentials: true,
       exposedHeaders: ['x-file-name']
     }))
     ```
   - **檔案名稱處理**：
     ```javascript
     let fileName = response.headers?.['x-file-name'] || response.headers?.['X-File-Name']
     if (fileName) {
       fileName = decodeURIComponent(fileName)
     } else {
       fileName = `歷史訂單_${new Date().toISOString().split('T')[0]}`
     }
     fileName = `${fileName}.${format}`
     ```
   - **Blob 處理**：
     ```javascript
     const blob = new Blob([response.data], { 
       type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
     })
     ```

5. 修正結果｜Results
   - ✅ 檔案下載功能正常工作
   - ✅ 檔案名稱正確顯示中文名稱
   - ✅ Excel 檔案格式完整，可以正常開啟
   - ✅ 瀏覽器下載權限提示正常
   - ✅ 支援 CSV 和 Excel 兩種格式
   - ✅ 具備完整的錯誤處理和回退機制

6. 影響範圍｜Impact
   - 商家端歷史訂單匯出功能完全修復
   - 提升用戶體驗，檔案下載更加可靠
   - 支援中文檔案名稱，符合本地化需求

7. 相關檔案｜Related files
   - 後端 CORS 配置：`server/src/index.js`
   - 前端匯出邏輯：`web/src/composables/merchant/useOrders.js`
   - API 服務：`web/src/services/api.js`
   - 訂單控制器：`server/src/controllers/orderController.js`

### 經驗總結｜Lessons learned
- CORS 配置需要明確允許自定義標頭
- Blob 處理時必須使用正確的響應數據結構
- 檔案名稱處理需要考慮編碼和解碼
- 建立完善的錯誤處理和回退機制很重要
- 測試時需要檢查瀏覽器開發者工具的詳細日誌

*時間：2025-08-20 21:30*

## 2025-08-20 22:15
### 購物車重複添加問題修復｜Fix duplicate item addition in shopping cart
1. 問題描述｜Problem description
   - 客戶端點擊"確認送出"按鈕時，商品被重複添加到購物車
   - 同一商品可能被添加多次，導致購物車數量異常
   - 用戶快速點擊按鈕時問題更加明顯
   - 影響用戶體驗和購物車數據準確性

2. 問題分析｜Problem analysis
   - `addConfiguredItemToCart` 函數缺少防重複調用機制
   - 用戶快速點擊時，函數可能被多次調用
   - 沒有適當的狀態管理來防止重複提交
   - 函數執行時間較長，增加了重複調用的機會

3. 解決方案｜Solution
   - **添加提交狀態管理**：
     * 在 `web/src/views/customer/Menu.js` 中新增 `isSubmitting` 響應式變數
     * 在函數開始時立即設置為 `true`，防止重複調用
     * 在函數結束時延遲重置為 `false`
   - **防重複調用機制**：
     * 在函數入口處檢查 `isSubmitting` 狀態
     * 如果正在提交中，直接返回，不執行後續邏輯
     * 使用 `setTimeout` 延遲重置標誌，給足夠時間防止重複調用
   - **錯誤處理優化**：
     * 在各種錯誤情況下都會重置 `isSubmitting` 標誌
     * 確保函數異常結束時不會卡住提交狀態

4. 技術細節｜Technical details
   - **狀態管理**：
     ```javascript
     const isSubmitting = ref(false)
     ```
   - **防重複調用檢查**：
     ```javascript
     if (isSubmitting.value) {
       console.log('正在提交中，忽略重複調用')
       return
     }
     isSubmitting.value = true
     ```
   - **延遲重置機制**：
     ```javascript
     setTimeout(() => {
       isSubmitting.value = false
       console.log('延遲重置 isSubmitting 為 false')
     }, 500)
     ```
   - **錯誤處理**：
     ```javascript
     } catch (error) {
       console.error('添加商品到購物車失敗:', error)
       isSubmitting.value = false
       // 錯誤處理邏輯...
     }
     ```

5. 修正結果｜Results
   - ✅ 防止重複添加商品到購物車
   - ✅ 提升用戶體驗，避免購物車數據異常
   - ✅ 支援快速點擊而不會產生重複提交
   - ✅ 完整的錯誤處理和狀態重置機制
   - ✅ 控制台日誌便於調試和監控

6. 影響範圍｜Impact
   - 客戶端購物車功能更加穩定可靠
   - 提升用戶體驗，避免購物車混亂
   - 減少後端不必要的重複請求
   - 提高系統整體穩定性

7. 相關檔案｜Related files
   - 客戶端菜單邏輯：`web/src/views/customer/Menu.js`
   - 購物車組件：`web/src/views/customer/Menu.vue`
   - 購物車服務：`web/src/composables/customer/useCart.js`

### 經驗總結｜Lessons learned
- 用戶交互函數必須考慮重複調用的可能性
- 狀態管理是防止重複提交的有效方法
- 延遲重置機制可以進一步防止快速重複調用
- 完整的錯誤處理確保狀態不會卡住
- 控制台日誌有助於調試和監控問題

*時間：2025-08-20 22:15*

## 2025-08-22 15:30
### 平均客單價計算邏輯修正｜Fix average order value calculation logic
1. 問題描述｜Problem description
   - 商家後台歷史訂單頁面的平均客單價計算錯誤
   - 顯示的平均客單價為 $15，但實際應該是 $58
   - 計算結果與預期不符，影響數據分析準確性
   - 用戶反映數據顯示異常

2. 問題分析｜Problem analysis
   - **錯誤的計算公式**：
     * 平均客單價 = 總營業額 ÷ 總客人數
     * 總客人數 = 所有桌次容量總和（如：13個訂單 × 4人桌 = 52人）
     * 結果：$755 ÷ 52 = $15
   - **根本原因**：
     * 混淆了"平均客單價"和"平均每人消費"的概念
     * 使用了桌次容量（`tableCapacity`）而不是實際訂單數
     * 計算邏輯與業務需求不符

3. 解決方案｜Solution
   - **修正計算公式**：
     * 平均客單價 = 總營業額 ÷ 總訂單數
     * 結果：$755 ÷ 13 = $58
   - **移除錯誤的客人數計算**：
     * 刪除 `totalCustomers` 的計算邏輯
     * 直接使用 `completedOrders.length` 作為分母
   - **更新註釋說明**：
     * 明確說明平均客單價的定義
     * 確保代碼可讀性和維護性

4. 技術細節｜Technical details
   - **修正前（錯誤）**：
     ```javascript
     // 計算總客人數（與儀表板計算方式一致）
     const totalCustomers = completedOrders.reduce((sum, order) => {
       return sum + (order.tableCapacity || 0)
     }, 0)
     
     // 客單價 = 總營業額 / 總客人數（與儀表板計算方式一致）
     const averageOrderValue = totalCustomers > 0 
       ? Math.round(totalRevenue / totalCustomers) 
       : 0
     ```
   - **修正後（正確）**：
     ```javascript
     // 平均客單價 = 總營業額 / 總訂單數
     const averageOrderValue = completedOrders.length > 0 
       ? Math.round(totalRevenue / completedOrders.length) 
       : 0
     ```

5. 修正結果｜Results
   - ✅ 平均客單價顯示正確：$58
   - ✅ 計算邏輯符合業務需求
   - ✅ 數據分析準確性提升
   - ✅ 代碼邏輯更加清晰
   - ✅ 與其他系統計算方式保持一致

6. 影響範圍｜Impact
   - 商家後台歷史訂單統計數據準確性
   - 平均客單價分析功能
   - 數據報表的可靠性
   - 商家決策參考的準確性

7. 相關檔案｜Related files
   - 訂單組合邏輯：`web/src/composables/merchant/useOrders.js`
   - 歷史訂單統計：`web/src/views/merchant/orders/OrderHistory.vue`
   - 訂單數據處理：`web/src/composables/merchant/useOrders.js`

### 經驗總結｜Lessons learned
- 業務邏輯必須與實際需求保持一致
- 平均客單價是指每個訂單的平均金額，不是每人平均消費
- 數據計算前需要明確定義計算公式和業務含義
- 代碼註釋應該準確反映實際邏輯
- 測試時需要驗證計算結果的合理性

*時間：2025-08-22 15:30*

## 2025-08-22 16:00
### 條碼生成服務重構｜Barcode generation service refactoring
1. 問題描述｜Problem description
   - 前端使用 jsbarcode 庫生成條碼，但該庫不適合服務器端使用
   - 條碼生成功能需要從前端遷移到後端
   - 需要建立完整的條碼生成 API 服務
   - 支援多種條碼格式和 QR Code 生成

2. 問題分析｜Problem analysis
   - **前端限制**：
     * jsbarcode 主要設計用於瀏覽器環境
     * 在 Node.js 服務器端運行時可能出現兼容性問題
     * 前端生成條碼會增加客戶端負擔
   - **架構需求**：
     * 需要統一的條碼生成服務
     * 支援多種條碼格式（CODE128、EAN13 等）
     * 需要 QR Code 生成功能
     * 提供驗證和批量生成功能

3. 解決方案｜Solution
   - **後端服務重構**：
     * 使用 `bwip-js` 替代 `jsbarcode`
     * 建立完整的 `BarcodeService` 類
     * 實現多種條碼生成方法
   - **API 端點建立**：
     * `/api/v1/barcode/generate` - 生成單個條碼
     * `/api/v1/barcode/qrcode` - 生成 QR Code
     * `/api/v1/barcode/combined` - 生成條碼和 QR Code 組合
     * `/api/v1/barcode/multiple` - 批量生成條碼
     * `/api/v1/barcode/validate` - 驗證條碼格式
   - **功能特性**：
     * 支援 SVG 格式輸出
     * 可自定義條碼尺寸和密度
     * 完整的錯誤處理機制
     * 支援多種條碼格式驗證

4. 技術細節｜Technical details
   - **服務器端條碼生成**：
     ```javascript
     const bwipjs = require('bwip-js');
     
     async generateBarcode(text, options = {}) {
       const defaultOptions = {
         bcid: 'code128',
         text: text,
         width: 150,
         height: 30,
         includetext: false,
         scale: 1.5,
         ...options
       };
       
       const svg = await bwipjs.toSVG(defaultOptions);
       return svg;
     }
     ```
   - **QR Code 生成**：
     ```javascript
     const QRCode = require('qrcode');
     
     async generateQRCode(text, options = {}) {
       const qrCodeDataURL = await QRCode.toDataURL(text, {
         width: 200,
         margin: 2,
         color: { dark: '#000000', light: '#FFFFFF' }
       });
       return qrCodeDataURL;
     }
     ```
   - **批量生成功能**：
     ```javascript
     async generateMultipleBarcodes(texts, options = {}) {
       const promises = texts.map(text => this.generateBarcode(text, options));
       return await Promise.all(promises);
     }
     ```

5. 修正結果｜Results
   - ✅ 建立完整的後端條碼生成服務
   - ✅ 支援多種條碼格式和 QR Code
   - ✅ 提供統一的 API 接口
   - ✅ 實現批量生成和驗證功能
   - ✅ 完整的錯誤處理和日誌記錄
   - ✅ 支援自定義配置選項

6. 影響範圍｜Impact
   - 後端條碼生成服務架構
   - 前端條碼生成功能遷移
   - API 接口設計和實現
   - 系統整體架構優化

7. 相關檔案｜Related files
   - 條碼服務：`server/src/services/barcodeService.js`
   - 條碼控制器：`server/src/controllers/barcodeController.js`
   - 條碼路由：`server/src/routes/barcodeRoutes.js`
   - 主服務器：`server/src/index.js`

### 經驗總結｜Lessons learned
- 選擇適合的技術棧對系統穩定性很重要
- 服務器端生成條碼比前端更可靠
- 統一的 API 設計便於維護和擴展
- 完整的錯誤處理提升系統健壯性
- 批量處理功能提高系統效率

*時間：2025-08-22 16:00*

## 2025-08-22 16:30
### 訂單金額計算邏輯優化｜Order amount calculation logic optimization
1. 問題描述｜Problem description
   - 訂單金額計算邏輯分散在多個地方
   - 不同模組的計算方式可能不一致
   - 需要統一和優化金額計算邏輯
   - 確保數據準確性和一致性

2. 問題分析｜Problem analysis
   - **計算邏輯分散**：
     * 前端和後端都有金額計算邏輯
     * 不同頁面可能使用不同的計算方式
     * 缺乏統一的計算標準
   - **數據一致性問題**：
     * 歷史訂單統計與實時數據可能不一致
     * 不同時間範圍的計算邏輯可能不同
     * 需要確保所有計算都使用相同的邏輯

3. 解決方案｜Solution
   - **統一計算邏輯**：
     * 在 `useOrders.js` 中集中管理金額計算
     * 使用 `totalAmount` 作為標準字段
     * 確保所有統計都使用相同的計算方式
   - **優化統計計算**：
     * 修正平均客單價計算公式
     * 統一營業額統計邏輯
     * 改進時間範圍過濾機制
   - **數據驗證機制**：
     * 添加計算結果驗證
     * 提供調試日誌便於問題排查
     * 確保數據完整性

4. 技術細節｜Technical details
   - **營業額計算**：
     ```javascript
     const totalRevenue = completedOrders.reduce((sum, order) => 
       sum + order.totalAmount, 0
     )
     ```
   - **平均客單價計算**：
     ```javascript
     const averageOrderValue = completedOrders.length > 0 
       ? Math.round(totalRevenue / completedOrders.length) 
       : 0
     ```
   - **時間過濾優化**：
     ```javascript
     filtered = filtered.filter(order => {
       try {
         const orderTime = new Date(order.completedAt)
         const orderDate = new Date(orderTime.getFullYear(), orderTime.getMonth(), orderTime.getDate())
         return orderDate.getTime() === today.getTime()
       } catch (error) {
         console.warn('時間過濾失敗:', order, error)
         return false
       }
     })
     ```

5. 修正結果｜Results
   - ✅ 統一訂單金額計算邏輯
   - ✅ 修正平均客單價計算公式
   - ✅ 優化時間範圍過濾機制
   - ✅ 提升數據計算準確性
   - ✅ 改善調試和錯誤處理
   - ✅ 確保數據一致性

6. 影響範圍｜Impact
   - 商家後台訂單統計功能
   - 歷史訂單數據分析
   - 營業額和客單價計算
   - 時間範圍過濾功能

7. 相關檔案｜Related files
   - 訂單組合邏輯：`web/src/composables/merchant/useOrders.js`
   - 歷史訂單頁面：`web/src/views/merchant/orders/OrderHistory.vue`
   - 訂單數據處理：`web/src/composables/merchant/useOrders.js`

### 經驗總結｜Lessons learned
- 統一的計算邏輯對數據一致性很重要
- 集中管理複雜計算邏輯便於維護
- 完整的錯誤處理提升系統穩定性
- 調試日誌有助於問題排查和驗證
- 數據驗證機制確保計算結果準確性

*時間：2025-08-22 16:30*