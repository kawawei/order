const Inventory = require('../models/inventory');
const Dish = require('../models/dish');

/**
 * 庫存服務
 */
class InventoryService {
  /**
   * 計算菜品的庫存消耗和成本
   * @param {string} dishId - 菜品ID
   * @param {Array} customOptions - 自定義選項
   * @param {string} sizeOption - 份量選項
   * @returns {Object} 包含消耗詳情和總成本
   */
  async calculateDishConsumption(dishId, customOptions = [], sizeOption = null) {
    try {
      const dish = await Dish.findById(dishId).populate('inventoryConfig.baseInventory.inventoryId');
      if (!dish) {
        throw new Error('菜品不存在');
      }

      let totalCost = 0;
      const consumptionDetails = [];

      // 如果菜品沒有庫存配置，返回默認值
      if (!dish.inventoryConfig) {
        return {
          totalCost: 0,
          consumptionDetails: [],
          dishName: dish.name
        };
      }

      // 計算基礎庫存消耗
      if (dish.inventoryConfig.baseInventory && Array.isArray(dish.inventoryConfig.baseInventory)) {
        for (const item of dish.inventoryConfig.baseInventory) {
          if (!item || !item.inventoryId || !item.quantity) continue;
          
          const inventory = await Inventory.findById(item.inventoryId);
          if (!inventory || !inventory.cost || typeof inventory.cost.unitPrice !== 'number') continue;

          const itemCost = inventory.cost.unitPrice * item.quantity;
          if (!isNaN(itemCost)) {
            totalCost += itemCost;
          }

          consumptionDetails.push({
            inventoryId: item.inventoryId,
            inventoryValueId: item.inventoryValueId || null,
            quantity: item.quantity,
            cost: itemCost,
            type: 'base'
          });
        }
      }

      // 計算條件庫存消耗
      if (dish.inventoryConfig.conditionalInventory && Array.isArray(dish.inventoryConfig.conditionalInventory)) {
        for (const item of dish.inventoryConfig.conditionalInventory) {
          if (!item || !item.inventoryId || !item.conditions || !Array.isArray(item.conditions)) continue;
          
          const inventory = await Inventory.findById(item.inventoryId);
          if (!inventory || !inventory.cost || typeof inventory.cost.unitPrice !== 'number') continue;

          // 檢查自定義選項
          for (const condition of item.conditions) {
            if (!condition || !condition.optionType || !condition.optionValue || !condition.quantity) continue;
            
            const hasOption = customOptions.some(option => 
              option.type === condition.optionType && 
              option.value === condition.optionValue
            );

            if (hasOption) {
              const itemCost = inventory.cost.unitPrice * condition.quantity;
              if (!isNaN(itemCost)) {
                totalCost += itemCost;
              }

              consumptionDetails.push({
                inventoryId: item.inventoryId,
                inventoryValueId: condition.inventoryValueId || null,
                quantity: condition.quantity,
                cost: itemCost,
                type: 'conditional',
                condition: `${condition.optionType}: ${condition.optionValue}`
              });
            }
          }
        }
      }

      return {
        totalCost,
        consumptionDetails,
        dishName: dish.name
      };
    } catch (error) {
      throw new Error(`計算菜品消耗失敗: ${error.message}`);
    }
  }

  /**
   * 扣減庫存
   * @param {Array} consumptionDetails - 消耗詳情
   * @returns {Object} 扣減結果
   */
  async deductInventory(consumptionDetails) {
    try {
      const results = [];
      
      for (const item of consumptionDetails) {
        const inventory = await Inventory.findById(item.inventoryId);
        if (!inventory) {
          results.push({
            inventoryId: item.inventoryId,
            success: false,
            error: '庫存項目不存在'
          });
          continue;
        }

        try {
          // 根據庫存類型扣減
          if (inventory.type === 'single') {
            await inventory.updateStock(null, item.quantity, 'subtract');
          } else if (inventory.type === 'multiSpec') {
            // 多規格庫存需要找到對應的規格值
            const specValue = await this.findSpecValue(inventory, item.inventoryValueId);
            if (specValue) {
              await inventory.updateStock(specValue.specName, item.quantity, 'subtract');
            } else {
              throw new Error('找不到對應的規格值');
            }
          }

          results.push({
            inventoryId: item.inventoryId,
            success: true,
            quantity: item.quantity
          });
        } catch (error) {
          results.push({
            inventoryId: item.inventoryId,
            success: false,
            error: error.message
          });
        }
      }

      return results;
    } catch (error) {
      throw new Error(`扣減庫存失敗: ${error.message}`);
    }
  }

  /**
   * 查找規格值
   * @param {Object} inventory - 庫存對象
   * @param {string} inventoryValueId - 規格值ID
   * @returns {Object|null} 規格值對象
   */
  async findSpecValue(inventory, inventoryValueId) {
    if (inventory.type === 'multiSpec') {
      return inventory.multiSpecStock.find(spec => 
        spec._id.toString() === inventoryValueId.toString()
      );
    }
    return null;
  }

  /**
   * 檢查庫存是否足夠
   * @param {Array} consumptionDetails - 消耗詳情
   * @returns {Object} 檢查結果
   */
  async checkInventoryAvailability(consumptionDetails) {
    try {
      const results = [];
      
      for (const item of consumptionDetails) {
        const inventory = await Inventory.findById(item.inventoryId);
        if (!inventory) {
          results.push({
            inventoryId: item.inventoryId,
            available: false,
            error: '庫存項目不存在'
          });
          continue;
        }

        let available = false;
        let currentStock = 0;

        if (inventory.type === 'single') {
          currentStock = inventory.singleStock.quantity;
          available = currentStock >= item.quantity;
        } else if (inventory.type === 'multiSpec') {
          const specValue = await this.findSpecValue(inventory, item.inventoryValueId);
          if (specValue) {
            currentStock = specValue.quantity;
            available = currentStock >= item.quantity;
          } else {
            available = false;
          }
        }

        results.push({
          inventoryId: item.inventoryId,
          available,
          currentStock,
          requiredQuantity: item.quantity,
          shortage: available ? 0 : item.quantity - currentStock
        });
      }

      return results;
    } catch (error) {
      throw new Error(`檢查庫存可用性失敗: ${error.message}`);
    }
  }
}

module.exports = new InventoryService();
