# 開發日誌

## 2025-02-09

### 清理桌次功能優化 - 完全刪除所有訂單記錄
1. 需求描述
   - 當按下「清理桌次」按鈕時，該桌次的所有訂單記錄都應該被完全刪除
   - 不應該保留任何狀態的訂單記錄（包括已完成、已取消等）
   - 清理桌次應該是一個徹底的重置操作

2. 問題分析
   - 原本的清理桌次功能只會將未完成訂單的狀態改為 'cancelled'
   - 訂單記錄仍然保留在資料庫中
   - 這不符合「清理」的語義，用戶期望的是完全清除

3. 解決方案
   - 修改後端 `tableController.js` 中的清理邏輯
   - 使用 `Order.deleteMany()` 完全刪除該桌次的所有訂單記錄
   - 更新前端確認訊息，清楚說明會刪除所有記錄

4. 技術實現
   ```javascript
   // 修改前：只取消未完成訂單
   await Order.updateMany(
     { 
       tableId: table._id,
       status: { $in: ['pending', 'confirmed', 'preparing', 'ready'] }
     },
     { 
       status: 'cancelled',
       updatedAt: new Date()
     }
   );

   // 修改後：完全刪除所有訂單記錄
   const deleteResult = await Order.deleteMany({ tableId: table._id });
   ```

5. 前端優化
   - 更新確認訊息，清楚說明會刪除所有訂單記錄
   - 添加警告圖示和詳細說明
   - 強調此操作無法復原

6. 影響範圍
   - 桌次管理頁面的清理功能
   - 訂單資料的完整性
   - 用戶操作體驗

7. 測試驗證
   - 清理桌次後，該桌次的所有訂單記錄都被完全刪除
   - 確認訊息清楚說明操作後果
   - 清理後的桌次狀態正確重置為可用

### 修復清理桌次功能刪除歷史訂單的問題
1. 問題描述
   - 當按下「清理桌次」按鈕時，歷史訂單也會被刪除一筆
   - 這會影響歷史訂單統計的準確性
   - 已完成的訂單應該保留在歷史記錄中

2. 根本原因分析
   - 在 `tableController.js` 的 `updateTableStatus` 函數中
   - 清理桌次時使用 `Order.deleteMany({ tableId: table._id })` 刪除所有訂單
   - 沒有區分訂單狀態，導致已完成的歷史訂單也被刪除

3. 解決方案
   - 修改刪除條件，只刪除未完成的訂單
   - 保留已完成（completed）和已取消（cancelled）的歷史訂單
   - 更新日誌訊息和回應訊息

4. 技術實現
   ```javascript
   // 修改前：刪除所有訂單
   const deleteResult = await Order.deleteMany({ tableId: table._id });

   // 修改後：只刪除未完成的訂單
   const deleteResult = await Order.deleteMany({ 
     tableId: table._id,
     status: { $nin: ['completed', 'cancelled'] } // 排除已完成和已取消的訂單
   });
   ```

5. 影響範圍
   - 桌次管理頁面的清理功能
   - 歷史訂單統計的準確性
   - 訂單資料的完整性

6. 測試驗證
   - 清理桌次後，未完成訂單被刪除
   - 已完成的歷史訂單保留在歷史記錄中
   - 歷史訂單統計數據保持準確

### 日期選擇器左右箭頭修復與優化

### 日期選擇器左右箭頭修復與優化
1. 問題描述
   - 日期選擇器的左右箭頭按鈕按下沒有反應
   - 無法切換月份和年份
   - 影響用戶選擇日期的體驗

2. 根本原因分析
   - Vue 3 的響應式系統問題
   - 直接修改 Date 對象的屬性不會觸發響應式更新
   - `selectedDate.value.setMonth()` 和 `selectedDate.value.setFullYear()` 方法不會觸發重新渲染

3. 解決方案
   - 創建新的 Date 對象而不是直接修改現有對象
   - 確保每次修改都觸發響應式更新
   - 修復所有日期操作函數

4. 技術實現
   ```javascript
   // 修復前（不會觸發響應式更新）
   const previousMonth = () => {
     selectedDate.value.setMonth(selectedDate.value.getMonth() - 1)
   }

   // 修復後（會觸發響應式更新）
   const previousMonth = () => {
     const newDate = new Date(selectedDate.value)
     newDate.setMonth(newDate.getMonth() - 1)
     selectedDate.value = newDate
   }
   ```

5. 修復的函數
   - `previousMonth()` - 上個月
   - `nextMonth()` - 下個月
   - `previousYear()` - 上一年
   - `nextYear()` - 下一年
   - `selectYear()` - 選擇年份
   - `selectMonth()` - 選擇月份

6. 影響範圍
   - BaseDatePicker 組件
   - 訂單管理頁面的日期選擇功能
   - 所有使用日期選擇器的頁面

7. 測試驗證
   - 左右箭頭按鈕現在可以正常切換月份
   - 年份切換功能正常
   - 日期選擇器響應式更新正常

### 日期導航功能優化
1. 需求描述
   - 將左右箭頭按鈕移到日期選擇器的左右兩邊
   - 提供更直觀的日期導航體驗
   - 簡化日期選擇器的內部結構

2. 實現方案
   - 在 Orders.vue 中添加日期導航容器
   - 將左右箭頭按鈕放在日期選擇器外部
   - 添加相應的點擊事件處理函數

3. 技術實現
   ```vue
   <div class="date-navigation">
     <button class="nav-arrow" @click="previousDate">
       <font-awesome-icon icon="chevron-left" />
     </button>
     <BaseDatePicker v-model="selectedDate" />
     <button class="nav-arrow" @click="nextDate">
       <font-awesome-icon icon="chevron-right" />
     </button>
   </div>
   ```

4. 新增功能
   - `previousDate()` - 切換到前一天
   - `nextDate()` - 切換到後一天
   - 日期導航樣式設計

5. 樣式設計
   - 32x32px 的圓角按鈕
   - 懸停和點擊效果
   - 與日期選擇器風格一致

6. 影響範圍
   - 訂單管理頁面的日期導航
   - 提升用戶體驗
   - 更直觀的日期切換方式

### 移除時間範圍選擇器
1. 需求描述
   - 移除「今日」、「本週」、「本月」的選單
   - 只保留日期選擇器進行篩選
   - 簡化用戶界面和邏輯

2. 實現方案
   - 移除 HTML 中的時間範圍選擇器
   - 簡化 useOrders.js 中的時間範圍邏輯
   - 統一使用日期選擇器進行篩選

3. 技術實現
   ```javascript
   // 移除 selectedTimeRange 相關邏輯
   // 統一使用 selectedDate 進行日期篩選
   const loadHistoryOrders = async () => {
     const selectedDay = new Date(selectedDate.value)
     const startOfDay = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate())
     const endOfDay = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), 23, 59, 59, 999)
     
     const response = await orderService.getOrdersByMerchant(merchantId, {
       startDate: startOfDay.toISOString(),
       endDate: endOfDay.toISOString()
     })
   }
   ```

4. 移除的功能
   - `selectedTimeRange` 響應式變數
   - `timeRangeTitle` 計算屬性
   - `selectedTimeRangeOrdersCount` 計算屬性
   - 時間範圍過濾邏輯

5. 新增的功能
   - `dateTitle` 計算屬性
   - `selectedDateOrdersCount` 計算屬性
   - 簡化的日期篩選邏輯

6. 影響範圍
   - 訂單管理頁面的時間篩選功能
   - 簡化用戶界面
   - 提升代碼可維護性

### 修復 selectedTimeRange 引用錯誤
1. 問題描述
   - 移除時間範圍選擇器後，`getStatVariant` 函數仍引用 `selectedTimeRange`
   - 匯出功能中的日期設定邏輯仍使用 `selectedTimeRange`
   - 導致 JavaScript 運行時錯誤

2. 修復方案
   - 修改 `getStatVariant` 函數，基於 `selectedDate` 判斷變體
   - 簡化匯出功能的日期設定邏輯
   - 統一使用 `selectedDate` 進行日期相關操作

3. 技術實現
   ```javascript
   // 修復 getStatVariant 函數
   const getStatVariant = () => {
     const today = new Date()
     const selectedDay = new Date(selectedDate.value)
     
     if (today.toDateString() === selectedDay.toDateString()) {
       return 'primary'  // 今天
     } else if (selectedDay < today) {
       return 'info'     // 過去日期
     } else {
       return 'warning'  // 未來日期
     }
   }
   
   // 簡化匯出日期設定
   const selectedDay = new Date(selectedDate.value)
   params.startDate = `${year}-${month}-${day}`
   params.endDate = `${year}-${month}-${day}`
   ```

4. 修復內容
   - 移除所有 `selectedTimeRange` 引用
   - 移除所有 `timeRangeTitle` 引用
   - 移除所有 `selectedTimeRangeOrdersCount` 引用
   - 統一使用 `selectedDate` 進行日期操作

5. 測試結果
   - 修復了 JavaScript 運行時錯誤
   - 統計卡片變體正確顯示
   - 匯出功能正常工作
   - 日期導航功能正常運作

### 修復 Orders.vue 中的 selectedTimeRange 引用
1. 問題描述
   - Orders.vue 第 295 行仍在使用 `selectedTimeRange` 來顯示統計卡片標籤
   - 導致 Vue 警告：Property "selectedTimeRange" was accessed during render but is not defined on instance

