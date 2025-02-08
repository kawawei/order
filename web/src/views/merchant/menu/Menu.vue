<template>
  <div class="menu-page">
    <header class="page-header">
      <h1>菜單管理</h1>
      <BaseButton variant="primary" @click="handleAddCategory">
        <font-awesome-icon icon="plus" />
        添加種類
      </BaseButton>
    </header>

    <main class="menu-content">
      <BaseTabs
        v-if="categories.length > 0"
        v-model="activeCategory"
        :tabs="categories"
      >
        <BaseTab
          v-for="category in categories"
          :key="category.name"
          :name="category.name"
          :is-active="activeCategory === category.name"
        >
          <div class="category-content">
            <div class="category-header">
              <h2>{{ category.label }}</h2>
              <BaseButton variant="text" @click="handleAddMenuItem(category.name)">
                <font-awesome-icon icon="plus" />
                添加菜品
              </BaseButton>
            </div>
            
            <!-- 菜品列表 -->
            <div class="menu-items">
              <MenuItemCard
                v-for="item in menuItems[category.name]"
                :key="item.id"
                :item="item"
                @edit="handleEditMenuItem(category.name, item)"
                @delete="handleDeleteMenuItem(category.name, item)"
              />
            </div>
          </div>
        </BaseTab>
      </BaseTabs>

      <div v-else class="empty-state">
        <div class="empty-content">
          <font-awesome-icon icon="utensils" size="2x" />
          <h2>還沒有任何菜單種類</h2>
          <p>點擊上方的「添加種類」按鈕開始建立您的菜單</p>
        </div>
      </div>
    </main>
    
    <!-- 添加種類對話框 -->
    <AddCategoryDialog
      v-model="showAddCategoryDialog"
      :categories="categories"
      @confirm="handleConfirmAddCategory"
    />
  </div>
  <AddMenuItemDialog
    v-model="showAddMenuItemDialog"
    :initial-category="currentCategory"
    :editing-item="editingItem"
    @confirm="handleConfirmAddMenuItem"
  />
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
  showAddCategoryDialog,
  showAddMenuItemDialog,
  currentCategory,
  editingItem,
  handleAddCategory,
  handleConfirmAddCategory,
  handleAddMenuItem,
  handleConfirmAddMenuItem,
  handleEditMenuItem,
  handleDeleteMenuItem
} = useMenuPage()
</script>

<style>
/* 樣式已通過 import 引入 */
</style>
