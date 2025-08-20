// 全域權限清單（以後端實際使用的字串為準）
// 注意：這些鍵需與 requirePermissions 中各路由所使用的權限名稱一致

const PERMISSIONS = [
  // 菜單相關
  { key: '菜單:查看', label: '菜單：查看' },
  { key: '菜單:編輯', label: '菜單：編輯' },

  // 庫存相關
  { key: '庫存:查看', label: '庫存：查看' },
  { key: '庫存:編輯', label: '庫存：編輯' },

  // 訂單相關
  { key: '訂單:查看', label: '訂單：查看' },
  { key: '訂單:更新狀態', label: '訂單：更新狀態' },
  { key: '訂單:結帳', label: '訂單：結帳' },

  // 桌位相關
  { key: '桌位:查看', label: '桌位：查看' },
  { key: '桌位:管理', label: '桌位：管理' },

  // 報表與設定
  { key: '報表:查看', label: '報表：查看' },
  { key: '報表:匯出', label: '報表：匯出' },
  { key: '商家設定:編輯', label: '商家設定：編輯' },

  // 人員與角色
  { key: '員工:查看', label: '員工：查看' },
  { key: '員工:編輯', label: '員工：編輯' },
  { key: '角色:管理', label: '角色：管理' }
];

// 常見英文鍵名到後端標準鍵名的映射（兼容前端舊版）
const PERMISSION_ALIASES = {
  // menu
  'menu_view': '菜單:查看',
  'menu_manage': '菜單:編輯',

  // inventory
  'inventory_view': '庫存:查看',
  'inventory_manage': '庫存:編輯',

  // orders
  'order_view': '訂單:查看',
  'order_status_update': '訂單:更新狀態',
  'order_checkout': '訂單:結帳',
  'order_manage': '訂單:更新狀態',

  // tables
  'table_view': '桌位:查看',
  'table_manage': '桌位:管理',

  // reports & settings
  'reports_view': '報表:查看',
  'settings_manage': '商家設定:編輯',

  // people & roles
  'employee_view': '員工:查看',
  'employee_manage': '員工:編輯',
  'role_manage': '角色:管理'
};

const CANONICAL_KEYS = new Set(PERMISSIONS.map(p => p.key));

function normalizePermissionKeys(inputKeys = []) {
  const result = new Set();
  for (const rawKey of Array.isArray(inputKeys) ? inputKeys : []) {
    if (!rawKey) continue;
    const trimmed = String(rawKey).trim();
    const mapped = PERMISSION_ALIASES[trimmed] || trimmed;
    if (CANONICAL_KEYS.has(mapped)) {
      result.add(mapped);
    }
  }
  return Array.from(result);
}

module.exports = {
  PERMISSIONS,
  PERMISSION_ALIASES,
  normalizePermissionKeys
};


