import { ref, computed } from 'vue'

/**
 * 庫存計算相關的 composable
 * 用於計算菜品的庫存消耗和檢查庫存是否充足
 */
export function useInventoryCalculation() {
  
  /**
   * 計算菜品的實際庫存消耗
   * @param {Object} dish - 菜品對象，包含 inventoryConfig
   * @param {Object} selectedOptions - 用戶選擇的選項，如 { size: 'large', ice: 'normal' }
   * @returns {Object} 庫存消耗對象，格式：{ inventoryId: quantity }
   */
  const calculateDishInventoryUsage = (dish, selectedOptions = {}) => {
    if (!dish.inventoryConfig) {
      return {}
    }
    
    let totalUsage = {}
    
    // 計算基礎庫存消耗
    if (dish.inventoryConfig.baseInventory) {
      dish.inventoryConfig.baseInventory.forEach(item => {
        if (item.inventoryId && item.quantity) {
          totalUsage[item.inventoryId] = (totalUsage[item.inventoryId] || 0) + item.quantity
        }
      })
    }
    
    // 計算條件庫存消耗
    if (dish.inventoryConfig.conditionalInventory) {
      dish.inventoryConfig.conditionalInventory.forEach(item => {
        if (item.inventoryId && item.baseQuantity) {
          let quantity = item.baseQuantity
          
          // 根據選項調整數量
          if (item.conditions && item.conditions.length > 0) {
            item.conditions.forEach(condition => {
              if (condition.optionType && 
                  condition.optionValue && 
                  selectedOptions[condition.optionType] === condition.optionValue) {
                quantity = quantity * (condition.multiplier || 1) + (condition.additionalQuantity || 0)
              }
            })
          }
          
          totalUsage[item.inventoryId] = (totalUsage[item.inventoryId] || 0) + quantity
        }
      })
    }
    
    return totalUsage
  }
  
  /**
   * 計算訂單的總庫存消耗
   * @param {Array} orderItems - 訂單項目數組，每個項目包含 dish 和 selectedOptions
   * @returns {Object} 總庫存消耗對象
   */
  const calculateOrderInventoryUsage = (orderItems) => {
    let totalUsage = {}
    
    orderItems.forEach(item => {
      const itemUsage = calculateDishInventoryUsage(item.dish, item.selectedOptions)
      
      // 累加數量
      Object.keys(itemUsage).forEach(inventoryId => {
        totalUsage[inventoryId] = (totalUsage[inventoryId] || 0) + (itemUsage[inventoryId] * (item.quantity || 1))
      })
    })
    
    return totalUsage
  }
  
  /**
   * 檢查庫存是否充足
   * @param {Object} inventoryUsage - 庫存消耗對象
   * @param {Array} availableInventory - 可用庫存列表
   * @returns {Object} 檢查結果，包含 isSufficient 和 insufficientItems
   */
  const checkInventorySufficiency = (inventoryUsage, availableInventory) => {
    const insufficientItems = []
    let isSufficient = true
    
    Object.keys(inventoryUsage).forEach(inventoryId => {
      const inventory = availableInventory.find(inv => inv._id === inventoryId)
      if (!inventory) {
        insufficientItems.push({
          inventoryId,
          name: '未知庫存',
          required: inventoryUsage[inventoryId],
          available: 0,
          shortfall: inventoryUsage[inventoryId]
        })
        isSufficient = false
      } else if (inventory.stock !== -1 && inventory.stock < inventoryUsage[inventoryId]) {
        insufficientItems.push({
          inventoryId,
          name: inventory.name,
          required: inventoryUsage[inventoryId],
          available: inventory.stock,
          shortfall: inventoryUsage[inventoryId] - inventory.stock
        })
        isSufficient = false
      }
    })
    
    return {
      isSufficient,
      insufficientItems
    }
  }
  
  /**
   * 獲取庫存消耗的詳細說明
   * @param {Object} inventoryUsage - 庫存消耗對象
   * @param {Array} availableInventory - 可用庫存列表
   * @returns {Array} 詳細說明數組
   */
  const getInventoryUsageDetails = (inventoryUsage, availableInventory) => {
    return Object.keys(inventoryUsage).map(inventoryId => {
      const inventory = availableInventory.find(inv => inv._id === inventoryId)
      return {
        inventoryId,
        name: inventory ? inventory.name : '未知庫存',
        category: inventory ? inventory.category : '',
        unit: inventory ? inventory.unit : '',
        required: inventoryUsage[inventoryId],
        available: inventory ? inventory.stock : 0,
        isUnlimited: inventory ? inventory.stock === -1 : false
      }
    })
  }
  
  /**
   * 預估庫存消耗（用於菜品編輯時的預覽）
   * @param {Object} dish - 菜品對象
   * @param {Object} previewOptions - 預覽選項
   * @returns {Object} 預估庫存消耗
   */
  const estimateDishInventoryUsage = (dish, previewOptions = {}) => {
    return calculateDishInventoryUsage(dish, previewOptions)
  }
  
  return {
    calculateDishInventoryUsage,
    calculateOrderInventoryUsage,
    checkInventorySufficiency,
    getInventoryUsageDetails,
    estimateDishInventoryUsage
  }
}
