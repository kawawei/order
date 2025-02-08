# 開發日誌

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