2. 修復方案
   - 創建新的 `getDateDisplayText()` 函數來替代 `selectedTimeRange` 的邏輯
   - 在 `useOrders.js` 中實現該函數並導出
   - 修改 Orders.vue 中的模板引用

3. 技術實現
   ```javascript
   // 新增 getDateDisplayText 函數
   const getDateDisplayText = () => {
     const today = new Date()
     const selectedDay = new Date(selectedDate.value)
     
     if (today.toDateString() === selectedDay.toDateString()) {
       return '今日'
     } else {
       return selectedDay.toLocaleDateString('zh-TW', { 
         month: 'long', 
         day: 'numeric' 
       })
     }
   }
   ```

4. 修復內容
   - 在 `useOrders.js` 中添加 `getDateDisplayText` 函數
   - 在 return 語句中導出該函數
   - 修改 Orders.vue 中的模板，使用 `getDateDisplayText()` 替代 `selectedTimeRange` 邏輯

5. 測試結果
   - 消除了 Vue 警告
   - 統計卡片標籤正確顯示
   - 日期導航功能正常運作

### 修復 getDateDisplayText 函數引用錯誤
1. 問題描述
   - 雖然在 `useOrders.js` 中正確導出了 `getDateDisplayText` 函數
   - 但在 `Orders.vue` 的解構中遺漏了該函數
   - 導致 Vue 錯誤：`Property "getDateDisplayText" was accessed during render but is not defined on instance`

2. 修復方案
   - 在 `Orders.vue` 的解構語句中添加 `getDateDisplayText` 函數

3. 技術實現
   ```javascript
   // 在 Orders.vue 的解構中添加
   const {
     // ... 其他解構項目
     getDateDisplayText,
     // ... 其他解構項目
   } = useOrders(route.query.restaurantId)
   ```

4. 修復內容
   - 在 `Orders.vue` 第 540 行左右的解構語句中添加 `getDateDisplayText`
   - 確保函數能夠正確從 composable 中導入

5. 測試結果
   - 消除了 Vue 錯誤
   - 統計卡片標籤正確顯示
   - 日期導航功能正常運作

### 增強日期導航功能 - 支持月/年視圖切換
1. 需求描述
   - 用戶反映當選擇「月」視圖時，左右箭頭還是切換日期而不是月份
   - 需要根據當前視圖模式（日/月/年）來調整導航行為

2. 技術實現
   - 在 `useOrders.js` 中添加 `dateViewMode` 狀態來追蹤當前視圖模式
   - 修改 `previousDate` 和 `nextDate` 函數，根據視圖模式進行不同的導航：
     - 年視圖：切換年份
     - 月視圖：切換月份
     - 日視圖：切換日期
   - 在 `BaseDatePicker` 組件中添加 `modeChange` 事件
   - 在 `Orders.vue` 中監聽模式變化並同步狀態

3. 修改內容
   ```javascript
   // useOrders.js - 添加視圖模式狀態
   const dateViewMode = ref('day')
   
   // 修改導航函數
   const previousDate = () => {
     const newDate = new Date(selectedDate.value)
     switch (dateViewMode.value) {
       case 'year': newDate.setFullYear(newDate.getFullYear() - 1); break
       case 'month': newDate.setMonth(newDate.getMonth() - 1); break
       case 'day': default: newDate.setDate(newDate.getDate() - 1); break
     }
     selectedDate.value = newDate
   }
   ```

4. 功能特點
   - 支持日/月/年三種視圖模式
   - 導航箭頭根據當前模式智能切換
   - 視圖模式狀態與日期選擇器同步
   - 保持向後兼容性

5. 測試結果
   - 日視圖：左右箭頭切換日期
   - 月視圖：左右箭頭切換月份
   - 年視圖：左右箭頭切換年份
   - 模式切換正常，狀態同步正確

### 修正月視圖訂單篩選邏輯
1. 問題描述
   - 用戶反映當選擇「月」視圖時，系統只顯示該月某一天的訂單
   - 例如：選擇8月22日，月視圖應該顯示整個8月的訂單，而不是只顯示8月22日的訂單

2. 技術實現
   - 修改 `loadHistoryOrders` 函數，根據視圖模式決定查詢時間範圍：
     - 年視圖：查詢整年訂單（1月1日到12月31日）
     - 月視圖：查詢整月訂單（當月1日到月底）
     - 日視圖：查詢單日訂單（當天00:00到23:59）
   - 更新 `dateTitle` 計算屬性，根據視圖模式顯示不同格式的標題
   - 修改監聽器，同時監聽日期和視圖模式的變化

3. 修改內容
   ```javascript
   // 根據視圖模式決定查詢時間範圍
   switch (dateViewMode.value) {
     case 'year':
       // 查詢整年的訂單
       const startOfYear = new Date(selectedDay.getFullYear(), 0, 1)
       const endOfYear = new Date(selectedDay.getFullYear(), 11, 31, 23, 59, 59, 999)
       break
     case 'month':
       // 查詢整月的訂單
       const startOfMonth = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), 1)
       const endOfMonth = new Date(selectedDay.getFullYear(), selectedDay.getMonth() + 1, 0, 23, 59, 59, 999)
       break
     case 'day':
       // 查詢單日的訂單
       const startOfDay = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate())
       const endOfDay = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), 23, 59, 59, 999)
       break
   }
   ```

4. 功能特點
   - 智能時間範圍查詢：根據視圖模式自動調整查詢範圍
   - 動態標題顯示：年視圖顯示「2024年」，月視圖顯示「2024年8月」
   - 即時數據更新：切換視圖模式時自動重新載入對應時間範圍的訂單
   - 保持數據一致性：確保顯示的訂單與當前視圖模式匹配

5. 測試結果
   - 日視圖：顯示選中日期的訂單
   - 月視圖：顯示整個月份的訂單
   - 年視圖：顯示整個年份的訂單
   - 標題格式正確對應視圖模式
   - 切換視圖時數據即時更新

### 移除日期選擇器向下箭頭
1. 需求描述
   - 用戶希望移除日期導航組件中的向下箭頭
   - 只顯示日期文字，保持簡潔的界面

2. 技術實現
   - 修改 `BaseDatePicker.vue` 組件
   - 移除觸發按鈕中的向下箭頭圖標
   - 清理相關的CSS樣式

3. 修改內容
   ```vue
   <!-- 移除前 -->
   <div class="trigger-content">
     <font-awesome-icon icon="calendar" class="trigger-icon" />
     <span class="trigger-text">{{ displayText }}</span>
     <font-awesome-icon icon="chevron-down" class="trigger-arrow" :class="{ 'rotated': isOpen }" />
   </div>
   
   <!-- 移除後 -->
   <div class="trigger-content">
     <font-awesome-icon icon="calendar" class="trigger-icon" />
     <span class="trigger-text">{{ displayText }}</span>
   </div>
   ```

4. 功能特點
   - 界面更簡潔：移除視覺干擾元素
   - 保持功能完整：點擊日期文字仍可打開選擇器
   - 視覺一致性：與整體設計風格更協調

5. 測試結果
   - 日期顯示正常：顯示格式為「2025年8月20日」
   - 點擊功能正常：點擊日期文字可打開日期選擇器
   - 界面更簡潔：沒有向下箭頭，視覺更清爽

### 動態顯示日期標籤文字
1. 需求描述
   - 用戶希望「今日」按鈕的文字根據當前選擇的視圖模式動態變化
   - 日視圖：顯示「今日」
   - 月視圖：顯示「本月」或「7月」
   - 年視圖：顯示「今年」或「2025」

2. 技術實現
   - 修改 `useOrders.js` 中的 `getDateDisplayText` 函數
   - 根據 `dateViewMode` 返回對應的文字
   - 智能判斷是否為當前時間段

3. 修改內容
   ```javascript
   // 修改前：只顯示「今日」或日期
   const getDateDisplayText = () => {
     const today = new Date()
     const selectedDay = new Date(selectedDate.value)
     
     if (today.toDateString() === selectedDay.toDateString()) {
       return '今日'
     } else {
       return selectedDay.toLocaleDateString('zh-TW', { 
         month: 'long', 
         day: 'numeric' 
       })
     }
   }
   
   // 修改後：根據視圖模式動態顯示
   const getDateDisplayText = () => {
     const today = new Date()
     const selectedDay = new Date(selectedDate.value)
     
     switch (dateViewMode.value) {
       case 'year':
         if (today.getFullYear() === selectedDay.getFullYear()) {
           return '今年'
         } else {
           return `${selectedDay.getFullYear()}年`
         }
       case 'month':
         if (today.getFullYear() === selectedDay.getFullYear() && 
             today.getMonth() === selectedDay.getMonth()) {
           return '本月'
         } else {
           return `${selectedDay.getFullYear()}年${selectedDay.getMonth() + 1}月`
         }
       case 'day':
       default:
         if (today.toDateString() === selectedDay.toDateString()) {
           return '今日'
         } else {
           return selectedDay.toLocaleDateString('zh-TW', { 
             month: 'long', 
             day: 'numeric' 
           })
         }
     }
   }
   ```

