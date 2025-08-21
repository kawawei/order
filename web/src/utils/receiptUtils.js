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

// 合併相同菜品
export function mergeItems(items) {
  const merged = {}
  
  items.forEach(item => {
    // 使用 dishId 或 id 作為唯一標識
    const key = item.dishId || item.id
    if (merged[key]) {
      merged[key].quantity += item.quantity
      merged[key].totalPrice = merged[key].quantity * (merged[key].price || merged[key].unitPrice)
    } else {
      merged[key] = {
        ...item,
        totalPrice: item.quantity * (item.price || item.unitPrice)
      }
    }
  })
  
  return Object.values(merged)
}

// 生成收據數據
export function generateReceiptData(order, employeeId, tableNumber, storeName = '餐廳名稱') {
  if (!order || !order.items) {
    throw new Error('無效的訂單數據')
  }
  
  const mergedItems = mergeItems(order.items)
  const subtotal = mergedItems.reduce((sum, item) => sum + item.totalPrice, 0)
  
  return {
    tableNumber: tableNumber,
    billNumber: generateBillNumber(),
    employeeId: employeeId,
    checkoutTime: formatDateTime(new Date()),
    items: mergedItems.map(item => ({
      id: item.dishId || item.id,
      name: item.name,
      quantity: item.quantity,
      totalPrice: item.totalPrice
    })),
    subtotal: subtotal,
    total: subtotal, // 如果沒有其他費用，總計等於小計
    storeName: storeName
  }
}
