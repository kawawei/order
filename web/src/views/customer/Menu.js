// Customer Menu Script - 客戶菜單腳本
import { ref, computed } from 'vue'

export default {
  setup() {
    // 餐廳信息 - Restaurant Information
    const restaurantInfo = ref({
      name: '美味小館',
      description: '提供新鮮美味的台式料理，歡迎品嚐我們的招牌菜色'
    })

    // 桌號信息 - Table Information
    const tableInfo = ref({
      tableNumber: null
    })

    // 分類數據 - Category Data
    const categories = ref([
      { id: 'all', name: '全部' },
      { id: 'main', name: '主餐' },
      { id: 'side', name: '小菜' },
      { id: 'drink', name: '飲品' },
      { id: 'dessert', name: '甜點' }
    ])

    // 選中的分類 - Selected Category
    const selectedCategory = ref('all')

    // 菜單項目 - Menu Items
    const menuItems = ref([
      {
        id: 1,
        name: '紅燒牛肉麵',
        description: '精選牛肉慢燉，湯頭濃郁，麵條Q彈',
        basePrice: 180,
        category: 'main',
        image: null,
        options: ['size', 'extra']
      },
      {
        id: 2,
        name: '宮保雞丁',
        description: '經典川菜，香辣下飯',
        basePrice: 120,
        category: 'main',
        image: null,
        options: ['extra']
      },
      {
        id: 3,
        name: '涼拌小黃瓜',
        description: '清爽開胃，夏日首選',
        basePrice: 60,
        category: 'side',
        image: null,
        options: []
      },
      {
        id: 4,
        name: '珍珠奶茶',
        description: '香濃奶茶配上Q彈珍珠',
        basePrice: 45,
        category: 'drink',
        image: null,
        options: ['size', 'sugar', 'ice']
      }
    ])

    // 購物車 - Shopping Cart
    const cartItems = ref([])
    const showCart = ref(false)

    // 選項對話框 - Options Dialog
    const showOptionsDialog = ref(false)
    const selectedItem = ref(null)
    const selectedOptions = ref({})

    // 選項組標籤映射 - Option Group Label Mapping
    const optionGroupLabels = {
      size: '份量',
      extra: '加料',
      sugar: '甜度',
      ice: '冰塊'
    }

    // 選項數據 - Option Data
    const optionData = {
      size: [
        { name: 'small', label: '小份', price: -20 },
        { name: 'regular', label: '標準', price: 0 },
        { name: 'large', label: '大份', price: 30 }
      ],
      extra: [
        { name: 'none', label: '不加料', price: 0 },
        { name: 'extra_meat', label: '加肉', price: 30 },
        { name: 'extra_vegetables', label: '加菜', price: 15 }
      ],
      sugar: [
        { name: 'no_sugar', label: '無糖', price: 0 },
        { name: 'half_sugar', label: '半糖', price: 0 },
        { name: 'normal_sugar', label: '正常糖', price: 0 },
        { name: 'extra_sugar', label: '多糖', price: 0 }
      ],
      ice: [
        { name: 'no_ice', label: '去冰', price: 0 },
        { name: 'less_ice', label: '少冰', price: 0 },
        { name: 'normal_ice', label: '正常冰', price: 0 }
      ]
    }

    // 計算屬性 - Computed Properties
    const filteredMenuItems = computed(() => {
      if (selectedCategory.value === 'all') {
        return menuItems.value
      }
      return menuItems.value.filter(item => item.category === selectedCategory.value)
    })

    const cartTotal = computed(() => {
      return cartItems.value.reduce((total, item) => total + item.totalPrice, 0)
    })

    // 方法 - Methods
    const selectCategory = (categoryId) => {
      selectedCategory.value = categoryId
    }

    const getOptionGroupLabel = (type) => {
      return optionGroupLabels[type] || type
    }

    const getOptions = (type) => {
      return optionData[type] || []
    }

    const showItemOptions = (item) => {
      selectedItem.value = item
      selectedOptions.value = {}
      
      // 設置默認選項 - Set Default Options
      item.options.forEach(optionType => {
        const options = getOptions(optionType)
        if (options.length > 0) {
          selectedOptions.value[optionType] = options.find(opt => opt.price === 0) || options[0]
        }
      })
      
      showOptionsDialog.value = true
    }

    const selectOption = (optionType, option) => {
      selectedOptions.value[optionType] = option
    }

    const calculateItemPrice = () => {
      if (!selectedItem.value) return 0
      
      let price = selectedItem.value.basePrice
      Object.values(selectedOptions.value).forEach(option => {
        price += option.price || 0
      })
      return price
    }

    // 直接添加到購物車（無選項商品）- Direct add to cart for items without options
    const addToCart = (item) => {
      const cartItem = {
        id: item.id,
        name: item.name,
        basePrice: item.basePrice,
        quantity: 1,
        totalPrice: item.basePrice,
        selectedOptions: null
      }
      
      cartItems.value.push(cartItem)
    }

    // 新的點餐方法 - New order method
    const orderItem = (item) => {
      // 如果商品沒有選項，直接加入購物車 - If item has no options, add to cart directly
      if (!item.options || item.options.length === 0) {
        addToCart(item)
        return
      }
      
      // 如果有選項，先執行點餐動作（加入購物車），然後顯示選項對話框 - If has options, first order then show options dialog
      const cartItem = {
        id: item.id,
        name: item.name,
        basePrice: item.basePrice,
        quantity: 1,
        totalPrice: item.basePrice,
        selectedOptions: null // 初始時沒有選項 - No options initially
      }
      
      // 先加入購物車 - Add to cart first
      cartItems.value.push(cartItem)
      
      // 然後顯示選項對話框 - Then show options dialog
      showItemOptions(item)
    }

    const addConfiguredItemToCart = () => {
      // 找到最後一個相同 ID 的商品（剛剛加入的）- Find the last item with same ID (just added)
      let lastItemIndex = -1
      for (let i = cartItems.value.length - 1; i >= 0; i--) {
        if (cartItems.value[i].id === selectedItem.value.id && cartItems.value[i].selectedOptions === null) {
          lastItemIndex = i
          break
        }
      }
      
      if (lastItemIndex !== -1) {
        // 更新已存在的商品選項 - Update existing item options
        const item = cartItems.value[lastItemIndex]
        item.selectedOptions = { ...selectedOptions.value }
        item.totalPrice = calculateItemPrice()
      } else {
        // 如果找不到，則新增商品（備用方案）- If not found, add new item (fallback)
        const cartItem = {
          id: selectedItem.value.id,
          name: selectedItem.value.name,
          basePrice: selectedItem.value.basePrice,
          quantity: 1,
          totalPrice: calculateItemPrice(),
          selectedOptions: { ...selectedOptions.value }
        }
        cartItems.value.push(cartItem)
      }
      
      showOptionsDialog.value = false
    }

    const updateQuantity = (index, newQuantity) => {
      if (newQuantity <= 0) {
        cartItems.value.splice(index, 1)
      } else {
        const item = cartItems.value[index]
        item.quantity = newQuantity
        item.totalPrice = (item.basePrice + 
          Object.values(item.selectedOptions || {}).reduce((sum, opt) => sum + (opt.price || 0), 0)
        ) * newQuantity
      }
    }

    const proceedToCheckout = () => {
      if (cartItems.value.length === 0) {
        alert('購物車是空的')
        return
      }

      // 創建訂單對象
      const order = {
        id: Date.now().toString(),
        status: 'pending',
        createdAt: new Date(),
        tableNumber: tableInfo.value.tableNumber,
        totalAmount: cartTotal.value,
        items: cartItems.value.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          totalPrice: item.totalPrice,
          selectedOptions: item.selectedOptions
        }))
      }

      // 將訂單保存到 localStorage
      try {
        localStorage.setItem('currentOrder', JSON.stringify(order))
        
        // 清空購物車
        cartItems.value = []
        showCart.value = false
        
        // 顯示成功消息
        alert(`點餐成功！\n總金額：NT$ ${order.totalAmount}\n您可以在點餐紀錄中查看詳細內容`)
        
        console.log('訂單已創建:', order)
      } catch (error) {
        console.error('保存訂單失敗:', error)
        alert('訂單保存失敗，請重試')
      }
    }

    // 初始化桌號 - Initialize Table Number
    const initializeTable = () => {
      // 首先檢查 sessionStorage 中是否有桌次資訊（來自 QR Code 掃描）
      try {
        const storedTableInfo = sessionStorage.getItem('currentTable')
        if (storedTableInfo) {
          const tableData = JSON.parse(storedTableInfo)
          tableInfo.value.tableNumber = tableData.tableNumber
          tableInfo.value.tableName = tableData.tableName || null
          tableInfo.value.capacity = tableData.capacity
          tableInfo.value.uniqueCode = tableData.uniqueCode
          
          // 更新餐廳資訊
          if (tableData.merchant) {
            restaurantInfo.value.name = tableData.merchant.businessName || '餐廳'
            restaurantInfo.value.description = `${tableData.merchant.businessType || ''}` + 
              (tableData.merchant.address ? ` | ${tableData.merchant.address}` : '')
            restaurantInfo.value.phone = tableData.merchant.phone
            restaurantInfo.value.businessHours = tableData.merchant.businessHours
          }
          
          return // 如果有 sessionStorage 資料，就不需要檢查 URL 參數
        }
      } catch (error) {
        console.error('解析 sessionStorage 中的桌次資訊失敗:', error)
      }
      
      // 如果沒有 sessionStorage 資料，則從 URL 參數獲取桌號（兼容性處理）
      const urlParams = new URLSearchParams(window.location.search)
      const tableFromUrl = urlParams.get('table')
      
      if (tableFromUrl) {
        tableInfo.value.tableNumber = parseInt(tableFromUrl)
      }
      // 如果URL沒有桌號參數，保持為null（不顯示桌號）
    }

    // 在組件掛載時初始化桌號
    initializeTable()

    // 返回所有需要的數據和方法 - Return all required data and methods
    return {
      // Data - 數據
      restaurantInfo,
      tableInfo,
      categories,
      selectedCategory,
      menuItems,
      cartItems,
      showCart,
      showOptionsDialog,
      selectedItem,
      selectedOptions,
      
      // Computed - 計算屬性
      filteredMenuItems,
      cartTotal,
      
      // Methods - 方法
      selectCategory,
      getOptionGroupLabel,
      getOptions,
      showItemOptions,
      selectOption,
      calculateItemPrice,
      addToCart,
      orderItem,
      addConfiguredItemToCart,
      updateQuantity,
      proceedToCheckout
    }
  }
}