4. 功能特點
   - 智能判斷：自動檢測是否為當前時間段
   - 動態顯示：根據視圖模式顯示對應文字
   - 用戶友好：提供直觀的時間段標識

5. 顯示效果
   - **日視圖**：
     - 今天：顯示「今日」
     - 其他日期：顯示「8月22日」
   - **月視圖**：
     - 本月：顯示「本月」
     - 其他月份：顯示「2025年8月」
   - **年視圖**：
     - 今年：顯示「今年」
     - 其他年份：顯示「2025年」

### 智能匯出功能
1. 需求描述
   - 匯出功能需要根據當前選擇的視圖模式來決定匯出範圍
   - 日模式：匯出選擇的單日資料，檔名為「2025-08-22-餐廳名稱-歷史訂單」
   - 月模式：匯出選擇的整月資料，檔名為「2025-08-餐廳名稱-歷史訂單」
   - 年模式：匯出選擇的整年資料，檔名為「2025-餐廳名稱-歷史訂單」

2. 技術實現
   - 修改前端 `useOrders.js` 中的 `exportHistoryOrders` 函數
   - 修改後端 `orderController.js` 中的檔案名稱生成邏輯
   - 根據 `dateViewMode` 和 `selectedDate` 動態設定匯出範圍

3. 修改內容
   ```javascript
   // 前端：根據視圖模式設定匯出範圍
   switch (dateViewMode.value) {
     case 'year':
       // 年模式：匯出整年資料
       params.startDate = `${year}-01-01`
       params.endDate = `${year}-12-31`
       break
     case 'month':
       // 月模式：匯出整月資料
       params.startDate = `${year}-${month}-01`
       const lastDay = new Date(year, selectedDay.getMonth() + 1, 0).getDate()
       params.endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`
       break
     case 'day':
     default:
       // 日模式：匯出單日資料
       params.startDate = `${year}-${month}-${day}`
       params.endDate = `${year}-${month}-${day}`
       break
   }
   
   // 後端：根據匯出範圍生成檔案名稱
   if (startDate === endDate) {
     // 單日匯出：年月日-餐廳名稱-歷史訂單
     fileName = `${dateStr}-${merchant.businessName}-歷史訂單`;
   } else if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
     // 整月匯出：年月-餐廳名稱-歷史訂單
     fileName = `${monthStr}-${merchant.businessName}-歷史訂單`;
   } else if (start.getFullYear() === end.getFullYear()) {
     // 整年匯出：年-餐廳名稱-歷史訂單
     fileName = `${yearStr}-${merchant.businessName}-歷史訂單`;
   }
   ```

4. 功能特點
   - 智能判斷：自動檢測匯出範圍類型
   - 動態命名：根據匯出範圍生成對應的檔案名稱
   - 用戶友好：檔案名稱清楚標示匯出的時間範圍

5. 匯出效果
   - **日模式**：
     - 匯出範圍：2025-08-22 單日資料
     - 檔案名稱：`2025-08-22-餐廳名稱-歷史訂單.xlsx`
   - **月模式**：
     - 匯出範圍：2025-08-01 到 2025-08-31 整月資料
     - 檔案名稱：`2025-08-餐廳名稱-歷史訂單.xlsx`
   - **年模式**：
     - 匯出範圍：2025-01-01 到 2025-12-31 整年資料
     - 檔案名稱：`2025-餐廳名稱-歷史訂單.xlsx`

6. 智能檢查機制
   - 匯出前先檢查是否有訂單可匯出
   - 使用 `getOrdersByMerchant` API 檢查訂單數量
   - 沒有訂單時直接顯示提醒，不進行匯出操作
   - 避免顯示「匯出進行中」的誤導訊息
   - 根據視圖模式顯示對應的提醒訊息：
     - 日模式：`2025年8月22日沒有找到已完成的訂單`
     - 月模式：`2025年8月沒有找到已完成的訂單`
     - 年模式：`2025年沒有找到已完成的訂單`
   - 修正 API 方法名稱錯誤（從 `getHistoryOrders` 改為 `getOrdersByMerchant`）
   - 修正參數格式，使用正確的 `startDate` 和 `endDate` 參數

### 匯出功能時間格式和收據號修復｜Fix export time format and receipt number

*時間：2025-08-22 18:00*

1. 問題描述｜Problem description
   - 匯出的結帳時間顯示 UTC 時間而非台灣本地時間
   - 匯出資料缺少收據號欄位，用戶無法追蹤具體訂單
   - 影響報表的可讀性和實用性

2. 問題分析｜Problem analysis
   - **時間格式問題**：`toLocaleString('zh-TW')` 沒有指定時區，預設使用 UTC
   - **缺少收據號**：匯出資料結構中沒有包含訂單的唯一識別碼
   - **欄位順序**：需要將收據號放在 A 列，其他欄位往後移動

3. 解決方案｜Solution
   - **修正時間格式**：
     * 添加 `timeZone: 'Asia/Taipei'` 參數
     * 確保顯示台灣本地時間 (UTC+8)
   - **添加收據號欄位**：
     * 在 A 列添加收據號 (10位數字收據號)
     * 其他欄位順序往後移動
   - **調整欄寬**：
     * 收據號欄位寬度設為 12 字符
     * 保持其他欄位的合適寬度

4. 技術細節｜Technical details
   - **時間格式修正**：
     ```javascript
     const orderTime = order.completedAt ? 
       new Date(order.completedAt).toLocaleString('zh-TW', {
         year: 'numeric',
         month: '2-digit',
         day: '2-digit',
         hour: '2-digit',
         minute: '2-digit',
         second: '2-digit',
         timeZone: 'Asia/Taipei'  // 新增時區設定
       }) : '';
     ```
   - **收據號添加**：
     ```javascript
     exportData.push({
       '收據號': order.receiptOrderNumber || '',  // 使用正確的收據號欄位
       '訂單號': order.tableOrderNumber || order.orderNumber,
       // ... 其他欄位
     });
     ```
   - **欄寬調整**：
     ```javascript
     const columnWidths = [
       { wch: 12 }, // 收據號 (10位數字)
       { wch: 15 }, // 訂單號
       // ... 其他欄位寬度
     ];
     ```

5. 修正結果｜Results
   - ✅ 結帳時間現在顯示台灣本地時間 (UTC+8)
   - ✅ 匯出資料包含正確的收據號在 A 列
   - ✅ 欄位順序：收據號 → 訂單號 → 桌號 → 結帳時間 → ...
   - ✅ 欄寬設定適合內容長度
   - ✅ 提升報表的可讀性和追蹤性

6. 影響範圍｜Impact
   - 匯出報表現在顯示正確的本地時間
   - 用戶可以通過收據號追蹤具體訂單
   - 提升報表的實用性和專業性
   - 符合台灣本地化需求

7. 相關檔案｜Related files
   - 後端匯出控制器：`server/src/controllers/orderController.js`

### 收據號格式修正｜Fix receipt number format

*時間：2025-08-22 18:15*

1. 問題描述｜Problem description
   - 匯出功能中收據號使用了錯誤的欄位 (MongoDB ObjectId)
   - 應該使用 `receiptOrderNumber` 欄位，這是10位數字的收據號
   - 影響報表的準確性和專業性

2. 問題分析｜Problem analysis
   - **錯誤的收據號**：使用了 `order._id.toString()` (MongoDB ObjectId)
   - **正確的收據號**：應該是 `order.receiptOrderNumber` (10位數字)
   - **欄寬設定**：24字符寬度不適合10位數字

3. 解決方案｜Solution
   - **修正收據號欄位**：
     * 使用 `order.receiptOrderNumber || ''` 替代 `order._id.toString()`
     * 確保使用正確的收據號格式
   - **調整欄寬**：
     * 收據號欄位寬度從 24 調整為 12 字符
     * 更適合10位數字的顯示

4. 技術細節｜Technical details
   - **收據號生成邏輯**：
     ```javascript
     // 生成10位隨機數字收據號碼
     function generateReceiptNumber() {
       return Math.floor(1000000000 + Math.random() * 9000000000).toString();
     }
     ```
   - **收據號欄位修正**：
     ```javascript
     exportData.push({
       '收據號': order.receiptOrderNumber || '',  // 修正：使用正確的收據號
       '訂單號': order.tableOrderNumber || order.orderNumber,
       // ... 其他欄位
     });
     ```
   - **欄寬調整**：
     ```javascript
     const columnWidths = [
       { wch: 12 }, // 收據號 (10位數字) - 修正寬度
       { wch: 15 }, // 訂單號
       // ... 其他欄位寬度
     ];
     ```

5. 修正結果｜Results
   - ✅ 收據號現在顯示正確的10位數字格式
   - ✅ 欄寬設定更適合收據號長度
   - ✅ 提升報表的專業性和準確性
   - ✅ 符合商業收據的標準格式

6. 影響範圍｜Impact
   - 匯出報表現在顯示正確的收據號格式
   - 提升報表的專業性和可讀性
   - 符合台灣商業收據的標準格式
   - 便於用戶追蹤和對帳

7. 相關檔案｜Related files
   - 後端匯出控制器：`server/src/controllers/orderController.js`
   - 收據號生成邏輯：`server/src/controllers/orderController.js:747`

### 匯出功能欄位簡化｜Simplify export columns

*時間：2025-08-22 18:30*

1. 問題描述｜Problem description
   - 匯出功能包含過多欄位，影響報表的簡潔性
   - 總金額和桌位容量欄位在商品明細中重複顯示
   - 需要簡化匯出格式，提升可讀性

2. 問題分析｜Problem analysis
   - **總金額欄位**：在商品明細中顯示訂單總金額，與小計欄位功能重疊
   - **桌位容量欄位**：與訂單內容無直接關係，影響報表焦點
   - **欄位順序**：移除欄位後需要調整欄寬設定

3. 解決方案｜Solution
   - **移除總金額欄位**：避免與小計欄位功能重疊
   - **移除桌位容量欄位**：專注於訂單內容，提升報表簡潔性
   - **調整欄寬**：重新設定各欄位的合適寬度

4. 技術細節｜Technical details
   - **移除的欄位**：
     ```javascript
     // 移除前
     '總金額': order.totalAmount,
     '桌位容量': order.tableId ? order.tableId.tableCapacity : '',
     
     // 移除後
     // 直接從桌號跳到商品名稱
     ```
   - **欄寬調整**：
     ```javascript
     const columnWidths = [
       { wch: 12 }, // 收據號 (10位數字)
       { wch: 15 }, // 訂單號
       { wch: 10 }, // 桌號
       { wch: 20 }, // 結帳時間
       { wch: 20 }, // 商品名稱 (移除總金額和桌位容量後)
       { wch: 8 },  // 數量
       { wch: 10 }, // 單價
       { wch: 12 }, // 小計
       { wch: 30 }, // 選項
       { wch: 20 }  // 備註
     ];
     ```

5. 修正結果｜Results
   - ✅ 匯出報表更加簡潔，專注於訂單內容
   - ✅ 移除重複的總金額顯示，避免混淆
   - ✅ 移除無關的桌位容量資訊，提升報表焦點
   - ✅ 欄寬設定更適合簡化後的欄位結構
   - ✅ 提升報表的可讀性和專業性

6. 影響範圍｜Impact
   - 匯出報表欄位從 12 個減少到 10 個
   - 報表更加簡潔，專注於核心訂單資訊
   - 提升用戶閱讀體驗
   - 符合精簡化報表設計原則

7. 相關檔案｜Related files
   - 後端匯出控制器：`server/src/controllers/orderController.js`

### 匯出功能日期範圍問題修復｜Fix export date range issue

*時間：2025-08-22 17:45*

1. 問題描述｜Problem description
   - 匯出歷史訂單時，明明有訂單但系統提示「沒有找到已完成的訂單」
   - 從日誌看到匯出參數正確，但查詢結果為空
   - 影響用戶正常使用匯出功能
   - 日期範圍查詢邏輯存在問題

2. 問題分析｜Problem analysis
   - 匯出參數：`{startDate: '2025-08-22', endDate: '2025-08-22'}`
   - 後端解析時，`startDate` 和 `endDate` 都被解析為 `2025-08-22T00:00:00.000Z`
   - 導致查詢範圍為 0 毫秒，無法找到任何訂單
   - 日期範圍應該包含整天的時間（00:00:00 到 23:59:59）

3. 解決方案｜Solution
   - **修正日期範圍格式**：
     * 日模式：`startDate: '2025-08-22T00:00:00.000Z'`, `endDate: '2025-08-22T23:59:59.999Z'`
     * 月模式：`endDate: '2025-12-31T23:59:59.999Z'`
     * 年模式：`endDate: '2025-12-31T23:59:59.999Z'`
   - **確保時間範圍完整性**：
     * 開始時間設為當天 00:00:00
     * 結束時間設為當天 23:59:59.999
     * 使用 ISO 8601 格式確保時區正確

4. 技術細節｜Technical details
   - **日模式修正**：
     ```javascript
     params.startDate = `${year}-${month}-${day}T00:00:00.000Z`
     params.endDate = `${year}-${month}-${day}T23:59:59.999Z`
     ```
   - **月模式修正**：
     ```javascript
     params.endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}T23:59:59.999Z`
     ```
   - **年模式修正**：
     ```javascript
     params.endDate = `${year}-12-31T23:59:59.999Z`
     ```

