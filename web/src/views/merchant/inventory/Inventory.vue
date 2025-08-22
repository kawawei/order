<template>
  <div class="inventory-container">
    <!-- 頁面標題 -->
    <div class="page-header">
      <h1 class="page-title">庫存管理</h1>
      <div class="header-buttons">
        <button @click="showImportModal = true" class="btn btn-secondary">
          <font-awesome-icon icon="upload" class="mr-2" />
          匯入原料
        </button>
        <button @click="showAddModal = true" class="btn btn-primary">
          <font-awesome-icon icon="plus" class="mr-2" />
          新增原料
        </button>
      </div>
    </div>

    <!-- 統計卡片 -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">
          <font-awesome-icon icon="box" />
        </div>
        <div class="stat-content">
          <h3 class="stat-number">{{ totalItems }}</h3>
          <p class="stat-label">原料種類</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon warning">
          <font-awesome-icon icon="exclamation-triangle" />
        </div>
        <div class="stat-content">
          <h3 class="stat-number">{{ lowStockItems }}</h3>
          <p class="stat-label">庫存不足</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon danger">
          <font-awesome-icon icon="times-circle" />
        </div>
        <div class="stat-content">
          <h3 class="stat-number">{{ outOfStockItems }}</h3>
          <p class="stat-label">缺貨項目</p>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon success">
          <font-awesome-icon icon="dollar-sign" />
        </div>
        <div class="stat-content">
          <h3 class="stat-number">${{ totalValue.toFixed(2) }}</h3>
          <p class="stat-label">總庫存價值</p>
        </div>
      </div>
    </div>

    <!-- 搜尋和篩選 -->
    <div class="filters-section">
      <div class="search-box">
        <font-awesome-icon icon="search" class="search-icon" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜尋原料名稱..."
          class="search-input"
        />
      </div>
      <div class="filter-buttons">
        <button
          v-for="category in categories"
          :key="category.value"
          @click="filterByCategory(category.value)"
          :class="['filter-btn', { active: selectedCategory === category.value }]"
        >
          {{ category.label }}
        </button>
        <button @click="openCategoryModal" class="btn btn-secondary category-manage-btn">
          <font-awesome-icon icon="tags" class="mr-2" />
          管理分類
        </button>
      </div>
    </div>

    <!-- 原料列表 -->
    <div class="inventory-table">
      <table>
        <thead>
          <tr>
            <th>原料名稱</th>
            <th>分類</th>
            <th>型號數量</th>
            <th>總庫存</th>
            <th>單位</th>
            <th>成本範圍</th>
            <th>庫存狀態</th>
            <th>最後更新</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="item in filteredItems" :key="item._id">
          <tr :class="getRowClass(item)">
            <td>
              <div class="item-info">
                <span class="item-name">{{ item.name }}</span>
                <span v-if="item.description" class="item-description">{{ item.description }}</span>
              </div>
            </td>
            <td>
              <span class="category-badge" :class="getCategoryClass(item.category)">
                {{ getCategoryLabel(item.category) }}
              </span>
            </td>
            <td>
              <span class="model-count">{{ item.type === 'multiSpec' ? item.multiSpecStock.length : 1 }} 個型號</span>
            </td>
            <td>
              <span class="quantity" :class="getQuantityClass(item)">
                {{ getTotalQuantity(item) }}
              </span>
            </td>
            <td>{{ item.singleStock?.unit || item.multiSpecStock[0]?.unit }}</td>
            <td>
              <div v-if="hasVariants(item)">
                <span class="variant-badge">多規格</span>
                <div class="variant-summary">{{ getVariantCostRangeText(item) }}</div>
              </div>
              <div v-else>
                ${{ item.cost.unitPrice.toFixed(2) }} × {{ item.singleStock.quantity }} {{ item.singleStock.unit }} = ${{ (item.cost.unitPrice * item.singleStock.quantity).toFixed(2) }}
              </div>
            </td>
            <td>
              <span class="status-badge" :class="getStatusClass(item)">
                {{ getStatusText(item) }}
              </span>
            </td>
            <td>{{ formatDate(item.updatedAt) }}</td>
            <td>
              <div class="action-buttons">
                <button @click="editItem(item)" class="btn-icon" title="編輯">
                  <font-awesome-icon icon="edit" />
                </button>
                <button @click="adjustStock(item)" class="btn-icon" title="調整庫存">
                  <font-awesome-icon icon="plus-minus" />
                </button>
                <button @click="deleteItem(item)" class="btn-icon danger" title="刪除">
                  <font-awesome-icon icon="trash" />
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="hasVariants(item)" :key="`variants-${item._id}`" class="variant-details-row">
            <td colspan="9">
              <div class="variant-chip-list">
                <span
                  v-for="(v, idx) in item.multiSpecStock"
                  :key="idx"
                  :class="['variant-chip', { 
                    'out-of-stock-variant': v.quantity === 0,
                    'low-stock-variant': v.quantity > 0 && v.quantity <= v.minStock 
                  }]"
                >
                  {{ v.specName }} ${{ Number(v.unitPrice).toFixed(2) }} × {{ v.quantity }} {{ v.unit }} = ${{ (Number(v.unitPrice) * v.quantity).toFixed(2) }}
                </span>
              </div>
            </td>
          </tr>
          </template>
        </tbody>
      </table>
    </div>

    <!-- 新增/編輯原料模態框 -->
    <div v-if="showAddModal || showEditModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>{{ showEditModal ? '編輯原料' : '新增原料' }}</h2>
          <button @click="closeModal" class="btn-close">
            <font-awesome-icon icon="times" />
          </button>
        </div>
        <form @submit.prevent="submitForm" class="modal-form">
          <div class="form-group">
            <label for="name">原料名稱 *</label>
            <input
              id="name"
              v-model="formData.name"
              type="text"
              required
              placeholder="例如：杯子、吸管、茶葉"
            />
          </div>
          <div class="form-group">
            <label for="description">描述</label>
            <textarea
              id="description"
              v-model="formData.description"
              placeholder="原料的詳細描述（可選）"
              rows="3"
            ></textarea>
          </div>
          <div class="form-group">
            <label for="category">分類 *</label>
            <select id="category" v-model="formData.category" required>
              <option value="">請選擇分類</option>
              <option v-for="cat in categories" :key="cat.value" :value="cat.value">
                {{ cat.label }}
              </option>
            </select>
          </div>
          <div class="form-group">
            <label for="type">原料類型 *</label>
            <select id="type" v-model="formData.type" required>
              <option value="single">單一物品</option>
              <option value="multiSpec">多規格</option>
            </select>
          </div>
          <div v-if="formData.type === 'single'">
            <div class="form-group">
              <label for="singleUnit">單位 *</label>
              <input
                id="singleUnit"
                v-model="formData.singleStock.unit"
                type="text"
                required
                placeholder="例如：包、個、公斤"
              />
            </div>
            <div class="form-group">
              <label for="singleCost">成本 (元) *</label>
              <input
                id="singleCost"
                v-model.number="formData.cost.unitPrice"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.00"
              />
            </div>
            <div class="form-group">
              <label for="singleQuantity">初始庫存數量 *</label>
              <input
                id="singleQuantity"
                v-model.number="formData.singleStock.quantity"
                type="number"
                min="0"
                required
                placeholder="0"
              />
            </div>
            <div class="form-group">
              <label for="singleMinStock">最低庫存警告</label>
              <input
                id="singleMinStock"
                v-model.number="formData.singleStock.minStock"
                type="number"
                min="0"
                placeholder="低於此數量時會顯示警告"
              />
            </div>
            <div class="form-group">
              <label for="singleMaxStock">最高庫存警告</label>
              <input
                id="singleMaxStock"
                v-model.number="formData.singleStock.maxStock"
                type="number"
                min="0"
                placeholder="高於此數量時會顯示警告"
              />
            </div>
          </div>
          <div v-else class="form-group">
            <div class="variants-header">
              <span>規格與庫存</span>
              <button type="button" class="btn btn-secondary" @click="addVariant">
                <font-awesome-icon icon="plus" class="mr-2" />新增規格
              </button>
            </div>
            <div v-if="formData.multiSpecStock.length === 0" class="variants-empty">尚未新增任何規格</div>
            <div v-for="(variant, index) in formData.multiSpecStock" :key="index" class="variant-row">
              <div class="variant-input-group">
                <label :for="`variant-name-${index}`">規格名稱</label>
                <input
                  :id="`variant-name-${index}`"
                  v-model="variant.specName"
                  type="text"
                  placeholder="如：大 / 中 / 小"
                />
              </div>
              <div class="variant-input-group">
                <label :for="`variant-unit-${index}`">單位</label>
                <input
                  :id="`variant-unit-${index}`"
                  v-model="variant.unit"
                  type="text"
                  placeholder="如：個、包、支"
                />
              </div>
              <div class="variant-input-group">
                <label :for="`variant-quantity-${index}`">庫存數量</label>
                <input
                  :id="`variant-quantity-${index}`"
                  v-model.number="variant.quantity"
                  type="number"
                  min="0"
                  placeholder="0"
                />
              </div>
              <div class="variant-input-group">
                <label :for="`variant-cost-${index}`">單價 (元) *</label>
                <input
                  :id="`variant-cost-${index}`"
                  v-model.number="variant.unitPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  placeholder="0.00"
                />
              </div>
              <div class="variant-input-group">
                <label :for="`variant-minStock-${index}`">最低庫存</label>
                <input
                  :id="`variant-minStock-${index}`"
                  v-model.number="variant.minStock"
                  type="number"
                  min="0"
                  placeholder="0"
                />
              </div>
              <button type="button" class="btn-icon danger" @click="removeVariant(index)" title="刪除">
                <font-awesome-icon icon="trash" />
              </button>
            </div>
          </div>
          <div class="form-group">
            <label for="status">狀態</label>
            <select id="status" v-model="formData.status" required>
              <option value="active">正常</option>
              <option value="inactive">停用</option>
            </select>
          </div>
          <div class="form-group">
            <label for="notes">備註</label>
            <textarea
              id="notes"
              v-model="formData.notes"
              placeholder="其他備註（可選）"
              rows="3"
            ></textarea>
          </div>
          <div class="form-actions">
            <button type="button" @click="closeModal" class="btn btn-secondary">
              取消
            </button>
            <button type="submit" class="btn btn-primary">
              {{ showEditModal ? '更新' : '新增' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 調整庫存模態框 -->
    <div v-if="showStockModal" class="modal-overlay" @click="closeStockModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h2>調整庫存 - {{ selectedItem?.name }}</h2>
          <button @click="closeStockModal" class="btn-close">
            <font-awesome-icon icon="times" />
          </button>
        </div>
        <form @submit.prevent="submitStockAdjustment" class="modal-form">
          <div class="form-group" v-if="hasVariants(selectedItem)">
            <label for="variantSelect">規格</label>
            <select id="variantSelect" v-model.number="stockForm.variantIndex" required>
              <option v-for="(v, idx) in selectedItem.multiSpecStock" :key="idx" :value="idx">
                {{ v.specName }}（現有：{{ v.quantity }} {{ v.unit }}）
              </option>
            </select>
          </div>
          <div class="form-group">
            <label for="adjustmentType">調整類型</label>
            <select id="adjustmentType" v-model="stockForm.type" required>
              <option value="add">增加庫存</option>
              <option value="subtract">減少庫存</option>
              <option value="set">設定庫存</option>
            </select>
          </div>
          <div class="form-group">
            <label for="adjustmentQuantity">數量</label>
            <input
              id="adjustmentQuantity"
              v-model="stockForm.quantity"
              type="number"
              min="0"
              required
              :placeholder="stockPlaceholder"
            />
          </div>
          <div class="form-group">
            <label for="adjustmentReason">調整原因</label>
            <textarea
              id="adjustmentReason"
              v-model="stockForm.reason"
              placeholder="例如：採購入庫、盤點調整、損耗等"
              rows="3"
            ></textarea>
          </div>
          <div class="form-actions">
            <button type="button" @click="closeStockModal" class="btn btn-secondary">
              取消
            </button>
            <button type="submit" class="btn btn-primary">
              確認調整
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- 匯入原料模態框 -->
    <div v-if="showImportModal" class="modal-overlay" @click="closeImportModal">
      <div class="modal-content import-modal" @click.stop>
        <div class="modal-header">
          <h2>匯入庫存項目</h2>
          <button @click="closeImportModal" class="btn-close">
            <font-awesome-icon icon="times" />
          </button>
        </div>
        
        <div class="import-content">
          <!-- 檔案上傳區域 -->
          <div class="upload-section">
            <div class="upload-area" @click="triggerFileInput" @drop="handleFileDrop" @dragover.prevent>
              <div v-if="!importForm.file" class="upload-placeholder">
                <font-awesome-icon icon="upload" size="3x" />
                <h3>選擇 Excel 或 CSV 檔案</h3>
                <p>拖拽檔案到此處或點擊選擇檔案</p>
                <p class="file-types">支援格式：.xlsx, .xls, .csv</p>
              </div>
              <div v-else class="file-selected">
                <font-awesome-icon icon="file-excel" size="2x" />
                <div class="file-info">
                  <h4>{{ importForm.file.name }}</h4>
                  <p>{{ formatFileSize(importForm.file.size) }}</p>
                </div>
                <button @click.stop="removeFile" class="btn-remove">
                  <font-awesome-icon icon="times" />
                </button>
              </div>
            </div>
            <input
              ref="fileInput"
              type="file"
              accept=".xlsx,.xls,.csv"
              @change="handleFileSelect"
              class="hidden"
            />
          </div>

          <!-- 格式說明 -->
          <div class="format-guide">
            <h3>匯入格式說明</h3>
            <div class="format-table">
              <table>
                <thead>
                  <tr>
                    <th>欄位名稱</th>
                    <th>必填</th>
                    <th>說明</th>
                    <th>範例</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>原料名稱</td>
                    <td>✓</td>
                    <td>庫存項目名稱</td>
                    <td>果糖、吸管、杯子</td>
                  </tr>
                  <tr>
                    <td>庫存分類</td>
                    <td>✓</td>
                    <td>分類名稱</td>
                    <td>食材、耗材、包裝</td>
                  </tr>
                  <tr>
                    <td>原料類型</td>
                    <td>✓</td>
                    <td>單一規格 或 多規格</td>
                    <td>單一規格</td>
                  </tr>
                  <tr>
                    <td>規格名稱</td>
                    <td>多規格必填</td>
                    <td>多規格時填寫</td>
                    <td>粗、細、大、中、小</td>
                  </tr>
                  <tr>
                    <td>單位</td>
                    <td>✓</td>
                    <td>計量單位</td>
                    <td>cc、根、杯</td>
                  </tr>
                  <tr>
                    <td>庫存</td>
                    <td>✓</td>
                    <td>當前庫存數量</td>
                    <td>10000</td>
                  </tr>
                  <tr>
                    <td>單價</td>
                    <td>✓</td>
                    <td>單價（數字）</td>
                    <td>1.00</td>
                  </tr>
                  <tr>
                    <td>最低庫存</td>
                    <td></td>
                    <td>最低庫存警告</td>
                    <td>100</td>
                  </tr>
                  <tr>
                    <td>最高庫存</td>
                    <td></td>
                    <td>最高庫存警告</td>
                    <td>1000</td>
                  </tr>
                  <tr>
                    <td>狀態</td>
                    <td></td>
                    <td>正常、停用</td>
                    <td>正常</td>
                  </tr>
                  <tr>
                    <td>描述</td>
                    <td></td>
                    <td>項目描述</td>
                    <td>調味用果糖</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- 匯入結果 -->
          <div v-if="importResult" class="import-result">
            <h3>匯入結果</h3>
            <div class="result-summary">
              <div v-if="importResult.created > 0" class="result-item success">
                <font-awesome-icon icon="check-circle" />
                <span>成功創建：{{ importResult.created }} 個項目</span>
              </div>
              <div v-if="importResult.updated > 0" class="result-item success">
                <font-awesome-icon icon="check-circle" />
                <span>成功更新：{{ importResult.updated }} 個項目</span>
              </div>
              <div v-if="importResult.failed > 0" class="result-item error">
                <font-awesome-icon icon="times-circle" />
                <span>失敗：{{ importResult.failed }} 個項目</span>
              </div>
            </div>
            
            <div v-if="importResult.results && importResult.results.length > 0" class="result-details">
              <h4>詳細結果</h4>
              <div class="result-list">
                <div 
                  v-for="(result, index) in importResult.results" 
                  :key="index"
                  :class="['result-row', { success: result.success, error: !result.success }]"
                >
                  <span class="item-name">{{ result.name }}</span>
                  <span class="item-category">{{ result.category }}</span>
                  <span v-if="result.success" class="status-success">
                    <font-awesome-icon icon="check" />
                    {{ result.action === 'updated' ? '更新' : '創建' }}
                  </span>
                  <span v-else class="status-error">
                    <font-awesome-icon icon="times" />
                    {{ result.error }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 操作按鈕 -->
          <div class="import-actions">
            <button 
              @click="submitImport" 
              :disabled="!importForm.file || importing"
              class="btn btn-primary"
            >
              <font-awesome-icon v-if="importing" icon="spinner" spin />
              {{ importing ? '匯入中...' : '開始匯入' }}
            </button>
            <button @click="closeImportModal" class="btn btn-secondary">
              取消
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 分類管理模態框 -->
    <div v-if="showCategoryModal" class="modal-overlay" @click="closeCategoryModal">
      <div class="modal-content category-modal" @click.stop>
        <div class="modal-header">
          <h2>管理庫存分類</h2>
          <button @click="closeCategoryModal" class="btn-close">
            <font-awesome-icon icon="times" />
          </button>
        </div>
        <div class="modal-body">
          <!-- 新增分類表單 -->
          <div class="add-category-form">
            <h3>新增分類</h3>
            <form @submit.prevent="submitCategoryForm" class="category-form">
              <div class="form-group">
                <label for="categoryName">分類名稱 *</label>
                <input
                  id="categoryName"
                  v-model="categoryForm.name"
                  type="text"
                  required
                  placeholder="例如：設備、清潔用品"
                />
              </div>
              <div class="form-group">
                <label for="categoryDescription">描述</label>
                <textarea
                  id="categoryDescription"
                  v-model="categoryForm.description"
                  placeholder="分類描述（可選）"
                  rows="2"
                ></textarea>
              </div>
              <div class="form-actions">
                <button type="button" @click="closeCategoryModal" class="btn btn-secondary">
                  取消
                </button>
                <button type="submit" class="btn btn-primary">
                  新增分類
                </button>
              </div>
            </form>
          </div>

          <!-- 分類列表 -->
          <div class="category-list">
            <h3>現有分類</h3>
            <div class="category-items">
              <div
                v-for="category in categories.filter(c => c.value)"
                :key="category.value"
                class="category-item"
              >
                <div class="category-info">
                  <span class="category-name">
                    {{ category.label }}
                  </span>
                  <span v-if="category.description" class="category-description">
                    {{ category.description }}
                  </span>
                  <span v-if="category.isSystem" class="system-badge">預設</span>
                </div>
                <div class="category-actions">
                  <button
                    @click="openCategoryEditModal(category)"
                    class="btn-icon"
                    title="編輯"
                  >
                    <font-awesome-icon icon="edit" />
                  </button>
                  <button
                    @click="deleteCategory(category)"
                    class="btn-icon danger"
                    title="刪除"
                  >
                    <font-awesome-icon icon="trash" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 編輯分類模態框 -->
    <div v-if="showCategoryEditModal" class="modal-overlay" @click="closeCategoryModal">
      <div class="modal-content category-modal" @click.stop>
        <div class="modal-header">
          <h2>編輯分類 - {{ selectedCategoryForEdit?.label }}</h2>
          <button @click="closeCategoryModal" class="btn-close">
            <font-awesome-icon icon="times" />
          </button>
        </div>
        <form @submit.prevent="submitCategoryForm" class="modal-form">
          <div class="form-group">
            <label for="editCategoryName">分類名稱 *</label>
            <input
              id="editCategoryName"
              v-model="categoryForm.name"
              type="text"
              required
              placeholder="分類名稱"
            />
          </div>
          <div class="form-group">
            <label for="editCategoryDescription">描述</label>
            <textarea
              id="editCategoryDescription"
              v-model="categoryForm.description"
              placeholder="分類描述（可選）"
              rows="2"
            ></textarea>
          </div>
          <div class="form-actions">
            <button type="button" @click="closeCategoryModal" class="btn btn-secondary">
              取消
            </button>
            <button type="submit" class="btn btn-primary">
              更新分類
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import {
  // 響應式數據
  searchQuery,
  selectedCategory,
  showAddModal,
  showEditModal,
  showStockModal,
  showImportModal,
  showCategoryModal,
  showCategoryEditModal,
  selectedItem,
  selectedCategoryForEdit,
  loading,
  error,
  formData,
  stockForm,
  importForm,
  categoryForm,
  inventoryItems,
  stats,
  categories,
  importing,
  importResult,
  fileInput,
  
  // 計算屬性
  filteredItems,
  totalItems,
  lowStockItems,
  outOfStockItems,
  totalValue,
  stockPlaceholder,
  
  // 方法
  filterByCategory,
  getCategoryLabel,
  getCategoryClass,
  hasVariants,
  getTotalQuantity,
  getVariantCostRangeText,
  getQuantityClass,
  getStatusClass,
  getStatusText,
  getRowClass,
  formatDate,
  editItem,
  adjustStock,
  deleteItem,
  closeModal,
  closeStockModal,
  closeImportModal,
  resetForm,
  addVariant,
  removeVariant,
  submitForm,
  submitStockAdjustment,
  triggerFileInput,
  handleFileSelect,
  handleFileDrop,
  removeFile,
  formatFileSize,
  submitImport,
  openCategoryModal,
  openCategoryEditModal,
  closeCategoryModal,
  resetCategoryForm,
  submitCategoryForm,
  deleteCategory,
  initData
} from './inventory.js'

// 初始化
initData()
</script>

<style src="./Inventory.css" scoped></style>
