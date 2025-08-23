<template>
  <div class="customer-menu">
    <!-- 頭部 -->
    <div class="menu-header">
      <div class="restaurant-info">
        <h1>{{ restaurantInfo.name }}</h1>
        <p class="description">{{ restaurantInfo.description }}</p>
      </div>
      
      <!-- 桌號顯示 -->
      <div class="table-info" v-if="tableInfo.tableNumber">
        <div class="table-display">
          <div class="table-main">
            <span class="table-label">桌號</span>
            <span class="table-number">{{ tableInfo.tableNumber }}</span>
          </div>
          <div class="table-details" v-if="tableInfo.tableName || tableInfo.capacity">
            <span v-if="tableInfo.tableName" class="table-name">{{ tableInfo.tableName }}</span>
            <span v-if="tableInfo.capacity" class="table-capacity">{{ tableInfo.capacity }}人桌</span>
          </div>
        </div>
      </div>
      
      <!-- 購物車按鈕 -->
      <div style="margin-left: auto;">
        <BaseButton 
          variant="primary" 
          @click="showCart = true"
          class="cart-button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="m1 1 4 4 2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          購物車 ({{ cartTotalItems }})
        </BaseButton>
      </div>
      

    </div>

    <!-- 分類標籤 -->
    <div class="category-tabs">
      <BaseTag
        v-for="category in categories"
        :key="category._id"
        :variant="selectedCategory === category._id ? 'primary' : 'default'"
        :onClick="() => selectCategory(category._id)"
        size="medium"
      >
        {{ category.label }}
      </BaseTag>
    </div>

    <!-- 菜單項目 -->
    <div class="menu-items">
      <BaseCard
        v-for="item in filteredMenuItems"
        :key="item.id"
        elevation="low"
        :hoverable="true"
        class="menu-item-card"
      >
        <div class="item-content">
          <!-- 菜品圖片 -->
          <div class="item-image">
            <img :src="resolveImage(item.image) || '/api/placeholder/120/120'" :alt="item.name">
          </div>

          <!-- 菜品信息 -->
          <div class="item-info">
            <div class="item-header">
              <h3>{{ item.name }}</h3>
              <div class="price">NT$ {{ item.basePrice }}</div>
            </div>
            
            <p class="description" v-if="item.description">{{ item.description }}</p>

            <!-- 選項預覽 -->
            <div class="options-preview" v-if="item.options && item.options.length > 0">
              <span class="options-label">可選：</span>
              <BaseTag
                v-for="optionType in item.options.slice(0, 2)"
                :key="optionType"
                variant="default"
                size="small"
              >
                {{ getOptionGroupLabel(optionType) }}
              </BaseTag>
              <span v-if="item.options.length > 2" class="more-options">
                +{{ item.options.length - 2 }}項
              </span>
            </div>

            <!-- 加入購物車按鈕 -->
            <div class="item-actions">
              <BaseButton
                variant="primary"
                size="medium"
                @click="orderItem(item)"
              >
                加入購物車
              </BaseButton>
            </div>
          </div>
        </div>
      </BaseCard>
    </div>

          <!-- 購物車模態框 -->
      <BaseDialog
        v-model="showCart"
        title="購物車"
        size="medium"
      >

        <div class="cart-items">
          <!-- 空購物車提示 -->
          <div v-if="cartItems.length === 0" class="empty-cart">
            <p>購物車是空的</p>
            <p>請選擇您想要的餐點</p>
          </div>
          
          <div
            v-for="(cartItem, index) in cartItems"
            :key="`${cartItem.id}-${index}`"
            class="cart-item"
          >
            <div class="cart-item-info">
              <h4>{{ cartItem.name }}</h4>
              <div class="cart-item-options" v-if="cartItem.selectedOptions">
                <BaseTag
                  v-for="(option, optionKey) in cartItem.selectedOptions"
                  :key="optionKey"
                  variant="default"
                  size="small"
                >
                  {{ option.label }}
                  <span v-if="option.price && option.price !== 0">+NT$ {{ option.price }}</span>
                </BaseTag>
              </div>
            </div>
            <div class="cart-item-controls">
              <div class="quantity-controls">
                <BaseButton
                  variant="secondary"
                  size="small"
                  @click.stop="updateQuantity(index, cartItem.quantity - 1)"
                  icon="minus"
                />
                <span class="quantity">{{ cartItem.quantity }}</span>
                <BaseButton
                  variant="secondary"
                  size="small"
                  @click.stop="updateQuantity(index, cartItem.quantity + 1)"
                  icon="plus"
                />
              </div>
              <div class="item-total">NT$ {{ cartItem.totalPrice }}</div>
            </div>
          </div>
        </div>

        <template #footer>
          <div class="cart-footer">
            <div class="cart-total">
              <strong>總計：NT$ {{ cartTotal }}</strong>
            </div>
            <BaseButton
              variant="primary"
              size="large"
              @click.stop="proceedToCheckout"
              :disabled="cartItems.length === 0 || isOrderSubmitting"
            >
              {{ isOrderSubmitting ? '處理中...' : '送出' }}
            </BaseButton>
          </div>
        </template>
      </BaseDialog>

    <!-- 選項選擇對話框 -->
    <BaseDialog 
      v-model="showOptionsDialog" 
      :title="`${selectedItem?.name} - 選擇選項`"
      size="medium"
    >

      <div class="options-dialog-content" v-if="selectedItem">
        <div
          v-for="optionType in selectedItem.options"
          :key="optionType"
          class="option-group"
        >
          <h4>{{ getOptionGroupLabel(optionType) }}</h4>
          <div class="option-list">
            <BaseTag
              v-for="option in getOptions(optionType)"
              :key="option.name"
              :variant="selectedOptions[optionType]?.name === option.name ? 'primary' : 'default'"
              :onClick="() => selectOption(optionType, option)"
              size="medium"
            >
              {{ option.label }}
              <span v-if="option.price">+NT$ {{ option.price }}</span>
            </BaseTag>
          </div>
        </div>

        <div class="dialog-price">
          <strong>價格：NT$ {{ calculateItemPrice() }}</strong>
        </div>
      </div>

      <template #footer>
        <BaseButton variant="secondary" @click="showOptionsDialog = false">
          取消
        </BaseButton>
        <BaseButton variant="primary" @click.stop="addConfiguredItemToCart" :disabled="isSubmitting">
          {{ isSubmitting ? '處理中...' : '確認送出' }}
        </BaseButton>
      </template>
    </BaseDialog>
  </div>
</template>

<script>
// Import external script file - 引入外部腳本文件
import MenuScript from './Menu.js'
import BaseCard from '../../components/base/BaseCard.vue'
import BaseButton from '../../components/base/BaseButton.vue'
import BaseTag from '../../components/base/BaseTag.vue'
import BaseDialog from '../../components/base/BaseDialog.vue'

export default {
  components: {
    BaseCard,
    BaseButton,
    BaseTag,
    BaseDialog
  },
  ...MenuScript
}
</script>

<style scoped>
/* Import external CSS file - 引入外部CSS文件 */
@import './Menu.css';
</style>