5. 修正結果｜Results
   - ✅ 修正日期範圍查詢邏輯
   - ✅ 確保能正確查詢到當天的訂單
   - ✅ 支持日、月、年三種視圖模式的匯出
   - ✅ 使用標準 ISO 8601 時間格式
   - ✅ 解決「沒有找到訂單」的錯誤提示

6. 影響範圍｜Impact
   - 匯出功能現在能正確查詢到訂單
   - 提升用戶體驗，避免錯誤提示
   - 確保日期範圍查詢的準確性
   - 支持完整的時間範圍查詢

7. 相關檔案｜Related files
   - 訂單管理邏輯：`web/src/composables/merchant/useOrders.js`
   - 後端訂單控制器：`server/src/controllers/orderController.js`

### 匯出功能重複執行問題修復｜Fix duplicate export execution issue

*時間：2025-08-22 17:30*

1. 問題描述｜Problem description
   - 匯出歷史訂單時，匯出函數被重複執行兩次
   - 從控制台日誌看到匯出 API 被調用了兩次
   - 用戶體驗不佳，可能導致重複下載檔案
   - 影響系統性能和用戶體驗

2. 問題分析｜Problem analysis
   - 匯出按鈕使用了箭頭函數 `@click="() => exportHistoryOrders('xlsx')"`
   - 每次組件重新渲染時都會創建新的函數實例
   - 可能存在快速點擊或事件冒泡問題
   - 防重複機制需要進一步加強

3. 解決方案｜Solution
   - **改進防重複機制**：
     * 在函數開始時立即設置 `isExporting.value = true`
     * 添加詳細的控制台日誌來追蹤執行流程
     * 使用延遲重置機制（500ms）防止快速重複調用
   - **優化事件處理**：
     * 將箭頭函數改為具名函數 `handleExport`
     * 避免每次渲染時創建新的函數實例
     * 添加按鈕點擊日誌來追蹤事件觸發
   - **加強日誌追蹤**：
     * 在匯出函數開始時記錄調用信息
     * 在狀態設置時記錄狀態變化
     * 在函數完成時記錄執行結果

4. 技術細節｜Technical details
   - **防重複調用檢查**：
     ```javascript
     if (isExporting.value) {
       console.log('匯出進行中，請稍候...')
       return
     }
     isExporting.value = true
     console.log('設置匯出狀態為 true')
     ```
   - **延遲重置機制**：
     ```javascript
     setTimeout(() => {
       isExporting.value = false
       console.log('延遲重置匯出狀態為 false')
     }, 500)
     ```
   - **事件處理優化**：
     ```javascript
     const handleExport = () => {
       console.log('匯出按鈕被點擊')
       exportHistoryOrders('xlsx')
     }
     ```

5. 修正結果｜Results
   - ✅ 防止匯出函數重複執行
   - ✅ 提升用戶體驗，避免重複下載
   - ✅ 完整的日誌追蹤便於調試
   - ✅ 穩定的防重複機制
   - ✅ 優化的事件處理方式

6. 影響範圍｜Impact
   - 匯出功能更加穩定可靠
   - 提升用戶體驗，避免重複操作
   - 減少不必要的 API 調用
   - 提高系統整體穩定性

7. 相關檔案｜Related files
   - 訂單管理邏輯：`web/src/composables/merchant/useOrders.js`
   - 訂單頁面：`web/src/views/merchant/orders/Orders.vue`

### 隱藏訂單數統計顯示
1. 需求描述
   - 隱藏左上角顯示的本週本月本日訂單數
   - 保留日期顯示功能
   - 簡化界面顯示

2. 實現方案
   - 在 Orders.vue 中註釋掉顯示訂單數的 BaseTag 組件
   - 保留日期顯示功能
   - 不影響其他功能

3. 修改內容
   ```vue
   <!-- 隱藏本週本月本日訂單數顯示 -->
   <!-- <BaseTag v-if="activeTab === 'history'" variant="info" size="medium">
     <font-awesome-icon icon="receipt" class="mr-1" />
     {{ timeRangeTitle }}: {{ selectedTimeRangeOrdersCount }}
   </BaseTag> -->
   ```

4. 影響範圍
   - 訂單管理頁面的統計顯示
   - 不影響數據計算和功能邏輯

### 客人組數計算邏輯修正
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
1. 完成內容｜What's done
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
1. 完成內容｜What's done
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

## 2025-08-22 18:40
### 收據菜品分組顯示邏輯實現｜Receipt item grouping display logic implementation
1. 問題描述｜Problem description
   - 桌次訂單包含多個批次的菜品項目
   - 需要將相同菜品但不同選項的項目進行分組顯示
   - 相同菜品相同選項的項目需要合併數量
   - 不同選項的相同菜品需要分別顯示
   - 收據顯示需要清晰易讀，便於顧客理解

2. 問題分析｜Problem analysis
   - **桌次訂單結構複雜**：
     * 一個桌次訂單包含多個批次（orders）
     * 每個批次包含多個菜品項目（items）
     * 每個項目可能有不同的選項組合
   - **菜品分組需求**：
     * 相同菜品名稱 + 相同選項 = 合併數量
     * 相同菜品名稱 + 不同選項 = 分別顯示
     * 需要保持選項的完整性和準確性
   - **顯示邏輯複雜**：
     * 需要處理多種選項格式
     * 需要計算合併後的總價
     * 需要保持原始數據的完整性

