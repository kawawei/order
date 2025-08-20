import { ref, computed } from 'vue'

/**
 * 庫存計算相關的 composable
 * 用於計算菜品的庫存消耗和檢查庫存是否充足
 * 支持多規格庫存（如：中杯、大杯等）
 */
export function useInventoryCalculation() {
  
  /**
   * 計算菜品的實際庫存消耗
   * @param {Object} dish - 菜品對象，包含 inventoryConfig
   * @param {Object} selectedOptions - 用戶選擇的選項，如 { size: 'large', ice: 'normal' }
   * @returns {Object} 庫存消耗對象，格式：{ inventoryId_inventoryValueId: quantity }
   */
  const calculateDishInventoryUsage = (dish, selectedOptions = {}) => {
    if (!dish.inventoryConfig) {
      return {}
    }
    
    let totalUsage = {}
    
    // 計算基礎庫存消耗
    if (dish.inventoryConfig.baseInventory) {
      dish.inventoryConfig.baseInventory.forEach(item => {
        if (item.inventoryId && item.inventoryValueId && item.quantity) {
          const key = `${item.inventoryId}_${item.inventoryValueId}`
          totalUsage[key] = (totalUsage[key] || 0) + parseFloat(item.quantity)
        }
      })
    }
    
    // 計算條件庫存消耗
    if (dish.inventoryConfig.conditionalInventory) {
      dish.inventoryConfig.conditionalInventory.forEach(item => {
        if (item.inventoryId) {
          // 檢查是否有匹配的條件
          if (item.conditions && item.conditions.length > 0) {
            item.conditions.forEach(condition => {
              if (condition.optionType && 
                  condition.optionValue && 
                  condition.inventoryValueId &&
                  condition.quantity &&
                  selectedOptions[condition.optionType] === condition.optionValue) {
                
                const key = `${item.inventoryId}_${condition.inventoryValueId}`
                totalUsage[key] = (totalUsage[key] || 0) + parseFloat(condition.quantity)
              }
            })
          }
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
      Object.keys(itemUsage).forEach(key => {
        totalUsage[key] = (totalUsage[key] || 0) + (itemUsage[key] * (item.quantity || 1))
      })
    })
    
    return totalUsage
  }
  
  /**
   * 檢查庫存是否充足
   * @param {Object} inventoryUsage - 庫存消耗對象，格式：{ inventoryId_inventoryValueId: quantity }
   * @param {Array} availableInventory - 可用庫存列表
   * @returns {Object} 檢查結果，包含 isSufficient 和 insufficientItems
   */
  const checkInventorySufficiency = (inventoryUsage, availableInventory) => {
    const insufficientItems = []
    let isSufficient = true
    
    Object.keys(inventoryUsage).forEach(key => {
      const [inventoryId, inventoryValueId] = key.split('_')
      const inventory = availableInventory.find(inv => inv._id === inventoryId)
      
      if (!inventory) {
        insufficientItems.push({
          inventoryId,
          inventoryValueId,
          name: '未知庫存',
          required: inventoryUsage[key],
          available: 0,
          shortfall: inventoryUsage[key]
        })
        isSufficient = false
        return
      }
      
      // 查找對應的庫存值
      let currentStock = 0
      if (inventory.type === 'single') {
        currentStock = inventory.singleStock.quantity
      } else if (inventory.type === 'multiSpec') {
        const spec = inventory.multiSpecStock.find(s => s._id === inventoryValueId)
        if (spec) {
          currentStock = spec.quantity
        }
      }
      
      if (currentStock < inventoryUsage[key]) {
        insufficientItems.push({
          inventoryId,
          inventoryValueId,
          name: `${inventory.name}${inventory.type === 'multiSpec' ? ` (${getSpecName(inventory, inventoryValueId)})` : ''}`,
          required: inventoryUsage[key],
          available: currentStock,
          shortfall: inventoryUsage[key] - currentStock
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
   * 獲取規格名稱
   * @param {Object} inventory - 庫存對象
   * @param {String} inventoryValueId - 庫存值ID
   * @returns {String} 規格名稱
   */
  const getSpecName = (inventory, inventoryValueId) => {
    if (inventory.type === 'multiSpec' && inventory.multiSpecStock) {
      const spec = inventory.multiSpecStock.find(s => s._id === inventoryValueId)
      return spec ? spec.specName : ''
    }
    return ''
  }
  
  /**
   * 獲取庫存消耗的詳細說明
   * @param {Object} inventoryUsage - 庫存消耗對象
   * @param {Array} availableInventory - 可用庫存列表
   * @returns {Array} 詳細說明數組
   */
  const getInventoryUsageDetails = (inventoryUsage, availableInventory) => {
    return Object.keys(inventoryUsage).map(key => {
      const [inventoryId, inventoryValueId] = key.split('_')
      const inventory = availableInventory.find(inv => inv._id === inventoryId)
      
      if (!inventory) {
        return {
          inventoryId,
          inventoryValueId,
          name: '未知庫存',
          category: '',
          unit: '',
          required: inventoryUsage[key],
          available: 0,
          isUnlimited: false
        }
      }
      
      let unit = ''
      let currentStock = 0
      let specName = ''
      
      if (inventory.type === 'single') {
        unit = inventory.singleStock.unit
        currentStock = inventory.singleStock.quantity
      } else if (inventory.type === 'multiSpec') {
        const spec = inventory.multiSpecStock.find(s => s._id === inventoryValueId)
        if (spec) {
          unit = spec.unit
          currentStock = spec.quantity
          specName = spec.specName
        }
      }
      
      return {
        inventoryId,
        inventoryValueId,
        name: `${inventory.name}${specName ? ` (${specName})` : ''}`,
        category: inventory.category,
        unit: unit,
        required: inventoryUsage[key],
        available: currentStock,
        isUnlimited: currentStock === -1
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
  
  /**
   * 格式化庫存消耗顯示
   * @param {Object} inventoryUsage - 庫存消耗對象
   * @param {Array} availableInventory - 可用庫存列表
   * @returns {Array} 格式化的顯示數組
   */
  const formatInventoryUsageDisplay = (inventoryUsage, availableInventory) => {
    return Object.keys(inventoryUsage).map(key => {
      const [inventoryId, inventoryValueId] = key.split('_')
      const inventory = availableInventory.find(inv => inv._id === inventoryId)
      
      if (!inventory) {
        return {
          key,
          displayName: '未知庫存',
          quantity: inventoryUsage[key],
          unit: ''
        }
      }
      
      let unit = ''
      let specName = ''
      
      if (inventory.type === 'single') {
        unit = inventory.singleStock.unit
      } else if (inventory.type === 'multiSpec') {
        const spec = inventory.multiSpecStock.find(s => s._id === inventoryValueId)
        if (spec) {
          unit = spec.unit
          specName = spec.specName
        }
      }
      
      return {
        key,
        displayName: `${inventory.name}${specName ? ` (${specName})` : ''}`,
        quantity: inventoryUsage[key],
        unit: unit
      }
    })
  }
  
  return {
    calculateDishInventoryUsage,
    calculateOrderInventoryUsage,
    checkInventorySufficiency,
    getInventoryUsageDetails,
    estimateDishInventoryUsage,
    formatInventoryUsageDisplay
  }
}
