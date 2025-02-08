import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

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
  faEnvelope,
  faLock,
  faEye,
  faEyeSlash,
  faUpload,
  faCircleCheck,
  faCircleXmark,
  faTriangleExclamation,
  faCircleInfo,
  faShieldAlt,
  faUserShield,
  faBan,
  faKey,
  faCheck,
  faStore,
  faPhone,
  faMapMarkerAlt,
  faMapMarkedAlt
} from '@fortawesome/free-solid-svg-icons'

/* Import Base Components */
import BaseComponents from './plugins/components'

/* Add icons to the library */
library.add(
  faChartLine, 
  faClipboardList, 
  faUtensils,
  faUserShield,
  faBan,
  faKey,
  faCheck, 
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
  faUpload,
  faEnvelope,
  faLock,
  faEye,
  faEyeSlash,
  faCircleCheck,
  faCircleXmark,
  faTriangleExclamation,
  faCircleInfo,
  faShieldAlt,
  faStore,
  faPhone,
  faMapMarkerAlt,
  faMapMarkedAlt
)

const app = createApp(App)
app
  .use(router)
  .use(BaseComponents)
  .component('font-awesome-icon', FontAwesomeIcon)
  .mount('#app')