3. 解決方案｜Solution
   - **精確項目鍵生成**：
     * 使用菜品ID + 選項組合作為唯一鍵
     * 選項按字母順序排序確保一致性
     * 處理不同選項值格式（字符串、對象等）
   - **智能項目合併**：
     * 完全相同的項目（菜品+選項）合併數量
     * 不同選項的相同菜品分別顯示
     * 保留原始單價和總價信息
   - **選項格式化處理**：
     * 統一選項顯示格式
     * 處理複雜的選項對象結構
     * 確保選項信息的完整性

4. 技術細節｜Technical details
   - **項目鍵生成邏輯**：
     ```javascript
     const optionsKey = item.selectedOptions ? 
       Object.entries(item.selectedOptions)
         .sort(([a], [b]) => a.localeCompare(b)) // 排序確保一致性
         .map(([key, value]) => {
           // 處理不同的選項值格式
           let displayValue = value;
           if (typeof value === 'object' && value !== null) {
             displayValue = value.label || value.name || value.value || JSON.stringify(value);
           }
           return `${key}:${displayValue}`;
         })
         .join('|') : '';
     
     const itemKey = `${item.dishId}-${optionsKey}`;
     ```
   
   - **項目合併邏輯**：
     ```javascript
     if (itemMap.has(itemKey)) {
       // 合併完全相同的項目（包括選項）
       const existingItem = itemMap.get(itemKey);
       existingItem.quantity += item.quantity;
       existingItem.totalPrice += item.totalPrice;
       
       // 確保合併後的項目也有正確的顯示名稱
       if (!existingItem.displayName) {
         existingItem.displayName = existingItem.dishName || existingItem.name;
       }
     } else {
       // 新增項目（可能是相同菜品但選項不同）
       const newItem = {
         ...item,
         dishName: item.dishName || item.name,
         batchNumber: batchIndex + 1,
         originalPrice: item.price,
         originalTotalPrice: item.totalPrice,
         displayName: item.dishName || item.name
       };
       itemMap.set(itemKey, newItem);
     }
     ```
   
   - **最終數據處理**：
     ```javascript
     // 將合併後的項目轉換為陣列，並按菜品名稱排序
     allItems.push(...itemMap.values());
     allItems.sort((a, b) => {
       const nameA = a.dishName || a.displayName || a.name || '';
       const nameB = b.dishName || b.displayName || b.name || '';
       return nameA.localeCompare(nameB);
     });
     
     // 計算所有批次的總金額
     const totalAmount = allItems.reduce((sum, item) => sum + item.totalPrice, 0);
     ```

5. 實現結果｜Results
   - ✅ 實現精確的菜品分組邏輯
   - ✅ 相同菜品相同選項自動合併數量
   - ✅ 不同選項的相同菜品分別顯示
   - ✅ 保持選項信息的完整性和準確性
   - ✅ 按菜品名稱排序，提升可讀性
   - ✅ 正確計算合併後的總金額
   - ✅ 保留原始數據用於調試和驗證

6. 顯示效果｜Display effects
   - **合併顯示**：烏龍茶（吸管:粗|杯子:小|果糖:微糖）x3 = 75元
   - **分別顯示**：
     * 奶茶（吸管:細|杯子:大|果糖:正常|珍珠:無珍珠）x1 = 50元
     * 奶茶（吸管:粗|杯子:小|果糖:正常）x1 = 35元
   - **總計顯示**：所有項目合計 260元

7. 影響範圍｜Impact
   - 桌次訂單收據顯示
   - 收據預覽功能
   - 收據列印功能
   - 訂單歷史查看

8. 相關檔案｜Related files
   - 訂單組合邏輯：`web/src/composables/merchant/useOrders.js`
   - 收據工具函數：`web/src/utils/receiptUtils.js`
   - 收據組件：`web/src/components/receipt/BaseReceipt.vue`

### 經驗總結｜Lessons learned
- 複雜的數據分組邏輯需要精確的鍵值生成策略
- 選項處理需要考慮多種數據格式
- 排序和合併邏輯對用戶體驗很重要
- 保留原始數據有助於調試和驗證
- 清晰的顯示邏輯提升收據的可讀性
- 模組化的代碼結構便於維護和擴展

*時間：2025-08-22 18:40*

## 2025-01-27 歷史訂單匯出功能修復

### 問題描述｜Problem description
在歷史訂單匯出功能中，發現以下問題：
1. **合併邏輯錯誤**：在合併相同菜品時，使用了錯誤的屬性名（`quantity` 和 `subtotal`），應該使用中文屬性名（`數量` 和 `小計`）
2. **Excel 樣式問題**：框線和文字居中設定可能不正確
3. **數據格式不一致**：匯出的數據結構與預期不符

### 修復內容｜Fixes applied

#### 1. 修復合併邏輯錯誤
**問題**：在 `server/src/controllers/orderController.js` 中，合併相同菜品時使用了錯誤的屬性名
```javascript
// 錯誤的代碼
existingItem.quantity += item.quantity;
existingItem.subtotal += (item.totalPrice || (item.unitPrice * item.quantity));
```

**修復**：使用正確的中文屬性名
```javascript
// 修復後的代碼
existingItem['數量'] += item.quantity;
existingItem['小計'] += (item.totalPrice || (item.unitPrice * item.quantity));
```

#### 2. 改進 Excel 樣式設定
**問題**：框線樣式設定不完整，可能導致顯示問題

**修復**：添加完整的樣式設定
```javascript
// 框線樣式
border: {
  top: { style: 'thin', color: { rgb: '000000' } },
  bottom: { style: 'thin', color: { rgb: '000000' } },
  left: { style: 'thin', color: { rgb: '000000' } },
  right: { style: 'thin', color: { rgb: '000000' } }
},
// 對齊方式：水平居中，垂直居中
alignment: {
  horizontal: 'center',
  vertical: 'center',
  wrapText: true
},
// 字體樣式
font: {
  name: '微軟正黑體',
  sz: 11
}
```

#### 3. 添加行高設定
**新增**：為 Excel 工作表設定統一的行高
```javascript
// 設定工作表樣式
worksheet['!rows'] = [];
for (let R = range.s.r; R <= range.e.r; R++) {
  worksheet['!rows'][R] = { hpt: 25 }; // 設定行高
}
```

### 技術細節｜Technical details

#### 合併邏輯流程
1. **項目鍵生成**：基於菜品ID和選項組合生成唯一鍵
2. **合併判斷**：檢查是否已存在相同鍵的項目
3. **數量累加**：合併相同項目的數量和金額
4. **數據轉換**：將 Map 結構轉換為陣列格式

#### Excel 樣式設定
- **框線**：所有儲存格添加黑色細框線
- **對齊**：水平和垂直都居中對齊
- **字體**：使用微軟正黑體，11號字
- **行高**：統一設定為25點
- **自動換行**：啟用文字自動換行

### 影響範圍｜Impact
- 歷史訂單 Excel 匯出功能
- 歷史訂單 CSV 匯出功能
- 訂單數據的合併顯示邏輯

### 相關檔案｜Related files
- `server/src/controllers/orderController.js` - 歷史訂單匯出控制器

### 測試建議｜Testing suggestions
1. 匯出包含相同菜品的歷史訂單
2. 檢查 Excel 檔案中的合併邏輯是否正確
3. 驗證框線和文字對齊是否正常
4. 確認 CSV 匯出功能是否正常

### 經驗總結｜Lessons learned
- 在處理多語言屬性名時，需要特別注意屬性名的一致性
- Excel 樣式設定需要完整的屬性配置
- 合併邏輯的錯誤會影響數據的準確性
- 代碼審查時需要關注數據結構的一致性

*時間：2025-01-27 15:30*

## 2025-01-27 歷史訂單匯出時區問題修復

### 問題描述｜Problem description
在歷史訂單匯出功能中，發現嚴重的時區轉換問題：
1. **時區不一致**：前端和後端使用不同的時區轉換邏輯
2. **日期範圍錯誤**：匯出的訂單日期範圍不正確，可能包含不應該包含的訂單
3. **時區偏移計算錯誤**：使用了系統本地時區偏移，而不是固定的台灣時區

### 問題分析｜Problem analysis

#### 原始問題代碼
```javascript
// 錯誤的時區轉換邏輯
const timezoneOffset = new Date().getTimezoneOffset();
const start = new Date(startDateObj.getTime() - (timezoneOffset * 60 * 1000));
const end = new Date(endDateObj.getTime() - (timezoneOffset * 60 * 1000));
```

**問題所在**：
1. 使用 `new Date().getTimezoneOffset()` 獲取系統本地時區偏移
2. 不同環境（開發機、伺服器）可能有不同的時區設定
3. 與前端時區轉換邏輯不一致

#### 前端時區轉換邏輯
```javascript
// 前端使用固定的台灣時區轉換
const taiwanTimezoneOffset = 8 * 60; // 8小時 = 480分鐘
const start = new Date(startDateObj.getTime() - (taiwanTimezoneOffset * 60 * 1000));
const end = new Date(endDateObj.getTime() - (taiwanTimezoneOffset * 60 * 1000));
```

