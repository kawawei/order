import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import Dashboard from './views/Dashboard.vue'

/* Import Font Awesome */
import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { 
  faChartLine, 
  faClipboardList, 
  faUtensils, 
  faUsers, 
  faBars, 
  faChevronLeft,
  faSort,
  faSortUp,
  faSortDown,
  faXmark,
  faClock,
  faPrint,
  faRefresh,
  faStar,
  faChair,
  faArrowTrendUp,
  faBell,
  faSignOutAlt,
  faUser,
  faCog,
  faPlus,
  faPen,
  faTrash,
  faUpload
} from '@fortawesome/free-solid-svg-icons'

/* Import Base Components */
import BaseComponents from './plugins/components'

/* Add icons to the library */
library.add(
  faChartLine, 
  faClipboardList, 
  faUtensils, 
  faUsers, 
  faBars, 
  faChevronLeft,
  faSort,
  faSortUp,
  faSortDown,
  faXmark,
  faClock,
  faPrint,
  faRefresh,
  faStar,
  faChair,
  faArrowTrendUp,
  faBell,
  faSignOutAlt,
  faUser,
  faCog,
  faPlus,
  faPen,
  faTrash,
  faUpload
)

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/dashboard'
    },
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: Dashboard
    },
    {
      path: '/menu',
      name: 'Menu',
      component: () => import('./views/Menu.vue')
    },
    {
      path: '/settings',
      name: 'Settings',
      component: () => import('./views/Settings.vue')
    }
  ]
})

const app = createApp(App)
app
  .use(router)
  .use(BaseComponents)
  .component('font-awesome-icon', FontAwesomeIcon)
  .mount('#app')
