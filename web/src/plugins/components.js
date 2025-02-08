import BaseButton from '../components/base/BaseButton.vue'
import BaseCard from '../components/base/BaseCard.vue'
import BaseTag from '../components/base/BaseTag.vue'
import BaseTable from '../components/base/BaseTable.vue'

export default {
  install: (app) => {
    app.component('BaseButton', BaseButton)
    app.component('BaseCard', BaseCard)
    app.component('BaseTag', BaseTag)
    app.component('BaseTable', BaseTable)
  }
}