### 修復內容｜Fixes applied

#### 1. 統一時區轉換邏輯
**修復前**：使用系統本地時區偏移
```javascript
const timezoneOffset = new Date().getTimezoneOffset();
```

**修復後**：使用固定的台灣時區偏移
```javascript
const taiwanTimezoneOffset = 8 * 60; // 8小時 = 480分鐘
```

#### 2. 改進日期範圍處理
**修復前**：直接使用日期對象的時間戳
```javascript
const start = new Date(startDateObj.getTime() - (timezoneOffset * 60 * 1000));
const end = new Date(endDateObj.getTime() - (timezoneOffset * 60 * 1000));
```

**修復後**：構建完整的台灣本地時間範圍
```javascript
// 構建台灣本地時間的開始和結束
const taiwanStart = new Date(startDateObj.getFullYear(), startDateObj.getMonth(), startDateObj.getDate());
const taiwanEnd = new Date(endDateObj.getFullYear(), endDateObj.getMonth(), endDateObj.getDate(), 23, 59, 59, 999);

// 轉換為 UTC 時間：台灣時間 - 8小時 = UTC 時間
start = new Date(taiwanStart.getTime() - (taiwanTimezoneOffset * 60 * 1000));
end = new Date(taiwanEnd.getTime() - (taiwanTimezoneOffset * 60 * 1000));
```

#### 3. 添加詳細的日誌記錄
**新增**：添加時區轉換的詳細日誌
```javascript
console.log('匯出查詢時間範圍:', {
  localDate: startDate,
  utcStart: start.toISOString(),
  utcEnd: end.toISOString(),
  taiwanTimezoneOffset: 'UTC+8 (480分鐘)',
  note: '使用台灣時區轉換邏輯'
});
```

### 技術細節｜Technical details

#### 時區轉換原理
1. **台灣時區**：UTC+8（東八區）
2. **轉換公式**：UTC時間 = 台灣時間 - 8小時
3. **時間戳計算**：減去 480分鐘（8小時 × 60分鐘）

#### 日期範圍處理
1. **開始時間**：設定為當天 00:00:00.000
2. **結束時間**：設定為當天 23:59:59.999
3. **包含邊界**：使用 `$gte` 和 `$lte` 確保包含邊界值

#### 數據庫查詢邏輯
```javascript
query.$or = [
  { completedAt: { $gte: start, $lte: end } },
  { createdAt: { $gte: start, $lte: end } }
];
```

### 影響範圍｜Impact
- 歷史訂單 Excel 匯出功能
- 歷史訂單 CSV 匯出功能
- 所有使用日期範圍過濾的匯出功能

### 相關檔案｜Related files
- `server/src/controllers/orderController.js` - 歷史訂單匯出控制器
  - `exportOrdersToExcel` 函數
  - `exportOrdersToCSV` 函數

### 測試建議｜Testing suggestions
1. 測試不同日期範圍的匯出功能
2. 驗證時區轉換是否正確
3. 檢查匯出的訂單是否在正確的時間範圍內
4. 在不同環境（開發、測試、生產）中測試

### 經驗總結｜Lessons learned
- **時區處理**：必須使用固定的時區偏移，不能依賴系統本地時區
- **前後端一致性**：時區轉換邏輯必須與前端保持一致
- **日期範圍**：需要明確指定開始和結束時間的具體時刻
- **日誌記錄**：添加詳細的時區轉換日誌有助於問題排查
- **環境差異**：不同環境的時區設定可能不同，需要統一處理

### 預防措施｜Prevention measures
1. 在時區相關代碼中添加詳細註釋
2. 使用固定的時區偏移值
3. 添加時區轉換的單元測試
4. 在部署前驗證不同環境的時區設定

*時間：2025-01-27 16:45*

## 2025-01-27 時區問題處理與修復

### 問題描述｜Problem description
在商家後台的歷史訂單統計功能中，發現嚴重的時區轉換問題：
1. **統計數據不準確**：顯示的訂單數量與實際不符
2. **日期範圍錯誤**：查詢的日期範圍不正確，可能包含不應該包含的訂單
3. **時區偏移計算錯誤**：使用了系統本地時區偏移，而不是固定的台灣時區
4. **前後端不一致**：前端和後端的時區處理邏輯不同步

### 問題分析｜Problem analysis

#### 原始問題代碼
```javascript
// 錯誤的時區轉換邏輯
const startOfDay = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate());
const endOfDay = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), 23, 59, 59, 999);
```

**問題所在**：
1. 直接使用 JavaScript Date 構造函數，會使用系統本地時區
2. 不同環境（開發機、伺服器）可能有不同的時區設定
3. 與前端時區轉換邏輯不一致
4. 導致查詢範圍不準確

### 解決方案｜Solution

#### 1. 統一時區轉換邏輯
**修復前**：直接使用系統本地時區
```javascript
const startOfDay = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate());
const endOfDay = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), 23, 59, 59, 999);
```

**修復後**：使用固定的台灣時區轉換
```javascript
// 台灣時區是 UTC+8，所以需要減去 8 小時來轉換為 UTC
const taiwanTimezoneOffset = 8 * 60; // 8小時 = 480分鐘

const taiwanStart = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate());
const taiwanEnd = new Date(selectedDay.getFullYear(), selectedDay.getMonth(), selectedDay.getDate(), 23, 59, 59, 999);

const startOfDay = new Date(taiwanStart.getTime() - (taiwanTimezoneOffset * 60 * 1000));
const endOfDay = new Date(taiwanEnd.getTime() - (taiwanTimezoneOffset * 60 * 1000));
```

#### 2. 修復前一期查詢的時區處理
**修復內容**：
- 日視圖：與前一天比較的時區轉換
- 月視圖：與上個月比較的時區轉換  
- 年視圖：與上一年比較的時區轉換

**修復邏輯**：
```javascript
// 台灣時區是 UTC+8，所以需要減去 8 小時來轉換為 UTC
const taiwanTimezoneOffset = 8 * 60; // 8小時 = 480分鐘

const taiwanStart = new Date(previousDate.getFullYear(), previousDate.getMonth(), previousDate.getDate());
const taiwanEnd = new Date(previousDate.getFullYear(), previousDate.getMonth(), previousDate.getDate() + 1);

const startOfDay = new Date(taiwanStart.getTime() - (taiwanTimezoneOffset * 60 * 1000));
const endOfDay = new Date(taiwanEnd.getTime() - (taiwanTimezoneOffset * 60 * 1000));
```

#### 3. 修復高峰時段查詢的時區處理
**修復內容**：
- 使用 `completedAt` 而非 `createdAt` 進行查詢
- 修正時區轉換邏輯
- 確保查詢範圍準確

**修復邏輯**：
```javascript
// 台灣時區是 UTC+8，所以需要減去 8 小時來轉換為 UTC
const taiwanTimezoneOffset = 8 * 60; // 8小時 = 480分鐘
const sevenDaysAgoUTC = new Date(sevenDaysAgo.getTime() - (taiwanTimezoneOffset * 60 * 1000));

const peakHours = await Order.aggregate([
  { 
    $match: { 
      merchantId: new mongoose.Types.ObjectId(merchantId),
      status: 'completed',
      completedAt: { $gte: sevenDaysAgoUTC }
    } 
  },
  {
    $addFields: {
      // 轉換為台灣時區 (UTC+8)
      localHour: {
        $add: [
          { $hour: '$completedAt' },
          8 // 台灣時區偏移
        ]
      }
    }
  }
]);
```

### 技術細節｜Technical details

#### 時區轉換原理
1. **台灣時區**：UTC+8（東八區）
2. **轉換公式**：UTC時間 = 台灣時間 - 8小時
3. **時間戳計算**：減去 480分鐘（8小時 × 60分鐘）

#### 修復範圍
1. **主要查詢邏輯**：`loadHistoryOrders` 函數
2. **前一期比較**：`previousPeriodQuery` 邏輯
3. **高峰時段查詢**：`peakHours` 聚合查詢
4. **時區轉換統一**：所有日期範圍查詢

#### 數據庫查詢邏輯
```javascript
// 修正後的查詢條件
const query = {
  merchantId: new mongoose.Types.ObjectId(merchantId),
  status: 'completed',
  completedAt: { $gte: startOfDay, $lt: endOfDay }
};
```

### 影響範圍｜Impact
- 商家後台歷史訂單統計功能
- 訂單數量統計準確性
- 營業額計算準確性
- 高峰時段分析功能
- 前一期比較功能

### 相關檔案｜Related files
- `server/src/controllers/reportController.js` - 報表控制器
  - `getOrderStats` 函數
  - 時區轉換邏輯
  - 前一期查詢邏輯
  - 高峰時段查詢邏輯

### 測試建議｜Testing suggestions
1. 測試不同日期範圍的訂單統計
2. 驗證時區轉換是否正確
3. 檢查統計數據是否與實際訂單數量一致
4. 在不同環境（開發、測試、生產）中測試
5. 驗證前一期比較功能的準確性

