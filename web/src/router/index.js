import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth'

// 靜態導入組件
import AdminLayout from '../layouts/AdminLayout.vue'
import AdminDashboard from '../views/admin/dashboard/Dashboard.vue'
import AdminLogin from '../views/auth/admin/Login.vue'
// Removed legacy users import to avoid case-sensitive duplicate and missing file

const routes = [
  // 餐廳管理員路由
  {
    path: '/merchant/login',
    name: 'MerchantLogin',
    component: () => import('../views/auth/merchant/Login.vue'),
    meta: { requiresAuth: false, role: 'merchant' }
  },
  {
    path: '/merchant/register',
    name: 'MerchantRegister',
    component: () => import('../views/auth/merchant/Register.vue'),
    meta: { requiresAuth: false, role: 'merchant' }
  },
  {
    path: '/merchant',
    component: () => import('../layouts/MerchantLayout.vue'),
    meta: { requiresAuth: true, role: 'merchant' },
    children: [
      {
        path: 'dashboard',
        name: 'MerchantDashboard',
        component: () => import('../views/merchant/dashboard/Dashboard.vue')
      },
      {
        path: 'menu',
        name: 'MerchantMenu',
        component: () => import('../views/merchant/menu/Menu.vue')
      },
      {
        path: 'tables',
        name: 'MerchantTables',
        component: () => import('../views/merchant/tables/Tables.vue')
      },
      {
        path: 'orders',
        name: 'MerchantOrders',
        component: () => import('../views/merchant/orders/Orders.vue')
      },
      {
        path: 'reports',
        name: 'MerchantReports',
        component: () => import('../views/merchant/reports/Reports.vue')
      },
      // 暫時隱藏設置頁面路由
      // {
      //   path: 'settings',
      //   name: 'MerchantSettings',
      //   component: () => import('../views/merchant/settings/Settings.vue')
      // },
      {
        path: 'inventory',
        name: 'MerchantInventory',
        component: () => import('../views/merchant/inventory/Inventory.vue')
      },
      {
        path: 'permissions',
        name: 'MerchantPermissions',
        component: () => import('../views/merchant/permissions/Permissions.vue')
      },
      {
        path: '',
        redirect: { name: 'MerchantDashboard' }
      }
    ]
  },

  // 超級管理員路由
  {
    path: '/admin/login',
    name: 'AdminLogin',
    component: AdminLogin,
    meta: { requiresAuth: false, role: 'admin' }
  },
  {
    path: '/admin',
    component: AdminLayout,
    meta: { requiresAuth: true, role: 'admin' },
    children: [
      {
        path: 'dashboard',
        name: 'AdminDashboard',
        component: AdminDashboard
      },
      {
        path: 'restaurants',
        name: 'AdminRestaurants',
        component: () => import('../views/admin/restaurants/Restaurants.vue')
      },
      {
        path: 'reports',
        name: 'AdminReports',
        component: () => import('../views/admin/reports/Reports.vue')
      },

      {
        path: '',
        redirect: { name: 'AdminDashboard' }
      }
    ]
  },

  // 桌次 QR Code 連結路由
  {
    path: '/table/:code',
    name: 'TableAccess',
    component: () => import('../views/customer/TableAccess.vue'),
    meta: { requiresTableCode: true }
  },

  // 客戶端路由（不需要登入）
  {
    path: '/customer',
    component: () => import('../layouts/CustomerLayout.vue'),
    children: [
      {
        path: 'menu',
        name: 'CustomerMenu',
        component: () => import('../views/customer/Menu.vue')
      },
      {
        path: 'orders',
        name: 'CustomerOrders',
        component: () => import('../views/customer/Orders.vue')
      },
      {
        path: '',
        redirect: { name: 'CustomerMenu' }
      }
    ]
  },
  
  // 謝謝光臨頁面（獨立路由，不使用布局）
  {
    path: '/customer/thank-you',
    name: 'CustomerThankYou',
    component: () => import('../views/customer/ThankYou.vue')
  },
  // 直接訪問 /menu 也會導向客戶點餐頁面
  {
    path: '/menu',
    redirect: { name: 'CustomerMenu' }
  },
  {
    path: '/orders',
    redirect: { name: 'CustomerOrders' }
  },
  {
    path: '/thank-you',
    redirect: { name: 'CustomerThankYou' }
  },

  // 根路由重定向
  {
    path: '/',
    redirect: { name: 'CustomerMenu' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 導航守衛
router.beforeEach((to, from, next) => {
  const { isAuthenticated, getUserRole } = useAuth()
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const routeRole = to.matched.find(record => record.meta.role)?.meta.role

  if (requiresAuth && !isAuthenticated()) {
    // 未登入時重定向到對應的登入頁面
    next({ name: routeRole === 'admin' ? 'AdminLogin' : 'MerchantLogin' })
  } else if (requiresAuth && routeRole) {
    // 驗證用戶角色
    const userRole = getUserRole()
    const isAdminRole = (role) => role === 'admin' || role === 'superadmin'
    const canAccess = (
      (routeRole === 'admin' && isAdminRole(userRole)) ||
      (routeRole === 'merchant' && (userRole === 'merchant' || userRole === 'employee' || isAdminRole(userRole)))
    )

    if (canAccess) {
      // 進一步限制商家內部員工的權限：
      // - 工作人員：僅能訪問 /merchant/orders
      if (routeRole === 'merchant') {
        try {
          const merchantRaw = localStorage.getItem('merchant_user')
          const merchantUser = merchantRaw ? JSON.parse(merchantRaw) : null
          const employeeRoleName = merchantUser?.employeeRoleName || null
          const name = String(employeeRoleName || '').trim().toLowerCase()
          const isStaff = name === '工作人員' || name === 'staff' || name === 'employee'
          if (isStaff) {
            const targetPath = to.path || ''
            const isOrdersPage = targetPath.startsWith('/merchant/orders')
            if (!isOrdersPage) {
              next({ name: 'MerchantOrders' })
              return
            }
          }
        } catch (e) {}
      }
      next()
    } else {
      // 無權訪問時重定向到對應的登入頁面
      next({ name: isAdminRole(userRole) ? 'AdminLogin' : 'MerchantLogin' })
    }
  } else {
    next()
  }
})

export default router
