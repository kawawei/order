// Customer Menu Script - 客戶菜單腳本
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { menuService, orderService } from '@/services/api'
import api from '@/services/api'

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
    const categories = ref([])
    const allMenuData = ref([]) // 完整的菜單數據（包含分類和菜品）

    // 選中的分類 - Selected Category
    const selectedCategory = ref('all')

    // 菜單項目 - Menu Items
    const menuItems = ref([])

    // 加載狀態
    const loading = ref(true)
    const error = ref(null)

    // 購物車 - Shopping Cart
    const cartItems = ref([])
    const showCart = ref(false)
    
    // 從 sessionStorage 載入購物車
    const loadCartFromStorage = () => {
      try {
        const storedCart = sessionStorage.getItem('cartItems')
        if (storedCart) {
          cartItems.value = JSON.parse(storedCart)
        }
      } catch (error) {
        console.error('載入購物車失敗:', error)
        cartItems.value = []
      }
    }
    
    // 保存購物車到 sessionStorage
    const saveCartToStorage = () => {
      try {
        sessionStorage.setItem('cartItems', JSON.stringify(cartItems.value))
      } catch (error) {
        console.error('保存購物車失敗:', error)
      }
    }

    // 清空購物車
    const clearCart = () => {
      cartItems.value = []
      saveCartToStorage()
    }

    // 選項對話框 - Options Dialog
    const showOptionsDialog = ref(false)
    const selectedItem = ref(null)
    const selectedOptions = ref({})
    
    // 防止重複提交的標誌
    const isSubmitting = ref(false)

    // 選項組標籤映射 - Option Group Label Mapping
    const optionGroupLabels = {
      size: '份量',
      extra: '加料',
      sugar: '甜度',
      ice: '冰塊',
      sweetness: '甜度',  // 可能的後端甜度選項名
      iceCube: '冰塊',    // 可能的後端冰塊選項名
      '甜度': '甜度',      // 中文選項名
      '冰塊': '冰塊'       // 中文選項名
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
      
      // 根據分類ID篩選菜品（從已轉換的menuItems中篩選）
      return menuItems.value.filter(dish => dish.category === selectedCategory.value)
    })

    const cartTotal = computed(() => {
      return cartItems.value.reduce((total, item) => total + item.totalPrice, 0)
    })

    const cartTotalItems = computed(() => {
      return cartItems.value.reduce((total, item) => total + item.quantity, 0)
    })

    // 方法 - Methods
    const selectCategory = (categoryId) => {
      selectedCategory.value = categoryId
    }

    const getOptionGroupLabel = (type) => {
      return optionGroupLabels[type] || type
    }

    const getOptions = (type) => {
      // 如果有選中的菜品且該菜品有自定義選項數據
      if (selectedItem.value && selectedItem.value.customOptionsData) {
        // 找到對應類型的自定義選項
        const customOption = selectedItem.value.customOptionsData.find(opt => opt.name === type)
        if (customOption && customOption.options) {
          // 轉換自定義選項格式為前端需要的格式
          return customOption.options.map(opt => ({
            name: opt.value || opt.label,
            label: opt.label,
            price: opt.price || 0
          }))
        }
      }
      
      // 如果沒有自定義選項，使用預設選項
      return optionData[type] || []
    }

    const showItemOptions = (item) => {
      console.log('顯示菜品選項:', item)
      console.log('菜品的options:', item.options)
      console.log('菜品的customOptionsData:', item.customOptionsData)
      
      selectedItem.value = item
      selectedOptions.value = {}
      
      // 設置默認選項 - Set Default Options
      item.options.forEach(optionType => {
        console.log('處理選項類型:', optionType)
        const options = getOptions(optionType)
        console.log('獲取到的選項:', options)
        if (options.length > 0) {
          selectedOptions.value[optionType] = options.find(opt => opt.price === 0) || options[0]
        }
      })
      
      console.log('最終選中的選項:', selectedOptions.value)
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
      console.log('加入商品到購物車:', item)
      
      // 檢查購物車中是否已存在相同商品（無選項）
      const existingItemIndex = cartItems.value.findIndex(cartItem => 
        cartItem.id === item.id && !cartItem.selectedOptions
      )
      
      if (existingItemIndex !== -1) {
        // 如果已存在，增加數量
        cartItems.value[existingItemIndex].quantity += 1
        cartItems.value[existingItemIndex].totalPrice = cartItems.value[existingItemIndex].basePrice * cartItems.value[existingItemIndex].quantity
        console.log('增加現有商品數量:', cartItems.value[existingItemIndex])
      } else {
        // 如果不存在，添加新商品
        const cartItem = {
          id: item.id,
          name: item.name,
          basePrice: item.basePrice,
          quantity: 1,
          totalPrice: item.basePrice,
          selectedOptions: null
        }
        
        cartItems.value.push(cartItem)
        console.log('新增購物車商品:', cartItem)
      }
      
      // 保存到 sessionStorage
      saveCartToStorage()
      console.log('目前購物車內容:', cartItems.value)
    }

    // 新的點餐方法 - New order method
    const orderItem = (item) => {
      // 如果商品沒有選項，直接加入購物車 - If item has no options, add to cart directly
      if (!item.options || item.options.length === 0) {
        addToCart(item)
        return
      }
      
      // 如果有選項，直接顯示選項對話框 - If has options, show options dialog directly
      showItemOptions(item)
    }

    const addConfiguredItemToCart = () => {
      console.log('addConfiguredItemToCart 被調用，isSubmitting:', isSubmitting.value)
      
      // 防止重複點擊 - 立即檢查並設置
      if (isSubmitting.value) {
        console.warn('正在處理中，請勿重複點擊')
        return
      }
      
      // 立即設置為處理中狀態，防止重複調用
      isSubmitting.value = true
      console.log('設置 isSubmitting 為 true')
      
      if (!selectedItem.value) {
        console.warn('沒有選中的商品')
        isSubmitting.value = false
        return
      }
      
      // 檢查選項是否為空
      if (Object.keys(selectedOptions.value).length === 0) {
        console.warn('沒有選擇任何選項，使用默認選項')
        // 為每個選項類型設置默認選項
        if (selectedItem.value.options && selectedItem.value.customOptionsData) {
          selectedItem.value.options.forEach(optionType => {
            const options = getOptions(optionType)
            if (options && options.length > 0) {
              // 選擇第一個選項作為默認
              selectedOptions.value[optionType] = options[0]
            }
          })
        }
      }
      
      console.log('加入配置好的商品到購物車')
      console.log('選中的商品:', selectedItem.value)
      console.log('選中的選項:', selectedOptions.value)
      
      // 檢查購物車中是否已存在相同配置的商品
      const selectedOptionsString = JSON.stringify(selectedOptions.value)
      const existingItemIndex = cartItems.value.findIndex(cartItem => {
        if (cartItem.id !== selectedItem.value.id) return false
        
        // 比較選項配置
        const cartItemOptionsString = JSON.stringify(cartItem.selectedOptions || {})
        return cartItemOptionsString === selectedOptionsString
      })
      
      if (existingItemIndex !== -1) {
        // 如果已存在相同配置的商品，增加數量
        const existingItem = cartItems.value[existingItemIndex]
        existingItem.quantity += 1
        existingItem.totalPrice = calculateItemPrice() * existingItem.quantity
        console.log('增加現有商品數量:', existingItem)
      } else {
        // 如果不存在，添加新商品
        const cartItem = {
          id: selectedItem.value.id,
          name: selectedItem.value.name,
          basePrice: selectedItem.value.basePrice,
          quantity: 1,
          totalPrice: calculateItemPrice(),
          selectedOptions: { ...selectedOptions.value }
        }
        
        cartItems.value.push(cartItem)
        console.log('新增購物車商品:', cartItem)
      }
      
      // 保存到 sessionStorage
      saveCartToStorage()
      console.log('目前購物車內容:', cartItems.value)
      
      // 重置選項和關閉對話框 - Reset options and close dialog
      selectedOptions.value = {}
      showOptionsDialog.value = false
      
      // 延遲重置提交標誌，防止快速重複調用
      setTimeout(() => {
        isSubmitting.value = false
        console.log('延遲重置 isSubmitting 為 false')
      }, 500)
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
      saveCartToStorage() // 保存到 sessionStorage
    }

    // 訂單提交狀態管理
    const isOrderSubmitting = ref(false)

    const proceedToCheckout = async () => {
      console.log('proceedToCheckout 被調用，isOrderSubmitting:', isOrderSubmitting.value)
      
      // 防重複提交檢查
      if (isOrderSubmitting.value) {
        console.log('訂單正在提交中，忽略重複調用')
        return
      }

      if (cartItems.value.length === 0) {
        alert('購物車是空的')
        return
      }

      // 立即設置為提交中狀態，防止重複調用
      isOrderSubmitting.value = true
      console.log('設置 isOrderSubmitting 為 true')

      try {

        // 獲取桌子資訊
        const storedTableInfo = sessionStorage.getItem('currentTable')
        if (!storedTableInfo) {
          alert('找不到桌子資訊，請重新掃描QR碼')
          return
        }

        const tableData = JSON.parse(storedTableInfo)
        
        // 準備訂單數據
        const orderData = {
          tableId: tableData.id,
          items: cartItems.value.map(item => ({
            dishId: item.id,
            quantity: item.quantity,
            selectedOptions: item.selectedOptions || {},
            notes: item.notes || ''
          })),
          customerNotes: ''
        }

        console.log('提交訂單數據:', orderData)

        // 調用後端API創建訂單
        const response = await orderService.createOrder(orderData)
        
        if (response.status === 'success') {
          const order = response.data.order
          
          // 將訂單保存到 localStorage 以供點餐紀錄查看
          localStorage.setItem('currentOrder', JSON.stringify(order))
          
          // 清空購物車
          cartItems.value = []
          saveCartToStorage() // 清空 sessionStorage
          showCart.value = false
          
          // 顯示成功消息
          alert(`點餐成功！\n訂單編號：${order.orderNumber}\n總金額：NT$ ${order.totalAmount}\n您可以在點餐紀錄中查看詳細內容`)
          
          console.log('訂單已創建:', order)
        } else {
          throw new Error('訂單創建失敗')
        }
        
      } catch (error) {
        console.error('提交訂單失敗:', error)
        alert(`訂單提交失敗：${error.message || '請重試'}`)
      } finally {
        // 延遲重置提交狀態，防止快速重複調用
        setTimeout(() => {
          isOrderSubmitting.value = false
          console.log('延遲重置 isOrderSubmitting 為 false')
        }, 1000)
      }
    }

    // 獲取商家ID
    const getMerchantId = () => {
      try {
        const storedTableInfo = sessionStorage.getItem('currentTable')
        console.log('getMerchantId - sessionStorage currentTable:', storedTableInfo)
        
        if (storedTableInfo) {
          const tableData = JSON.parse(storedTableInfo)
          console.log('getMerchantId - 解析後的 tableData:', tableData)
          console.log('getMerchantId - merchant 對象:', tableData.merchant)
          
          const merchantId = tableData.merchant?._id || tableData.merchant?.id
          console.log('getMerchantId - 提取的 merchantId:', merchantId)
          
          return merchantId
        } else {
          console.warn('getMerchantId - sessionStorage 中沒有 currentTable 數據')
        }
      } catch (error) {
        console.error('獲取商家ID失敗:', error)
      }
      return null
    }

    // 獲取菜單數據
    const loadMenuData = async () => {
      try {
        loading.value = true
        error.value = null
        
        const merchantId = getMerchantId()
        console.log('嘗試獲取菜單，商家ID:', merchantId)
        
        if (!merchantId) {
          console.error('無法獲取商家信息，sessionStorage 內容:', {
            currentTable: sessionStorage.getItem('currentTable'),
            allKeys: Object.keys(sessionStorage)
          })
          throw new Error('無法獲取商家信息，請重新掃描QR碼或刷新頁面')
        }

        const response = await menuService.getPublicMenu(merchantId)
        
        if (response.status === 'success' && response.data?.menu) {
          allMenuData.value = response.data.menu
          
          // 構建分類列表（包含"全部"選項）
          categories.value = [
            { _id: 'all', name: 'all', label: '全部' },
            ...response.data.menu.map(category => ({
              _id: category._id,
              name: category.name,
              label: category.label || category.name
            }))
          ]
          
          // 構建所有菜品列表（用於"全部"分類）
          menuItems.value = response.data.menu.reduce((allDishes, category) => {
            const dishesWithCategory = category.dishes.map(dish => ({
              ...dish,
              id: dish._id,
              basePrice: dish.price,
              category: category._id,
              // 處理自定義選項 - 如果有後端選項就用後端的，否則用預設選項
              options: dish.customOptions?.length > 0 
                ? dish.customOptions.map(opt => opt.name)
                : ['sugar', 'ice'], // 預設為奶茶類商品提供甜度和冰塊選項
              // 保存原始的自定義選項數據以供使用
              customOptionsData: dish.customOptions || []
            }))
            return allDishes.concat(dishesWithCategory)
          }, [])
          
          console.log('菜單數據加載成功:', response.data.menu)
          // 檢查第一個菜品的自定義選項結構
          if (response.data.menu.length > 0 && response.data.menu[0].dishes.length > 0) {
            console.log('第一個菜品的customOptions:', response.data.menu[0].dishes[0].customOptions)
          }
        } else {
          throw new Error('菜單數據格式錯誤')
        }
      } catch (err) {
        console.error('加載菜單失敗:', err)
        error.value = err.message || '無法加載菜單，請稍後再試'
        
        // 如果API失敗，使用默認菜單數據
        loadDefaultMenu()
      } finally {
        loading.value = false
      }
    }

    // 加載默認菜單（備用方案）
    const loadDefaultMenu = () => {
      categories.value = [
        { _id: 'all', name: 'all', label: '全部' },
        { _id: 'main', name: 'main', label: '主餐' },
        { _id: 'side', name: 'side', label: '小菜' },
        { _id: 'drink', name: 'drink', label: '飲品' },
        { _id: 'dessert', name: 'dessert', label: '甜點' }
      ]

      menuItems.value = [
        {
          id: 1,
          _id: '1',
          name: '紅燒牛肉麵',
          description: '精選牛肉慢燉，湯頭濃郁，麵條Q彈',
          price: 180,
          basePrice: 180,
          category: 'main',
          image: null,
          options: ['size', 'extra']
        },
        {
          id: 2,
          _id: '2',
          name: '宮保雞丁',
          description: '經典川菜，香辣下飯',
          price: 120,
          basePrice: 120,
          category: 'main',
          image: null,
          options: ['extra']
        },
        {
          id: 3,
          _id: '3',
          name: '涼拌小黃瓜',
          description: '清爽開胃，夏日首選',
          price: 60,
          basePrice: 60,
          category: 'side',
          image: null,
          options: []
        },
        {
          id: 4,
          _id: '4',
          name: '珍珠奶茶',
          description: '香濃奶茶配上Q彈珍珠',
          price: 45,
          basePrice: 45,
          category: 'drink',
          image: null,
          options: ['size', 'sugar', 'ice']
        }
      ]

      allMenuData.value = [
        {
          _id: 'main',
          name: 'main',
          label: '主餐',
          dishes: menuItems.value.filter(item => item.category === 'main')
        },
        {
          _id: 'side',
          name: 'side',
          label: '小菜',
          dishes: menuItems.value.filter(item => item.category === 'side')
        },
        {
          _id: 'drink',
          name: 'drink',
          label: '飲品',
          dishes: menuItems.value.filter(item => item.category === 'drink')
        }
      ]
    }

    // 初始化桌號 - Initialize Table Number
    const initializeTable = () => {
      console.log('initializeTable - 開始初始化桌號')
      
      // 首先檢查 sessionStorage 中是否有桌次資訊（來自 QR Code 掃描）
      try {
        const storedTableInfo = sessionStorage.getItem('currentTable')
        console.log('initializeTable - sessionStorage currentTable:', storedTableInfo)
        
        if (storedTableInfo) {
          const tableData = JSON.parse(storedTableInfo)
          console.log('initializeTable - 解析後的 tableData:', tableData)
          
          tableInfo.value.tableNumber = tableData.tableNumber
          tableInfo.value.tableName = tableData.tableName || null
          tableInfo.value.capacity = tableData.capacity
          tableInfo.value.uniqueCode = tableData.uniqueCode
          
          // 更新餐廳資訊
          if (tableData.merchant) {
            console.log('initializeTable - 設置餐廳信息:', tableData.merchant)
            restaurantInfo.value.name = tableData.merchant.businessName || '餐廳'
            restaurantInfo.value.description = `${tableData.merchant.businessType || ''}` + 
              (tableData.merchant.address ? ` | ${tableData.merchant.address}` : '')
            restaurantInfo.value.phone = tableData.merchant.phone
            restaurantInfo.value.businessHours = tableData.merchant.businessHours
            
            const merchantId = tableData.merchant._id || tableData.merchant.id
            console.log('initializeTable - 返回商家ID:', merchantId)
            return merchantId
          } else {
            console.warn('initializeTable - tableData 中沒有 merchant 信息')
          }
        } else {
          console.warn('initializeTable - sessionStorage 中沒有 currentTable 數據')
        }
      } catch (error) {
        console.error('解析 sessionStorage 中的桌次資訊失敗:', error)
      }
      
      // 如果沒有 sessionStorage 資料，則從 URL 參數獲取桌號（兼容性處理）
      const urlParams = new URLSearchParams(window.location.search)
      const tableFromUrl = urlParams.get('table')
      
      if (tableFromUrl) {
        console.log('initializeTable - 從 URL 參數獲取桌號:', tableFromUrl)
        tableInfo.value.tableNumber = parseInt(tableFromUrl)
      }
      
      console.log('initializeTable - 無法獲取商家ID，返回 null')
      return null
    }

    // 檢查桌次狀態
    const checkTableStatus = async () => {
      try {
        const storedTableInfo = sessionStorage.getItem('currentTable')
        if (!storedTableInfo) return

        const tableData = JSON.parse(storedTableInfo)
        if (!tableData.uniqueCode) return

        // 調用後端 API 檢查桌次狀態
        const response = await api.get(`/tables/public/${tableData.uniqueCode}`)
        
        if (response.status === 'success') {
          const currentTableStatus = response.data.table.status
          
          // 如果桌次狀態變為可用（已被清理），清空購物車並提示
          if (currentTableStatus === 'available' && tableData.status === 'occupied') {
            clearCart()
            alert('桌次已被店家清理，購物車已清空。\n如需繼續點餐，請重新開始。')
            
            // 更新 sessionStorage 中的桌次狀態
            const updatedTableData = { ...tableData, status: 'available' }
            sessionStorage.setItem('currentTable', JSON.stringify(updatedTableData))
          }
        }
      } catch (error) {
        console.error('檢查桌次狀態失敗:', error)
        // 如果是 404 或 400 錯誤，說明桌次可能被刪除或禁用
        if (error.response?.status === 404 || error.response?.status === 400) {
          clearCart()
          alert('此桌次已被店家清理或移除，購物車已清空。')
        }
      }
    }

    // 監聽購物車顯示狀態
    watch(showCart, (newValue) => {
      if (newValue) {
        console.log('購物車被打開，當前內容:', cartItems.value)
      }
    })

    // 定時器變數
    let statusCheckInterval = null

    // 在組件掛載時初始化
    onMounted(async () => {
      // 先初始化桌號和商家信息
      const merchantId = initializeTable()
      
      // 如果沒有商家ID，嘗試從其他地方獲取或使用默認值
      if (!merchantId) {
        console.warn('無法獲取商家ID，將使用默認菜單')
        // 可以嘗試從其他來源獲取商家ID，或者直接使用默認菜單
      }
      
      loadCartFromStorage() // 載入購物車資料
      await loadMenuData()
      
      // 定期檢查桌次狀態（每30秒檢查一次）
      statusCheckInterval = setInterval(checkTableStatus, 30000)
    })

    // 組件卸載時清除定時器
    onUnmounted(() => {
      if (statusCheckInterval) {
        clearInterval(statusCheckInterval)
      }
    })

    // 返回所有需要的數據和方法 - Return all required data and methods
    return {
      // Data - 數據
      restaurantInfo,
      tableInfo,
      categories,
      selectedCategory,
      menuItems,
      allMenuData,
      cartItems,
      showCart,
      showOptionsDialog,
      selectedItem,
      selectedOptions,
      isSubmitting,
      isOrderSubmitting,
      loading,
      error,
      
      // Computed - 計算屬性
      filteredMenuItems,
      cartTotal,
      cartTotalItems,
      
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
      proceedToCheckout,
      loadMenuData
    }
  }
}