### 經驗總結｜Lessons learned
- **時區處理**：必須使用固定的時區偏移，不能依賴系統本地時區
- **前後端一致性**：時區轉換邏輯必須與前端保持一致
- **數據準確性**：時區錯誤會導致統計數據完全不準確
- **環境差異**：不同環境的時區設定可能不同，需要統一處理
- **查詢範圍**：需要明確指定開始和結束時間的具體時刻

### 預防措施｜Prevention measures
1. 在時區相關代碼中添加詳細註釋
2. 使用固定的時區偏移值（台灣時區：UTC+8）
3. 添加時區轉換的單元測試
4. 在部署前驗證不同環境的時區設定
5. 建立時區處理的最佳實踐文檔

*時間：2025-01-27 18:00*

### 時區統一：全面使用本地時間
1. 需求描述
   - 系統中時區處理不一致，有些地方寫死使用台北時區（UTC+8）
   - 需要統一使用本地時間，提高系統的通用性和可移植性
   - 確保在不同時區部署時都能正確顯示時間

2. 問題分析
   - 在 `orderController.js` 中發現多處硬編碼的時區偏移
   - 使用 `new Date(now.getTime() + (8 * 60 * 60 * 1000))` 強制轉換為台北時區
   - 這種做法在非台北時區部署時會產生錯誤的時間顯示

3. 解決方案
   - 統一使用本地時間，移除所有硬編碼的時區偏移
   - 使用 `new Date(now.getTime() - (now.getTimezoneOffset() * 60 * 1000))` 獲取本地時間
   - 保留匯出功能中的時區指定，確保匯出格式一致性

4. 技術實現
   ```javascript
   // 修改前：硬編碼台北時區
   const taipeiTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
   
   // 修改後：使用本地時區
   const localTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60 * 1000));
   ```

5. 修改範圍
   - `server/src/controllers/orderController.js` 中的訂單創建時間
   - 移除所有硬編碼的時區偏移計算
   - 保留匯出功能中的 `timeZone: 'Asia/Taipei'` 設定（用於格式一致性）

6. 影響範圍
   - 訂單創建時間的準確性
   - 系統在不同時區部署的兼容性
   - 時間顯示的一致性

7. 測試驗證
   - 訂單創建時間正確顯示為本地時間
   - 系統在不同時區環境下都能正確運作
   - 匯出功能保持原有的時間格式

8. 重要原則
   - **一律使用本地時間**：所有時間相關操作都使用本地時區
   - **避免硬編碼時區**：不寫死特定的時區偏移
   - **保持格式一致性**：匯出功能可指定時區以確保格式統一

### 歷史訂單查詢邏輯優化：使用訂單號碼日期部分
1. 需求描述
   - 歷史訂單查詢時，一律使用訂單號碼中的日期部分進行比對
   - 訂單號碼格式：`T10-202508220006001`，其中 `20250822` 標示了年月日
   - 選擇日期時，透過訂單號碼中的日期部分來判斷是哪一天的訂單
   - 不再依賴資料庫中的 `createdAt` 或 `completedAt` 欄位進行日期查詢

2. 問題分析
   - 原本的歷史訂單查詢使用 `completedAt` 欄位進行日期範圍查詢
   - 這種方式容易受到時區問題影響，在不同時區部署時可能產生錯誤結果
   - 訂單號碼中已經包含了日期信息，應該優先使用這個信息進行查詢

3. 解決方案
   - 修改 `getOrdersByMerchant` 函數，使用訂單號碼中的日期部分進行查詢
   - 修改 `exportHistoryOrders` 函數，同樣使用訂單號碼日期部分
   - 使用正則表達式匹配訂單號碼格式：`^T\d+-YYYYMMDD`

4. 技術實現
   ```javascript
   // 修改前：使用 completedAt 欄位查詢
   query.completedAt = {
     $gte: start,
     $lte: end
   };
   
   // 修改後：使用訂單號碼中的日期部分查詢
   query.orderNumber = {
     $regex: `^T\\d+-${dateStr}`  // dateStr 格式：20250822
   };
   ```

5. 修改範圍
   - `server/src/controllers/orderController.js` 中的 `getOrdersByMerchant` 函數
   - `server/src/controllers/orderController.js` 中的 `exportHistoryOrders` 函數
   - 支援單日查詢和日期範圍查詢

6. 日期範圍查詢處理
   - 對於日期範圍查詢，生成包含所有日期的正則表達式
   - 格式：`^T\d+-20250822|^T\d+-20250823|^T\d+-20250824`
   - 確保查詢結果包含範圍內所有日期的訂單

7. 影響範圍
   - 歷史訂單查詢的準確性
   - 匯出功能的日期過濾
   - 系統在不同時區部署的兼容性

8. 測試驗證
   - 單日查詢：選擇 2025-08-22，查詢訂單號碼包含 20250822 的訂單
   - 日期範圍查詢：選擇 2025-08-22 到 2025-08-24，查詢包含這三天日期的訂單
   - 匯出功能：確保匯出的訂單符合選擇的日期範圍

9. 重要原則
   - **優先使用訂單號碼日期**：所有日期相關查詢都基於訂單號碼中的日期部分
   - **避免時區依賴**：不再依賴資料庫時間欄位進行日期查詢
   - **保持查詢一致性**：歷史訂單查詢和匯出功能使用相同的查詢邏輯

