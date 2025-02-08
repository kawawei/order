import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/merchant',
    component: () => import('../layouts/MerchantLayout.vue'),
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
  {
    path: '/',
    redirect: { name: 'MerchantDashboard' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
