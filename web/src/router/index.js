import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const routes = [
  // 餐廳管理員路由
  {
    path: '/merchant/login',
    name: 'MerchantLogin',
    component: () => import('../views/auth/merchant/Login.vue'),
    meta: { requiresAuth: false }
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
  const { isAuthenticated } = useAuth()
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)

  if (requiresAuth && !isAuthenticated()) {
    next({ name: 'MerchantLogin' })
  } else {
    next()
  }
})

export default router