### 時區統一：全面使用本地時間
// ... existing code ...
```

## 2025-08-22 23:00
### 歷史成本保護機制測試與驗證｜Historical cost protection mechanism testing and validation
1. 問題描述｜Problem description
   - 需要驗證系統的歷史成本保護機制是否正常運作
   - 確認修改庫存成本後，舊訂單仍使用歷史成本，新訂單使用新成本
   - 驗證報表統計是否正確反映歷史成本和當前成本的差異
   - 確保財務數據的準確性和一致性

2. 測試目標｜Test objectives
   - 驗證歷史成本保護機制的有效性
   - 確認新成本計算機制的正確性
   - 測試報表統計的準確性
   - 確保系統在不同成本變更場景下的穩定性

3. 測試過程｜Test process

#### 3.1 初始狀態確認
- **測試環境**：Docker 開發環境
- **商家ID**：68a523c58c09949e502a232c
- **測試商品**：珍珠（庫存ID：68a8ea848069c57a5acdfd9e）
- **初始成本**：1元/單位
- **初始訂單**：T2-202508230002000（奶茶含珍珠，總成本6元）

#### 3.2 成本修改測試
- **修改操作**：將珍珠成本從1元調整為5元
- **修改方式**：通過庫存管理API更新成本
- **驗證結果**：
  * 珍珠成本成功更新為5元
  * 庫存記錄中的成本字段正確更新
  * 系統記錄了成本變更歷史

#### 3.3 新訂單測試
- **新訂單**：T2-202508230002001（奶茶含珍珠）
- **成本計算**：
  * 珍珠：1單位 × 5元（新成本）= 5元
  * 吸管：1單位 × 3元 = 3元
  * 封膜：1單位 × 1元 = 1元
  * 杯子：1單位 × 1元 = 1元
  * 果糖：1單位 × 1元 = 1元
  * **總成本**：11元
- **驗證結果**：
  * 新訂單正確使用新的珍珠成本（5元）
  * 成本計算邏輯正確
  * 訂單狀態轉換正常

#### 3.4 報表統計驗證
- **修改前統計**：
  * 總營收：230元
  * 總成本：46元
  * 總利潤：184元
  * 成本率：20.0%
- **修改後統計**：
  * 總營收：265元（+35元）
  * 總成本：57元（+11元）
  * 總利潤：208元（+24元）
  * 成本率：21.5%（+1.5%）
- **驗證結果**：
  * 舊訂單保持原有成本（珍珠1元）
  * 新訂單使用新成本（珍珠5元）
  * 報表統計準確反映成本差異

4. 測試結果｜Test results

#### 4.1 歷史成本保護機制 ✅
- **舊訂單成本保持**：T2-202508230002000 的珍珠成本仍為1元
- **歷史數據完整性**：舊訂單的 `historicalCost` 記錄完整保留
- **成本隔離成功**：歷史訂單和新訂單使用不同的成本計算

#### 4.2 新成本計算機制 ✅
- **新訂單成本正確**：T2-202508230002001 的珍珠成本為5元
- **成本計算準確**：總成本11元，成本率31.4%
- **訂單處理正常**：從創建到完成的整個流程正常

#### 4.3 報表統計準確性 ✅
- **數據一致性**：報表統計與實際訂單數據一致
- **成本率變化合理**：從20.0%上升到21.5%
- **利潤計算正確**：總利潤增加24元，符合預期

5. 技術驗證｜Technical validation

#### 5.1 歷史成本記錄結構
```javascript
historicalCost: {
  totalCost: 6,
  consumptionDetails: [
    {
      inventoryId: "68a8ea848069c57a5acdfd9e",
      inventoryName: "珍珠",
      quantity: 1,
      unitCost: 1,  // 歷史成本：1元
      totalCost: 1,
      type: "base"
    }
  ]
}
```

#### 5.2 新成本計算結構
```javascript
historicalCost: {
  totalCost: 11,
  consumptionDetails: [
    {
      inventoryId: "68a8ea848069c57a5acdfd9e",
      inventoryName: "珍珠",
      quantity: 1,
      unitCost: 5,  // 新成本：5元
      totalCost: 5,
      type: "base"
    }
  ]
}
```

6. 影響範圍｜Impact
- **財務數據準確性**：確保歷史訂單和新訂單的成本計算準確
- **報表統計可靠性**：報表能正確反映不同時期的成本變化
- **系統穩定性**：成本變更不會影響歷史數據的完整性
- **業務決策支持**：提供準確的財務數據支持業務決策

7. 相關檔案｜Related files
- 庫存服務：`server/src/services/inventoryService.js`
- 訂單控制器：`server/src/controllers/orderController.js`
- 報表控制器：`server/src/controllers/reportController.js`
- 前端訂單邏輯：`web/src/composables/merchant/useOrders.js`

8. 經驗總結｜Lessons learned
- **歷史成本保護**：系統必須保護歷史訂單的成本數據，確保財務報表的準確性
- **成本隔離機制**：新舊訂單的成本計算必須完全隔離，避免相互影響
- **數據一致性**：報表統計必須準確反映歷史成本和當前成本的差異
- **測試驗證**：重要功能必須通過完整的測試驗證，確保系統穩定性
- **文檔記錄**：詳細記錄測試過程和結果，便於後續維護和問題排查

9. 預防措施｜Prevention measures
- 建立成本變更的審核機制
- 定期驗證歷史成本保護機制的有效性
- 監控成本變更對財務報表的影響
- 建立成本數據的備份和恢復機制

*時間：2025-08-22 23:00*

## 2025-08-22 23:30
### 統計報表成本計算邏輯修正｜Fix cost calculation logic in statistics report
1. 問題描述｜Problem description
   - 商家後台統計報表的成本計算與歷史訂單報表不一致
   - 統計報表顯示總成本為 0，而歷史訂單報表顯示正確的成本數據
   - 兩個報表使用不同的成本計算邏輯，導致數據不一致
   - 影響財務報表的準確性和可靠性

2. 問題分析｜Problem analysis
   - **統計報表邏輯**：使用 `order.totalCost` 欄位進行成本統計
   - **歷史訂單報表邏輯**：使用 `items.historicalCost.totalCost` 進行成本統計
   - **根本原因**：兩個報表使用了不同的成本數據來源
   - **數據差異**：`order.totalCost` 可能未正確設置，而 `items.historicalCost.totalCost` 在訂單確認時正確記錄

3. 解決方案｜Solution
   - **統一成本計算邏輯**：修改統計報表使用與歷史訂單報表相同的計算方式
   - **使用歷史成本數據**：統計報表改為使用 `items.historicalCost.totalCost`
   - **確保數據一致性**：兩個報表使用相同的成本計算邏輯

4. 技術實現｜Technical implementation
   - **修改統計報表聚合查詢**：
     ```javascript
     // 修改前：使用 order.totalCost
     const totalCost = await Order.aggregate([
       { 
         $match: { 
           merchantId: new mongoose.Types.ObjectId(merchantId),
           status: 'completed',
           ...dateQuery 
         } 
       },
       {
         $group: {
           _id: null,
           totalCost: { $sum: '$totalCost' }
         }
       }
     ]);
     
     // 修改後：使用 items.historicalCost.totalCost
     const totalCost = await Order.aggregate([
       { 
         $match: { 
           merchantId: new mongoose.Types.ObjectId(merchantId),
           status: 'completed',
           ...dateQuery 
         } 
       },
       {
         $unwind: '$items'
       },
       {
         $group: {
           _id: null,
           totalCost: { $sum: '$items.historicalCost.totalCost' }
         }
       }
     ]);
     ```

5. 修正結果｜Results
   - ✅ 統計報表成本計算與歷史訂單報表保持一致
   - ✅ 成本數據準確反映實際的庫存消耗成本
   - ✅ 財務報表的可靠性和準確性得到提升
   - ✅ 兩個報表使用統一的成本計算邏輯

6. 影響範圍｜Impact
   - 商家後台統計報表的成本計算
   - 財務報表的數據準確性
   - 成本分析功能的可靠性
   - 報表數據的一致性

7. 相關檔案｜Related files
   - 報表控制器：`server/src/controllers/reportController.js`
   - 訂單控制器：`server/src/controllers/orderController.js`
   - 前端訂單邏輯：`web/src/composables/merchant/useOrders.js`

8. 經驗總結｜Lessons learned
   - **數據一致性**：不同報表必須使用相同的數據計算邏輯
   - **成本計算標準**：歷史成本數據是成本計算的權威來源
   - **報表驗證**：新功能開發後必須驗證不同報表間的數據一致性
   - **代碼維護**：統一的計算邏輯便於維護和擴展

9. 預防措施｜Prevention measures
   - 建立報表數據一致性檢查機制
   - 統一成本計算的標準和規範
   - 定期驗證不同報表間的數據一致性
   - 建立報表開發的最佳實踐文檔

*時間：2025-08-22 23:30*

## 2025-08-23 00:15
### QR Code 下載功能商家名稱獲取問題修復｜Fix business name retrieval in QR Code download feature
1. 問題描述｜Problem description
   - QR Code 下載功能生成的檔案名稱始終使用預設的「餐廳」名稱
   - 即使 URL 查詢參數中包含正確的餐廳名稱（如：test11），檔案名稱仍顯示為「餐廳-桌次2.png」
   - 影響 QR Code 檔案的可識別性和專業性
   - 用戶無法區分不同餐廳的 QR Code 檔案

2. 問題分析｜Problem analysis
   - **優先級問題**：原本的邏輯優先從 `localStorage` 獲取商家信息，然後才檢查 URL 查詢參數
   - **localStorage 數據干擾**：`localStorage` 中可能存儲了包含商家信息的數據，導致 URL 查詢參數被忽略
   - **日誌顯示**：控制台顯示「使用 URL 查詢參數中的餐廳名稱: test11」，但實際檔案名稱仍為「餐廳」
   - **邏輯順序錯誤**：URL 查詢參數應該是最權威的餐廳名稱來源

3. 解決方案｜Solution
   - **調整優先級順序**：修改商家名稱獲取邏輯，優先使用 URL 查詢參數
   - **統一獲取邏輯**：在 `downloadQRCode` 和 `batchDownloadQRCodes` 兩個函數中統一修改
   - **改進日誌記錄**：添加更詳細的日誌來追蹤商家名稱的獲取過程

4. 技術實現｜Technical implementation
   - **修改前（錯誤的優先級）**：
     ```javascript
     // 先從 localStorage 獲取
     const merchantRaw = localStorage.getItem('merchant_user')
     if (merchantRaw) {
       const merchant = JSON.parse(merchantRaw)
       businessName = merchant.businessName || merchant.name || merchant.merchantName || merchant.restaurantName || '餐廳'
       
       // 只有在 localStorage 中沒有有效名稱時才檢查 URL
       if (businessName === '餐廳') {
         const urlParams = new URLSearchParams(window.location.search)
         const restaurantName = urlParams.get('restaurantName')
         if (restaurantName) {
           businessName = restaurantName
         }
       }
     }
     ```
   
   - **修改後（正確的優先級）**：
     ```javascript
     // 優先從 URL 查詢參數獲取餐廳名稱
     const urlParams = new URLSearchParams(window.location.search)
     const restaurantName = urlParams.get('restaurantName')
     if (restaurantName) {
       businessName = restaurantName
       console.log('從 URL 查詢參數獲取商家名稱:', businessName)
     } else {
       // 如果 URL 中沒有，再嘗試從 localStorage 獲取
       const merchantRaw = localStorage.getItem('merchant_user')
       if (merchantRaw) {
         const merchant = JSON.parse(merchantRaw)
         businessName = merchant.businessName || merchant.name || merchant.merchantName || merchant.restaurantName || '餐廳'
         console.log('從 localStorage 獲取商家名稱:', businessName)
       }
     }
     ```

5. 修正結果｜Results
   - ✅ QR Code 檔案名稱現在正確使用 URL 查詢參數中的餐廳名稱
   - ✅ 檔案名稱格式：`test11-桌次2.png`（而不是 `餐廳-桌次2.png`）
   - ✅ 批量下載功能也使用正確的餐廳名稱
   - ✅ 提升了 QR Code 檔案的可識別性和專業性
   - ✅ 詳細的日誌記錄便於調試和問題排查

6. 影響範圍｜Impact
   - QR Code 單一下載功能
   - QR Code 批量下載功能
   - 檔案命名的一致性
   - 用戶體驗的改善

7. 相關檔案｜Related files
   - 桌次管理頁面：`web/src/views/merchant/tables/Tables.vue`
   - 商家名稱獲取邏輯
   - QR Code 下載功能

8. 經驗總結｜Lessons learned
   - **數據來源優先級**：URL 查詢參數通常是最權威的數據來源，應該優先使用
   - **邏輯順序重要性**：獲取邏輯的順序會直接影響最終結果
   - **日誌調試價值**：詳細的日誌記錄有助於快速定位問題
   - **用戶體驗細節**：檔案命名等細節對用戶體驗有重要影響

9. 預防措施｜Prevention measures
   - 建立數據獲取優先級的標準規範
   - 在涉及多個數據來源的功能中添加詳細日誌
   - 定期檢查用戶體驗相關的細節功能
   - 建立功能測試清單，包含檔案命名等細節

*時間：2025-08-23 00:15*