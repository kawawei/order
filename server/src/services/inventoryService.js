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
      console.log(`\n=== 計算菜品消耗: ${dishId} ===`);
      console.log('自定義選項:', customOptions);
      
      const dish = await Dish.findById(dishId).populate('inventoryConfig.baseInventory.inventoryId');
      if (!dish) {
        throw new Error('菜品不存在');
      }

      console.log(`菜品名稱: ${dish.name}`);
      console.log(`庫存配置:`, dish.inventoryConfig ? '存在' : '不存在');

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
        console.log(`基礎庫存項目數量: ${dish.inventoryConfig.baseInventory.length}`);
        
        for (const item of dish.inventoryConfig.baseInventory) {
          if (!item || !item.inventoryId || !item.quantity) {
            console.log('跳過無效的基礎庫存項目:', item);
            continue;
          }
          
          console.log(`處理基礎庫存項目: ${item.inventoryId}, 數量: ${item.quantity}`);
          
          const inventory = await Inventory.findById(item.inventoryId);
          if (!inventory) {
            console.log(`找不到庫存: ${item.inventoryId}`);
            continue;
          }

          let unitCost = 0;
          let specName = '';

          // 處理多規格庫存
          if (inventory.type === 'multiSpec' && item.inventoryValueId) {
            const spec = await this.findSpecValue(inventory, item.inventoryValueId);
            if (spec) {
              unitCost = spec.unitPrice;
              specName = spec.specName;
              console.log(`多規格庫存: ${inventory.name} (${specName}), 單價: $${unitCost}`);
            } else {
              console.log(`找不到規格: ${item.inventoryValueId} 在庫存 ${inventory.name} 中`);
            }
          } else {
            // 處理單一規格庫存
            unitCost = inventory.cost.unitPrice;
            console.log(`單一規格庫存: ${inventory.name}, 單價: $${unitCost}`);
          }

          if (typeof unitCost !== 'number' || isNaN(unitCost)) {
            console.log(`無效的單位成本: ${unitCost}`);
            continue;
          }

          const itemCost = unitCost * item.quantity;
          if (!isNaN(itemCost)) {
            totalCost += itemCost;
            console.log(`項目成本: $${unitCost} × ${item.quantity} = $${itemCost}`);
          }

          consumptionDetails.push({
            inventoryId: item.inventoryId,
            inventoryValueId: item.inventoryValueId || null,
            quantity: item.quantity,
            cost: itemCost,
            type: 'base',
            specName: specName
          });
        }
      }

      // 計算條件庫存消耗
      if (dish.inventoryConfig.conditionalInventory && Array.isArray(dish.inventoryConfig.conditionalInventory)) {
        console.log(`條件庫存項目數量: ${dish.inventoryConfig.conditionalInventory.length}`);
        
        for (const item of dish.inventoryConfig.conditionalInventory) {
          if (!item || !item.inventoryId || !item.conditions || !Array.isArray(item.conditions)) {
            console.log('跳過無效的條件庫存項目:', item);
            continue;
          }
          
          console.log(`處理條件庫存項目: ${item.inventoryId}`);
          
          const inventory = await Inventory.findById(item.inventoryId);
          if (!inventory) {
            console.log(`找不到條件庫存: ${item.inventoryId}`);
            continue;
          }

          // 檢查自定義選項
          for (const condition of item.conditions) {
            if (!condition || !condition.optionType || !condition.optionValue || !condition.quantity) {
              console.log('跳過無效的條件:', condition);
              continue;
            }
            
            console.log(`檢查條件: ${condition.optionType} = ${condition.optionValue}`);
            
            const hasOption = customOptions.some(option => 
              option.type === condition.optionType && 
              option.value === condition.optionValue
            );

            if (hasOption) {
              console.log(`條件匹配: ${condition.optionType} = ${condition.optionValue}`);
              
              let unitCost = 0;
              let specName = '';

              // 處理多規格庫存
              if (inventory.type === 'multiSpec' && condition.inventoryValueId) {
                const spec = await this.findSpecValue(inventory, condition.inventoryValueId);
                if (spec) {
                  unitCost = spec.unitPrice;
                  specName = spec.specName;
                  console.log(`條件多規格庫存: ${inventory.name} (${specName}), 單價: $${unitCost}`);
                } else {
                  console.log(`找不到條件規格: ${condition.inventoryValueId} 在庫存 ${inventory.name} 中`);
                }
              } else {
                // 處理單一規格庫存
                unitCost = inventory.cost.unitPrice;
                console.log(`條件單一規格庫存: ${inventory.name}, 單價: $${unitCost}`);
              }

              if (typeof unitCost !== 'number' || isNaN(unitCost)) {
                console.log(`無效的條件單位成本: ${unitCost}`);
                continue;
              }

              const itemCost = unitCost * condition.quantity;
              if (!isNaN(itemCost)) {
                totalCost += itemCost;
                console.log(`條件項目成本: $${unitCost} × ${condition.quantity} = $${itemCost}`);
              }

              consumptionDetails.push({
                inventoryId: item.inventoryId,
                inventoryValueId: condition.inventoryValueId || null,
                quantity: condition.quantity,
                cost: itemCost,
                type: 'conditional',
                condition: `${condition.optionType}: ${condition.optionValue}`,
                specName: specName
              });
            } else {
              console.log(`條件不匹配: ${condition.optionType} = ${condition.optionValue}`);
            }
          }
        }
      }

      console.log(`\n=== 菜品消耗計算完成 ===`);
      console.log(`總成本: $${totalCost}`);
      console.log(`消耗詳情數量: ${consumptionDetails.length}`);
      consumptionDetails.forEach((detail, index) => {
        console.log(`  ${index + 1}. ${detail.type} - 成本: $${detail.cost}${detail.specName ? ` (${detail.specName})` : ''}`);
      });
      
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
   * @param {string} inventoryValueId - 規格值ID或名稱
   * @returns {Object|null} 規格值對象
   */
  async findSpecValue(inventory, inventoryValueId) {
    console.log(`[DEBUG] 查找規格值: 庫存=${inventory.name}, 類型=${inventory.type}, 查找值=${inventoryValueId}`);
    
    if (inventory.type === 'multiSpec') {
      console.log(`[DEBUG] 多規格庫存，可用規格:`, inventory.multiSpecStock.map(s => ({
        _id: s._id.toString(),
        specName: s.specName
      })));
      
      // 首先嘗試按ID匹配
      let spec = inventory.multiSpecStock.find(spec => 
        spec._id.toString() === inventoryValueId.toString()
      );
      
      if (spec) {
        console.log(`[DEBUG] 按ID找到規格: ${spec.specName}`);
        return spec;
      }
      
      // 如果按ID找不到，嘗試按名稱匹配
      spec = inventory.multiSpecStock.find(spec => 
        spec.specName === inventoryValueId
      );
      
      if (spec) {
        console.log(`[DEBUG] 按名稱找到規格: ${spec.specName}`);
        return spec;
      }
      
      // 如果還是找不到，使用第一個可用規格作為默認值
      if (inventory.multiSpecStock && inventory.multiSpecStock.length > 0) {
        const defaultSpec = inventory.multiSpecStock[0];
        console.log(`[DEBUG] 使用默認規格: ${defaultSpec.specName} (原查找值: ${inventoryValueId})`);
        return defaultSpec;
      }
      
      console.log(`[DEBUG] 找不到規格值: ${inventoryValueId}`);
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
