// 生成10位隨機數字帳單號碼
export function generateBillNumber() {
  return Math.floor(1000000000 + Math.random() * 9000000000).toString()
}

// 格式化日期時間
export function formatDateTime(date) {
  const d = new Date(date)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  
  return `${year}/${month}/${day} ${hours}:${minutes}`
}

// 合併相同菜品和選項
export function mergeItems(items) {
  console.log('=== mergeItems 調試信息 ===');
  console.log('輸入項目:', items);
  console.log('輸入項目數量:', items.length);
  
  const merged = {}
  
  items.forEach((item, index) => {
    // 正確提取 dishId
    let dishId = null;
    
    if (item.dishId) {
      // 如果 dishId 是對象，提取其 _id
      if (typeof item.dishId === 'object' && item.dishId !== null) {
        dishId = item.dishId._id || item.dishId.id || item.dishId;
      } else {
        dishId = item.dishId;
      }
    } else if (item.id) {
      dishId = item.id;
    }
    
    // 創建更精確的項目鍵，包含所有影響價格的選項
    const optionsKey = item.selectedOptions ? 
      Object.entries(item.selectedOptions)
        .sort(([a], [b]) => a.localeCompare(b)) // 排序確保一致性
        .map(([key, value]) => {
          // 處理不同的選項值格式
          let displayValue = value;
          if (typeof value === 'object' && value !== null) {
            displayValue = value.label || value.name || value.value || JSON.stringify(value);
          }
          return `${key}:${displayValue}`;
        })
        .join('|') : '';
    
    // 使用 dishId + 選項作為唯一鍵值
    const itemKey = `${dishId}-${optionsKey}`;
    
    console.log(`項目 ${index}:`, {
      name: item.name,
      dishId: dishId,
      id: item.id,
      options: item.selectedOptions,
      optionsKey: optionsKey,
      itemKey: itemKey,
      quantity: item.quantity,
      price: item.price,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice
    });
    
    if (merged[itemKey]) {
      console.log(`合併項目: ${item.name} (key: ${itemKey})`);
      merged[itemKey].quantity += item.quantity
      merged[itemKey].totalPrice = merged[itemKey].quantity * (merged[itemKey].price || merged[itemKey].unitPrice)
    } else {
      console.log(`新增項目: ${item.name} (key: ${itemKey})`);
      merged[itemKey] = {
        ...item,
        totalPrice: item.quantity * (item.price || item.unitPrice)
      }
    }
  })
  
  const result = Object.values(merged);
  console.log('合併結果:', result);
  console.log('合併後項目數量:', result.length);
  console.log('=== mergeItems 調試完成 ===');
  
  return result;
}

// 生成收據數據
export function generateReceiptData(order, employeeId, tableNumber, storeName = '餐廳名稱', existingBillNumber = null) {
  console.log('=== 前端收據生成調試信息 ===');
  console.log('生成時間:', new Date().toISOString());
  console.log('完整訂單對象:', order); // 添加完整對象的調試
  
  // 檢查訂單對象的完整性
  if (!order) {
    console.error('訂單對象為空');
    throw new Error('訂單對象為空');
  }
  
  console.log('輸入訂單數據:', {
    orderId: order._id || order.id,
    orderNumber: order.orderNumber,
    tableNumber: tableNumber,
    totalAmount: order.totalAmount,
    itemsCount: order.items ? order.items.length : 0
  });
  
  // 如果缺少關鍵信息，記錄警告
  if (!order._id && !order.id) {
    console.warn('警告：訂單缺少ID信息');
  }
  if (!order.orderNumber) {
    console.warn('警告：訂單缺少訂單編號');
  }
  
  if (!order.items) {
    console.error('無效的訂單數據：缺少項目信息');
    throw new Error('無效的訂單數據：缺少項目信息')
  }
  
  const mergedItems = mergeItems(order.items)
  const subtotal = mergedItems.reduce((sum, item) => sum + item.totalPrice, 0)
  
  const receiptData = {
    tableNumber: tableNumber,
    billNumber: existingBillNumber || generateBillNumber(),
    employeeId: employeeId,
    checkoutTime: formatDateTime(new Date()),
    // 添加訂單關聯信息
    orderId: order._id || order.id,
    orderNumber: order.orderNumber,
    items: mergedItems.map(item => ({
      id: item.dishId || item.id,
      name: item.name,
      quantity: item.quantity,
      totalPrice: item.totalPrice,
      // 保留選項信息
      selectedOptions: item.selectedOptions || null
    })),
    subtotal: subtotal,
    total: subtotal, // 如果沒有其他費用，總計等於小計
    storeName: storeName
  };
  
  // 如果有傳入的收據號碼，優先使用
  if (existingBillNumber) {
    receiptData.billNumber = existingBillNumber;
    console.log('使用傳入的收據號碼:', existingBillNumber);
  } else {
    console.log('生成新的收據號碼:', receiptData.billNumber);
  }
  
  console.log('生成的收據數據:', {
    billNumber: receiptData.billNumber,
    tableNumber: receiptData.tableNumber,
    employeeId: receiptData.employeeId,
    subtotal: receiptData.subtotal,
    total: receiptData.total,
    itemsCount: receiptData.items.length,
    associatedOrderId: receiptData.orderId,
    associatedOrderNumber: receiptData.orderNumber
  });
  
  console.log('收據與訂單關聯信息:', {
    receiptBillNumber: receiptData.billNumber,
    associatedOrderId: receiptData.orderId,
    associatedOrderNumber: receiptData.orderNumber,
    tableNumber: tableNumber
  });
  
  console.log('=== 前端收據生成調試完成 ===');
  
  return receiptData;
}

// 從儲存的收據數據生成收據
export function generateReceiptFromStoredData(receipt) {
  console.log('=== generateReceiptFromStoredData 調試信息 ===');
  console.log('輸入收據數據:', receipt);
  
  if (!receipt) {
    console.error('無效的收據數據');
    throw new Error('無效的收據數據')
  }
  
  const result = {
    tableNumber: receipt.tableNumber || '未知桌號',
    billNumber: receipt.billNumber || '未知帳單號',
    orderNumber: receipt.orderId?.orderNumber || receipt.orderNumber || receipt.billNumber || '未知訂單號', // 優先使用 orderNumber 字段
    employeeId: receipt.employeeId || '未知員工',
    employeeName: receipt.employeeName || '',
    checkoutTime: receipt.checkoutTime ? formatDateTime(new Date(receipt.checkoutTime)) : formatDateTime(new Date()),
    items: (receipt.items || []).map(item => ({
      id: item.dishId || item.id,
      name: item.name,
      quantity: item.quantity,
      totalPrice: item.totalPrice,
      // 保留選項信息
      selectedOptions: item.selectedOptions || null
    })),
    subtotal: receipt.subtotal || 0,
    total: receipt.total || 0,
    storeName: receipt.storeName || '餐廳名稱'
  };
  
  console.log('生成的收據數據:', result);
  console.log('收據項目數量:', result.items.length);
  console.log('=== generateReceiptFromStoredData 調試完成 ===');
  
  return result;
}
