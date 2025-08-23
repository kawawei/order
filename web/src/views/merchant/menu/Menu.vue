<template>
  <div class="menu-page">
    <header class="page-header">
      <h1>菜單管理</h1>
              <div class="header-actions">
          <button @click="handleImportMenu" class="btn btn-secondary">
            <font-awesome-icon icon="upload" />
            匯入菜單
          </button>
          <button @click="handleImportImages" class="btn btn-secondary">
            <font-awesome-icon icon="image" />
            匯入圖片
          </button>
        <BaseButton variant="primary" @click="handleAddCategory">
          <font-awesome-icon icon="cog" />
          種類管理
        </BaseButton>
      </div>
    </header>

    <main class="menu-content">
      <BaseTabs
        v-if="categories.length > 0"
        v-model="activeCategory"
        :tabs="categories.map(c => ({ name: c._id, label: c.label }))"
      >
        <BaseTab
          v-for="category in categories"
          :key="category._id"
          :name="category._id"
          :is-active="activeCategory === category._id"
        >
          <div class="category-content">
            <div class="category-header">
              <h2>{{ category.label }}</h2>
              <BaseButton variant="text" @click="handleAddMenuItem(category._id)">
                <font-awesome-icon icon="plus" />
                添加菜品
              </BaseButton>
            </div>
            
            <!-- 菜品列表 -->
            <div class="menu-items">
              <div v-if="loading" class="loading-state">
                載入中...
              </div>
              <div v-else-if="menuItems[category._id]?.length === 0" class="empty-items">
                <p>此分類還沒有菜品</p>
              </div>
              <MenuItemCard
                v-else
                v-for="item in menuItems[category._id]"
                :key="item._id"
                :item="item"
                :available-inventory="availableInventory"
                @edit="handleEditMenuItem(category._id, item)"
                @delete="handleDeleteMenuItem(category._id, item)"
              />
            </div>
          </div>
        </BaseTab>
      </BaseTabs>

      <div v-else class="empty-state">
        <div class="empty-content">
          <font-awesome-icon icon="utensils" size="2x" />
          <h2>還沒有任何菜單種類</h2>
          <p>點擊上方的「種類管理」按鈕開始建立您的菜單</p>
        </div>
      </div>
    </main>
    
    <!-- 添加種類對話框 -->
    <AddCategoryDialog
      v-model="showAddCategoryDialog"
      :categories="categories"
      @confirm="handleConfirmAddCategory"
      @update-category="handleUpdateCategory"
      @delete-category="handleDeleteCategory"
    />
    
    <!-- 添加菜品對話框 -->
    <AddMenuItemDialog
      v-model="showAddMenuItemDialog"
      :initial-category="currentCategory"
      :editing-item="editingItem"
      @confirm="handleConfirmAddMenuItem"
    />

    <!-- 匯入菜單對話框 -->
    <ImportDialog
      v-model:show="showImportDialog"
      title="匯入菜單"
      description="請上傳包含菜單資料的 Excel 或 CSV 檔案。"
      :instructions="importInstructions"
      :format-guide="menuFormatGuide"
      :on-import="handleImportMenuData"
      @import-success="handleImportSuccess"
    />

    <!-- 匯入圖片對話框 -->
    <ImportImagesDialog
      v-model:show="showImportImagesDialog"
      @import-success="handleImportImagesSuccess"
    />
  </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useMenuPage } from '../../../composables/merchant/useMenuPage'
import { useAuth } from '../../../composables/useAuth'
import AddCategoryDialog from '../../../components/merchant/menu/AddCategoryDialog.vue'
import AddMenuItemDialog from '../../../components/merchant/menu/AddMenuItemDialog.vue'
import MenuItemCard from '../../../components/merchant/menu/MenuItemCard.vue'
import ImportDialog from '../../../components/common/ImportDialog.vue'
import ImportImagesDialog from '../../../components/merchant/menu/ImportImagesDialog.vue'
import '../../../assets/styles/menu.css'

const route = useRoute()
const router = useRouter()
const { user } = useAuth()

// 檢查超級管理員是否有餐廳ID參數
if (user.value?.role === 'admin' && !route.query.restaurantId) {
  console.warn('超級管理員訪問菜單頁面缺少 restaurantId 參數，重定向到餐廳列表')
  router.push({ name: 'AdminRestaurants' })
}

const {
  categories,
  activeCategory,
  menuItems,
  loading,
  error,
  availableInventory,
  showAddCategoryDialog,
  showAddMenuItemDialog,
  currentCategory,
  editingItem,
  handleAddCategory,
  handleConfirmAddCategory,
  handleUpdateCategory,
  handleDeleteCategory,
  handleAddMenuItem,
  handleConfirmAddMenuItem,
  handleEditMenuItem,
  handleDeleteMenuItem,
  handleImportMenu,
  showImportDialog,
  importInstructions,
  menuFormatGuide,
  handleImportMenuData,
  handleImportSuccess,
  handleImportImages,
  showImportImagesDialog,
  handleImportImagesSuccess
} = useMenuPage(route.query.restaurantId)
</script>

<style>
/* 樣式已通過 import 引入 */
</style>
