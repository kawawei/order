import { ref, computed, watch, onMounted } from 'vue'
import { inventoryService } from '@/services/api'
import { useInventoryCalculation } from '@/composables/merchant/useInventoryCalculation'

export function useAddMenuItemDialog(props, emit) {
  const dialogVisible = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
  })

  const fileInput = ref(null)
  const form = ref({
    name: '',
    basePrice: '',
    description: '',
    image: '',
    imageFile: null,
    options: [],
    baseInventory: [],
    conditionalInventory: []
  })

  // 分頁相關
  const tabs = [
    { key: 'basic', label: '基本信息' },
    { key: 'options', label: '選項設置' },
    { key: 'inventory', label: '庫存配置' }
  ]
  const currentTab = ref('basic')

  // 可用庫存列表
  const availableInventory = ref([])
  const previewOptions = ref({})
  const inventoryPreview = ref({})

  // 使用庫存計算 composable
  const { estimateDishInventoryUsage } = useInventoryCalculation()

  // 加載可用庫存
  const loadAvailableInventory = async () => {
    try {
      const response = await inventoryService.getInventory()
      if (response.status === 'success') {
        availableInventory.value = response.data.inventory || []
      }
    } catch (err) {
      console.error('加載庫存失敗:', err)
    }
  }

  // 獲取庫存單位
  const getInventoryUnit = (inventoryId) => {
    const inventory = availableInventory.value.find(inv => inv._id === inventoryId)
    return inventory ? inventory.unit : ''
  }

  // 獲取庫存名稱
  const getInventoryName = (inventoryId) => {
    const inventory = availableInventory.value.find(inv => inv._id === inventoryId)
    return inventory ? inventory.name : ''
  }

  // 獲取庫存的所有值（如：中杯、大杯）
  const getInventoryValues = (inventoryId) => {
    const inventory = availableInventory.value.find(inv => inv._id === inventoryId)
    if (!inventory) return []
    
    if (inventory.type === 'single') {
      // 單一庫存，返回一個虛擬的規格對象
      return [{
        _id: inventory._id,
        specName: inventory.name,
        quantity: inventory.singleStock.quantity,
        unit: inventory.singleStock.unit
      }]
    } else if (inventory.type === 'multiSpec' && inventory.multiSpecStock) {
      // 多規格庫存，返回所有規格
      return inventory.multiSpecStock.map(spec => ({
        _id: spec._id,
        specName: spec.specName,
        quantity: spec.quantity,
        unit: spec.unit
      }))
    }
    
    return []
  }

  // 獲取當前庫存數量
  const getCurrentStock = (inventoryValueId) => {
    // 在所有庫存中查找對應的值
    for (const inventory of availableInventory.value) {
      if (inventory.type === 'single' && inventory._id === inventoryValueId) {
        return inventory.singleStock.quantity || 0
      } else if (inventory.type === 'multiSpec' && inventory.multiSpecStock) {
        const spec = inventory.multiSpecStock.find(s => s._id === inventoryValueId)
        if (spec) {
          return spec.quantity || 0
        }
      }
    }
    return 0
  }

  // 獲取選項的選擇值
  const getOptionChoices = (optionType) => {
    const option = form.value.options.find(opt => opt.name === optionType)
    return option ? option.choices : []
  }

  // 基礎庫存變化處理
  const onBaseInventoryChange = (item) => {
    // 清空之前選擇的庫存值
    item.inventoryValueId = ''
    updateInventoryPreview()
  }

  // 基礎庫存值變化處理
  const onBaseInventoryValueChange = (item) => {
    updateInventoryPreview()
  }

  // 條件庫存變化處理
  const onConditionalInventoryChange = (item) => {
    // 清空所有條件的庫存值選擇
    item.conditions.forEach(condition => {
      condition.inventoryValueId = ''
    })
    updateInventoryPreview()
  }

  // 條件選項類型變化處理
  const onConditionOptionTypeChange = (condition, item) => {
    // 清空選項值和庫存值
    condition.optionValue = ''
    condition.inventoryValueId = ''
    updateInventoryPreview()
  }

  // 條件選項值變化處理
  const onConditionOptionValueChange = (condition, item) => {
    // 清空庫存值
    condition.inventoryValueId = ''
    updateInventoryPreview()
  }

  // 條件庫存值變化處理
  const onConditionInventoryValueChange = (condition) => {
    updateInventoryPreview()
  }

  // 添加基礎庫存
  const addBaseInventory = () => {
    form.value.baseInventory.push({
      inventoryId: '',
      inventoryValueId: '',
      quantity: 1
    })
  }

  // 添加條件庫存
  const addConditionalInventory = () => {
    form.value.conditionalInventory.push({
      inventoryId: '',
      baseQuantity: 1,
      conditions: []
    })
  }

  // 添加條件
  const addCondition = (inventoryItem) => {
    inventoryItem.conditions.push({
      optionType: '',
      optionValue: '',
      inventoryValueId: '',
      quantity: 1
    })
  }

  // 更新庫存預覽
  const updateInventoryPreview = () => {
    const preview = {}
    
    // 處理基礎庫存
    form.value.baseInventory.forEach(item => {
      if (item.inventoryId && item.inventoryValueId && item.quantity) {
        const key = `${item.inventoryId}_${item.inventoryValueId}`
        preview[key] = (preview[key] || 0) + parseFloat(item.quantity)
      }
    })
    
    // 處理條件庫存
    form.value.conditionalInventory.forEach(item => {
      if (item.inventoryId && item.baseQuantity) {
        // 檢查是否有匹配的條件
        let hasMatchingCondition = false
        
        item.conditions.forEach(condition => {
          if (condition.optionType && condition.optionValue && 
              condition.inventoryValueId && condition.quantity) {
            
            const selectedOptionValue = previewOptions.value[condition.optionType]
            if (selectedOptionValue === condition.optionValue) {
              const key = `${item.inventoryId}_${condition.inventoryValueId}`
              preview[key] = (preview[key] || 0) + parseFloat(condition.quantity)
              hasMatchingCondition = true
            }
          }
        })
        
        // 如果沒有匹配的條件，使用基礎數量
        if (!hasMatchingCondition && item.baseQuantity) {
          // 這裡需要選擇一個默認的庫存值，暫時使用第一個
          const values = getInventoryValues(item.inventoryId)
          if (values.length > 0) {
            const key = `${item.inventoryId}_${values[0]._id}`
            preview[key] = (preview[key] || 0) + parseFloat(item.baseQuantity)
          }
        }
      }
    })
    
    inventoryPreview.value = preview
  }

  // 獲取庫存顯示名稱（包含規格）
  const getInventoryDisplayName = (key) => {
    const [inventoryId, inventoryValueId] = key.split('_')
    const inventory = availableInventory.value.find(inv => inv._id === inventoryId)
    
    if (!inventory) {
      return '未知庫存'
    }
    
    if (inventory.type === 'single') {
      return inventory.name
    } else if (inventory.type === 'multiSpec') {
      const spec = inventory.multiSpecStock.find(s => s._id === inventoryValueId)
      if (spec) {
        return `${inventory.name} (${spec.specName})`
      }
    }
    
    return inventory.name
  }

  // 獲取庫存單位（包含規格）
  const getInventoryDisplayUnit = (key) => {
    const [inventoryId, inventoryValueId] = key.split('_')
    const inventory = availableInventory.value.find(inv => inv._id === inventoryId)
    
    if (!inventory) {
      return ''
    }
    
    if (inventory.type === 'single') {
      return inventory.singleStock.unit
    } else if (inventory.type === 'multiSpec') {
      const spec = inventory.multiSpecStock.find(s => s._id === inventoryValueId)
      if (spec) {
        return spec.unit
      }
    }
    
    return ''
  }

  // 觸發文件選擇
  const triggerFileInput = () => {
    fileInput.value?.click()
  }

  // 處理圖片上傳
  const handleImageUpload = (event) => {
    const file = event.target.files[0]
    if (file) {
      form.value.imageFile = file
      const reader = new FileReader()
      reader.onload = (e) => {
        form.value.image = e.target.result
      }
      reader.readAsDataURL(file)
    }
  }

  // 添加選項
  const addOption = () => {
    form.value.options.push({
      name: '',
      choices: [{ label: '', price: 0 }],
      priceEnabled: false,
      required: false
    })
  }

  // 添加選項值
  const addChoice = (option) => {
    option.choices = option.choices || []
    if (option.choices.length === 0 || option.choices[option.choices.length - 1].label) {
      option.choices.push({
        label: '',
        price: 0
      })
    }
  }

  // 移除選項值
  const removeChoice = (option, choiceIndex) => {
    option.choices.splice(choiceIndex, 1)
  }

  // 移除選項
  const removeOption = (optionIndex) => {
    form.value.options.splice(optionIndex, 1)
  }

  // 移除基礎庫存
  const removeBaseInventory = (index) => {
    form.value.baseInventory.splice(index, 1)
    updateInventoryPreview()
  }

  // 移除條件庫存
  const removeConditionalInventory = (index) => {
    form.value.conditionalInventory.splice(index, 1)
    updateInventoryPreview()
  }

  // 移除條件
  const removeCondition = (inventoryItem, conditionIndex) => {
    inventoryItem.conditions.splice(conditionIndex, 1)
    updateInventoryPreview()
  }

  // 重置表單
  const resetForm = () => {
    form.value = {
      name: '',
      basePrice: '',
      description: '',
      image: '',
      imageFile: null,
      options: [],
      baseInventory: [],
      conditionalInventory: []
    }
    previewOptions.value = {}
    inventoryPreview.value = {}
  }

  // 驗證表單
  const isValid = computed(() => {
    return form.value.name && 
           form.value.basePrice &&
           form.value.options.every(option => 
             option.name && 
             (!option.choices || option.choices.length === 0 || 
              (option.choices.length > 0 && option.choices.every(choice => choice.label))
             )
           )
  })

  // 處理確認
  const handleConfirm = () => {
    if (isValid.value) {
      // 轉換選項數據為後端期望的格式
      const transformedOptions = form.value.options.map(option => ({
        name: option.name,
        type: 'checkbox', // 默認類型
        required: false,   // 默認非必需
        options: option.choices ? option.choices
          .filter(choice => choice.label) // 過濾掉空的選項
          .map(choice => ({
            label: choice.label,
            value: choice.label, // 使用 label 作為 value
            price: option.priceEnabled ? (choice.price || 0) : 0
          })) : []
      }))

      // 轉換庫存配置數據
      const transformedInventory = {
        baseInventory: form.value.baseInventory
          .filter(item => item.inventoryId && item.inventoryValueId && item.quantity)
          .map(item => ({
            inventoryId: item.inventoryId,
            inventoryValueId: item.inventoryValueId,
            quantity: item.quantity
          })),
        conditionalInventory: form.value.conditionalInventory
          .filter(item => item.inventoryId && item.baseQuantity)
          .map(item => ({
            inventoryId: item.inventoryId,
            baseQuantity: item.baseQuantity,
            conditions: item.conditions
              .filter(cond => cond.optionType && cond.optionValue && cond.inventoryValueId)
              .map(cond => ({
                optionType: cond.optionType,
                optionValue: cond.optionValue,
                inventoryValueId: cond.inventoryValueId,
                quantity: cond.quantity || 1
              }))
          }))
      }

      emit('confirm', { 
        ...form.value,
        options: transformedOptions,
        inventoryConfig: transformedInventory
      })

      dialogVisible.value = false
    }
  }

  // 初始化編輯數據
  const initializeEditData = () => {
    if (props.editingItem) {
      // 將後端的 customOptions 轉換為前端期望的格式
      const transformedOptions = (props.editingItem.customOptions || []).map(option => ({
        name: option.name,
        priceEnabled: option.options && option.options.some(opt => opt.price > 0),
        choices: option.options ? option.options.map(opt => ({
          label: opt.label,
          price: opt.price || 0
        })) : []
      }))

      // 兼容：從 inventoryConfig 中讀取庫存配置（若存在）
      const inventoryConfig = props.editingItem.inventoryConfig || {}
      const baseInventory = inventoryConfig.baseInventory || props.editingItem.baseInventory || []
      const conditionalInventory = inventoryConfig.conditionalInventory || props.editingItem.conditionalInventory || []

      form.value = {
        name: props.editingItem.name,
        basePrice: props.editingItem.price || props.editingItem.basePrice,
        description: props.editingItem.description || '',
        image: props.editingItem.image || '',
        options: transformedOptions,
        baseInventory,
        conditionalInventory
      }
      
      // 初始化預覽選項
      transformedOptions.forEach(option => {
        if (option.choices.length > 0) {
          previewOptions.value[option.name] = option.choices[0].label
        }
      })
      
      // 更新庫存預覽
      updateInventoryPreview()
    }
  }

  // 監聽編輯項目變化
  watch(() => props.editingItem, initializeEditData, { immediate: true })

  // 監聽選項變化，更新預覽選項
  watch(() => form.value.options, (newOptions) => {
    // 清理不存在的選項
    Object.keys(previewOptions.value).forEach(key => {
      if (!newOptions.find(opt => opt.name === key)) {
        delete previewOptions.value[key]
      }
    })
    
    // 為新選項設置預設值
    newOptions.forEach(option => {
      if (!previewOptions.value[option.name] && option.choices.length > 0) {
        previewOptions.value[option.name] = option.choices[0].label
      }
    })
    
    updateInventoryPreview()
  }, { deep: true })

  // 監聽庫存配置變化，更新預覽
  watch([() => form.value.baseInventory, () => form.value.conditionalInventory], () => {
    updateInventoryPreview()
  }, { deep: true })

  // 監聽對話框的顯示狀態，當關閉時重置表單
  watch(dialogVisible, (newValue) => {
    if (!newValue && !props.editingItem) {
      resetForm()
    }
  })

  // 組件掛載時加載庫存
  onMounted(() => {
    loadAvailableInventory()
  })

  return {
    // 響應式數據
    dialogVisible,
    fileInput,
    form,
    tabs,
    currentTab,
    availableInventory,
    previewOptions,
    inventoryPreview,
    
    // 方法
    loadAvailableInventory,
    getInventoryUnit,
    getInventoryName,
    getInventoryValues,
    getCurrentStock,
    getInventoryDisplayName,
    getInventoryDisplayUnit,
    getOptionChoices,
    onBaseInventoryChange,
    onBaseInventoryValueChange,
    onConditionalInventoryChange,
    onConditionOptionTypeChange,
    onConditionOptionValueChange,
    onConditionInventoryValueChange,
    addBaseInventory,
    addConditionalInventory,
    addCondition,
    updateInventoryPreview,
    triggerFileInput,
    handleImageUpload,
    addOption,
    addChoice,
    removeChoice,
    removeOption,
    removeBaseInventory,
    removeConditionalInventory,
    removeCondition,
    resetForm,
    isValid,
    handleConfirm,
    initializeEditData
  }
}
