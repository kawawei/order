<template>
  <div class="menu-page">
    <header class="page-header">
      <h1>菜單管理</h1>
      <BaseButton variant="primary" @click="handleAddCategory">
        <font-awesome-icon icon="cog" />
        種類管理
      </BaseButton>
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
  </div>
</template>

<script setup>
import { useMenuPage } from '../../../composables/merchant/useMenuPage'
import AddCategoryDialog from '../../../components/merchant/menu/AddCategoryDialog.vue'
import AddMenuItemDialog from '../../../components/merchant/menu/AddMenuItemDialog.vue'
import MenuItemCard from '../../../components/merchant/menu/MenuItemCard.vue'
import '../../../assets/styles/menu.css'

const {
  categories,
  activeCategory,
  menuItems,
  loading,
  error,
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
  handleDeleteMenuItem
} = useMenuPage()
</script>

<style>
/* 樣式已通過 import 引入 */
</style>
