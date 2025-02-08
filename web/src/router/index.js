import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth'

// 靜態導入組件
import AdminLayout from '../layouts/AdminLayout.vue'
import AdminDashboard from '../views/admin/dashboard/Dashboard.vue'
import AdminLogin from '../views/auth/admin/Login.vue'
import AdminUsers from '../views/admin/users/Users.vue'

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
        path: 'settings',
        name: 'MerchantSettings',
        component: () => import('../views/merchant/settings/Settings.vue')
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
        path: 'users',
        name: 'AdminUsers',
        component: AdminUsers
      },
      {
        path: '',
        redirect: { name: 'AdminDashboard' }
      }
    ]
  },

  // 根路由重定向
  {
    path: '/',
    redirect: { name: 'MerchantLogin' }
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
    if (userRole === routeRole) {
      next()
    } else {
      // 無權訪問時重定向到對應的登入頁面
      next({ name: userRole === 'admin' ? 'AdminLogin' : 'MerchantLogin' })
    }
  } else {
    next()
  }
})

export default router
